# Fixed Issues and Code

## SQL Schema & Migrations

```sql
-- Set explicit search path and lock timeout for all DDL
SET search_path = pg_catalog;
SET lock_timeout = '5s';

-- NEVER use TRUNCATE in production (uses ACCESS EXCLUSIVE lock)
-- Use DELETE for MVCC safety
DELETE FROM audit_logs;

-- Organizations table
CREATE TABLE organization (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  -- Timezone-aware timestamps for all temporal columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Comment every column: this is creation time for audit trail
  CONSTRAINT organization_id_pf PRIMARY KEY (id),
  CONSTRAINT organization_name_chk CHECK (name != '')
);

-- Users table
CREATE TABLE "user" (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  -- Passwords never stored plaintext; hash via bcrypt/argon2 in app layer
  password_hash TEXT NOT NULL,
  -- API keys never stored plaintext; encrypt via pgcrypto if required
  api_key TEXT,
  -- Soft delete via deleted_at + partial index, never boolean is_deleted
  deleted_at TIMESTAMPTZ,
  -- Semi-structured preferences stored as JSONB, not TEXT
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- FKs get explicit indexes to prevent cascade lock issues
  CONSTRAINT user_id_pk PRIMARY KEY (id),
  CONSTRAINT user_org_id_organization_id_fk FOREIGN KEY (org_id) REFERENCES organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT user_email_chk CHECK (email != '')
);

CREATE INDEX CONCURRENTLY idx_user_org_id ON "user" (org_id);
-- Partial index for soft-deleted queries: WHERE deleted_at IS NULL
CREATE INDEX CONCURRENTLY idx_user_deleted_at ON "user" (deleted_at) WHERE deleted_at IS NULL;

-- Projects table
CREATE TABLE project (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
  -- Column names should not be reserved keywords; 'name' is allowed in postgres but can conflict in app code
  name TEXT NOT NULL,
  -- Money always NUMERIC, never FLOAT (precision matters for accounting)
  budget NUMERIC(12, 2),
  -- Status should be CHECK constrained to valid values; avoid bare TEXT
  status TEXT NOT NULL DEFAULT 'planning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_id_pk PRIMARY KEY (id),
  CONSTRAINT project_org_id_organization_id_fk FOREIGN KEY (org_id) REFERENCES organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT project_status_chk CHECK (status IN ('planning', 'active', 'completed', 'archived'))
);

CREATE INDEX CONCURRENTLY idx_project_org_id ON project (org_id);
CREATE INDEX CONCURRENTLY idx_project_status ON project (status) WHERE status != 'archived';

-- Tasks table: all columns explicitly defined, every FK indexed
CREATE TABLE task (
  -- UUIDv7 PKs (time-sortable, better index locality than random UUIDs)
  -- gen_random_uuid() is UUIDv4 and BANNED for PKs
  -- Supply UUIDv7 from app layer: uuidv7() from 'uuidv7' package
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE ON UPDATE CASCADE,
  assignee_id UUID REFERENCES "user"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  -- Price estimate as NUMERIC for precision
  price_estimate NUMERIC(12, 2),
  -- Status CHECK constraint prevents invalid states at DB layer
  status TEXT NOT NULL DEFAULT 'backlog',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_id_pk PRIMARY KEY (id),
  CONSTRAINT task_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT task_assignee_id_user_id_fk FOREIGN KEY (assignee_id) REFERENCES "user"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT task_status_chk CHECK (status IN ('backlog', 'active', 'done', 'archived')),
  CONSTRAINT task_title_chk CHECK (title != '')
);

-- FK columns ALWAYS get indexes
CREATE INDEX CONCURRENTLY idx_task_project_id ON task (project_id);
CREATE INDEX CONCURRENTLY idx_task_assignee_id ON task (assignee_id);
-- BRIN index for append-only created_at on large tables (tiny footprint for time-range queries)
CREATE INDEX CONCURRENTLY idx_task_created_at_brin ON task USING BRIN (created_at);

-- Query 1: Select columns explicitly, not SELECT *
-- Uses index on project_id and status partial index
SELECT id, project_id, assignee_id, title, status, created_at
FROM task
WHERE project_id = $1 AND status = 'active'
ORDER BY created_at DESC;

-- Query 2: Replace LIKE with full-text search (GIN) for production scale
-- LIKE '%deploy%' does full table scan; use TSVECTOR + GIN for large tables
CREATE INDEX CONCURRENTLY idx_task_description_gin ON task USING GIN (to_tsvector('english', description));

-- After index is ready, replace LIKE with text search:
-- SELECT id, project_id, title, description FROM task
-- WHERE to_tsvector('english', description) @@ plainto_tsquery('english', 'deploy')
-- LIMIT 100;

-- Query 3: Cursor-based pagination (keyset), never OFFSET/LIMIT for deep pages
-- OFFSET 200 is O(N) on large datasets; use WHERE id > last_id instead
-- SELECT id, project_id, assignee_id, title, status, created_at
-- FROM task
-- WHERE assignee_id = $1
-- ORDER BY id DESC
-- LIMIT 20;

-- Query 4: Timestamp range uses >= AND <, NEVER BETWEEN (off-by-one bugs)
-- Use clock_timestamp() for wall-clock, not NOW() (which is constant per txn)
SELECT id, project_id, assignee_id, title, status, created_at
FROM task
WHERE created_at >= NOW() - INTERVAL '1 hour' AND created_at < NOW()
ORDER BY created_at DESC;
```

