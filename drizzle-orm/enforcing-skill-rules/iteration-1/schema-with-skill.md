# Schema Definition — With Skill

## Prompt
I'm building a PostgreSQL app with Drizzle ORM. Create a `products` table with id, name, price, category, and a metadata JSON column that stores `{ color: string; weight: number }`. Also create a `reviews` table with id, product_id (FK), rating, and comment. Show how to get TypeScript types from the schema.

## Answer

```typescript
// db/schema.ts
import {
  pgTable,
  serial,
  text,
  integer,
  json,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  category: text('category').notNull(),
  metadata: json('metadata').$type<{ color: string; weight: number }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index('reviews_product_id_idx').on(table.productId),
}));

// Infer TypeScript types from schema
type Product = typeof products.$inferSelect;
type NewProduct = typeof products.$inferInsert;

type Review = typeof reviews.$inferSelect;
type NewReview = typeof reviews.$inferInsert;
```

Key points:
- `metadata` uses `.$type<{ color: string; weight: number }>()` for compile-time type safety on the JSON column.
- `productId` uses camelCase in TypeScript but `'product_id'` (snake_case) as the actual DB column name.
- An index is defined on `reviews.productId` since it's a foreign key that will be queried frequently in joins.
- Types are inferred using `$inferSelect` (for reading) and `$inferInsert` (for writing — optional fields like `id` and `createdAt` are automatically optional).
