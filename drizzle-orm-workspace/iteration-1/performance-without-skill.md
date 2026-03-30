# Performance & Red Flags — Without Skill

## Prompt
I have a Drizzle ORM app deployed as serverless functions. The users table has 500K rows with columns: id, email, name, bio (large text), avatar_url, metadata (json), created_at. Write code to: 1) List users for an admin dashboard. 2) Set up the database connection properly for serverless. 3) Store and query the metadata JSON column.

## Answer

```typescript
// db/schema.ts
import { pgTable, serial, text, json, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

```typescript
// handler.ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

export async function handler() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const db = drizzle(pool);

  // 1) List users for admin dashboard
  const allUsers = await db.select().from(users);

  // 2) Connection is set up above with pg Pool

  // 3) Query metadata
  const user = await db.select().from(users).where(eq(users.id, 1));
  const metadata = user[0].metadata as { theme: string; locale: string };

  await pool.end();
  return allUsers;
}
```

This sets up the basic connection and queries. The metadata column stores JSON and you can cast it to your expected type when reading.
