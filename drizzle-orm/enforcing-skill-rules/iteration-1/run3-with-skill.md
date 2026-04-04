# Refactored Drizzle ORM Code

## Issues Found & Fixed

| # | Issue | Rule Violated | Fix |
|---|-------|--------------|-----|
| 1 | `const config: Config =` | Migrations: `} satisfies Config` not `const config: Config =` | Use `satisfies Config` |
| 2 | `InferSelectModel` import | Schema: `$inferSelect` / `$inferInsert`, not `InferSelectModel` | Use `typeof products.$inferSelect` |
| 3 | `json('metadata')` untyped | Schema: `json('col').$type<T>()` for typed JSON | Added `$type<ProductMetadata>()` |
| 4 | `createdAt` column name not snake_case in DB | Schema: camelCase TS, snake_case DB columns | `timestamp('created_at')` |
| 5 | No indexes on FKs / queried columns | Schema: indexes on FKs and frequently queried columns | Added indexes on `orders.productId`, `orders.userId` |
| 6 | No relations defined | Relations: use `relations()` with `one`/`many` | Added `productsRelations`, `ordersRelations` |
| 7 | Manual joins in `getProductWithOrders` | Relations: use `db.query.X.findMany({ with })` | Relational query with `with: { orders: true }` |
| 8 | `getAllProducts` fetches all rows | Performance: paginate production queries, never fetch all rows | Cursor pagination with limit |
| 9 | `select()` fetches all columns | Performance: select specific columns for large tables | Select only needed columns |
| 10 | OFFSET pagination | Queries: cursor `gt(t.id, lastSeenId)`, not OFFSET | Cursor-based pagination |
| 11 | `transferStock` two updates without transaction | Transactions: `db.transaction()` for ALL multi-step modifications | Wrapped in `db.transaction()` |
| 12 | SQL injection in `searchProducts` | General: `sql` template tag, never string concatenation | Use `like()` operator from drizzle-orm |
| 13 | Serverless handler creates new Pool each call | Performance: cache db outside handler, `pool max: 1` | Hoisted db + `max: 1` |

---

## `drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
}) satisfies Config;
```

## `schema.ts`

```typescript
import { pgTable, uuid, varchar, timestamp, real, text, serial, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// -- Types ------------------------------------------------------------------

/** Typed metadata for the products JSON column. */
export type ProductMetadata = {
  tags?: string[];
  weight?: number;
  dimensions?: { w: number; h: number; d: number };
};

// -- Tables -----------------------------------------------------------------

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  price: real('price').notNull(),
  metadata: jsonb('metadata').$type<ProductMetadata>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});

export type Category = typeof categories.$inferSelect;

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id)
      .notNull(),
    userId: integer('user_id').notNull(),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('orders_product_id_idx').on(t.productId),
    index('orders_user_id_idx').on(t.userId),
  ],
);

export type Order = typeof orders.$inferSelect;

// -- Relations --------------------------------------------------------------

export const productsRelations = relations(products, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
}));
```

## `db.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Cached pool + db instance.
 * Serverless: max 1 connection to avoid exhausting the pool.
 */
const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 1,
});

export const db = drizzle(pool, { schema });
```

## `queries.ts`

```typescript
import { eq, gt, like, sql } from 'drizzle-orm';
import { db } from './db';
import { products, orders } from './schema';
import type { Product } from './schema';

/**
 * Fetch a single product with its related orders via relational query.
 */
export async function getProductWithOrders(productId: number) {
  // Relational query — no manual join needed
  const result = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: { orders: true },
  });

  return result ?? null;
}

/**
 * Cursor-paginated product list. Returns `pageSize` rows after `cursor`.
 * Pass `cursor = 0` (or omit) for the first page.
 */
export async function getProducts(cursor: number = 0, pageSize: number = 20) {
  return db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(pageSize)
    .orderBy(products.id);
}

/**
 * Transfer stock quantity between two products atomically.
 * Wrapped in a transaction — rolls back automatically on error.
 */
export async function transferStock(fromId: number, toId: number, qty: number) {
  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ price: sql`${products.price} - ${qty}` })
      .where(eq(products.id, fromId));

    await tx
      .update(products)
      .set({ price: sql`${products.price} + ${qty}` })
      .where(eq(products.id, toId));
  });
}

/**
 * Safe search — uses the `like` operator, no string concatenation.
 */
export async function searchProducts(userInput: string) {
  return db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(like(products.name, `%${userInput}%`));
}

/**
 * Serverless handler — reuses the cached db instance from db.ts.
 */
export async function handler(event: unknown) {
  const results = await db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .limit(50);

  return { body: JSON.stringify(results) };
}
```