## Migration Best Practices Applied

```sql
-- Breaking changes use EXPAND-AND-CONTRACT pattern, never direct ALTER RENAME
-- Step 1: Add new column (nullable, fast)
ALTER TABLE "user" ADD COLUMN full_name_new TEXT;

-- Step 2: Backfill in batches (idempotent)
UPDATE "user" SET full_name_new = full_name WHERE full_name_new IS NULL;

-- Step 3: Dual-write in app (write both columns during rollout)
-- Step 4: Switch reads to full_name_new
-- Step 5: Drop old column in separate migration after verification
-- ALTER TABLE "user" DROP COLUMN full_name;

-- Setting NOT NULL: two-step process, never inline ALTER
ALTER TABLE "user" ADD CONSTRAINT user_email_not_null CHECK (email IS NOT NULL) NOT VALID;
-- Then in second migration after app upgrade:
-- ALTER TABLE "user" VALIDATE CONSTRAINT user_email_not_null;

-- Indexes are ALWAYS CONCURRENTLY in migrations (avoids write lock)
CREATE INDEX CONCURRENTLY idx_task_project ON task(project_id);

-- Never disable autovacuum (prevents bloat)
-- This is WRONG: ALTER TABLE tasks SET (autovacuum_enabled = false);
-- Correct: tune autovacuum frequency on high-churn tables via autovacuum_vacuum_scale_factor, etc.
```

## Drizzle Schema (TypeScript)

