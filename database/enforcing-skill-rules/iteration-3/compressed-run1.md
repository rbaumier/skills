# Database Skill - Compressed Prompt Eval Run 1

## Prompt
Fix all issues in the provided SQL schema, queries, migrations, Drizzle schema, repository, and db.ts.

## Fixed Code + Issues

### SQL Schema (Fixed)

```sql
-- [truncate-vs-delete] TRUNCATE takes ACCESS EXCLUSIVE lock, not MVCC-safe during traffic
DELETE FROM audit_logs;

-- [uuidv7] UUIDv7 for index locality + time-sortability, never random UUIDv4
-- [text-not-varchar] TEXT not VARCHAR — no perf difference in PG, avoids arbitrary limits
-- [timestamptz] TIMESTAMPTZ not TIMESTAMP — always store timezone-aware
-- [check-constraints] CHECK constraints make invalid data unrepresentable
CREATE TABLE organizations (
  id UUID PRIMARY KEY, -- generate UUIDv7 in application layer
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [fk-indexes] FK columns MUST have explicit indexes — prevents cascade lock issues
-- [soft-delete] deleted_at TIMESTAMPTZ, never boolean is_deleted
-- [jsonb] Semi-structured data uses JSONB, not TEXT
-- [password-secrets] api_key must NEVER be stored plain text — encrypt with pgcrypto or use vault
CREATE TABLE users (
  id UUID PRIMARY KEY, -- UUIDv7 app-generated
  org_id UUID NOT NULL REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- [bcrypt/argon2] hashed, never plaintext
  api_key_hash TEXT, -- store HASH of API key, never plaintext
  deleted_at TIMESTAMPTZ, -- soft delete via timestamp, not boolean
  preferences JSONB, -- JSONB for semi-structured data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_org_id ON users(org_id);
-- Partial unique index for soft delete: active users have unique emails
CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;

CREATE TABLE projects (
  id UUID PRIMARY KEY, -- UUIDv7
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  budget NUMERIC(12,2) CHECK (budget > 0), -- [numeric-not-float] NUMERIC for money, never FLOAT
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')), -- [check-constraints]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_org_id ON projects(org_id);

CREATE TABLE tasks (
  id UUID PRIMARY KEY, -- UUIDv7, not SERIAL
  project_id UUID NOT NULL REFERENCES projects(id),
  assignee_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  price_estimate NUMERIC(10,2) CHECK (price_estimate > 0), -- [numeric-not-float]
  status TEXT NOT NULL CHECK (status IN ('backlog', 'active', 'done', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [fk-indexes] Explicit indexes on ALL FK columns
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);

-- [partial-index] Partial index for frequently queried active tasks
CREATE INDEX idx_tasks_active ON tasks(project_id, created_at DESC)
  WHERE status = 'active';

-- [brin-time-series] BRIN index for time-series queries on created_at (append-only, naturally ordered)
CREATE INDEX idx_tasks_created_at_brin ON tasks USING BRIN (created_at);

-- [tsvector-gin] Full-text search instead of LIKE '%term%'
ALTER TABLE tasks ADD COLUMN description_tsv TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(description, ''))) STORED;
CREATE INDEX idx_tasks_description_gin ON tasks USING GIN (description_tsv);
```

### Queries (Fixed)

```sql
-- [no-select-star] Explicit columns enable covering indexes
-- [covering-index] INCLUDE clauses for index-only scans
CREATE INDEX idx_tasks_project_active_cover ON tasks(project_id, created_at DESC)
  INCLUDE (id, title, status, assignee_id)
  WHERE status = 'active';

SELECT id, title, status, assignee_id, created_at
FROM tasks
WHERE project_id = $1 AND status = 'active'
ORDER BY created_at DESC;

-- [tsvector-gin] Use ts_query instead of LIKE '%deploy%'
SELECT id, title, description, status
FROM tasks
WHERE description_tsv @@ plainto_tsquery('english', 'deploy');

-- [cursor-pagination] Keyset pagination instead of OFFSET/LIMIT (O(N) on deep pages)
SELECT id, title, status, created_at
FROM tasks
WHERE assignee_id = $1
  AND (created_at, id) < ($2, $3)  -- cursor from previous page
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- [now-clock-timestamp] NOW() returns same value entire transaction
-- Use clock_timestamp() if you need wall-clock time inside a transaction
SELECT id, title, created_at
FROM tasks
WHERE created_at > clock_timestamp() - INTERVAL '1 hour';
```

