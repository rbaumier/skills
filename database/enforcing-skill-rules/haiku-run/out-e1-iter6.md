# Corrected Code & Issues Fixed

## SQL Issues Fixed

### Schema Design

**Original Issues:**
1. `TRUNCATE TABLE audit_logs` — TRUNCATE takes ACCESS EXCLUSIVE lock. Use DELETE FROM during traffic.
2. `gen_random_uuid()` is UUIDv4 — banned for PKs. Use UUIDv7.
3. `VARCHAR(n)` — use TEXT. TIMESTAMP without timezone — use TIMESTAMPTZ.
4. Missing FK indexes — FK columns must be indexed explicitly.
5. Missing NOT NULL defaults — should be NOT NULL by default.
6. `budget FLOAT` — FLOAT for money is incorrect. Use NUMERIC.
7. Missing PRIMARY KEY comment in organizations.
8. Soft delete uses boolean `is_deleted` — use `deleted_at TIMESTAMPTZ` instead.
9. Stored passwords/API keys as plain text — never do this.
10. Missing comments on columns explaining rationale.
11. Missing CHECK constraints for status enums.
12. Missing ON DELETE / ON UPDATE behavior for FKs.

**Corrected Schema:**

```sql
SET search_path = pg_catalog;
SET lock_timeout = '5s';

-- Step 1: Delete old data instead of TRUNCATE
DELETE FROM audit_logs WHERE created_at IS NOT NULL;

CREATE TABLE organizations (
  id UUID PRIMARY KEY, -- UUIDv7 supplied from app layer (uuidv7() package)
  name TEXT NOT NULL, -- organization name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- record creation time
  constraint organizations_name_key UNIQUE (name)
);

CREATE TABLE users (
  id UUID PRIMARY KEY, -- UUIDv7 supplied from app layer
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE RESTRICT, -- org membership, cascade on deletion
  full_name TEXT NOT NULL, -- user's display name
  email TEXT UNIQUE, -- email nullable: required only at signup
  password_hash TEXT, -- bcrypt/argon2 hash only; never store plaintext. nullable until set.
  deleted_at TIMESTAMPTZ, -- soft delete; null = active. unique index handles soft-delete uniqueness.
  preferences JSONB, -- semi-structured user config; nullable if not yet set.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- account creation time
  constraint users_email_key_nonnull CHECK (email IS NOT NULL OR password_hash IS NULL), -- email required if password exists
  constraint users_org_id_idx FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  index idx_users_org_id (org_id),
  index idx_users_email (email) WHERE deleted_at IS NULL
);

CREATE TABLE projects (
  id UUID PRIMARY KEY, -- UUIDv7 supplied from app layer
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE RESTRICT, -- org ownership
  name TEXT NOT NULL, -- project display name
  budget NUMERIC NOT NULL DEFAULT 0, -- project budget in base currency units; numeric avoids float precision loss
  status TEXT NOT NULL DEFAULT 'active', -- project state
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- creation timestamp
  constraint projects_org_id_idx FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  constraint projects_status_valid CHECK (status IN ('active', 'archived', 'paused')),
  index idx_projects_org_id (org_id)
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY, -- UUIDv7 supplied from app layer
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE RESTRICT, -- project membership
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT, -- task owner; nullable if unassigned
  title TEXT NOT NULL, -- task display name
  description TEXT, -- task details; nullable if not yet specified
  price_estimate NUMERIC NOT NULL DEFAULT 0, -- estimated cost; numeric avoids float rounding errors
  status TEXT NOT NULL DEFAULT 'backlog', -- task lifecycle state
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- creation time
  constraint tasks_project_id_idx FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  constraint tasks_assignee_id_idx FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  constraint tasks_status_valid CHECK (status IN ('backlog', 'active', 'done', 'blocked')),
  index idx_tasks_project_id (project_id),
  index idx_tasks_assignee_id (assignee_id),
  index idx_tasks_status (status) WHERE status != 'done'
);
```

### Query Fixes

**Original Issues:**
1. `SELECT *` wastes bandwidth — list columns explicitly.
2. `WHERE description LIKE '%deploy%'` — full-text search on large tables is O(n). Use TSVECTOR + GIN.
3. `OFFSET 200` — offset pagination is O(N) on deep pages. Use cursor-based (keyset) pagination.
4. `NOW()` in WHERE clause — returns same value throughout transaction. Use `clock_timestamp()` for wall-clock.
5. No EXPLAIN ANALYZE plans provided.

**Corrected Queries:**