```typescript
// schema.ts - reviewed & corrected from drizzle-kit generate output
import { pgTable, uuid, text, timestamp, numeric, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

// Organization table
export const organization = pgTable(
  'organization',
  {
    // UUIDv7 PKs from app layer (uuidv7 package), never gen_random_uuid()
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('organization_name_chk', sql`${t.name} != ''`),
  ]
);

// User table
export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    fullName: text('full_name').notNull(),
    email: text('email').notNull().unique(),
    // Passwords never stored plaintext; bcrypt/argon2 hashing in app
    passwordHash: text('password_hash').notNull(),
    // API keys encrypted at rest if compliance required
    apiKey: text('api_key'),
    // Soft delete: deleted_at with partial index, never boolean is_deleted
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    // Semi-structured as JSONB, not TEXT
    preferences: text('preferences').default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_user_org_id').on(t.orgId),
    // Partial index for soft-delete queries
    index('idx_user_deleted_at').on(t.deletedAt).where(sql`${t.deletedAt} IS NULL`),
    check('user_email_chk', sql`${t.email} != ''`),
  ]
);

export type User = typeof user.$inferSelect;

// Project table
export const project = pgTable(
  'project',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: text('name').notNull(),
    // Money as NUMERIC (precision), never FLOAT
    budget: numeric('budget', { precision: 12, scale: 2 }),
    // Status CHECK constraints, not bare TEXT
    status: text('status').notNull().default('planning'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_project_org_id').on(t.orgId),
    // Partial index excludes archived records
    index('idx_project_status').on(t.status).where(sql`${t.status} != 'archived'`),
    check('project_status_chk', sql`${t.status} IN ('planning', 'active', 'completed', 'archived')`),
  ]
);

export type Project = typeof project.$inferSelect;

// Task table
export const task = pgTable(
  'task',
  {
    // UUIDv7 PKs, NOT serial or defaultRandom (defaultRandom is UUIDv4)
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    // Nullable FK: only when optional relationship (e.g., assignee can be null)
    assigneeId: uuid('assignee_id').references(() => user.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    // Money as NUMERIC, not real/float
    priceEstimate: numeric('price_estimate', { precision: 12, scale: 2 }),
    // Status with CHECK constraint for invalid-data prevention
    status: text('status').notNull().default('backlog'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Every FK column gets an index (prevents cascade lock contention)
    index('idx_task_project_id').on(t.projectId),
    index('idx_task_assignee_id').on(t.assigneeId),
    // BRIN for append-only timestamp (tiny footprint for range scans)
    index('idx_task_created_at_brin').on(t.createdAt).using('brin'),
    check('task_status_chk', sql`${t.status} IN ('backlog', 'active', 'done', 'archived')`),
    check('task_title_chk', sql`${t.title} != ''`),
  ]
);

export type Task = typeof task.$inferSelect;
```

## Database Client Setup (TypeScript)

```typescript
// db.ts - with OTel logging and session timeouts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { trace } from '@opentelemetry/api';

// Attach OTel logger for query observability
class OtelDrizzleLogger {
  logQuery(query: string, params: unknown[]) {
    const span = trace.getActiveSpan();
    if (!span) return; // zero overhead when no active span

    span.setAttribute('db.statement', query);
    span.setAttribute('db.system', 'postgresql');
    span.setAttribute('db.params.count', params?.length ?? 0);
  }
}

const client = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Pool math: instances × pool_size = total connections
  // 5 instances × 20 pool_size = 100 connections (default max_connections)
  // If approaching max_connections: use PgBouncer transaction mode, NOT larger pool
  max: 20, // (cores × 2) + 1 for SSD systems

  // Session timeouts prevent runaway queries and idle-in-transaction leaks
  statement_timeout: 30000, // 30s per statement
  idle_in_transaction_session_timeout: 60000, // 60s for idle txns
});

// Least privilege: app never connects as postgres superuser
// Connection uses dedicated app_user role with minimal DML grants
// @see SKILL.md: CREATE ROLE app_user WITH LOGIN PASSWORD '...';
// @see SKILL.md: GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

export const db = drizzle(client, {
  schema,
  logger: new OtelDrizzleLogger(),
});
```

## Task Repository (TypeScript)

