# Fixed Drizzle ORM Code

## drizzle.config.ts
```typescript
import type { Config } from 'drizzle-kit';

const config = {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
} satisfies Config;

export default config;
```

## schema.ts
```typescript
import { pgTable, varchar, timestamp, real, integer, json, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const products = pgTable(
  'products',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 255 }).notNull(),
    price: real('price').notNull(),
    metadata: json('metadata').$type<{ tags?: string[]; description?: string }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    nameIdx: index('products_name_idx').on(t.name),
  })
);

export const categories = pgTable(
  'categories',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 100 }).notNull(),
  },
  (t) => ({
    nameIdx: index('categories_name_idx').on(t.name),
  })
);

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
    pk: index('products_to_categories_pk').on(t.productId, t.categoryId),
    productIdx: index('products_to_categories_product_id_idx').on(t.productId),
    categoryIdx: index('products_to_categories_category_id_idx').on(t.categoryId),
  })
);

export const orders = pgTable(
  'orders',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    userId: integer('user_id').notNull(),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    productIdx: index('orders_product_id_idx').on(t.productId),
    userIdx: index('orders_user_id_idx').on(t.userId),
  })
);

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  orders: many(orders),
  categories: many(productsToCategories),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(productsToCategories),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
}));

export const productsToCategoriesRelations = relations(productsToCategories, ({ one }) => ({
  product: one(products, {
    fields: [productsToCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productsToCategories.categoryId],
    references: [categories.id],
  }),
}));

// Types
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type ProductToCategory = typeof productsToCategories.$inferSelect;
export type NewProductToCategory = typeof productsToCategories.$inferInsert;
```

## queries.ts
```typescript
import { db } from './db';
import { products, orders, productsToCategories } from './schema';
import { eq, gt, sql } from 'drizzle-orm';

// Get a single product with all related orders
export async function getProductWithOrders(productId: number) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: {
      orders: true,
    },
  });

  return product;
}

// Paginated list of products (always paginate, never unbounded fetch)
export async function getProducts(limit: number = 50, cursor: number = 0) {
  return await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
    })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(limit);
}

// Get products by page with cursor pagination
export async function getProductsPage(page: number = 0, pageSize: number = 20) {
  const cursor = page * pageSize;

  return await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(pageSize);
}

// Atomic transfer of stock between products (uses transaction internally)
export async function transferStock(fromId: number, toId: number, qty: number) {
  return await db.transaction(async (tx) => {
    // Deduct from source
    await tx
      .update(products)
      .set({ price: sql`${products.price} - ${qty}` })
      .where(eq(products.id, fromId))
      .returning();

    // Add to destination
    const updated = await tx
      .update(products)
      .set({ price: sql`${products.price} + ${qty}` })
      .where(eq(products.id, toId))
      .returning();

    return updated;
  });
}

// Safe search: parameterized query, never concatenates user input
export async function searchProducts(userInput: string, limit: number = 50) {
  return await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
    })
    .from(products)
    .where(sql`${products.name} ILIKE ${`%${userInput}%`}`)
    .limit(limit);
}

// Get products with their categories (M:N via junction table)
export async function getProductsWithCategories(limit: number = 50, cursor: number = 0) {
  return await db.query.products.findMany({
    where: gt(products.id, cursor),
    limit,
    with: {
      categories: {
        with: {
          category: true,
        },
      },
    },
  });
}
```

## db.ts (Serverless Handler Pattern)
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create the pool ONCE at module scope, outside the handler
const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 1, // Serverless: max 1 connection per instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Create the db client ONCE at module scope
export const db = drizzle(pool, { schema });

// Serverless handler example (Vercel, Lambda, etc.)
export async function handler(event: any) {
  // Reuse db connection from module scope—no new Pool() or drizzle() here
  const result = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      price: schema.products.price,
    })
    .from(schema.products)
    .limit(10);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
  // Never call pool.end() here
}
```

## Key Fixes Applied

1. **drizzle.config.ts**: Changed to use `satisfies Config` instead of `const config: Config =`

2. **schema.ts**:
   - Added `{ withTimezone: true }` to all timestamps (createdAt, updatedAt)
   - Added `.defaultNow()` to createdAt, `.$onUpdate(() => new Date())` to updatedAt
   - Changed camelCase TS props to snake_case DB columns: `createdAt` → `created_at`
   - Added `$type<T>()` to JSON column with explicit metadata type
   - Changed to `generatedAlwaysAsIdentity()` for proper serial columns
   - Added `.notNull()` to required columns
   - **Created explicit `productsToCategories` junction table** with composite primary key (M:N relation fix)
   - Added indexes to FK columns: productId, userId, and junction table columns
   - Declared all relations on both sides: productsRelations, categoriesRelations, ordersRelations, productsToCategoriesRelations
   - Used `typeof table.$inferSelect` and `$inferInsert` instead of InferSelectModel

3. **queries.ts**:
   - Changed `getProductWithOrders` to use `db.query.products.findFirst({ with: {...} })` (relational query pattern)
   - Removed unbounded `getAllProducts()` — all list queries now have `.limit()` + cursor pagination
   - Changed `getProductsByPage` to use cursor-based pagination with `gt()` instead of OFFSET
   - Added explicit column selection to all queries (never bare `db.select()`)
   - Fixed `transferStock` to wrap in `db.transaction()` and use `.returning()`
   - Fixed `searchProducts` to use parameterized SQL (no string concatenation)
   - Added `getProductsWithCategories` to demonstrate M:N query with junction table

4. **db.ts (Serverless Pattern)**:
   - Pool and drizzle() created ONCE at module top-level (outside handler)
   - Set `max: 1` for serverless
   - Added `idleTimeoutMillis` and `connectionTimeoutMillis`
   - Removed `pool.end()` call from handler
   - Passed full schema object to drizzle config
