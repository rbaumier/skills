# Refactored Drizzle ORM Code

## Issues Found & Fixed

1. **Config**: `const config: Config =` changed to `} satisfies Config` (Migrations rule)
2. **Schema types**: `InferSelectModel` replaced with `typeof table.$inferSelect` / `$inferInsert` (Schema rule)
3. **Column naming**: `createdAt` DB column changed to `created_at` — camelCase TS, snake_case DB (Schema rule)
4. **JSON typing**: `json('metadata')` changed to `jsonb('metadata').$type<T>()` with explicit type (Schema rule)
5. **Many-to-many**: JSON array replaced with explicit junction table `productCategories` with composite PK (Relations rule)
6. **Relations**: Added `relations()` definitions for relational queries (Relations rule)
7. **Manual join replaced**: `getProductWithOrders` uses `db.query.products.findFirst({ with: { orders } })` (Relations rule)
8. **Pagination**: OFFSET pagination replaced with cursor-based `gt(t.id, cursor)` (Queries rule)
9. **Transaction**: `transferStock` wrapped in `db.transaction()` (Transactions rule)
10. **SQL injection**: `searchProducts` raw string concatenation replaced with `sql` template tag + `like()` (General rule)
11. **Select columns**: `getAllProducts` and pagination select specific columns, not `select()` (Performance rule)
12. **Serverless handler**: DB instance cached outside handler, pool `max: 1` (Performance rule)
13. **Indexes**: Added indexes on FKs and queried columns (Schema rule)
14. **Missing imports**: All imports explicit
15. **Variable shadowing**: `handler` no longer shadows `products` table with local `products` variable

---

## `drizzle.config.ts`

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
} satisfies Config;
```

## `schema.ts`

```typescript
import {
  pgTable,
  varchar,
  timestamp,
  real,
  text,
  serial,
  integer,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -- Types ------------------------------------------------------------------

export type ProductMetadata = {
  brand?: string;
  tags?: string[];
  weight?: number;
};

// -- Tables -----------------------------------------------------------------

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    price: real("price").notNull(),
    metadata: jsonb("metadata").$type<ProductMetadata>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("products_name_idx").on(t.name)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
});

export type Category = typeof categories.$inferSelect;

// Junction table for many-to-many products <-> categories
export const productCategories = pgTable(
  "product_categories",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    index("product_categories_product_id_idx").on(t.productId),
    index("product_categories_category_id_idx").on(t.categoryId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    userId: integer("user_id").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("orders_product_id_idx").on(t.productId),
    index("orders_user_id_idx").on(t.userId),
  ],
);

export type Order = typeof orders.$inferSelect;

// -- Relations --------------------------------------------------------------

export const productsRelations = relations(products, ({ many }) => ({
  orders: many(orders),
  productCategories: many(productCategories),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  productCategories: many(productCategories),
}));

export const productCategoriesRelations = relations(
  productCategories,
  ({ one }) => ({
    product: one(products, {
      fields: [productCategories.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [productCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ one }) => ({
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
}));
```

## `db.ts`

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Cached pool — reused across serverless invocations.
// max: 1 keeps connection overhead minimal in Lambda/Edge.
const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 1,
});

export const db = drizzle(pool, { schema });
```

## `queries.ts`

```typescript
import { eq, gt, like, sql } from "drizzle-orm";
import { db } from "./db";
import { products, orders } from "./schema";

/**
 * Fetch a single product with its orders using relational query API.
 */
export async function getProductWithOrders(productId: number) {
  // Uses relational queries — no manual join needed
  const result = await db.query.products.findFirst({
    columns: { id: true, name: true, price: true, createdAt: true },
    where: eq(products.id, productId),
    with: {
      orders: true,
    },
  });

  return result ?? null;
}

/**
 * Select specific columns to avoid pulling metadata/large fields.
 */
export async function getAllProducts() {
  return db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products);
}

/**
 * Cursor-based pagination — stable, performant on large tables.
 * Pass the last seen `id` from the previous page (0 for the first page).
 */
export async function getProductsByPage(cursor: number, pageSize = 20) {
  return db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(gt(products.id, cursor))
    .limit(pageSize)
    .orderBy(products.id);
}

/**
 * Atomic stock transfer — both updates succeed or neither does.
 */
export async function transferStock(
  fromId: number,
  toId: number,
  qty: number,
) {
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
 * Safe search — uses parameterized `like()`, no SQL injection.
 */
export async function searchProducts(userInput: string) {
  return db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products)
    .where(like(products.name, `%${userInput}%`));
}

/**
 * Serverless handler — reuses the cached db/pool from db.ts.
 */
export async function handler() {
  const rows = await db
    .select({ id: products.id, name: products.name, price: products.price })
    .from(products);

  return { body: JSON.stringify(rows) };
}
```