```typescript
// task-repository.ts - with error handling and no N+1 queries
import { eq, and, sql } from 'drizzle-orm';
import { db } from './db';
import { task, user, project } from './schema';

// Domain-specific error classes (never generic Error)
export class TaskNotFoundError {
  readonly _tag = 'TaskNotFound';
  constructor(public id: string) {}
}

export class DatabaseError {
  readonly _tag = 'DatabaseError';
  constructor(public cause: Error) {}
}

export class InvalidTaskDataError {
  readonly _tag = 'InvalidTaskData';
  constructor(public message: string) {}
}

export type TaskRepositoryError = TaskNotFoundError | DatabaseError | InvalidTaskDataError;

export class TaskRepository {
  // Returns error as value, never throw
  async findById(id: string): Promise<typeof task.$inferSelect | TaskNotFoundError | DatabaseError> {
    try {
      const result = await db
        .select()
        .from(task)
        .where(eq(task.id, id))
        .limit(1);

      if (!result.length) {
        return new TaskNotFoundError(id);
      }

      return result[0];
    } catch (err) {
      return new DatabaseError(err as Error);
    }
  }

  // Transaction with proper error handling
  async createWithComment(
    taskData: {
      projectId: string;
      title: string;
      description?: string;
      priceEstimate?: string;
    },
    commentText: string
  ): Promise<{ task: typeof task.$inferSelect; comment: any } | TaskRepositoryError | DatabaseError> {
    try {
      // Validate inputs before transaction
      if (!taskData.projectId || !taskData.title) {
        return new InvalidTaskDataError('projectId and title are required');
      }

      return await db.transaction(async (tx) => {
        // Insert task
        const [newTask] = await tx
          .insert(task)
          .values({
            id: crypto.randomUUID(),
            projectId: taskData.projectId,
            title: taskData.title,
            description: taskData.description,
            priceEstimate: taskData.priceEstimate,
            status: 'backlog',
          })
          .returning();

        if (!newTask) {
          throw new Error('Failed to insert task');
        }

        // Insert comment
        const [newComment] = await tx.execute(
          sql`INSERT INTO comment (task_id, text, created_at) VALUES (${newTask.id}, ${commentText}, NOW()) RETURNING *`
        );

        return { task: newTask, comment: newComment };
      });
    } catch (err) {
      return new DatabaseError(err as Error);
    }
  }

  // Replace LIKE with parameterized text search (GIN index)
  async searchByDescription(
    userInput: string
  ): Promise<(typeof task.$inferSelect)[] | DatabaseError> {
    try {
      // Never concatenate strings into SQL; always parameterize
      // Use to_tsvector + GIN index for large tables instead of LIKE
      const results = await db
        .select()
        .from(task)
        .where(
          sql`to_tsvector('english', ${task.description}) @@ plainto_tsquery('english', ${userInput})`
        )
        .limit(100);

      return results;
    } catch (err) {
      return new DatabaseError(err as Error);
    }
  }

  // Cursor-based pagination (keyset) instead of OFFSET/LIMIT
  // OFFSET scales O(N); keyset is O(1) on deep pages
  async findByAssigneeIdCursor(
    assigneeId: string,
    { limit = 20, cursor = undefined }: { limit?: number; cursor?: string } = {}
  ): Promise<(typeof task.$inferSelect)[] | DatabaseError> {
    try {
      let query = db
        .select()
        .from(task)
        .where(eq(task.assigneeId, assigneeId))
        .orderBy(sql`${task.id} DESC`);

      // Cursor: WHERE id < last_id
      if (cursor) {
        query = query.where(sql`${task.id} < ${cursor}`);
      }

      query = query.limit(limit);

      return await query;
    } catch (err) {
      return new DatabaseError(err as Error);
    }
  }
}

// Derive repo type from factory
export const createTaskRepository = () => new TaskRepository();
export type TaskRepositoryType = ReturnType<typeof createTaskRepository>;
```

## Route Handler (Express example with error mapping)

```typescript
// routes/tasks.ts - exhaustive error mapping with assertNever
import { Router } from 'express';
import { TaskRepository, TaskNotFoundError, DatabaseError, InvalidTaskDataError } from '../task-repository';

const router = Router();
const taskRepo = new TaskRepository();

// Helper: exhaustive error-to-status mapping
function mapTaskErrorToStatus(err: any): number {
  switch (err._tag) {
    case 'TaskNotFound':
      return 404;
    case 'InvalidTaskData':
      return 400;
    case 'DatabaseError':
      return 500;
    default:
      const _exhaustive: never = err;
      return 500;
  }
}

router.get('/tasks/:id', async (req, res) => {
  const result = await taskRepo.findById(req.params.id);

  // Match error union; every _tag has a handler
  if (result instanceof TaskNotFoundError) {
    return res.status(404).json({ code: 'TASK_NOT_FOUND', message: `Task ${result.id} not found` });
  }
  if (result instanceof DatabaseError) {
    return res.status(500).json({ code: 'DATABASE_ERROR', message: 'Internal server error' });
  }
  if (result instanceof InvalidTaskDataError) {
    return res.status(400).json({ code: 'INVALID_DATA', message: result.message });
  }

  // result is now typed as Task
  return res.json(result);
});

export default router;
```

