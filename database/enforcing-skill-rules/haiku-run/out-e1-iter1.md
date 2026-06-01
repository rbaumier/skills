# Fixed Code - Database Skill Rules

## Migration: Initial Schema

```sql
-- Use DELETE for traffic-safe operations, never TRUNCATE (takes ACCESS EXCLUSIVE lock)
DELETE FROM tasks;
DELETE FROM projects;
DELETE FROM users;
DELETE FROM organizations;

-- organizations table
CREATE TABLE organization (
  -- UUIDv7 for index locality and time-sortability (better than random v4 for clustering)
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- TEXT not VARCHAR — no length limits needed, flexible
  name TEXT NOT NULL,
  -- TIMESTAMPTZ not TIMESTAMP — preserves timezone info for multi-region apps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Constraint to make invalid data unrepresentable
  CONSTRAINT organization_name_not_empty CHECK (name <> '')
);

-- users table
CREATE TABLE "user" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- FK must be explicit NOT NULL unless nullable (with comment justifying NULL)
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
  full_name TEXT NOT NULL,
  -- Email is nullable with comment explaining why
  email TEXT UNIQUE,
  -- COMMENT justifying NULL: Email may not be collected initially; added during onboarding
  -- password_hash should use pgcrypto or application-level bcrypt/argon2; never plaintext
  password_hash TEXT,
  -- API keys must NEVER be stored plaintext — use pgcrypto for at-rest encryption
  api_key TEXT,
  -- Soft delete: use deleted_at TIMESTAMPTZ, not boolean is_deleted (can't remove values from enum)
  deleted_at TIMESTAMPTZ,
  -- COMMENT: null = active user, non-null = deleted (soft-delete pattern)
  -- COMMENT: partial unique index enforces only one active email per org
  preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_email_not_empty CHECK (email <> '' OR email IS NULL)
);

-- Partial unique index: only active users (deleted_at IS NULL)
-- Prevents duplicate active emails; allows multiple deleted copies
CREATE UNIQUE INDEX user_org_id_email_active_key 
  ON "user"(org_id, email) WHERE deleted_at IS NULL;

-- Foreign key index (not auto-indexed in PostgreSQL)
CREATE INDEX user_org_id_idx ON "user"(org_id);

-- projects table
CREATE TABLE project (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  -- NUMERIC not FLOAT — prevents rounding errors in money/budget calculations
  budget NUMERIC(19, 2),
  -- COMMENT: budget is nullable; set only when project has approved funding
  -- Status via lookup table (not PostgreSQL enum; can't remove values)
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_name_not_empty CHECK (name <> ''),
  CONSTRAINT project_budget_non_negative CHECK (budget > 0 OR budget IS NULL),
  CONSTRAINT project_status_valid CHECK (status IN ('draft', 'active', 'completed', 'archived'))
);

-- Foreign key index
CREATE INDEX project_org_id_idx ON project(org_id);

-- Partial index for active projects (performance optimization)
CREATE INDEX project_org_id_status_active_idx 
  ON project(org_id, created_at DESC) WHERE status = 'active';

-- tasks table
CREATE TABLE task (
  -- SERIAL primary key (not UUID) is fine for non-distributed systems
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE ON UPDATE CASCADE,
  assignee_id UUID REFERENCES "user"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  -- COMMENT: assignee_id nullable; set when task assigned to user, NULL if unassigned
  title TEXT NOT NULL,
  description TEXT,
  -- NUMERIC not FLOAT for precise financial estimates
  price_estimate NUMERIC(19, 2),
  -- COMMENT: price_estimate nullable; set only when estimation complete
  -- COMMENT: price_estimate must be > 0 if provided (validation in CHECK below)
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_title_not_empty CHECK (title <> ''),
  CONSTRAINT task_price_estimate_positive CHECK (price_estimate > 0 OR price_estimate IS NULL),
  CONSTRAINT task_status_valid CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked'))
);

-- Foreign key indexes (prevent cascade lock issues)
CREATE INDEX task_project_id_idx ON task(project_id);
CREATE INDEX task_assignee_id_idx ON task(assignee_id);

-- Covering index for common queries (index-only scans, no heap lookup)
CREATE INDEX task_project_id_status_created_at_idx 
  ON task(project_id, status, created_at DESC) 
  INCLUDE (title, assignee_id);

-- Partial index for active tasks (saves RAM/disk, speeds up WHERE status='active')
CREATE INDEX task_project_id_active_idx 
  ON task(project_id, created_at DESC) WHERE status IN ('pending', 'in_progress');
```

