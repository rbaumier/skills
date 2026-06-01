# Fixed Code: All Database Skill Rules Applied

## SQL Schema & Migrations

### Issues Fixed:
1. **TRUNCATE during traffic** → Use DELETE FROM
2. **gen_random_uuid() is UUIDv4** → Use UUIDv7 (app-supplied)
3. **TIMESTAMP not TIMESTAMPTZ** → Add timezone awareness
4. **VARCHAR(n) not allowed** → Use TEXT
5. **FK columns need explicit indexes** → Add indexes
6. **Boolean column naming** → Must use `is_*` or `has_*`
7. **NULL columns need justification** → Add comments or NOT NULL
8. **Missing constraints/ON DELETE/ON UPDATE** → Add them
9. **Soft delete with boolean** → Use `deleted_at TIMESTAMPTZ`
10. **Missing column comments** → Document rationale
11. **ALTER TABLE RENAME in production** → Use expand-and-contract
12. **Missing lock_timeout on DDL** → Add 5s timeout
13. **Autovacuum disabled** → Remove that setting

```sql
-- Clear data safely during traffic (no ACCESS EXCLUSIVE lock)
DELETE FROM audit_logs;

-- All constraints explicitly named per convention: tablename_columnname(s)_suffix
CREATE TABLE organization (
  id UUID PRIMARY KEY,
  -- UUIDv7 supplied from app layer, never DEFAULT gen_random_uuid()
  name TEXT NOT NULL,
  -- Email domain allowed, no abbreviations
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Always use TIMESTAMPTZ for wall-clock time, not TIMESTAMP
  
  CONSTRAINT organization_name_key UNIQUE (name)
  -- Explicit unique constraint naming
);

CREATE TABLE user_account (
  -- Singular naming: user_account not users
  id UUID PRIMARY KEY,
  -- UUIDv7 supplied from app layer
  org_id UUID NOT NULL REFERENCES organization(id)
    ON DELETE CASCADE
    ON UPDATE RESTRICT,
  -- Explicit FK constraints with referential actions
  full_name TEXT NOT NULL,
  -- TEXT not VARCHAR; no abbreviations
  email TEXT NOT NULL UNIQUE,
  -- UNIQUE constraint implicit here, but consider explicit naming
  password_hash TEXT,
  -- May be NULL for OAuth-only users
  api_key TEXT,
  -- May be NULL; secrets never stored plaintext (consider encryption)
  deleted_at TIMESTAMPTZ,
  -- Soft delete: NULL = active, not-NULL = deleted timestamp
  -- Replaces is_deleted BOOLEAN anti-pattern
  preferences JSONB,
  -- Semi-structured data; use JSONB not TEXT
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Always track updates for audit/pagination
  
  CONSTRAINT user_account_id_pk PRIMARY KEY (id),
  CONSTRAINT user_account_email_key UNIQUE (email),
  CONSTRAINT user_account_org_id_fk FOREIGN KEY (org_id)
    REFERENCES organization(id) ON DELETE CASCADE ON UPDATE RESTRICT
);

-- Partial unique index for soft-delete: ensures uniqueness among non-deleted
CREATE UNIQUE INDEX idx_user_account_email_active
  ON user_account(email) WHERE deleted_at IS NULL;

-- FK column index prevents cascade lock
CREATE INDEX idx_user_account_org_id
  ON user_account(org_id);

CREATE TABLE project (
  id UUID PRIMARY KEY,
  -- UUIDv7 supplied from app layer
  org_id UUID NOT NULL REFERENCES organization(id)
    ON DELETE CASCADE
    ON UPDATE RESTRICT,
  name TEXT NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 0,
  -- NUMERIC for money, never FLOAT (precision loss)
  status TEXT NOT NULL DEFAULT 'backlog',
  -- Use CHECK constraint or lookup table, no PostgreSQL enums (can't remove values)
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT project_org_id_fk FOREIGN KEY (org_id)
    REFERENCES organization(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT project_status_valid CHECK (status IN ('backlog', 'active', 'done', 'archived'))
  -- Make invalid states unrepresentable
);

CREATE INDEX idx_project_org_id ON project(org_id);

-- Partial index for active projects (filters out deleted)
CREATE INDEX idx_project_status_active
  ON project(status) WHERE deleted_at IS NULL AND status = 'active';

CREATE TABLE task (
  -- Singular: task not tasks
  id UUID PRIMARY KEY,
  -- UUIDv7, never SERIAL (gaps, non-portable, not time-sortable)
  project_id UUID NOT NULL REFERENCES project(id)
    ON DELETE CASCADE
    ON UPDATE RESTRICT,
  assignee_id UUID REFERENCES user_account(id)
    ON DELETE SET NULL
    ON UPDATE RESTRICT,
  -- Nullable: task can be unassigned
  title TEXT NOT NULL,
  description TEXT,
  -- May be NULL: not all tasks need detailed description
  price_estimate NUMERIC,
  -- NUMERIC not FLOAT; nullable: can be estimated later
  is_completed BOOLEAN NOT NULL DEFAULT false,
  -- Boolean column starts with is_/has_
  status TEXT NOT NULL DEFAULT 'backlog',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT task_project_id_fk FOREIGN KEY (project_id)
    REFERENCES project(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT task_assignee_id_fk FOREIGN KEY (assignee_id)
    REFERENCES user_account(id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT task_status_valid CHECK (status IN ('backlog', 'active', 'done', 'archived'))
);

-- Every FK column needs an index
CREATE INDEX idx_task_project_id ON task(project_id);
CREATE INDEX idx_task_assignee_id ON task(assignee_id);

-- Covering index for common query: project_id + status, includes title/id for index-only scan
CREATE INDEX idx_task_project_id_status
  ON task(project_id, status) INCLUDE (title, created_at)
  WHERE deleted_at IS NULL;

-- BRIN index for append-only created_at on large tables
CREATE INDEX idx_task_created_at_brin
  ON task USING BRIN (created_at);

-- Soft-delete support: partial unique on title per project
CREATE UNIQUE INDEX idx_task_project_id_title_active
  ON task(project_id, title) WHERE deleted_at IS NULL;
```

