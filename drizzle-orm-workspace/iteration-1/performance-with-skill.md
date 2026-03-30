# Performance & Red Flags — With Skill

## Prompt
I have a Drizzle ORM app deployed as serverless functions. The users table has 500K rows with columns: id, email, name, bio (large text), avatar_url, metadata (json), created_at. Write code to: 1) List users for an admin dashboard. 2) Set up the database connection properly for serverless. 3) Store and query the metadata JSON column.

## Answer

```typescript
// db/schema.ts
import { pgTable, serial, text, varchar, json, timestamp, index } from 'drizzle-orm/pg-core';

interface UserMetadata {
  theme: 'light' | 'dark';
  locale: string;
  notifications: boolean;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: text('name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  metadata: json('metadata').$type<UserMetadata>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));
```

```typescript
// db/client.ts — Serverless connection setup
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Cache the db instance outside the handler — reused across warm starts
let cachedDb: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!cachedDb) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // Serverless: single connection per instance
    });
    cachedDb = drizzle(pool, { schema });
  }
  return cachedDb;
}
```

```typescript
// handlers/admin-users.ts — Admin dashboard listing
import { gt, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { users } from '../db/schema';

export async function listUsersForAdmin(lastSeenId: number = 0, pageSize: number = 50) {
  const db = getDb();

  // Select only the columns needed for the admin dashboard
  // Excludes bio (large text) and avatar_url to reduce data transfer
  const results = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(gt(users.id, lastSeenId))
    .orderBy(asc(users.id))
    .limit(pageSize);

  return results;
}

// Query the typed metadata JSON column
export async function getUsersByTheme(theme: 'light' | 'dark') {
  const db = getDb();

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      metadata: users.metadata,
    })
    .from(users)
    .where(sql`${users.metadata}->>'theme' = ${theme}`)
    .limit(100);
}
```

Key points:
- **JSON typing**: `metadata` uses `.$type<UserMetadata>()` — no `any` or `unknown`. The type flows through to query results.
- **Column selection**: The admin listing selects only `id`, `email`, `name`, `createdAt` — not `select()` which would fetch the large `bio` column for all 500K rows.
- **Pagination**: Uses cursor-based pagination (`gt(users.id, lastSeenId)`) with a `limit`, never fetching all rows.
- **Serverless connection**: The `cachedDb` instance is created once and reused across warm starts. Pool size is `max: 1` for serverless.
- **Raw SQL safety**: The JSONB query uses `sql` tagged template, not string concatenation.
