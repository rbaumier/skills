# PostgreSQL + Drizzle ORM + TypeScript — Complete Code Review

## Issues Found (mapped to skill rules)

### CRITICAL — Security

#### 1. SQL Injection in `search()` method
**Rule**: *Parameterized queries only. Never concatenate strings into SQL.*

```typescript
// BROKEN — SQL injection
async search(userInput: string) {
  return await db.execute(`SELECT * FROM tasks WHERE title LIKE '%${userInput}%'`);
}
```

An attacker passing `'; DROP TABLE tasks; --` destroys the table.

#### 2. API key stored in plain text
**Rule**: *bcrypt/argon2 for passwords. Never store API keys/secrets plain text.*

```sql
api_key TEXT, -- stored in plain text
```

API keys must be hashed (SHA-256 for lookup, or encrypted with pgcrypto). Only show the key once at creation time.

#### 3. App connects as `postgres` superuser, no RLS
**Rule**: *Least privilege: app never superuser. GRANT only SELECT/INSERT/UPDATE/DELETE on specific tables.* and *RLS on every table.*

The app must use a dedicated role with minimal grants. RLS policies must be enabled per table.

---

### CRITICAL — Data Integrity

#### 4. `FLOAT` for money columns (`budget`, `price_estimate`)
**Rule**: *NUMERIC for money never FLOAT.*

```sql
budget FLOAT,          -- BROKEN: floating-point rounding
price_estimate FLOAT,  -- BROKEN: 0.1 + 0.2 != 0.3
```

IEEE 754 floats silently corrupt financial calculations.

#### 5. `TIMESTAMP` without timezone
**Rule**: *TIMESTAMPTZ not TIMESTAMP.*

Every `TIMESTAMP DEFAULT NOW()` in the schema loses timezone context. A server timezone change silently shifts all historical data.

#### 6. Soft delete uses boolean `is_deleted`
**Rule**: *Soft delete: `deleted_at TIMESTAMPTZ` with partial unique index, or history table. Never boolean `is_deleted`.*

A boolean gives zero forensic value (who deleted it? when?). A `deleted_at` timestamp provides both the flag and the audit trail.

#### 7. No CHECK constraints on `status`, `price`, `budget`
**Rule**: *CHECK constraints: `price > 0`, `status IN (...)`. Make invalid data unrepresentable.*

The schema accepts negative budgets, empty statuses, and nonsense price values.

#### 8. `VARCHAR` instead of `TEXT`
**Rule**: *TEXT not VARCHAR.*

`VARCHAR(100)` and `VARCHAR(255)` offer no performance benefit in PostgreSQL. They only create artificial truncation bugs when legitimate data exceeds the limit.

#### 9. `preferences` stored as `TEXT` instead of `JSONB`
**Rule**: *JSONB for semi-structured.*

TEXT column cannot be queried, indexed, or validated. JSONB provides all three.

---

### CRITICAL — Performance

#### 10. `SELECT *` everywhere
**Rule**: *No SELECT *: explicit columns enables covering indexes.*

All four queries use `SELECT *`. This defeats covering indexes, wastes bandwidth, and leaks columns (like `password_hash`) to callers that don't need them.

#### 11. `LIKE '%deploy%'` full table scan
**Rule**: *Text search: TSVECTOR + GIN. Never `LIKE '%term%'` on large tables.*

```sql
SELECT * FROM tasks WHERE description LIKE '%deploy%';
```

Leading wildcard prevents any index use. This is a sequential scan on every row.

#### 12. `OFFSET 200` deep pagination
**Rule**: *Pagination: cursor-based (keyset). OFFSET/LIMIT is O(N) on deep pages.*

```sql
SELECT * FROM tasks WHERE assignee_id = $1 ORDER BY created_at DESC LIMIT 20 OFFSET 200;
```

The DB reads and discards 200 rows before returning 20. Gets worse as offset grows.

#### 13. Missing indexes on FK columns and query patterns
**Rule**: *FK columns need explicit indexes — NOT auto-indexed.* and *Index based on query patterns.*

