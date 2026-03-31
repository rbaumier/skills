# Migrations & Config — With Skill

## Prompt
I'm setting up Drizzle ORM for the first time in a new project. Show me the drizzle.config.ts file, explain how to generate and apply migrations, and show what a typical migration workflow looks like.

## Answer

### 1. Configuration

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### 2. Migration Workflow

```bash
# Step 1: Generate migration from schema changes
npx drizzle-kit generate

# This creates a SQL file like: drizzle/0000_initial.sql
# You can review the generated SQL:
cat drizzle/0000_initial.sql

# Step 2: Apply the migration to your database
npx drizzle-kit migrate

# Other useful commands:
# Introspect an existing database to generate schema
npx drizzle-kit introspect

# Launch Drizzle Studio (database GUI)
npx drizzle-kit studio
```

### 3. Typical Day-to-Day Workflow

1. Modify your schema in `db/schema.ts` (add a column, table, etc.)
2. Run `npx drizzle-kit generate` — produces a new SQL migration file
3. Review the generated SQL to verify correctness
4. Run `npx drizzle-kit migrate` — applies the migration to the database
5. Commit both the schema change and the migration file to version control

### Example Generated Migration

```sql
-- drizzle/0001_add_posts.sql
CREATE TABLE IF NOT EXISTS "posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "content" text,
  "author_id" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);
```

Key points:
- The config uses `satisfies Config` for type-safe configuration without losing the literal type.
- Migrations are SQL-based — you have full control and can review/edit them before applying.
- `generate` creates the migration file, `migrate` applies it. These are separate steps so you can review.
