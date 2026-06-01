```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
} satisfies Config;

// schema.ts
import { pgTable, uuid, varchar, timestamp, real, text, serial, integer, json } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  price: real('price'),
  metadata: json('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Product = typeof products.$inferSelect;

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
});

// db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DB_URL });
export const db = drizzle(pool, { schema });

// queries.ts
import { db } from './db';
import { products, orders } from './schema';
import { eq, sql, gt } from 'drizzle-orm';

export async function getProductWithOrders(productId: number) {
  return await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: {
      orders: true,
    },
  });
}

export async function getAllProducts() {
  return await db.select().from(products);
}

export async function getProductsByPage(lastSeenId: number | null) {
  const query = db.select().from(products).limit(20);
  if (lastSeenId !== null) {
    return await query.where(gt(products.id, lastSeenId));
  }
  return await query;
}

export async function transferStock(fromId: number, toId: number, qty: number) {
  await db.transaction(async (tx) => {
    await tx.update(products).set({ price: sql`price - ${qty}` }).where(eq(products.id, fromId)).returning();
    await tx.update(products).set({ price: sql`price + ${qty}` }).where(eq(products.id, toId)).returning();
  });
}

export async function searchProducts(userInput: string) {
  return await db.select().from(products).where(sql`name ILIKE ${userInput}`);
}

// serverless handler
export async function handler(event: any) {
  const productList = await db.select().from(products);
  return { body: JSON.stringify(productList) };
}
```
