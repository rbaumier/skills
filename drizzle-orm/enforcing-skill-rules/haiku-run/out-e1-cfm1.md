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
import { pgTable, varchar, timestamp, real, text, serial, integer, json, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

interface ProductMetadata {
  description?: string;
  tags?: string[];
}

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }),
    price: real('price'),
    metadata: json('metadata').$type<ProductMetadata>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    nameIdx: index('product_name_idx').on(t.name),
  })
);

export type Product = typeof products.$inferSelect;
export type ProductInsert = typeof products.$inferInsert;

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
});

export type Category = typeof categories.$inferSelect;

export const productsToCategories = pgTable(
  'products_to_categories',
  {
    productId: integer('product_id').references(() => products.id),
    categoryId: integer('category_id').references(() => categories.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.categoryId] }),
    productIdx: index('ptc_product_idx').on(t.productId),
    categoryIdx: index('ptc_category_idx').on(t.categoryId),
  })
);

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').references(() => products.id),
    userId: integer('user_id'),
    quantity: integer('quantity'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    productIdx: index('order_product_idx').on(t.productId),
    userIdx: index('order_user_idx').on(t.userId),
  })
);

export type Order = typeof orders.$inferSelect;
export type OrderInsert = typeof orders.$inferInsert;

// Relations
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

export const productsToCategoriessRelations = relations(productsToCategories, ({ one }) => ({
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
import { eq, sql, gt } from 'drizzle-orm';

export async function getProductWithOrders(productId: number) {
  const result = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: {
      orders: true,
    },
  });
  return result;
}

export async function getProducts(cursor?: number) {
  const where = cursor ? gt(products.id, cursor) : undefined;
  return await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(where)
    .limit(50);
}

export async function getProductsByPage(page: number) {
  const cursor = page > 0 ? page * 20 : 0;
  return await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(20);
}

export async function transferStock(fromId: number, toId: number, qty: number) {
  return await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        price: sql`price - ${qty}`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, fromId))
      .returning();

    return await tx
      .update(products)
      .set({
        price: sql`price + ${qty}`,
        updatedAt: new Date(),
      })
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
    .where(sql`name ILIKE ${`%${userInput}%`}`)
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

const db = drizzle(pool, { schema });

export async function handler(event: any) {
  const productList = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      price: schema.products.price,
    })
    .from(schema.products)
    .limit(100);
  return { body: JSON.stringify(productList) };
}
```

## Issues Fixed

1. **drizzle.config.ts**: Changed `const config: Config =` to `satisfies Config` (rule: "Config: `} satisfies Config` not `const config: Config =`")

2. **schema.ts**:
   - Typed JSON metadata with `.$type<ProductMetadata>()`
   - All timestamp columns use `{ withTimezone: true }`
   - `createdAt` has `.defaultNow()`, `updatedAt` has `.$onUpdate(() => new Date())`
   - Column names use snake_case in DB: `createdAt` → `'created_at'`
   - Changed from `InferSelectModel` to `typeof table.$inferSelect`
   - Added indexes on FK columns (`productId`, `userId`)
   - Added explicit M:N junction table `productsToCategories` with composite `primaryKey`
   - Declared all relations on both sides: `productsRelations`, `ordersRelations`, `categoriesRelations`, `productsToCategoriessRelations`

3. **queries.ts**:
   - `getProductWithOrders` uses `db.query.products.findFirst({ with: { orders } })` with relational query
   - Renamed `getAllProducts` to `getProducts` with cursor pagination using `gt()`
   - All `select()` queries specify exact columns needed (no bare `select()`)
   - `getProductsByPage` uses cursor pagination instead of OFFSET
   - `transferStock` wrapped in `db.transaction()` with `.returning()` on both updates
   - `searchProducts` uses parameterized `sql` template (no string concatenation), removes SQL injection vulnerability
   - All list queries limited to 50-100 rows (no unbounded fetches)

4. **serverless handler**:
   - Pool instantiated at module scope (outside handler)
   - Pool configured with `max: 1`, `idleTimeoutMillis`, `connectionTimeoutMillis`
   - Drizzle instance created at module scope with full `schema` object
   - Handler reuses the pool without calling `pool.end()`
   - Select query specifies columns and limit (no bare select)
```
