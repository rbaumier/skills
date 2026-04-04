# Refactored Drizzle ORM Code

## Issues Found and Fixed

| # | Issue | Skill Rule Violated | Fix |
|---|-------|---------------------|-----|
| 1 | `const config: Config =` instead of `satisfies Config` | Migrations: `} satisfies Config` not `const config: Config =` | Use `satisfies Config` |
| 2 | `InferSelectModel` import instead of `$inferSelect` | Schema: `typeof table.$inferSelect` and `$inferInsert` for types | Use `$inferSelect` |
| 3 | `json('metadata')` untyped | Schema: `json('col').$type<T>()` for typed JSON columns | Add `.$type<ProductMetadata>()` |
| 4 | `createdAt` column name not snake_case in DB | Schema: camelCase TS properties, snake_case DB columns | `timestamp('created_at')` |
| 5 | No indexes on FKs or queried columns | Schema: Define indexes on FKs and frequently queried columns | Add indexes on `orders.productId`, `orders.userId`, `products.name` |
| 6 | Many-to-many via JSON array, no junction table | Relations: explicit junction table with `primaryKey({ columns: [t.aId, t.bId] })` | Add `productCategories` junction table |
| 7 | Manual join (two queries) for product+orders | Relations: Use `db.query.X.findMany({ with: { ... } })` for relational queries | Use relational query API |
| 8 | OFFSET-based pagination | Queries: Cursor pagination `gt(t.id, lastSeenId)` for large datasets | Use cursor pagination with `gt(t.id, cursor)` |
| 9 | `transferStock` not wrapped in transaction | Transactions: `db.transaction()` for ALL multi-step data modifications | Wrap in `db.transaction()` |
| 10 | `searchProducts` uses string concatenation (SQL injection) | General: `sql` template tag for raw SQL, never string concatenation | Use `like()` operator from drizzle-orm |
| 11 | `select()` fetches all columns | Performance: Select specific columns for large tables | Select only needed columns |
| 12 | `getAllProducts` fetches all rows without pagination | Performance: Paginate production queries; never fetch all rows | Remove or add pagination |
| 13 | Serverless handler creates new db/pool inside handler | Performance: Serverless: cache db instance outside handler, `pool max: 1` | Cache outside handler, `max: 1` |
| 14 | No `relations()` definitions | Relations: `relations()` with `one`/`many` | Add relations definitions |
| 15 | `transferStock` modifies `price` when it should modify a `stock` column | Logical bug | Fix column semantics (add `stock` column) |
| 16 | Handler shadows `products` variable name | Bug: variable shadowing | Rename to `allProducts` |

---

## Refactored Code

### `drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
} satisfies Config;
```

### `schema.ts`

```typescript
import { pgTable, varchar, timestamp, real, text, serial, integer, jsonb, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// -- Types --

interface ProductMetadata {
  tags?: string[];
  sku?: string;
  weight?: number;
}

// -- Tables --

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  price: real('price').notNull(),
  stock: integer('stock').notNull().default(0),
  metadata: jsonb('metadata').$type<ProductMetadata>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('products_name_idx').on(t.name),
]);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});

export type Category = typeof categories.$inferSelect;

// Junction table for many-to-many: products <-> categories
export const productCategories = pgTable('product_categories', {
  productId: integer('product_id').notNull().references(() => products.id),
  categoryId: integer('category_id').notNull().references(() => categories.id),
}, (t) => [
  primaryKey({ columns: [t.productId, t.categoryId] }),
]);

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  userId: integer('user_id').notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('orders_product_id_idx').on(t.productId),
  index('orders_user_id_idx').on(t.userId),
]);

export type Order = typeof orders.$inferSelect;

// -- Relations --

export const productsRelations = relations(products, ({ many }) => ({
  orders: many(orders),
  productCategories: many(productCategories),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  productCategories: many(productCategories),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
}));
```

### `db.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Cached pool for serverless — reused across handler invocations.
// max: 1 keeps connection count low in serverless environments.
const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 1,
});

export const db = drizzle(pool, { schema });
```

### `queries.ts`

```typescript
import { db } from './db';
import { products, orders } from './schema';
import { eq, gt, like } from 'drizzle-orm';

// Relational query: fetches product with its orders in a single call.
export async function getProductWithOrders(productId: number) {
  return db.query.products.findFirst({
    columns: { id: true, name: true, price: true, stock: true, createdAt: true },
    where: eq(products.id, productId),
    with: {
      orders: true,
    },
  });
}

// Cursor-based pagination: pass the last seen product ID (0 for first page).
export async function getProducts(cursor: number, limit = 20) {
  return db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(limit)
    .orderBy(products.id);
}

// Atomic stock transfer — wrapped in a transaction so both updates
// succeed or both roll back. No partial writes.
export async function transferStock(fromId: number, toId: number, qty: number) {
  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${qty}` })
      .where(eq(products.id, fromId));
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${qty}` })
      .where(eq(products.id, toId));
  });
}

// Safe search: uses parameterized `like` operator, no SQL injection risk.
export async function searchProducts(userInput: string) {
  return db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(like(products.name, `%${userInput}%`));
}
```

> **Note:** `sql` was referenced in `transferStock` above. Add the import:

```typescript
import { eq, gt, like, sql } from 'drizzle-orm';
```

### `handler.ts`

```typescript
import { db } from './db';
import { products } from './schema';
import { gt } from 'drizzle-orm';

// Serverless handler.
// The db instance is cached in db.ts (outside the handler) with pool max: 1.
export async function handler(event: { cursor?: number }) {
  const cursor = event.cursor ?? 0;

  // Always paginate — never fetch all rows in production.
  const rows = await db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(20)
    .orderBy(products.id);

  return { body: JSON.stringify(rows) };
}
```