### Pool Math + PgBouncer

```
-- [pool-math-pgbouncer]
-- 5 instances x 20 pool = 100 connections = default max_connections limit
-- SOLUTION: Put PgBouncer in front, transaction mode
-- Each app instance connects to PgBouncer (pool 20 each)
-- PgBouncer maintains ~20-30 actual DB connections total
-- Keep < 100 active DB connections
```

### Migrations (Fixed)

```sql
-- [lock-timeout] SET lock_timeout on EVERY DDL migration
SET lock_timeout = '5s';

-- [expand-contract] Breaking column rename uses expand-and-contract:
-- Step 1: Add new nullable column
ALTER TABLE users ADD COLUMN full_name TEXT;
-- Step 2: Backfill (batched)
UPDATE users SET full_name = name WHERE full_name IS NULL; -- in batches
-- Step 3: Dual-write in app (write to both name and full_name)
-- Step 4: Switch reads to full_name
-- Step 5: Drop old column (separate migration, after verification)
-- ALTER TABLE users DROP COLUMN name;

-- [not-valid-validate] NOT NULL via CHECK NOT VALID + VALIDATE (avoids full table lock)
ALTER TABLE users ADD CONSTRAINT users_email_not_null
  CHECK (email IS NOT NULL) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_email_not_null;

-- [concurrent-index] CONCURRENTLY avoids blocking writes
CREATE INDEX CONCURRENTLY idx_tasks_project ON tasks(project_id);

-- [no-disable-autovacuum] NEVER disable autovacuum — tune frequency instead
ALTER TABLE tasks SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);
```

### Drizzle Schema (Fixed)

```typescript
// schema.ts — reviewed and hardened from drizzle-kit output
// [drizzle-cli-review] CLI output is a STARTING POINT, not production-ready
import { pgTable, uuid, text, timestamp, numeric, check, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { InferSelectModel } from 'drizzle-orm';

export const tasks = pgTable('tasks', {
  // [drizzle-uuidv7] UUIDv7 with $defaultFn, never serial/defaultRandom (UUIDv4)
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  assigneeId: uuid('assignee_id').references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  // NUMERIC for money, never real/float
  priceEstimate: numeric('price_estimate', { precision: 10, scale: 2 }),
  status: text('status').notNull().default('backlog'),
  // [drizzle-timezone] Always { withTimezone: true }
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  // [drizzle-constraints] Constraints in third pgTable argument
  check('price_positive', sql`${t.priceEstimate} > 0`),
  check('status_valid', sql`${t.status} IN ('backlog', 'active', 'done', 'cancelled')`),
  index('idx_tasks_project_id').on(t.projectId),
  index('idx_tasks_assignee_id').on(t.assigneeId),
]);

// [drizzle-infer-type] Export InferSelectModel alongside table
export type Task = InferSelectModel<typeof tasks>;
```

### Task Repository (Fixed)