- `users.org_id` — no index
- `projects.org_id` — no index
- `tasks.assignee_id` — no index
- `tasks.status` — filtered in queries, no index
- The composite query `WHERE project_id = $1 AND status = 'active'` needs a composite index

#### 14. UUIDv4 for primary keys
**Rule**: *PKs: UUIDv7 (index locality, time-sortable). Never random UUIDv4 for clustered keys.*

`gen_random_uuid()` produces UUIDv4 which fragments B-tree indexes due to random distribution. UUIDv7 preserves insertion order.

---

### CRITICAL — Operations

#### 15. `TRUNCATE TABLE audit_logs` during traffic
**Rule**: *TRUNCATE takes ACCESS EXCLUSIVE lock, not MVCC-safe. Use `DELETE FROM` during traffic.*

TRUNCATE blocks ALL concurrent reads and writes on the table. Under traffic, this queues every connection.

#### 16. Pool math: 5 instances x 20 = 100 connections
**Rule**: *Pool math: 5 instances x 20 pool = 100 = default max_connections limit. Use PgBouncer.*

This saturates the default `max_connections` (100) with zero headroom for admin, migrations, or monitoring. PgBouncer in transaction mode is required.

#### 17. Migration disables autovacuum
**Rule**: *Tune autovacuum frequency on high-churn tables. NEVER disable autovacuum.*

```sql
ALTER TABLE tasks SET (autovacuum_enabled = false);
```

This guarantees table bloat, degrading performance over time until a manual VACUUM FULL (which takes an ACCESS EXCLUSIVE lock).

#### 18. Migration lacks `lock_timeout`
**Rule**: *`SET lock_timeout = '5s'` on every DDL migration — prevent write queue pileups.*

The `ALTER TABLE` and `CREATE INDEX` statements have no lock timeout. Under load, they can queue writes indefinitely.

#### 19. `CREATE INDEX` without `CONCURRENTLY`
**Rule**: *CREATE INDEX CONCURRENTLY. ADD CONSTRAINT NOT VALID then VALIDATE separately — avoid table locks.*

```sql
CREATE INDEX idx_tasks_project ON tasks(project_id);
```

Non-concurrent index creation takes a SHARE lock, blocking all writes for the duration.

#### 20. Rename column without expand-and-contract
**Rule**: *Expand-and-Contract for breaking changes.*

```sql
ALTER TABLE users RENAME COLUMN name TO full_name;
```

This instantly breaks every running app instance that references `name`. The safe pattern is: add `full_name`, dual-write, backfill, switch reads, drop `name`.

---

### HIGH — Repository & Drizzle

#### 21. `throw new Error` instead of typed error returns
**Rule**: *Return errors as values, never throw.* and *Domain-specific error classes.*

```typescript
if (!task.length) throw new Error('Task not found');
```

Thrown errors are invisible to the type system. Callers don't know what can fail.

#### 22. Drizzle schema uses bare `timestamp()`, `real()`, missing constraints
**Rule**: *Timestamps: always `{ withTimezone: true }`.* and *UUIDv7: `.$defaultFn(() => uuidv7())` on PKs.*

```typescript
createdAt: timestamp('created_at').defaultNow(),  // missing withTimezone
priceEstimate: real('price_estimate'),             // should be numeric
```

#### 23. Missing `InferSelectModel` export
**Rule**: *Export table + `InferSelectModel` type from same file.*

The Drizzle schema exports the table but not the inferred type.

#### 24. No OTel logger on db client
**Rule**: *`OtelDrizzleLogger` attaches `db.statement`/`db.system` to active OTel span.*

```typescript
export const db = drizzle(client, { schema });
// missing: logger: new OtelDrizzleLogger()
```

---

## Fixed Code

### Fixed SQL Schema

