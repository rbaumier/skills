# Schema Definition — Without Skill

## Prompt
I'm building a PostgreSQL app with Drizzle ORM. Create a `products` table with id, name, price, category, and a metadata JSON column that stores `{ color: string; weight: number }`. Also create a `reviews` table with id, product_id (FK), rating, and comment. Show how to get TypeScript types from the schema.

## Answer

```typescript
import { pgTable, serial, text, integer, json } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  category: text('category').notNull(),
  metadata: json('metadata'),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull().references(() => products.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
});

// Types
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

type Product = InferSelectModel<typeof products>;
type NewProduct = InferInsertModel<typeof products>;

type Review = InferSelectModel<typeof reviews>;
type NewReview = InferInsertModel<typeof reviews>;
```

This gives you a basic schema. The `json` column stores arbitrary JSON. You can query products and reviews using Drizzle's select/insert/update/delete methods.