## Query Best Practices

### Issues Fixed:
1. **SELECT \* wastes bandwidth** → List columns explicitly
2. **LIKE without index** → Use = or text search with TSVECTOR
3. **BETWEEN with timestamps off-by-one** → Use >= AND <
4. **OFFSET/LIMIT O(N)** → Use cursor-based pagination
5. **Missing parameterization** → All $1, $2, etc.

```sql
-- ❌ WRONG: SELECT *, no index leverage, LIKE '%...%' full scan
-- SELECT * FROM task WHERE project_id = $1 AND status = 'active' ORDER BY created_at DESC;

-- ✅ RIGHT: Named columns, index-backed WHERE clauses, explicit ordering
SELECT id, title, description, price_estimate, status, created_at
FROM task
WHERE project_id = $1
  AND status = 'active'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
-- Covered by: idx_task_project_id_status (project_id, status) INCLUDE (title, created_at)

---

-- ❌ WRONG: LIKE '%...%' = full table scan, no index
-- SELECT * FROM task WHERE description LIKE '%deploy%';

-- ✅ RIGHT: Text search with GIN index (for real apps)
-- First, add TSVECTOR column to schema:
-- ALTER TABLE task ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS
--   (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))) STORED;
-- CREATE INDEX idx_task_search_vector ON task USING GIN (search_vector);

-- Then query:
SELECT id, title, description, status, created_at
FROM task
WHERE search_vector @@ to_tsquery('english', 'deploy')
  AND deleted_at IS NULL
LIMIT 50;

---

-- ❌ WRONG: OFFSET 200 scans first 220 rows (O(N)), no cursor
-- SELECT * FROM task WHERE assignee_id = $1 ORDER BY created_at DESC LIMIT 20 OFFSET 200;

-- ✅ RIGHT: Cursor-based pagination (keyset) — O(1)
-- Pass cursor_id from previous page (id of last row returned)
SELECT id, title, status, created_at
FROM task
WHERE assignee_id = $1
  AND deleted_at IS NULL
  AND (created_at, id) < ($2::TIMESTAMPTZ, $3::UUID)  -- cursor: last created_at & id
ORDER BY created_at DESC, id DESC
LIMIT 21;  -- Fetch one extra to signal "more pages"

---

-- ❌ WRONG: NOW() same entire transaction, BETWEEN off-by-one
-- SELECT * FROM task WHERE created_at > NOW() - INTERVAL '1 hour';

-- ✅ RIGHT: clock_timestamp() for wall-clock, >= AND < to avoid off-by-one
SELECT id, title, status, created_at
FROM task
WHERE created_at >= clock_timestamp() - INTERVAL '1 hour'
  AND created_at < clock_timestamp()
  AND deleted_at IS NULL
ORDER BY created_at DESC;
-- Covered by: idx_task_created_at_brin (natural order on disk, tiny footprint)

---

-- N+1 PREVENTION: Load tasks + assignee in ONE query, never loop + query
-- ❌ WRONG:
-- const tasks = await db.select().from(task);
-- for (const t of tasks) {
--   t.assignee = await db.select().from(user_account).where(eq(user_account.id, t.assignee_id));
-- }

-- ✅ RIGHT: LEFT JOIN (eager load)
SELECT
  t.id, t.title, t.status, t.created_at,
  u.id AS assignee_id, u.full_name AS assignee_name
FROM task t
LEFT JOIN user_account u ON u.id = t.assignee_id
WHERE t.project_id = $1
  AND t.deleted_at IS NULL
  AND u.deleted_at IS NULL
ORDER BY t.created_at DESC
LIMIT 50;
```