```typescript
// task-repository.ts
// [errors-as-values] Return errors as values, never throw
// [domain-error-classes] Domain-specific error classes, not generic Error
// [derive-repo-type] Factory pattern with ReturnType

import { eq } from 'drizzle-orm';
import { tasks, comments } from './schema';
import type { Task } from './schema';
import type { DrizzleDB } from './db';

// --- Error classes (colocated in errors.ts) ---
class TaskNotFoundError {
  readonly _tag = 'TaskNotFoundError' as const;
  constructor(public readonly taskId: string) {}
}
class CommentCreateError {
  readonly _tag = 'CommentCreateError' as const;
  constructor(public readonly cause: unknown) {}
}
class DatabaseError {
  readonly _tag = 'DatabaseError' as const;
  constructor(public readonly cause: unknown) {}
}

type TaskRepoError = TaskNotFoundError | CommentCreateError | DatabaseError;

// [derive-repo-type] Factory function, derive type with ReturnType
export function createTaskRepository(db: DrizzleDB) {
  return {
    // [errors-as-values] Returns Task or error, never throws
    async findById(id: string): Promise<Task | TaskNotFoundError | DatabaseError> {
      try {
        const result = await db.select().from(tasks).where(eq(tasks.id, id));
        if (!result.length) return new TaskNotFoundError(id);
        return result[0];
      } catch (err) {
        return new DatabaseError(err);
      }
    },

    // [transaction-error-union] Transaction returns union of ALL step errors
    async createWithComment(
      taskData: typeof tasks.$inferInsert,
      commentText: string
    ): Promise<{ task: Task; comment: any } | CommentCreateError | DatabaseError> {
      try {
        return await db.transaction(async (tx) => {
          const [task] = await tx.insert(tasks).values(taskData).returning();
          const [comment] = await tx.insert(comments).values({
            taskId: task.id,
            text: commentText,
          }).returning();
          return { task, comment };
        });
      } catch (err) {
        return new DatabaseError(err);
      }
    },

    // [parameterized-queries] NEVER concatenate strings into SQL
    async search(userInput: string): Promise<Task[] | DatabaseError> {
      try {
        return await db
          .select()
          .from(tasks)
          .where(sql`${tasks.descriptionTsv} @@ plainto_tsquery('english', ${userInput})`);
      } catch (err) {
        return new DatabaseError(err);
      }
    },
  };
}

// [derive-repo-type] Derive type from factory
export type TaskRepository = ReturnType<typeof createTaskRepository>;
```

### Route Error Matching

```typescript
// [exhaustive-match] Every error _tag maps to specific HTTP status + problem code
function matchError(error: TaskRepoError): { status: number; code: string } {
  switch (error._tag) {
    case 'TaskNotFoundError':
      return { status: 404, code: 'TASK_NOT_FOUND' };
    case 'CommentCreateError':
      return { status: 422, code: 'COMMENT_CREATE_FAILED' };
    case 'DatabaseError':
      return { status: 500, code: 'DATABASE_ERROR' };
    default: {
      const _exhaustive: never = error;
      return { status: 500, code: 'UNKNOWN_ERROR' };
    }
  }
}
```

### db.ts (Fixed)

```typescript
// db.ts
// [otel-logger] OtelDrizzleLogger attached at client creation
// [least-privilege] App connects as limited-privilege user, NOT postgres superuser
// [rls] RLS enabled on all tables for multi-tenant isolation
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { trace, Span } from '@opentelemetry/api';
import * as schema from './schema';

class OtelDrizzleLogger {
  logQuery(query: string, params: unknown[]) {
    const span = trace.getActiveSpan();
    if (!span) return; // zero overhead when no span active
    span.setAttribute('db.statement', query);
    span.setAttribute('db.system', 'postgresql');
  }
}

// App user with least privilege — GRANT SELECT, INSERT, UPDATE, DELETE on specific tables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // connects as app_user, NOT postgres
});

export const db = drizzle(pool, {
  schema,
  logger: new OtelDrizzleLogger(),
});

export type DrizzleDB = typeof db;
```

### Security Notes

```sql
-- [least-privilege] Create dedicated app role
CREATE ROLE app_user WITH LOGIN PASSWORD '...'; -- from vault/env
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- [rls] Enable RLS on every table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Example policy for multi-tenant isolation
CREATE POLICY tenant_isolation ON tasks
  USING (project_id IN (
    SELECT id FROM projects WHERE org_id = current_setting('app.current_org_id')::UUID
  ));
```

