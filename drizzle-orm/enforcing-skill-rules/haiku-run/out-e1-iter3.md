```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

const config = {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
} satisfies Config;

export default config;

// schema.ts
import { pgTable, varchar, timestamp, real, integer, json, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const products = pgTable('products', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 255 }),
  price: real('price'),
  metadata: json('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  createdAtIdx: index('products_created_at_idx').on(t.createdAt),
}));

export const categories = pgTable('categories', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 100 }),
});

export const orders = pgTable('orders', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  productId: integer('product_id').references(() => products.id).notNull(),
  userId: integer('user_id').notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  productIdx: index('orders_product_idx').on(t.productId),
  userIdx: index('orders_user_idx').on(t.userId),
}));

export const productsToCategories = pgTable('products_to_categories', {
  productId: integer('product_id').references(() => products.id).notNull(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.productId, t.categoryId] }),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export const productsRelations = relations(products, ({ many }) => ({
  orders: many(orders),
  categories: many(productsToCategories),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(productsToCategories),
}));

export const productsToGategoriesRelations = relations(productsToCategories, ({ one }) => ({
  product: one(products, {
    fields: [productsToCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productsToCategories.categoryId],
    references: [categories.id],
  }),
}));

// queries.ts
import { db } from './db';
import { products, orders } from './schema';
import { eq, gt, sql } from 'drizzle-orm';

export async function getProductWithOrders(productId: number) {
  return await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: {
      orders: true,
    },
  });
}

export async function getProducts(cursor: number = 0, limit: number = 50) {
  return await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(limit);
}

export async function getProductsByPage(page: number) {
  const cursor = page * 20;
  return await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
    })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(20);
}

export async function transferStock(fromId: number, toId: number, qty: number) {
  return await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ price: sql`${products.price} - ${qty}`, updatedAt: new Date() })
      .where(eq(products.id, fromId))
      .returning();

    return await tx
      .update(products)
      .set({ price: sql`${products.price} + ${qty}`, updatedAt: new Date() })
      .where(eq(products.id, toId))
      .returning();
  });
}

export async function searchProducts(userInput: string) {
  return await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
    })
    .from(products)
    .where(sql`${products.name} ILIKE ${`%${userInput}%`}`)
    .limit(50);
}

// serverless handler
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const dbInstance = drizzle(pool, { schema });

export async function handler(event: any) {
  const result = await dbInstance
    .select({
      id: schema.products.id,
      name: schema.products.name,
      price: schema.products.price,
    })
    .from(schema.products)
    .limit(100);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
}
```