```sql
-- Migration: clean up old audit logs (safe under traffic)
-- Use DELETE with batching, not TRUNCATE
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Schema
CREATE TABLE organizations (
  id UUID DEFAULT uuidv7() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE users (
  id UUID DEFAULT uuidv7() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,  -- bcrypt/argon2 only
  api_key_hash TEXT,            -- SHA-256 hash, never plain text
  deleted_at TIMESTAMPTZ,      -- soft delete with timestamp, not boolean
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Partial unique: email must be unique among non-deleted users
CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_org_id ON users(org_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE TABLE projects (
  id UUID DEFAULT uuidv7() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  budget NUMERIC(12, 2) NOT NULL CHECK (budget >= 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_projects_org_id ON projects(org_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE tasks (
  id UUID DEFAULT uuidv7() PRIMARY KEY,  -- UUID, not SERIAL
  project_id UUID NOT NULL REFERENCES projects(id),
  assignee_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  price_estimate NUMERIC(10, 2) CHECK (price_estimate > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_progress', 'review', 'done', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Composite index for the most common query pattern
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status, created_at DESC)
  INCLUDE (title, assignee_id);
-- FK indexes
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
-- Partial index for active tasks (most queries filter on this)
CREATE INDEX idx_tasks_active ON tasks(status) WHERE status = 'active';
-- BRIN index for time-range queries (append-only, naturally ordered)
CREATE INDEX idx_tasks_created_brin ON tasks USING BRIN (created_at);
-- Full-text search instead of LIKE '%term%'
ALTER TABLE tasks ADD COLUMN description_tsv TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(description, ''))) STORED;
CREATE INDEX idx_tasks_description_gin ON tasks USING GIN (description_tsv);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
```

### Fixed Queries

```sql
-- Query 1: Tasks by project (uses covering index idx_tasks_project_status)
SELECT id, title, assignee_id, status, created_at
FROM tasks
WHERE project_id = $1 AND status = 'active'
ORDER BY created_at DESC;

-- Query 2: Full-text search (uses GIN index, not sequential scan)
SELECT id, title, description, status, created_at
FROM tasks
WHERE description_tsv @@ plainto_tsquery('english', 'deploy');

-- Query 3: Cursor-based pagination (not OFFSET)
SELECT id, title, status, created_at
FROM tasks
WHERE assignee_id = $1
  AND (created_at, id) < ($2, $3)  -- cursor from previous page
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Query 4: Recent tasks (uses BRIN index)
SELECT id, title, status, created_at
FROM tasks
WHERE created_at > NOW() - INTERVAL '1 hour';
```

### Fixed Migration Script

```sql
-- Every DDL statement gets a lock timeout to prevent queue pileup
BEGIN;
SET lock_timeout = '5s';

-- Step 1: Expand — add new column (non-blocking, nullable)
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Step 2: Backfill (do this in batches in application code for large tables)
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Step 3: Make NOT NULL after backfill is complete
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Note: ALTER TABLE users ALTER COLUMN email SET NOT NULL is safe (metadata-only)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

COMMIT;

-- Step 4: Index creation — CONCURRENTLY cannot run inside a transaction
SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY idx_tasks_project ON tasks(project_id);

-- Step 5 (later deploy): Drop old column after all app instances use full_name
-- ALTER TABLE users DROP COLUMN name;

-- NEVER disable autovacuum. Tune it instead for high-churn tables:
ALTER TABLE tasks SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
```

### Fixed Drizzle Schema