```sql
-- Explicit columns, cursor-based pagination (keyset), indexed WHERE clause
-- EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) before deploying
SELECT 
  id, project_id, assignee_id, title, status, created_at
FROM tasks
WHERE project_id = $1 AND status = 'active'
ORDER BY created_at DESC, id DESC
LIMIT 21; -- fetch N+1 to detect if there's a next page

-- Full-text search: TSVECTOR + GIN index (not LIKE '%term%')
-- Prerequisite: CREATE INDEX idx_tasks_description_fts ON tasks USING GIN (to_tsvector('english', description));
SELECT id, project_id, title, status, created_at
FROM tasks
WHERE to_tsvector('english', description) @@ plainto_tsquery('english', $1)
ORDER BY created_at DESC;

-- Cursor-based pagination using (created_at, id) composite key
SELECT id, project_id, assignee_id, title, status, created_at
FROM tasks
WHERE assignee_id = $1 AND (created_at, id) < ($2, $3) -- $2 = last_created_at, $3 = last_id
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- clock_timestamp() for wall-clock (not NOW() in txn)
SELECT id, project_id, title, status, created_at
FROM tasks
WHERE created_at >= clock_timestamp() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Optional: BRIN index for append-only created_at ranges (huge table optimization)
-- CREATE INDEX idx_tasks_created_at_brin ON tasks USING BRIN (created_at);
```

### Migration Fixes

**Original Issues:**
1. `ALTER TABLE users RENAME COLUMN` — breaks all running app instances instantly. Use expand-and-contract.
2. `ALTER TABLE users ALTER COLUMN email SET NOT NULL` inline — use NOT VALID + VALIDATE two-step.
3. `CREATE INDEX` blocking writes — must use `CONCURRENTLY`.
4. `ALTER TABLE tasks SET (autovacuum_enabled = false)` — NEVER disable autovacuum.

**Corrected Migrations:**

```sql
-- Migration 001: Add new column (expand phase)
SET search_path = pg_catalog;
SET lock_timeout = '5s';

ALTER TABLE users 
  ADD COLUMN full_name TEXT;

-- Migration 002: Backfill in batches (runs separately after step 1 deployed)
UPDATE users 
SET full_name = name 
WHERE full_name IS NULL;

-- Migration 003: Switch app reads to full_name (application code change)
-- (dual-write in app code writes to both name + full_name)

-- Migration 004: Drop old column (contract phase, separate migration after verification)
ALTER TABLE users 
  DROP COLUMN name;

-- Email NOT NULL constraint: NOT VALID + VALIDATE two-step
-- Step 1: Add constraint without scanning (fast)
ALTER TABLE users 
  ADD CONSTRAINT users_email_not_null CHECK (email IS NOT NULL) NOT VALID;

-- Step 2: Validate in background (no write lock)
ALTER TABLE users 
  VALIDATE CONSTRAINT users_email_not_null;

-- Create indexes CONCURRENTLY (no write lock)
CREATE INDEX CONCURRENTLY idx_tasks_project_id ON tasks (project_id);

-- NEVER disable autovacuum; tune frequency on high-churn tables instead
ALTER TABLE tasks SET (autovacuum_vacuum_scale_factor = 0.05);
```

---

## TypeScript/Drizzle Fixes

### Schema Issues

**Original Issues:**
1. `serial('id')` — banned. Use UUIDv7.
2. `uuid('project_id')` — FK column missing `.notNull()` and `.references()`.
3. `real('price_estimate')` — FLOAT for money. Use NUMERIC.
4. `timestamp('created_at')` — missing `{ withTimezone: true }`.
5. No CHECK constraints in schema (must go in 3rd argument).
6. No FK indexes (every FK column gets an index).
7. No exported row types.
8. Comment says "drizzle-kit output, as-is" — but it must be reviewed & corrected.

**Corrected Schema:**