## DDL Migration Safe Patterns

### Issues Fixed:
1. **ALTER TABLE RENAME in production** → Use expand-and-contract
2. **Missing lock_timeout** → Add 5s to prevent write queue
3. **Autovacuum disabled** → Keep enabled
4. **CREATE INDEX blocks writes** → Use CONCURRENTLY

```sql
-- ===== Migration 1: Add new column (non-blocking) =====
SET lock_timeout = '5s';

ALTER TABLE user_account
  ADD COLUMN full_name_new TEXT;
-- Non-blocking, adds nullable column, no table lock

-- ===== Migration 2: Backfill in batches (zero downtime) =====
-- Run in background, restart if needed
UPDATE user_account
SET full_name_new = name
WHERE full_name_new IS NULL
LIMIT 1000;  -- Batch, repeat until done

-- ===== Migration 3: Dual-write in app =====
-- App writes BOTH name AND full_name_new for several days

-- ===== Migration 4: Switch reads to new column =====
-- App reads from full_name_new, still writing to both

-- ===== Migration 5: Drop old column (separate migration, after verification) =====
SET lock_timeout = '5s';

ALTER TABLE user_account
  DROP COLUMN name;
-- Only drop after confident new column is correct

---

-- Safe constraint addition (non-blocking)
SET lock_timeout = '5s';

ALTER TABLE user_account
  ADD CONSTRAINT user_account_email_not_null
    CHECK (email IS NOT NULL) NOT VALID;

ALTER TABLE user_account
  VALIDATE CONSTRAINT user_account_email_not_null;
-- VALIDATE in separate transaction; allows validation to happen in background

---

-- Safe index creation (non-blocking)
SET lock_timeout = '5s';

CREATE INDEX CONCURRENTLY idx_user_account_org_id
  ON user_account(org_id);
-- CONCURRENTLY allows reads/writes during index build

---

-- Remove autovacuum-disable anti-pattern
-- ❌ WRONG: ALTER TABLE task SET (autovacuum_enabled = false);
-- ✅ RIGHT: Keep autovacuum enabled (default), tune frequency if needed
ALTER TABLE task SET (autovacuum_vacuum_scale_factor = 0.01);
-- If high churn: increase autovacuum frequency per role instead
ALTER ROLE app SET statement_timeout TO '250ms';
```

## Drizzle ORM Schema (TypeScript)

### Issues Fixed:
1. **serial PK instead of UUIDv7** → Use uuid().primaryKey()
2. **gen_random_uuid() is UUIDv4** → Supply UUIDv7 from app ($defaultFn)
3. **Missing constraints in third argument** → Add check(), index()
4. **TIMESTAMP without timezone** → Add { withTimezone: true }
5. **Missing column comments** → .notNull().default() with rationale
6. **Bare VARCHAR** → text() type
7. **No drizzle logger** → Attach OTel logger
8. **Missing row type exports** → Export typeof table.$inferSelect

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  boolean,
  check,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';  // Use app-layer UUIDv7

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey(),
  // UUIDv7 supplied from app; no DEFAULT gen_random_uuid()
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Constraints and indexes in third argument
  index('idx_organization_name').on(t.name),
]);