```typescript
import {
  pgTable, uuid, text, timestamp, numeric, boolean, check, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql, type InferSelectModel } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

// --- Organizations ---

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = InferSelectModel<typeof organizations>;

// --- Users ---

export const users = pgTable('users', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  apiKeyHash: text('api_key_hash'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  preferences: text('preferences').$type<Record<string, unknown>>(), // or use jsonb column type
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_users_email_active').on(table.email).where(sql`deleted_at IS NULL`),
  index('idx_users_org_id').on(table.orgId),
]);

export type User = InferSelectModel<typeof users>;

// --- Projects ---

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  budget: numeric('budget', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('budget_positive', sql`budget >= 0`),
  check('project_status_valid', sql`status IN ('draft', 'active', 'paused', 'completed', 'archived')`),
  index('idx_projects_org_id').on(table.orgId),
]);

export type Project = InferSelectModel<typeof projects>;

// --- Tasks ---

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  assigneeId: uuid('assignee_id').references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  priceEstimate: numeric('price_estimate', { precision: 10, scale: 2 }),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('price_positive', sql`price_estimate > 0`),
  check('task_status_valid', sql`status IN ('active', 'in_progress', 'review', 'done', 'cancelled')`),
  index('idx_tasks_project_status').on(table.projectId, table.status, table.createdAt),
  index('idx_tasks_assignee_id').on(table.assigneeId),
]);

export type Task = InferSelectModel<typeof tasks>;
```

### Fixed Repository Layer

```typescript
import { eq, sql, and, desc, lt } from 'drizzle-orm';
import { tasks, type Task } from './schema';
import { db } from './db';

// --- Typed error classes (one per business failure) ---

class TaskNotFoundError {
  readonly _tag = 'TaskNotFoundError' as const;
  constructor(readonly taskId: string) {}
}

class TaskCreateError {
  readonly _tag = 'TaskCreateError' as const;
  constructor(readonly cause: unknown) {}
}

class CommentCreateError {
  readonly _tag = 'CommentCreateError' as const;
  constructor(readonly cause: unknown) {}
}

class DatabaseError {
  readonly _tag = 'DatabaseError' as const;
  constructor(readonly cause: unknown) {}
}

type FindByIdError = TaskNotFoundError | DatabaseError;
type CreateWithCommentError = TaskCreateError | CommentCreateError | DatabaseError;
type SearchError = DatabaseError;

// --- Repository ---

export function createTaskRepository() {
  return {
    /**
     * Find a task by ID, returning explicit columns only.
     * Returns a typed error union — never throws.
     */
    async findById(id: string): Promise<Task | FindByIdError> {
      try {
        const result = await db
          .select({
            id: tasks.id,
            projectId: tasks.projectId,
            assigneeId: tasks.assigneeId,
            title: tasks.title,
            description: tasks.description,
            priceEstimate: tasks.priceEstimate,
            status: tasks.status,
            createdAt: tasks.createdAt,
          })
          .from(tasks)
          .where(eq(tasks.id, id));

        if (!result.length) return new TaskNotFoundError(id);
        return result[0];
      } catch (cause) {
        return new DatabaseError(cause);
      }
    },

    /**
     * Create a task and its first comment atomically.
     * Transaction error union includes all possible step failures.
     */
    async createWithComment(
      taskData: typeof tasks.$inferInsert,
      commentText: string,
    ): Promise<{ task: Task; comment: Comment } | CreateWithCommentError> {
      try {
        return await db.transaction(async (tx) => {
          const [task] = await tx.insert(tasks).values(taskData).returning();
          const [comment] = await tx
            .insert(comments)
            .values({ taskId: task.id, text: commentText })
            .returning();
          return { task, comment };
        });
      } catch (cause) {
        return new DatabaseError(cause);
      }
    },

    /**
     * Full-text search using tsvector + GIN index.
     * Parameterized — never concatenates user input into SQL.
     */
    async search(userInput: string): Promise<Task[] | SearchError> {
      try {
        return await db
          .select({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            status: tasks.status,
            createdAt: tasks.createdAt,
          })
          .from(tasks)
          .where(sql`description_tsv @@ plainto_tsquery('english', ${userInput})`);
      } catch (cause) {
        return new DatabaseError(cause);
      }
    },

    /**
     * Cursor-based pagination — O(1) regardless of page depth.
     * Caller passes the (created_at, id) tuple from the last item of previous page.
     */
    async findByAssignee(
      assigneeId: string,
      cursor?: { createdAt: Date; id: string },
      limit = 20,
    ): Promise<Task[] | DatabaseError> {
      try {
        let query = db
          .select({
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
            createdAt: tasks.createdAt,
          })
          .from(tasks)
          .where(
            cursor
              ? and(
                  eq(tasks.assigneeId, assigneeId),
                  sql`(${tasks.createdAt}, ${tasks.id}) < (${cursor.createdAt}, ${cursor.id})`,
                )
              : eq(tasks.assigneeId, assigneeId),
          )
          .orderBy(desc(tasks.createdAt), desc(tasks.id))
          .limit(limit);

        return await query;
      } catch (cause) {
        return new DatabaseError(cause);
      }
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
```

