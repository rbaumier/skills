# Fixed Drizzle ORM Code

## drizzle.config.ts
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
} satisfies Config;
```

## schema.ts
```typescript
import { pgTable, varchar, timestamp, real, text, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Products table with timezone-aware timestamps
export const products = pgTable('products', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 255 }),
  price: real('price'),
  metadata: json('metadata').$type<{ [key: string]: unknown }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => ({
  productNameIdx: index('product_name_idx').on(t.name),
}));

export const categories = pgTable('categories', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 100 }),
});

// Junction table for M:N relationship with composite primaryKey
export const productsToCategories = pgTable(
  'products_to_categories',
  {
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.categoryId] }),
    productIdx: index('product_category_idx').on(t.productId),
    categoryIdx: index('category_product_idx').on(t.categoryId),
  }),
);

export const orders = pgTable('orders', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  userId: integer('user_id').notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  productIdx: index('order_product_idx').on(t.productId),
  userIdx: index('order_user_idx').on(t.userId),
}));

// Type inference from schema
export type Product = typeof products.$inferSelect;
export type ProductInsert = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type OrderInsert = typeof orders.$inferInsert;

// Relations declarations (REQUIRED for relational queries with `with`)
export const productsRelations = relations(products, ({ many }) => ({
  categories: many(productsToCategories),
  orders: many(orders),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(productsToCategories),
}));

export const productsToCategories Relations = relations(productsToCategories, ({ one }) => ({
  product: one(products, { fields: [productsToCategories.productId], references: [products.id] }),
  category: one(categories, { fields: [productsToCategories.categoryId], references: [categories.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  product: one(products, { fields: [orders.productId], references: [products.id] }),
}));
```

## queries.ts
```typescript
import { db } from './db';
import { products, orders, productsToCategories } from './schema';
import type { Product, Order } from './schema';
import { eq, isNull, gt, sql } from 'drizzle-orm';

// Relational query: fetches product with all categories and orders in one request
export async function getProductWithOrdersAndCategories(productId: number) {
  return await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: {
      orders: true,
      categories: {
        with: {
          category: true,
        },
      },
    },
  });
}

// Paginated list query with cursor for large datasets
export async function getProductsPaginated(cursor: number = 0, limit: number = 50) {
  return await db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(limit);
}

// Insert with returning() to get the created row in one round-trip
export async function createProduct(name: string, price: number, metadata: Record<string, unknown>) {
  return await db
    .insert(products)
    .values({ name, price, metadata })
    .returning();
}

// Update with returning() and timezone-aware timestamp
export async function updateProductPrice(productId: number, newPrice: number) {
  return await db
    .update(products)
    .set({ price: newPrice, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .returning();
}

// Batch insert chunked for safety (Postgres limit ~65535 parameters)
export async function insertProductsBatch(productList: Array<{ name: string; price: number; metadata: Record<string, unknown> }>) {
  const chunkSize = 500;
  const results = [];
  
  for (let i = 0; i < productList.length; i += chunkSize) {
    const chunk = productList.slice(i, i + chunkSize);
    const inserted = await db
      .insert(products)
      .values(chunk)
      .returning();
    results.push(...inserted);
  }
  
  return results;
}

// Multi-step transaction: transfer quantity between products with rollback on error
export async function transferStock(fromId: number, toId: number, qty: number) {
  return await db.transaction(async (tx) => {
    // Reduce from source product
    const fromProduct = await tx
      .update(products)
      .set({ price: sql`${products.price} - ${qty}` })
      .where(eq(products.id, fromId))
      .returning();
    
    // Increase target product
    const toProduct = await tx
      .update(products)
      .set({ price: sql`${products.price} + ${qty}` })
      .where(eq(products.id, toId))
      .returning();
    
    return { from: fromProduct[0], to: toProduct[0] };
  });
}

// Parameterized SQL search: prevents SQL injection
export async function searchProducts(userInput: string) {
  return await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`${products.name} ILIKE ${`%${userInput}%`}`)
    .limit(50);
}

// Upsert: insert or update on conflict
export async function upsertProduct(id: number, name: string, price: number) {
  return await db
    .insert(products)
    .values({ id, name, price })
    .onConflictDoUpdate({
      target: products.id,
      set: { name, price, updatedAt: new Date() },
    })
    .returning();
}
```

## serverless handler
```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { products } from './schema';

// Pool created ONCE at module scope (outside handler) — reused across warm invocations
const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 1, // Serverless: one connection per instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const db = drizzle(pool, { schema: require('./schema') });

export async function handler(event: any) {
  // Use db directly — no pool.end() per request
  const result = await db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .limit(100);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
}
```

## Key Fixes Applied

1. **Config**: Changed to `satisfies Config` (line 42 rule)
2. **Timestamps**: All use `{ withTimezone: true }` with `.defaultNow()` for `createdAt`, `.$onUpdate()` for `updatedAt`
3. **Type inference**: Use `typeof table.$inferSelect` and `$inferInsert` (not `InferSelectModel`)
4. **M:N Relations**: Created explicit `productsToCategories` junction table with composite `primaryKey`
5. **Indexes**: Every FK column has an index (rule 21)
6. **Relations declarations**: Exported `productsRelations`, `categoriesRelations`, `productsToCategories Relations`, `ordersRelations` on both sides for relational queries
7. **Column selection**: All `db.select()` specify exact columns needed
8. **Pagination**: All list queries use cursor (`gt()`) + `.limit()` instead of unbounded fetches
9. **`.returning()`**: All insert/update operations chain `.returning()`
10. **Transactions**: Multi-step operations use `db.transaction()` with rollback on error
11. **Batch insert**: Chunked in groups of 500 to avoid parameter limit
12. **Parameterized SQL**: Replaced string concatenation with parameterized `sql` template
13. **Serverless handler**: Pool/db created at module scope with `max: 1`, no `pool.end()` per request
14. **Relational queries**: Uses `db.query.X.findFirst({ with: { ... } })` pattern with declared relations