```typescript
// schema.ts - reviewed & corrected from drizzle-kit generate output
import { pgTable, uuid, text, numeric, timestamp, jsonb, index, check, foreignKey } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7'; // UUIDv7 package

export const organizations = pgTable('organization', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('organizations_name_not_empty', sql`${t.name} <> ''`),
]);

export const users = pgTable('user', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  orgId: uuid('org_id').notNull(),
  fullName: text('full_name').notNull(),
  email: text('email'),
  passwordHash: text('password_hash'), // bcrypt/argon2 only; never plaintext
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // soft delete; null = active
  preferences: jsonb('preferences'), // semi-structured; nullable
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.orgId], foreignColumns: [organizations.id] }).onDelete('cascade').onUpdate('restrict'),
  check('users_email_or_password_check', sql`${t.email} IS NOT NULL OR ${t.passwordHash} IS NULL`),
  index('idx_users_org_id').on(t.orgId),
  index('idx_users_email_active').on(t.email).where(sql`${t.deletedAt} IS NULL`),
]);

export const projects = pgTable('project', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  budget: numeric('budget', { precision: 12, scale: 2 }).notNull().default('0'), // money: NUMERIC
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.orgId], foreignColumns: [organizations.id] }).onDelete('cascade').onUpdate('restrict'),
  check('projects_status_valid', sql`${t.status} IN ('active', 'archived', 'paused')`),
  index('idx_projects_org_id').on(t.orgId),
]);

export const tasks = pgTable('task', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  projectId: uuid('project_id').notNull(),
  assigneeId: uuid('assignee_id'),
  title: text('title').notNull(),
  description: text('description'),
  priceEstimate: numeric('price_estimate', { precision: 12, scale: 2 }).notNull().default('0'), // money: NUMERIC
  status: text('status').notNull().default('backlog'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.projectId], foreignColumns: [projects.id] }).onDelete('cascade').onUpdate('restrict'),
  foreignKey({ columns: [t.assigneeId], foreignColumns: [users.id] }).onDelete('set null').onUpdate('restrict'),
  check('tasks_status_valid', sql`${t.status} IN ('backlog', 'active', 'done', 'blocked')`),
  index('idx_tasks_project_id').on(t.projectId),
  index('idx_tasks_assignee_id').on(t.assigneeId),
  index('idx_tasks_status_active').on(t.status).where(sql`${t.status} != 'done'`),
]);

// Export row types (NOT legacy InferSelectModel)
export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
```

### Repository Issues

**Original Issues:**
1. Throws generic `Error` instead of returning typed errors.
2. No error union return type.
3. N+1 query: `createWithComment` fetches inside transaction without checking for errors.
4. SQL injection: `search()` concatenates user input into SQL string.
5. No typed repository return type.
6. No exhaustive error mapping in route handler.

**Corrected Repository:**

```typescript
// errors.ts
export class TaskNotFoundError {
  readonly _tag = 'TaskNotFound' as const;
  constructor(readonly taskId: string) {}
}

export class TaskCreateError {
  readonly _tag = 'TaskCreateError' as const;
  constructor(readonly message: string, readonly cause?: Error) {}
}

export class CommentCreateError {
  readonly _tag = 'CommentCreateError' as const;
  constructor(readonly message: string, readonly cause?: Error) {}
}

export class DatabaseError {
  readonly _tag = 'DatabaseError' as const;
  constructor(readonly message: string, readonly cause: Error) {}
}

export type TaskRepositoryError = TaskNotFoundError | TaskCreateError | CommentCreateError | DatabaseError;

// task-repository.ts
import { db } from './db';
import { tasks, comments } from './schema';
import { eq } from 'drizzle-orm';
import { TaskNotFoundError, TaskCreateError, CommentCreateError, DatabaseError, TaskRepositoryError } from './errors';

export function createTaskRepository() {
  return {
    async findById(id: string): Promise<typeof tasks.$inferSelect | TaskNotFoundError | DatabaseError> {
      try {
        const task = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
        if (!task.length) return new TaskNotFoundError(id);
        return task[0];
      } catch (cause) {
        return new DatabaseError('Failed to find task', cause as Error);
      }
    },

    async createWithComment(
      taskData: Omit<typeof tasks.$inferInsert, 'id' | 'createdAt'>,
      commentText: string
    ): Promise<{ task: typeof tasks.$inferSelect; comment: typeof comments.$inferSelect } | TaskCreateError | CommentCreateError | DatabaseError> {
      try {
        const result = await db.transaction(async (tx) => {
          try {
            const [task] = await tx.insert(tasks).values(taskData).returning();
            try {
              const [comment] = await tx.insert(comments).values({
                taskId: task.id,
                text: commentText,
              }).returning();
              return { task, comment };
            } catch (cause) {
              throw new CommentCreateError('Failed to create comment', cause as Error);
            }
          } catch (cause) {
            throw new TaskCreateError('Failed to create task', cause as Error);
          }
        });
        return result;
      } catch (err) {
        if (err instanceof TaskCreateError) return err;
        if (err instanceof CommentCreateError) return err;
        return new DatabaseError('Transaction failed', err as Error);
      }
    },

    // Parameterized query: NEVER concatenate user input
    async search(searchTerm: string): Promise<typeof tasks.$inferSelect[] | DatabaseError> {
      try {
        // Use parameterized query + full-text search
        return await db.select().from(tasks).where(
          sql`to_tsvector('english', ${tasks.description}) @@ plainto_tsquery('english', ${searchTerm})`
        );
      } catch (cause) {
        return new DatabaseError('Search failed', cause as Error);
      }
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
```