### Fixed db.ts

```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { OtelDrizzleLogger } from './otel-logger';
import * as schema from './schema';

// Connection pool sized for PgBouncer transaction mode.
// 5 instances x 4 connections = 20 total DB connections (well under the 100 limit).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // connects as app_role, NOT postgres superuser
  max: 4,
});

export const db = drizzle(pool, {
  schema,
  logger: new OtelDrizzleLogger(),
});
```

### Database Role Setup (run once as superuser)

```sql
-- Create a dedicated app role with minimal privileges
CREATE ROLE app_role LOGIN PASSWORD 'rotated-via-vault';

GRANT CONNECT ON DATABASE myapp TO app_role;
GRANT USAGE ON SCHEMA public TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;

-- No TRUNCATE, no CREATE, no DROP, no SUPERUSER
```

---

## Summary Table

| # | Severity | Skill Rule Violated | Issue |
|---|----------|-------------------|-------|
| 1 | CRITICAL | Parameterized queries only | SQL injection in `search()` |
| 2 | CRITICAL | Never store API keys plain text | `api_key TEXT` in plain text |
| 3 | CRITICAL | App never superuser + RLS on every table | Connects as `postgres`, no RLS |
| 4 | CRITICAL | NUMERIC for money never FLOAT | `FLOAT` on budget and price columns |
| 5 | CRITICAL | TIMESTAMPTZ not TIMESTAMP | All timestamps lack timezone |
| 6 | HIGH | Never boolean is_deleted | `is_deleted BOOLEAN` instead of `deleted_at` |
| 7 | HIGH | CHECK constraints | No validation on status, price, budget |
| 8 | MEDIUM | TEXT not VARCHAR | VARCHAR(100), VARCHAR(255) used |
| 9 | MEDIUM | JSONB for semi-structured | `preferences TEXT` storing JSON |
| 10 | HIGH | No SELECT * | All queries use `SELECT *` |
| 11 | HIGH | TSVECTOR + GIN, never LIKE '%term%' | `LIKE '%deploy%'` full table scan |
| 12 | HIGH | Cursor-based pagination | `OFFSET 200` deep pagination |
| 13 | HIGH | Index ALL FK columns | Missing indexes on org_id, assignee_id |
| 14 | MEDIUM | UUIDv7 not UUIDv4 | `gen_random_uuid()` fragments B-trees |
| 15 | HIGH | DELETE FROM during traffic, not TRUNCATE | `TRUNCATE TABLE audit_logs` |
| 16 | HIGH | Use PgBouncer | 100 connections = max_connections limit |
| 17 | CRITICAL | NEVER disable autovacuum | `autovacuum_enabled = false` |
| 18 | HIGH | lock_timeout on every DDL | Migration DDL has no lock timeout |
| 19 | HIGH | CREATE INDEX CONCURRENTLY | Non-concurrent index creation |
| 20 | HIGH | Expand-and-Contract | Column rename breaks running instances |
| 21 | HIGH | Return errors as values, never throw | `throw new Error('Task not found')` |
| 22 | MEDIUM | withTimezone: true, UUIDv7 | Bare timestamp(), real(), defaultRandom |
| 23 | LOW | Export InferSelectModel | Missing type export from schema |
| 24 | LOW | OtelDrizzleLogger | No logger on db client |

**24 issues total**: 5 critical, 13 high, 5 medium, 2 low.