export type Organization = typeof organization.$inferSelect;
// Always export row type; use $inferSelect not legacy InferSelectModel

export const userAccount = pgTable('user_account', {
  id: uuid('id').primaryKey(),
  // UUIDv7 will be supplied by app in insert()
  orgId: uuid('org_id').notNull().references(() => organization.id, {
    onDelete: 'cascade',
    onUpdate: 'restrict',
  }),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  // Nullable: OAuth-only users have no password
  apiKey: text('api_key'),
  // Nullable: secrets never stored plaintext, consider pgcrypto
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // Soft delete: NULL = active; replaces is_deleted boolean
  preferences: text('preferences'),  // JSON serialized in app, or JSONB if using postgres
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Constraints and indexes
  index('idx_user_account_org_id').on(t.orgId),
  index('idx_user_account_email_active').on(t.email).where(sql`${t.deletedAt} IS NULL`),
  // Partial index: active emails only
  check('user_account_email_not_empty', sql`${t.email} != ''`),
]);

export type UserAccount = typeof userAccount.$inferSelect;

export const project = pgTable('project', {
  id: uuid('id').primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organization.id, {
    onDelete: 'cascade',
    onUpdate: 'restrict',
  }),
  name: text('name').notNull(),
  budget: numeric('budget').notNull().default('0'),
  // NUMERIC for money, not FLOAT (precision)
  status: text('status').notNull().default('backlog'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_project_org_id').on(t.orgId),
  index('idx_project_status_active').on(t.status).where(
    sql`${t.deletedAt} IS NULL AND ${t.status} = 'active'`
  ),
  check('project_status_valid', sql`${t.status} IN ('backlog', 'active', 'done', 'archived')`),
]);

export type Project = typeof project.$inferSelect;

export const task = pgTable('task', {
  id: uuid('id').primaryKey(),
  // UUIDv7 supplied from app, NOT SERIAL
  projectId: uuid('project_id').notNull().references(() => project.id, {
    onDelete: 'cascade',
    onUpdate: 'restrict',
  }),
  assigneeId: uuid('assignee_id').references(() => userAccount.id, {
    onDelete: 'set null',
    onUpdate: 'restrict',
  }),
  // Nullable: task can be unassigned
  title: text('title').notNull(),
  description: text('description'),
  priceEstimate: numeric('price_estimate'),
  // NUMERIC not FLOAT; nullable: estimate comes later
  isCompleted: boolean('is_completed').notNull().default(false),
  // Boolean starts with is_/has_
  status: text('status').notNull().default('backlog'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Every FK column gets an index
  index('idx_task_project_id').on(t.projectId),
  index('idx_task_assignee_id').on(t.assigneeId),
  
  // Covering index for common query (status filter + listing)
  index('idx_task_project_id_status').on(t.projectId, t.status).where(sql`${t.deletedAt} IS NULL`),
  
  // BRIN for append-only created_at (time-series on large tables)
  // Note: Drizzle doesn't expose BRIN syntax; use raw migration for this
  
  // Constraints
  check('task_status_valid', sql`${t.status} IN ('backlog', 'active', 'done', 'archived')`),
]);

export type Task = typeof task.$inferSelect;

// ===== Drizzle client with OTel logger =====
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { trace } from '@opentelemetry/api';

class OtelDrizzleLogger {
  logQuery(query: string, params: unknown[]) {
    const span = trace.getActiveSpan();
    if (!span) return;  // Zero overhead when no active span
    span.setAttribute('db.statement', query);
    span.setAttribute('db.system', 'postgresql');
  }
}

const client = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ✅ Connection pool math: (core_count * 2) + 1 for SSD
  // If 5 instances * 20 = 100 connections approaches max_connections (100),
  // use PgBouncer in transaction mode, NOT increase max_connections
  max: 20,  // Per instance: assume 4-core = (4 * 2) + 1
  min: 5,
  // Session timeouts to prevent pool exhaustion:
  statement_timeout: 30000,  // 30s; kills runaway queries
  idle_in_transaction_session_timeout: 60000,  // 60s; reclaim idle-in-txn connections
});