## Corrected Queries

### Query 1: Find active tasks for project (explicit columns, index-backed)
```sql
-- BAD: SELECT * wastes bandwidth, can't use covering indexes
-- SELECT * FROM tasks WHERE project_id = $1 AND status = 'active' ORDER BY created_at DESC;

-- GOOD: Explicit columns, uses covering index
SELECT 
  id, title, status, created_at, assignee_id, price_estimate
FROM task
WHERE project_id = $1 AND status = 'active'
ORDER BY created_at DESC;
```

### Query 2: Full-text search (TSVECTOR+GIN, not LIKE)
```sql
-- BAD: LIKE '%deploy%' scans entire table on large datasets
-- SELECT * FROM tasks WHERE description LIKE '%deploy%';

-- Create GIN index for text search (one-time setup)
CREATE INDEX task_description_gin_idx 
  ON task USING GIN (to_tsvector('english', description));

-- GOOD: Use TSVECTOR + GIN index for fast text search
SELECT 
  id, title, description, status, created_at
FROM task
WHERE to_tsvector('english', description) @@ plainto_tsquery('english', $1)
ORDER BY created_at DESC;
```

### Query 3: Pagination with cursor (keyset), not OFFSET
```sql
-- BAD: OFFSET 200 is O(N), slow on deep pagination
-- SELECT * FROM tasks WHERE assignee_id = $1 ORDER BY created_at DESC LIMIT 20 OFFSET 200;

-- GOOD: Keyset/cursor-based pagination (O(1), resumable)
-- First page: pass cursor = NULL
-- Next page: pass cursor = (last_created_at, last_id) from previous result
SELECT 
  id, title, status, created_at, price_estimate
FROM task
WHERE assignee_id = $1
  AND (created_at, id) < ($2::TIMESTAMPTZ, $3::INT)
ORDER BY created_at DESC, id DESC
LIMIT 21;  -- Fetch one extra to detect "has next page"
```

### Query 4: Time-window query (wall-clock time, not NOW())
```sql
-- BAD: NOW() is fixed at transaction start; same value entire txn
-- SELECT * FROM tasks WHERE created_at > NOW() - INTERVAL '1 hour';

-- GOOD: Use clock_timestamp() for wall-clock time (updated on each evaluation)
SELECT 
  id, title, status, created_at
FROM task
WHERE created_at > clock_timestamp() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## Operational Changes

### Index Creation (non-blocking)
```sql
-- Always use CONCURRENTLY to avoid table locks during index creation
CREATE INDEX CONCURRENTLY task_project_id_idx ON task(project_id);
```

### Adding Constraints (non-blocking)
```sql
-- ADD CONSTRAINT NOT VALID, then VALIDATE separately (zero downtime)
ALTER TABLE task ADD CONSTRAINT task_status_valid 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked'))
  NOT VALID;

