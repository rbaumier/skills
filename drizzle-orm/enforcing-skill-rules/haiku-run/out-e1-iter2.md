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
import { pgTable, varchar, timestamp, real, text, serial, integer, json, index, primaryKey } from 'drizzle-orm/pg-core';

interface ProductMetadata {
  sku?: string;
  weight?: number;
  dimensions?: { width: number; height: number; depth: number };
}

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  price: real('price'),
  metadata: json('metadata').$type<ProductMetadata>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
}, (t) => ({
  createdAtIdx: index('products_created_at_idx').on(t.createdAt),
}));

export type Product = typeof products.$inferSelect;
export type ProductInsert = typeof products.$inferInsert;

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  userId: integer('user_id'),
  quantity: integer('quantity'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  productIdIdx: index('orders_product_id_idx').on(t.productId),
  userIdIdx: index('orders_user_id_idx').on(t.userId),
}));

export type Order = typeof orders.$inferSelect;
export type OrderInsert = typeof orders.$inferInsert;

// queries.ts
import { db } from './db';
import { products, orders } from './schema';
import { eq, sql, gt } from 'drizzle-orm';

export async function getProductWithOrders(productId: number) {
  return await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: {
      orders: {
        columns: {
          id: true,
          quantity: true,
          createdAt: true,
        },
      },
    },
    columns: {
      id: true,
      name: true,
      price: true,
      createdAt: true,
    },
  });
}

export async function getProducts(cursor?: number) {
  return await db.select({
    id: products.id,
    name: products.name,
    price: products.price,
    createdAt: products.createdAt,
  })
    .from(products)
    .where(cursor ? gt(products.id, cursor) : undefined)
    .limit(50);
}

export async function getProductsByPage(cursor?: number) {
  return await db.select({
    id: products.id,
    name: products.name,
    price: products.price,
    createdAt: products.createdAt,
  })
    .from(products)
    .where(cursor ? gt(products.id, cursor) : undefined)
    .limit(20);
}

export async function transferStock(fromId: number, toId: number, qty: number) {
  return await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ price: sql`price - ${qty}`, updatedAt: new Date() })
      .where(eq(products.id, fromId))
      .returning();

    await tx
      .update(products)
      .set({ price: sql`price + ${qty}`, updatedAt: new Date() })
      .where(eq(products.id, toId))
      .returning();
  });
}

export async function searchProducts(userInput: string) {
  return await db.select({
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

export async function handler(event: any) {
  const pool = new Pool({
    connectionString: process.env.DB_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  const db = drizzle(pool, { schema });
  const result = await db.select({
    id: schema.products.id,
    name: schema.products.name,
    price: schema.products.price,
  }).from(schema.products).limit(50);

  await pool.end();
  return { body: JSON.stringify(result) };
}
```
