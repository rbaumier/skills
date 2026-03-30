# Drizzle ORM — Without Skill

## Prompt
Set up Drizzle ORM schema for users table with id, name, email, role, timestamps. Show schema definition, type generation, primary key setup, constraints/indexes. Should CLI-generated output be used as-is?

## Response

### 1. Schema Definition

```typescript
import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 2. Type Generation

You can infer types from the schema:

```typescript
import type { InferModel } from 'drizzle-orm';

type User = InferModel<typeof users>;
type NewUser = InferModel<typeof users, 'insert'>;
```

### 3. Primary Key

Using `serial` auto-increments the ID. You could also use UUID:

```typescript
import { uuid } from 'drizzle-orm/pg-core';

id: uuid('id').defaultRandom().primaryKey(),
```

### 4. Adding Indexes

```typescript
import { index } from 'drizzle-orm/pg-core';

// Add to the table definition
export const users = pgTable('users', {
  // ... columns
}, (table) => ({
  emailIdx: index('email_idx').on(table.email),
}));
```

### 5. CLI Output

`drizzle-kit generate` creates migration files based on your schema changes. The output is generally reliable and can be used directly. Just review the SQL it generates to make sure it matches your expectations.

### Notes
- Run `drizzle-kit push` for development, `drizzle-kit generate` + `drizzle-kit migrate` for production
- Drizzle supports both query builder and raw SQL
