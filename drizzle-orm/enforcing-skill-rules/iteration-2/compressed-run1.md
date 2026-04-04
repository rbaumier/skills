# Drizzle ORM Skill - Compressed Prompt Eval Run 1

## Prompt
Fix all issues in the provided drizzle config, schema, queries, and serverless handler.

## Fixed Code

### drizzle.config.ts

```typescript
// [satisfies-config] Use `satisfies Config` not `const config: Config =`
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
}) satisfies Config;
```

### schema.ts

```typescript
import { pgTable, uuid, text, timestamp, numeric, integer, jsonb, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

// --- Product type for metadata ---
type ProductMetadata = {
  weight?: number;
  dimensions?: { w: number; h: number; d: number };
  tags?: string[];
};

export const products = pgTable('products', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  // [camel-snake-mapping] camelCase TS -> snake_case DB
  name: text('name').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  // [json-typed] json('col').$type<T>() for typed JSON columns
  metadata: jsonb('metadata').$type<ProductMetadata>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// [infer-select] typeof table.$inferSelect, not InferSelectModel
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
});

export type Category = typeof categories.$inferSelect;

// [junction-table] Many-to-many via explicit junction table with composite PK
export const productCategories = pgTable('product_categories', {
  productId: uuid('product_id').notNull().references(() => products.id),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
}, (t) => [
  primaryKey({ columns: [t.productId, t.categoryId] }),
  // [fk-indexes] Indexes on FK columns
  index('idx_pc_product_id').on(t.productId),
  index('idx_pc_category_id').on(t.categoryId),
]);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  // [fk-indexes] FK columns get explicit indexes
  productId: uuid('product_id').notNull().references(() => products.id),
  userId: uuid('user_id').notNull(),
  quantity: integer('quantity').notNull(),
  // [camel-snake-mapping] created_at not createdAt in DB
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_orders_product_id').on(t.productId),
  index('idx_orders_user_id').on(t.userId),
]);

export type Order = typeof orders.$inferSelect;

// --- Relations for relational query API ---
export const productsRelations = relations(products, ({ many }) => ({
  orders: many(orders),
  productCategories: many(productCategories),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  product: one(products, { fields: [orders.productId], references: [products.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  productCategories: many(productCategories),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, { fields: [productCategories.productId], references: [products.id] }),
  category: one(categories, { fields: [productCategories.categoryId], references: [categories.id] }),
}));
```

### queries.ts

```typescript
import { db } from './db';
import { products, orders } from './schema';
import type { Product, Order } from './schema';
import { eq, gt, sql } from 'drizzle-orm';

// [relational-queries] Use db.query.X.findMany({ with: {} }) for relational queries
export async function getProductWithOrders(productId: string) {
  return await db.query.products.findFirst({
    where: eq(products.id, productId),
    // [select-columns] Only select needed columns
    columns: { id: true, name: true, price: true },
    with: {
      orders: {
        columns: { id: true, userId: true, quantity: true, createdAt: true },
      },
    },
  });
}

// [paginate-production] Production queries MUST be paginated, never fetch all rows
export async function getProducts(cursor?: string, limit = 20) {
  // [cursor-pagination] gt(id, lastSeenId) for large datasets, not OFFSET
  return await db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(cursor ? gt(products.id, cursor) : undefined)
    .orderBy(products.id)
    .limit(limit);
}

// [cursor-pagination] Replace OFFSET-based pagination
export async function getProductsByPage(lastSeenId?: string, limit = 20) {
  return await db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(lastSeenId ? gt(products.id, lastSeenId) : undefined)
    .orderBy(products.id)
    .limit(limit);
}

// [transaction] db.transaction() for ALL multi-step data modifications
export async function transferStock(fromId: string, toId: string, qty: number) {
  return await db.transaction(async (tx) => {
    await tx.update(products).set({ price: sql`price - ${qty}` }).where(eq(products.id, fromId));
    await tx.update(products).set({ price: sql`price + ${qty}` }).where(eq(products.id, toId));
  });
}

// [sql-no-concat] sql template tag for raw SQL, NEVER string concatenation (SQL injection!)
export async function searchProducts(userInput: string) {
  return await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`${products.name} ILIKE ${'%' + userInput + '%'}`);
}
```

### Serverless Handler

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { products } from './schema';

// [serverless-pool] Cache db instance OUTSIDE handler, pool max: 1
const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 1, // serverless: single connection
});
const db = drizzle(pool, { schema });

export async function handler(event: any) {
  // [paginate-production] Never fetch all rows
  // [select-columns] Select specific columns
  const result = await db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .limit(50);
  return { body: JSON.stringify(result) };
}
```

## Issues List

| # | ID | Issue | Fix |
|---|---|---|---|
| 1 | json-typed | `json('metadata')` without `.$type<T>()` | `jsonb('metadata').$type<ProductMetadata>()` |
| 2 | infer-select | `InferSelectModel<typeof products>` | `typeof products.$inferSelect` |
| 3 | camel-snake-mapping | `createdAt` maps to DB column `'createdAt'` not `'created_at'` | `timestamp('created_at', ...)` snake_case DB columns |
| 4 | fk-indexes | `productId` and `userId` FK columns have no indexes | Added `index()` on all FK columns |
| 5 | junction-table | Many-to-many via JSON array, no junction table | `productCategories` junction table with `primaryKey({ columns: [...] })` |
| 6 | relational-queries | Manual join via two separate queries | `db.query.products.findFirst({ with: { orders } })` |
| 7 | cursor-pagination | OFFSET-based pagination `offset(page * 20)` | `gt(products.id, lastSeenId)` cursor pagination |
| 8 | transaction | Two updates without transaction wrapper | `db.transaction()` wrapping both updates |
| 9 | satisfies-config | `const config: Config =` | `} satisfies Config` |
| 10 | select-columns | `select()` without specific columns | `select({ id, name, price })` |
| 11 | paginate-production | `getAllProducts` fetches all rows | Always paginated with limit |
| 12 | serverless-pool | `new Pool()` inside handler, no `max: 1` | Pool cached outside handler, `max: 1` |
| 13 | sql-no-concat | `\`SELECT * ... '%${userInput}%'\`` string interpolation (SQL injection) | `sql` template tag with parameterized value |