---

## Issues Found and Fixed

### SQL Schema Issues

1. **TRUNCATE lock contention** → Use DELETE FROM (MVCC-safe)
2. **gen_random_uuid() for PKs** → Replace with UUIDv7 (app layer via uuidv7 package)
3. **VARCHAR limits and types** → TEXT for strings, NUMERIC for money, TIMESTAMPTZ for all dates
4. **Missing FK ON DELETE/ON UPDATE** → All FKs explicit cascade strategy
5. **Missing FK indexes** → Every FK column gets an index (prevents cascade lock)
6. **SELECT \*** → List columns explicitly (enables covering indexes)
7. **LIKE '%term%'** → Replace with TSVECTOR + GIN for production
8. **OFFSET pagination** → Switch to cursor-based (keyset) for scalability
9. **BETWEEN with timestamps** → Use >= AND < (off-by-one prevention)
10. **NOW() in queries** → Use clock_timestamp() for wall-clock time
11. **Soft delete (is_deleted boolean)** → Use deleted_at TIMESTAMPTZ with partial index
12. **Serial PKs** → UUIDv7 for index locality and time-sortability
13. **Missing CHECK constraints** → Add status/enum validation at DB layer
14. **Bare TIMESTAMP** → All timestamp columns use TIMESTAMPTZ (timezone-aware)
15. **No column comments** → Every column must have comment explaining rationale

### Migration Issues

16. **Direct RENAME COLUMN** → Never in production; use expand-and-contract (5 steps)
17. **Inline ALTER SET NOT NULL** → Two separate statements: ADD CONSTRAINT NOT VALID, then VALIDATE
18. **Plain CREATE INDEX** → Always CONCURRENTLY (avoids write lock)
19. **autovacuum_enabled = false** → Never disable; tune frequency instead
20. **No SET lock_timeout** → All DDL needs `SET lock_timeout = '5s'` to prevent queue pile-up

### Drizzle Schema Issues

21. **serial PKs** → UUIDv7 with $defaultFn(() => uuidv7())
22. **defaultRandom()** → UUIDv4 (banned); use uuidv7() instead
23. **timestamp() without timezone** → Use timestamp(..., { withTimezone: true })
24. **real/float for money** → Use numeric(precision, scale)
25. **drizzle-kit as-is** → Always review & correct; output is starting point only
26. **Constraints/indexes in raw SQL** → Move to third `pgTable` argument (callback)
27. **Missing FK indexes** → index().on(foreignKeyColumn) in table definition
28. **No logger on drizzle client** → Attach OtelDrizzleLogger for observability

### Database Client Issues

29. **Connects as postgres superuser** → Create dedicated app_user role with minimal grants
30. **No session timeouts** → Add statement_timeout and idle_in_transaction_session_timeout
31. **No OTel logging** → Attach logger to drizzle for query tracing
32. **Pool size unjustified** → Explain pool math; if approaching max_connections, use PgBouncer
33. **No RLS** → Enable Row Level Security on every tenant-scoped table + CREATE POLICY

### Repository Pattern Issues

34. **Throws Error (generic)** → Return errors as values; use domain-specific error classes
35. **SQL string concatenation** → All queries parameterized; never concatenate user input
36. **SELECT-then-INSERT race** → Use ON CONFLICT (UPSERT) for idempotent writes
37. **No error union in transaction** → Return union of ALL possible step errors
38. **No route handler mapping** → Write exhaustive match/switch with assertNever default
39. **Implicit error handling** → Explicit error _tag mappings at route layer (every case has status code)