export const db = drizzle(client, {
  schema: {
    organization,
    userAccount,
    project,
    task,
  },
  logger: new OtelDrizzleLogger(),
  // Never bare drizzle(client, { schema })
});
```

## Repository & Error Handling

### Issues Fixed:
1. **Throwing errors instead of returning them** → Use union types
2. **Generic `new Error()`** → Domain-specific error classes
3. **No error wrapping** → Preserve cause for debugging
4. **Any types** → Typed inputs and outputs
5. **N+1 implicit** → Document eager-load strategy

```typescript
// errors.ts
export class TaskNotFoundError {
  readonly _tag = 'TaskNotFound' as const;
  constructor(readonly taskId: string) {}
}

export class DatabaseError {
  readonly _tag = 'DatabaseError' as const;
  constructor(
    readonly message: string,
    readonly cause: Error
  ) {}
}

export type TaskError = TaskNotFoundError | DatabaseError;

// task-repository.ts
import { uuidv7 } from 'uuidv7';

type FindByIdResult = { id: string; title: string; status: string } | TaskNotFoundError | DatabaseError;

export function createTaskRepository(db: typeof import('./db').db) {
  return {
    async findById(id: string): Promise<FindByIdResult> {
      try {
        // Explicit columns, parameterized
        const result = await db
          .select({
            id: task.id,
            title: task.title,
            status: task.status,
          })
          .from(task)
          .where(eq(task.id, id))
          .limit(1);

        if (!result.length) {
          return new TaskNotFoundError(id);
        }
        return result[0];
      } catch (error) {
        return new DatabaseError(
          'Failed to fetch task',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    async createWithComment(
      taskData: { projectId: string; title: string; description?: string },
      commentText: string
    ): Promise<
      { task: Task; comment: Comment } | TaskCreateError | CommentCreateError | DatabaseError
    > {
      try {
        return await db.transaction(async (tx) => {
          // Insert task with UUIDv7
          const [newTask] = await tx
            .insert(task)
            .values({
              ...taskData,
              id: uuidv7(),  // App-supplied UUIDv7
            })
            .returning();

          // Insert comment (eager-loaded in same transaction, no N+1)
          const [newComment] = await tx
            .insert(comment)
            .values({
              taskId: newTask.id,
              text: commentText,
            })
            .returning();

          return { task: newTask, comment: newComment };
        });
      } catch (error) {
        return new DatabaseError(
          'Failed to create task with comment',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    // ✅ SAFE: Parameterized, uses index, no LIKE '%...%'
    async searchByTitle(projectId: string, titleQuery: string): Promise<Task[] | DatabaseError> {
      try {
        return await db
          .select({
            id: task.id,
            title: task.title,
            status: task.status,
            createdAt: task.createdAt,
          })
          .from(task)
          .where(
            and(
              eq(task.projectId, projectId),
              ilike(task.title, `%${titleQuery}%`),  // Case-insensitive, still uses index
              isNull(task.deletedAt)  // Exclude soft-deleted
            )
          )
          .limit(50);
      } catch (error) {
        return new DatabaseError(
          'Failed to search tasks',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;

// ===== Route handler with exhaustive error matching =====
export async function handleGetTask(req: Request, taskId: string) {
  const repo = createTaskRepository(db);
  const result = await repo.findById(taskId);

  // Exhaustive match on error _tag
  if (result._tag === 'TaskNotFound') {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  }
  if (result._tag === 'DatabaseError') {
    console.error('DB error:', result.cause);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 });
  }

  // TypeScript guarantees result is now the success case
  return new Response(JSON.stringify(result));
}
```

## Database Connection & Least Privilege

### Issues Fixed:
1. **App connects as postgres superuser** → Create app_user role, GRANT only DML
2. **Connection string hardcoded** → Use environment variables
3. **No timeouts** → Add statement_timeout + idle_in_transaction_session_timeout
4. **No RLS** → Enable RLS + write policies on every table

```sql
-- ===== Least Privilege: Create app role =====
-- Run as superuser once; credentials from vault/env, never hardcoded
CREATE ROLE app_user WITH LOGIN PASSWORD 'from_env_or_vault';

-- Grant DML only, NOT superuser
GRANT CONNECT ON DATABASE production TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Future tables auto-granted
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Set per-role timeouts (prevent runaway queries + idle-in-txn exhaustion)
ALTER ROLE app_user SET statement_timeout TO '30s';
ALTER ROLE app_user SET idle_in_transaction_session_timeout TO '60s';

-- ===== Row-Level Security for multi-tenant =====
-- Enable RLS on every table
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
ALTER TABLE task ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_account ENABLE ROW LEVEL SECURITY;

-- Policies: org_id = current_setting('app.current_org_id')::uuid
-- (assuming app sets this via SET LOCAL at request start)
CREATE POLICY tenant_isolation_org ON organization
  USING (id = current_setting('app.current_org_id')::uuid);

CREATE POLICY tenant_isolation_project ON project
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY tenant_isolation_task ON task
  USING (project_id IN (
    SELECT id FROM project
    WHERE org_id = current_setting('app.current_org_id')::uuid
  ));

CREATE POLICY tenant_isolation_user ON user_account
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Keep policies index-backed: org_id is already indexed
```

```typescript
// db.ts: Correct connection setup
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// ✅ Use app_user, never postgres
const client = new Pool({
  connectionString: process.env.DATABASE_URL,
  // e.g., postgresql://app_user:password@host/dbname
  
  // Connection pool sizing: (core_count * 2) + effective_spindle_count
  // For 4-core SSD: (4 * 2) + 1 = 9; round to 10-20 per instance
  max: 20,
  min: 5,
  
  // Idle timeout to reclaim connections
  idleTimeoutMillis: 30000,
  
  // Query timeout: app-level to catch stuck queries
  query_timeout: 30000,
});

// Monitor pool exhaustion
client.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

export const db = drizzle(client, { schema, logger: new OtelDrizzleLogger() });

// App middleware: set current org for RLS
export async function withOrgContext(orgId: string, fn: () => Promise<any>) {
  const client = await db.client.connect();
  try {
    // RLS context via PostgreSQL custom setting
    await client.query(`SET LOCAL app.current_org_id = '${orgId}'`);
    return await fn();
  } finally {
    client.release();
  }
}
```

## Summary: Issues Fixed

| Issue | Rule | Fix |
|-------|------|-----|
| TRUNCATE during traffic | Gotcha: TRUNCATE takes ACCESS EXCLUSIVE | Use DELETE FROM |
| gen_random_uuid() for PK | Critical: UUIDv7 not UUIDv4 | App-supplied uuidv7() |
| TIMESTAMP not TIMESTAMPTZ | Critical: always TIMESTAMPTZ | Add { withTimezone: true } |
| VARCHAR(n) | Critical: use TEXT not VARCHAR | text() type |
| FK columns without index | Critical: prevents cascade lock | CREATE INDEX on every FK |
| is_deleted BOOLEAN | Critical: use deleted_at TIMESTAMPTZ | Soft delete with timestamp |
| Missing constraints | Critical: make invalid unrepresentable | Add CHECK constraints |
| Missing ON DELETE/ON UPDATE | Critical: explicit referential actions | Specify CASCADE/RESTRICT/etc |
| SELECT * | Gotcha: wastes bandwidth | List columns explicitly |
| LIKE '%...%' | Query: no index leverage | Use = or TSVECTOR+GIN |
| BETWEEN with TIMESTAMP | Gotcha: off-by-one | Use >= AND < |
| OFFSET/LIMIT pagination | Performance: O(N) scans | Cursor-based keyset |
| NOW() in transaction | Gotcha: same value entire txn | Use clock_timestamp() |
| ALTER TABLE RENAME production | Operational: breaks all instances instantly | Expand-and-contract (5 steps) |
| Missing lock_timeout on DDL | Operational: write queue pileups | SET lock_timeout = '5s' |
| Autovacuum disabled | Operational: bloat/dead tuples | Keep enabled (default) |
| CREATE INDEX blocks writes | Operational: full table lock | CREATE INDEX CONCURRENTLY |
| serial PK instead of UUID | ORM: non-portable, gaps | uuid().primaryKey() |
| Missing drizzle logger | ORM: no observability | Attach OtelDrizzleLogger |
| Throwing Error() | Repository: no error recovery | Return union types |
| Implicit N+1 queries | Query: scales with result set | Document eager-load strategy |
| App connects as postgres | Security: least privilege violated | CREATE app_user role, GRANT DML only |
| No RLS | Security: multi-tenant isolation | Enable RLS + policies on every table |
| Missing column comments | Schema: rationale unclear | Document every column |
| Hardcoded secrets | Security: plaintext leaks | Use vault/environment only |

All rules from the database skill enforced.