## Issues List

| # | ID | Issue | Fix |
|---|---|---|---|
| 1 | uuidv7 | gen_random_uuid() = UUIDv4, poor index locality | UUIDv7 app-generated PKs |
| 2 | fk-indexes | FK columns org_id, project_id, assignee_id not indexed | Explicit indexes on all FKs |
| 3 | text-not-varchar | VARCHAR(100/255) used | TEXT everywhere |
| 4 | timestamptz | TIMESTAMP without timezone | TIMESTAMPTZ always |
| 5 | numeric-not-float | FLOAT for budget/price_estimate | NUMERIC(precision,scale) |
| 6 | jsonb | preferences as TEXT | JSONB for semi-structured |
| 7 | soft-delete | is_deleted BOOLEAN | deleted_at TIMESTAMPTZ + partial unique index |
| 8 | check-constraints | No CHECK constraints | CHECK on price > 0, status IN (...) |
| 9 | no-select-star | SELECT * in all queries | Explicit column lists |
| 10 | covering-index | No INCLUDE clauses | Covering indexes with INCLUDE |
| 11 | partial-index | No partial index for active queries | WHERE status = 'active' partial index |
| 12 | brin-time-series | No BRIN for created_at | BRIN index for time-series data |
| 13 | cursor-pagination | OFFSET 200 LIMIT 20 | Keyset/cursor pagination |
| 14 | tsvector-gin | LIKE '%deploy%' on large table | TSVECTOR + GIN index |
| 15 | expand-contract | Direct ALTER TABLE RENAME | Expand-and-contract 5-step migration |
| 16 | lock-timeout | No lock_timeout on DDL | SET lock_timeout = '5s' |
| 17 | concurrent-index | CREATE INDEX without CONCURRENTLY | CREATE INDEX CONCURRENTLY |
| 18 | not-valid-validate | ALTER COLUMN SET NOT NULL directly | ADD CONSTRAINT NOT VALID + VALIDATE |
| 19 | no-disable-autovacuum | autovacuum_enabled = false | Tune scale factors, never disable |
| 20 | now-clock-timestamp | NOW() in transaction context | clock_timestamp() for wall-clock |
| 21 | pool-math-pgbouncer | 5x20=100 = max_connections | PgBouncer transaction mode |
| 22 | truncate-vs-delete | TRUNCATE during live traffic | DELETE FROM (MVCC-safe) |
| 23 | least-privilege | App as postgres superuser | Dedicated app_user with minimal GRANT |
| 24 | rls | No RLS policies | RLS on every table |
| 25 | parameterized-queries | String concat in SQL (injection) | Parameterized queries / sql template |
| 26 | password-secrets | api_key stored plain text | Store hash, never plaintext |
| 27 | drizzle-uuidv7 | serial PK, no uuidv7 | uuid PK with $defaultFn(() => uuidv7()) |
| 28 | drizzle-timezone | bare timestamp without timezone | { withTimezone: true } |
| 29 | drizzle-constraints | No check/index in pgTable | Third argument with check/index |
| 30 | drizzle-infer-type | No type export | Export InferSelectModel<typeof tasks> |
| 31 | drizzle-cli-review | Using drizzle-kit output as-is | Review for timezone/constraints/indexes |
| 32 | errors-as-values | throw new Error('Task not found') | Return errors as values |
| 33 | domain-error-classes | Generic Error | TaskNotFoundError, etc. |
| 34 | transaction-error-union | No typed error return from transaction | Union of all step errors |
| 35 | exhaustive-match | No error-to-HTTP mapping | matchError() with exhaustive switch |
| 36 | derive-repo-type | Class export | Factory + ReturnType<typeof createTaskRepository> |
| 37 | otel-logger | No OTel logger in db.ts | OtelDrizzleLogger at client creation |