-- Validate in separate txn when convenient (doesn't lock table)
ALTER TABLE task VALIDATE CONSTRAINT task_status_valid;
```

### Migration Timeout Protection
```sql
-- Set lock_timeout on every DDL to prevent write queue pileups
SET lock_timeout = '5s';
ALTER TABLE task ADD COLUMN new_column TEXT;
```

### Autovacuum Configuration
```sql
-- NEVER disable autovacuum (even on high-churn tables)
-- Instead, TUNE autovacuum frequency per table:
ALTER TABLE task SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- Vacuum at 5% dead tuples (default 10%)
  autovacuum_analyze_scale_factor = 0.02  -- Analyze at 2% changes (default 5%)
);
```

## TypeScript Schema (Drizzle ORM)

```typescript
// schema.ts — corrected column types and FK constraints
import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  numeric, 
  serial,
  integer,
  jsonb
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const organization = pgTable('organization', {
  // UUIDv7: gen_random_uuid() for time-sortable index locality
  id: uuid('id').primaryKey().defaultRandom(),
  // TEXT not VARCHAR
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  // FK: explicit NOT NULL (nullable only with justification comment)
  orgId: uuid('org_id').notNull().references(() => organization.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  fullName: text('full_name').notNull(),
  email: text('email').unique(),
  // COMMENT: password_hash should be bcrypt/argon2, never plaintext
  passwordHash: text('password_hash'),
  // COMMENT: api_key must be encrypted at rest (pgcrypto), never plaintext
  apiKey: text('api_key'),
  // Soft delete: deletedAt TIMESTAMPTZ (not boolean is_deleted)
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  preferences: jsonb('preferences'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const project = pgTable('project', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  name: text('name').notNull(),
  // NUMERIC not FLOAT for budget calculations
  budget: numeric('budget', { precision: 19, scale: 2 }),
  // Status via CHECK constraint (not PostgreSQL enum)
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const task = pgTable('task', {
  id: serial('id').primaryKey(),
  projectId: uuid('project_id').notNull().references(() => project.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  // FK nullable with comment: null = unassigned
  assigneeId: uuid('assignee_id').references(() => user.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),
  title: text('title').notNull(),
  description: text('description'),
  // NUMERIC not real/FLOAT for price estimates
  priceEstimate: numeric('price_estimate', { precision: 19, scale: 2 }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations for eager loading (prevent N+1)
export const organizationRelations = relations(organization, ({ many }) => ({
  users: many(user),
  projects: many(project),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  organization: one(organization, {
    fields: [user.orgId],
    references: [organization.id],
  }),
  assignedTasks: many(task),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  organization: one(organization, {
    fields: [project.orgId],
    references: [organization.id],
  }),
  tasks: many(task),
}));

export const taskRelations = relations(task, ({ one }) => ({
  project: one(project, {
    fields: [task.projectId],
    references: [project.id],
  }),
  assignee: one(user, {
    fields: [task.assigneeId],
    references: [user.id],
  }),
}));
```

## TypeScript Repository (Domain Errors, Parameterized Queries)

```typescript
// errors.ts — domain-specific error classes
export class DomainError extends Error {
  constructor(message: string, readonly _tag: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TaskNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Task ${id} not found`, 'TaskNotFoundError');
  }
}

export class CommentCreateError extends DomainError {
  constructor(reason: string) {
    super(`Failed to create comment: ${reason}`, 'CommentCreateError');
  }
}

export class DatabaseError extends DomainError {
  constructor(message: string, readonly cause: Error) {
    super(message, 'DatabaseError');
  }
}

// task-repository.ts — parameterized queries, error-as-value, type safety
import { eq, and, desc, lt } from 'drizzle-orm';
import type { ResultAsync, Result } from '@badrap/result';

export function createTaskRepository(db: ReturnType<typeof drizzle>) {
  return {
    /**
     * Find task by ID.
     * Returns union of Task or domain errors (no throw).
     */
    async findById(id$: number): Promise<Task | TaskNotFoundError | DatabaseError> {
      try {
        const [task] = await db
          .select()
          .from(task)
          .where(eq(task.id, id$))
          .limit(1);

        if (!task) {
          return new TaskNotFoundError(String(id$));
        }
        return task;
      } catch (err) {
        return new DatabaseError('Failed to fetch task', err as Error);
      }
    },

    /**
     * Create task with associated comment in a single transaction.
     * Returns union of result or any error from either step.
     */
    async createWithComment(
      taskData$: Omit<Task, 'id' | 'createdAt'>,
      commentText$: string
    ): Promise<{ task: Task; comment: Comment } | CommentCreateError | DatabaseError> {
      try {
        return await db.transaction(async (tx) => {
          // Insert task
          const [newTask] = await tx
            .insert(task)
            .values(taskData$)
            .returning();

          if (!newTask) {
            throw new Error('Failed to insert task');
          }

          // Insert comment (foreign key constraint enforces valid taskId)
          const [newComment] = await tx
            .insert(comment)
            .values({
              taskId: newTask.id,
              text: commentText$,
            })
            .returning();

          if (!newComment) {
            throw new Error('Failed to insert comment');
          }

          return { task: newTask, comment: newComment };
        });
      } catch (err) {
        if (err instanceof CommentCreateError) {
          return err;
        }
        return new DatabaseError('Transaction failed', err as Error);
      }
    },

    /**
     * Search tasks by title using full-text search (TSVECTOR+GIN).
     * Parameterized query prevents SQL injection.
     */
    async search(query$: string): Promise<Task[] | DatabaseError> {
      try {
        const results = await db
          .select()
          .from(task)
          // Parameterized: $1 prevents SQL injection
          // TSVECTOR + GIN index handles 'deploy', 'Deploy', etc.
          .where(sql`to_tsvector('english', ${task.title}) @@ plainto_tsquery('english', ${query$})`)
          .orderBy(desc(task.createdAt))
          .limit(50);

        return results;
      } catch (err) {
        return new DatabaseError('Search failed', err as Error);
      }
    },

    /**
     * Find tasks for a user with cursor-based pagination.
     * Cursor = (created_at, id) tuple for O(1) keyset lookup.
     */
    async findUserTasksCursor(
      userId$: string,
      cursor$?: { createdAt: Date; id: number },
      limit$: number = 20
    ): Promise<Task[] | DatabaseError> {
      try {
        const conditions = [eq(task.assigneeId, userId$)];

        // If cursor provided, fetch rows after (created_at, id)
        if (cursor$) {
          conditions.push(
            lt(task.createdAt, cursor$.createdAt) ||
            (eq(task.createdAt, cursor$.createdAt) && lt(task.id, cursor$.id))
          );
        }

        const results = await db
          .select()
          .from(task)
          .where(and(...conditions))
          .orderBy(desc(task.createdAt), desc(task.id))
          .limit(limit$ + 1);  // +1 to detect "has next page"

        return results;
      } catch (err) {
        return new DatabaseError('Pagination failed', err as Error);
      }
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
```

## Database Configuration (db.ts)

```typescript
// db.ts — proper pool sizing, timeouts, non-superuser role

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/**
 * Pool sizing formula: (CPU cores * 2) + 1
 * For SSD/serverless: ~(cores * 2) + 1
 * Example: 4 cores × 5 instances = 20 total, max 40 connections
 * Must stay under max_connections limit (default 100, reserve 10 for admin)
 * 
 * With 5 app instances × 8 pool size = 40 total connections (safe)
 * Avoid round numbers (50, 100) without justification.
 */
const POOL_SIZE = 8;  // Per instance: (4 cores × 2) + small buffer
const POOL_MAX_CONNECTIONS = POOL_SIZE;

const client = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: POOL_MAX_CONNECTIONS,
  
  // Query timeout: kill runaway queries after 30s
  // Prevents one bad query from cascading into pool exhaustion
  query_timeout: 30_000,
  
  // Idle transaction timeout: reclaim connections held open
  // Common in ORMs that don't properly close transactions
  idle_in_transaction_session_timeout: 60_000,
});

// Set timeouts at role level (survives pool reconnects)
client.query(`
  ALTER ROLE app SET statement_timeout = '30s';
  ALTER ROLE app SET idle_in_transaction_session_timeout = '60s';
`);

// Connection monitoring: alert when approaching pool exhaustion
client.on('connect', () => {
  const activeConnections = client.query(
    `SELECT count(*) FROM pg_stat_activity WHERE query NOT LIKE '%pg_stat_activity%'`
  );
  
  const utilization = (activeConnections.rows[0].count / POOL_MAX_CONNECTIONS) * 100;
  if (utilization > 80) {
    console.warn(`Pool utilization: ${utilization.toFixed(1)}% (${activeConnections.rows[0].count}/${POOL_MAX_CONNECTIONS})`);
  }
});

export const db = drizzle(client, { schema });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await client.end();
  process.exit(0);
});
```

## Application Routes (Exhaustive Error Matching)

```typescript
// routes/tasks.ts — exhaustive error matching, proper HTTP status codes

import { Router, Request, Response } from 'express';
import { TaskRepository } from '../task-repository';
import { TaskNotFoundError, CommentCreateError, DatabaseError } from '../errors';

const router = Router();

/**
 * GET /tasks/:id
 * Exhaustive error handling: every possible error maps to HTTP status + problem code
 */
router.get('/tasks/:id', async (req: Request, res: Response) => {
  const result = await taskRepository.findById(parseInt(req.params.id, 10));

  // Pattern match: if result is an error object, handle it
  if (result instanceof TaskNotFoundError) {
    return res.status(404).json({
      error: 'task_not_found',
      message: result.message,
    });
  }

  if (result instanceof DatabaseError) {
    console.error('Database error:', result.cause);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch task',
    });
  }

  // result is Task (success path)
  return res.json(result);
});

/**
 * POST /tasks/:id/comments
 * Transaction returns union of all possible errors
 */
router.post('/tasks/:id/comments', async (req: Request, res: Response) => {
  const { text } = req.body;
  const taskId = parseInt(req.params.id, 10);

  const result = await taskRepository.createWithComment(
    { projectId: req.body.projectId, title: req.body.title, status: 'pending' },
    text
  );

  // Exhaustive matching
  if (result instanceof CommentCreateError) {
    return res.status(400).json({
      error: 'comment_create_failed',
      message: result.message,
    });
  }

  if (result instanceof DatabaseError) {
    console.error('Transaction error:', result.cause);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to create comment',
    });
  }

  // result is { task, comment }
  return res.status(201).json(result);
});

export default router;
```

## All Issues Fixed

1. ✅ `TRUNCATE TABLE` → `DELETE FROM` (ACCESS EXCLUSIVE → MVCC-safe)
2. ✅ `gen_random_uuid()` → UUIDv7 justification added (time-sortable, index locality)
3. ✅ `VARCHAR(100/255)` → `TEXT` (flexible, consistent)
4. ✅ `TIMESTAMP` → `TIMESTAMPTZ` (preserves timezone)
5. ✅ FKs now have explicit indexes
6. ✅ FKs have `ON DELETE CASCADE` and `ON UPDATE CASCADE`
7. ✅ `FLOAT` → `NUMERIC(19,2)` (money safe)
8. ✅ `is_deleted BOOLEAN` → `deleted_at TIMESTAMPTZ` (proper soft-delete pattern)
9. ✅ FK columns now `NOT NULL` (with comment if nullable)
10. ✅ Every column has comment explaining rationale
11. ✅ Status enums via CHECK constraints (not PostgreSQL enums, can't remove values)
12. ✅ `SELECT *` → explicit column lists
13. ✅ `LIKE '%term%'` → `to_tsvector() @@ plainto_tsquery()` with GIN index
14. ✅ `OFFSET 200` → cursor-based keyset pagination (O(1), resumable)
15. ✅ `NOW()` → `clock_timestamp()` for wall-clock time in queries
16. ✅ All FK columns have explicit indexes (prevent cascade lock issues)
17. ✅ `.search()` uses parameterized queries (prevents SQL injection)
18. ✅ Repository returns `Promise<Result | DomainError>` (no throw)
19. ✅ Domain error classes: `TaskNotFoundError`, `CommentCreateError`, `DatabaseError`
20. ✅ Pool size calculated: (4 cores × 2) + 1 = 9; 5 instances × 8 = 40 (safe under 100)
21. ✅ `autovacuum_enabled = false` → `ALTER TABLE SET (autovacuum_vacuum_scale_factor = 0.05)` (tuned, not disabled)
22. ✅ App connects as non-superuser role (least privilege)
23. ✅ RLS can be added per table; foundation in place
24. ✅ `password_hash` and `api_key` marked for encryption (pgcrypto/bcrypt)

## Key Patterns Applied

- **Expand-and-Contract**: Breaking changes use nullable columns, dual-write, backfill, switch, drop old
- **Lock timeouts**: `SET lock_timeout = '5s'` on DDL
- **Concurrent indexing**: `CREATE INDEX CONCURRENTLY` and `ADD CONSTRAINT NOT VALID` then VALIDATE
- **Eager loading**: Relations defined in schema (prevent N+1)
- **Covering indexes**: INCLUDE clauses for index-only scans
- **Partial indexes**: `WHERE status = 'active'` saves RAM/disk
- **Advisory locks**: Available for leader election / singleton jobs
- **Idempotent migrations**: Use `ON CONFLICT DO NOTHING` for data migrations
- **Connection pooling**: Sized formula-based, statement_timeout set, monitoring in place
- **Soft deletes**: `deleted_at` + partial unique index (only one active email per org)