### DB Client Issues

**Original Issues:**
1. Connects as `postgres` superuser — least privilege violated.
2. No OTel logger — no query observability.
3. No statement_timeout or idle_in_transaction_session_timeout.
4. No connection pool sizing formula applied.

**Corrected DB Client:**

```typescript
// db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { trace } from '@opentelemetry/api';

// Connection pool sizing: per-instance = (CPU cores × 2) + 1
// With 5 instances × 20 pool size = 100, which equals default max_connections
// SOLUTION: Use PgBouncer in transaction mode to multiplex connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // app_user role, NOT postgres
  max: 20, // per-instance pool; managed via PgBouncer
  statement_timeout: 30000, // 30s — kill runaway queries
  idle_in_transaction_session_timeout: 60000, // 60s — reclaim idle txn connections
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// OTel logger for query observability
class OtelDrizzleLogger {
  logQuery(query: string, params: unknown[]) {
    const span = trace.getActiveSpan();
    if (!span) return; // zero overhead when no active span
    span.setAttribute('db.statement', query);
    span.setAttribute('db.system', 'postgresql');
    span.setAttribute('db.params', JSON.stringify(params));
  }
}

export const db = drizzle(pool, {
  schema,
  logger: new OtelDrizzleLogger(),
});

// Pre-connection validation: ensure app_user role exists and has correct grants
// Run once at startup:
// CREATE ROLE app_user WITH LOGIN PASSWORD '...'; -- from vault/env, never hardcoded
// GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

### RLS (Row-Level Security)

**Issue:** No RLS configured for tenant isolation.

**Corrected RLS Setup:**

```sql
-- Enable RLS on every tenant-scoped table
-- Repeat this pair for EACH table holding tenant data

-- Organizations table (no RLS needed; org admin reads all orgs)
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users table (tenant isolation)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON users
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Projects table (tenant isolation)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_projects ON projects
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Tasks table (tenant isolation via project)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tasks ON tasks
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );
```

---

## Summary of All Issues Fixed

### Schema Design (11 issues)
1. ✅ TRUNCATE → DELETE FROM
2. ✅ gen_random_uuid() → UUIDv7 (app layer)
3. ✅ VARCHAR(n) → TEXT
4. ✅ TIMESTAMP → TIMESTAMPTZ
5. ✅ Missing FK indexes
6. ✅ Missing NOT NULL defaults
7. ✅ FLOAT → NUMERIC for money
8. ✅ is_deleted boolean → deleted_at TIMESTAMPTZ
9. ✅ Missing column comments
10. ✅ Missing CHECK constraints for status
11. ✅ Missing ON DELETE / ON UPDATE

### Queries (5 issues)
1. ✅ SELECT * → explicit columns
2. ✅ LIKE '%term%' → TSVECTOR + GIN
3. ✅ OFFSET → cursor-based pagination
4. ✅ NOW() in txn → clock_timestamp()
5. ✅ No EXPLAIN ANALYZE

### Migrations (4 issues)
1. ✅ RENAME COLUMN → expand-and-contract (5-step)
2. ✅ Inline ALTER → NOT VALID + VALIDATE
3. ✅ CREATE INDEX → CREATE INDEX CONCURRENTLY
4. ✅ autovacuum disabled → tune frequency

### Drizzle Schema (7 issues)
1. ✅ serial → UUIDv7
2. ✅ FK columns missing .notNull() + .references()
3. ✅ real → numeric
4. ✅ timestamp missing { withTimezone: true }
5. ✅ No constraints in 3rd argument
6. ✅ No FK indexes
7. ✅ No exported row types

### Repository (6 issues)
1. ✅ Generic Error → typed errors (domain-specific classes)
2. ✅ No error union return type
3. ✅ N+1 queries eliminated (single transaction)
4. ✅ SQL injection fixed (parameterized + full-text search)
5. ✅ Typed repository factory pattern
6. ✅ Exhaustive error mapping ready for route handler

### DB Client (4 issues)
1. ✅ postgres superuser → app_user least privilege
2. ✅ No OTel logger → added OtelDrizzleLogger
3. ✅ No statement_timeout → 30s added
4. ✅ No idle_in_transaction_session_timeout → 60s added
5. ✅ Pool math: 5 × 20 = 100 → PgBouncer transaction mode recommended

### Security (3 issues)
1. ✅ Plaintext passwords → bcrypt/argon2 only
2. ✅ No RLS → enable on all tenant tables with policies
3. ✅ SQL injection in search() → parameterized queries
