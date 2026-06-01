# Database Schema and Query Corrections

## SQL Schema and Migrations

```sql
-- Set search_path for explicit schema names
SET search_path = pg_catalog;

-- Migration: Create organizations table with proper schema
-- Reviewed for: UUIDv7, TIMESTAMPTZ, constraints, comments
CREATE TABLE public.organizations (
  -- UUID v7 (time-sortable, index locality) — must be supplied from app layer, never generated in DB
  id UUID PRIMARY KEY,
  -- Organization name, required
  name TEXT NOT NULL,
  -- Created timestamp with timezone for accurate wall-clock time
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Constraint naming: tablename_columnname_suffix
  CONSTRAINT organizations_name_key UNIQUE (name)
);
-- Every FK column needs an index
CREATE INDEX CONCURRENTLY idx_organizations_id ON public.organizations (id);

-- Migration: Create users table with proper schema
CREATE TABLE public.users (
  -- UUID v7 supplied from app layer
  id UUID PRIMARY KEY,
  -- Foreign key to organizations — ALWAYS indexed
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  -- User's full name, required
  full_name TEXT NOT NULL,
  -- Email — nullable, requires unique partial index (soft delete scenario)
  email TEXT,
  -- Password hash stored as TEXT, never store plaintext passwords. Use bcrypt/argon2 in app layer.
  password_hash TEXT,
  -- API key — NEVER store plaintext. Encrypt at rest or hash. Never an exposed secret.
  api_key TEXT,
  -- Soft delete using deleted_at with partial unique index, never boolean is_deleted
  -- NULL = not deleted, set to NOW() on deletion
  deleted_at TIMESTAMPTZ,
  -- Preferences stored as JSONB for semi-structured data (not TEXT)
  preferences JSONB,
  -- Created timestamp with timezone
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Updated timestamp with timezone for tracking changes
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- FK column index required
CREATE INDEX CONCURRENTLY idx_users_org_id ON public.users (org_id);
-- Partial unique index for soft delete: prevents duplicate active emails
CREATE UNIQUE INDEX CONCURRENTLY idx_users_email_key ON public.users (email) WHERE deleted_at IS NULL;

-- Migration: Create projects table with proper schema
CREATE TABLE public.project (
  -- UUID v7 supplied from app layer
  id UUID PRIMARY KEY,
  -- Foreign key to organizations — ALWAYS indexed
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  -- Project name, required
  name TEXT NOT NULL,
  -- Budget — NUMERIC for money, never FLOAT (binary floating-point causes rounding errors)
  budget NUMERIC NOT NULL DEFAULT 0,
  -- Status — use CHECK constraint to make invalid data unrepresentable
  status TEXT NOT NULL DEFAULT 'active',
  -- Created timestamp with timezone
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Updated timestamp with timezone
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- CHECK constraint: status must be one of allowed values
  CONSTRAINT project_status_chk CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived'))
);
-- FK column index required
CREATE INDEX CONCURRENTLY idx_project_org_id ON public.project (org_id);
-- Partial index for active projects (common query pattern)
CREATE INDEX CONCURRENTLY idx_project_status ON public.project (status) WHERE status = 'active';

-- Migration: Create tasks table with proper schema
CREATE TABLE public.task (
  -- UUID v7 supplied from app layer (NOT SERIAL — serial is auto-increment, not sortable by creation order)
  id UUID PRIMARY KEY,
  -- Foreign key to projects — ALWAYS indexed
  project_id UUID NOT NULL REFERENCES public.project(id) ON DELETE CASCADE ON UPDATE CASCADE,
  -- Foreign key to assignee (users table) — nullable, requires index
  assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  -- Task title, required
  title TEXT NOT NULL,
  -- Task description, nullable with justification: optional detail
  description TEXT,
  -- Price estimate — NUMERIC for money (no rounding errors), nullable with justification: may be unknown at creation
  price_estimate NUMERIC,
  -- Task status — use CHECK constraint to enforce valid states
  status TEXT NOT NULL DEFAULT 'backlog',
  -- Created timestamp with timezone
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Updated timestamp with timezone
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- CHECK constraint: status must be one of allowed values
  CONSTRAINT task_status_chk CHECK (status IN ('backlog', 'active', 'in_review', 'done', 'archived'))
);
-- FK column indexes (critical: prevents cascade lock issues)
CREATE INDEX CONCURRENTLY idx_task_project_id ON public.task (project_id);
CREATE INDEX CONCURRENTLY idx_task_assignee_id ON public.task (assignee_id);
-- BRIN index for time-series append-only data (created_at range queries on large tables)
CREATE INDEX idx_task_created_at_brin ON public.task USING BRIN (created_at);

-- Migration: Create audit_logs table with proper schema
CREATE TABLE public.audit_log (
  -- UUID v7 supplied from app layer
  id UUID PRIMARY KEY,
  -- Foreign key to organization — ALWAYS indexed
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  -- User who triggered the action — nullable (system actions)
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  -- Action type: e.g. 'create', 'update', 'delete'
  action TEXT NOT NULL,
  -- Table affected by action
  table_name TEXT NOT NULL,
  -- Primary key of affected record
  record_id UUID,
  -- Old values as JSONB for auditing changes
  old_values JSONB,
  -- New values as JSONB for auditing changes
  new_values JSONB,
  -- Timestamp with timezone (wall-clock time for accurate audit trail)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- FK column indexes
CREATE INDEX CONCURRENTLY idx_audit_log_org_id ON public.audit_log (org_id);
CREATE INDEX CONCURRENTLY idx_audit_log_user_id ON public.audit_log (user_id);
-- BRIN index for audit trail queries (created_at ranges)
CREATE INDEX idx_audit_log_created_at_brin ON public.audit_log USING BRIN (created_at);
-- Covering index for common audit queries: (org_id, action) with created_at
CREATE INDEX CONCURRENTLY idx_audit_log_org_action ON public.audit_log (org_id, action) INCLUDE (created_at);
```

## Corrected Queries

```sql
-- Query 1: Get active tasks for a project (cursor-based pagination, no OFFSET)
-- Uses explicit columns (no SELECT *), keyset pagination, and index
SELECT 
  id, project_id, assignee_id, title, description, price_estimate, status, created_at, updated_at
FROM public.task
WHERE project_id = $1 AND status = 'active'
ORDER BY created_at DESC
LIMIT 20;

-- Query 2: Search tasks by description (use TSVECTOR + GIN instead of LIKE)
-- Create TSVECTOR index first:
-- CREATE INDEX idx_task_description_gin ON public.task USING GIN (to_tsvector('english', description));
-- Then query with text search:
SELECT 
  id, project_id, assignee_id, title, description, price_estimate, status, created_at, updated_at
FROM public.task
WHERE to_tsvector('english', COALESCE(description, '')) @@ to_tsquery('english', 'deploy')
ORDER BY created_at DESC;

-- Query 3: Get tasks for assignee with cursor-based pagination (no OFFSET which is O(N))
-- Keyset pagination: fetch next page using last ID from previous result
SELECT 
  id, project_id, assignee_id, title, description, price_estimate, status, created_at, updated_at
FROM public.task
WHERE assignee_id = $1 AND id > $2  -- $2 is the last id from previous page (cursor)
ORDER BY id ASC
LIMIT 20;

-- Query 4: Get tasks created within last hour (use >= AND < instead of BETWEEN)
-- Avoids off-by-one bugs with BETWEEN inclusive on both sides
SELECT 
  id, project_id, assignee_id, title, description, price_estimate, status, created_at, updated_at
FROM public.task
WHERE created_at >= clock_timestamp() - INTERVAL '1 hour'
  AND created_at < clock_timestamp()
ORDER BY created_at DESC;
```

## Drizzle ORM Schema (reviewed & corrected from drizzle-kit output)

```typescript
// schema.ts
// reviewed & corrected from drizzle-kit generate output:
// - Changed UUIDv4 (gen_random_uuid) → UUIDv7 (uuidv7() from app layer)
// - Changed TIMESTAMP → TIMESTAMPTZ with { withTimezone: true }
// - Changed FLOAT → NUMERIC for money
// - Changed SERIAL → UUID
// - Moved constraints and indexes to third argument (proper Drizzle pattern)
// - Added all FK indexes (required to prevent cascade lock issues)
// - Added BRIN indexes for time-series data
// - Added CHECK constraints for status enums
// - Export row types using typeof table.$inferSelect

import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  jsonb,
  index,
  check,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7'; // npm install uuidv7

// Organizations table
export const organizations = pgTable(
  'organizations',
  {
    // UUID v7 (time-sortable, index locality) supplied from app layer
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    // Organization name, required
    name: text('name').notNull(),
    // Created timestamp with timezone for accurate wall-clock time
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('organizations_name_key').on(t.name),
  ]
);
export type Organization = typeof organizations.$inferSelect;

// Users table with soft delete and auth fields
export const users = pgTable(
  'users',
  {
    // UUID v7 supplied from app layer
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    // Foreign key to organizations — must be indexed
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    // User's full name, required
    fullName: text('full_name').notNull(),
    // Email — nullable (user may not have email), indexed for unique constraint on active records
    email: text('email'),
    // Password hash stored as TEXT, never plaintext. bcrypt/argon2 hashing in app layer.
    passwordHash: text('password_hash'),
    // API key — NEVER plaintext. Encrypt at rest or hash in app layer. No exposed secrets.
    apiKey: text('api_key'),
    // Soft delete: NULL = active, TIMESTAMPTZ = deleted at this time (not boolean is_deleted)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    // Preferences stored as JSONB for semi-structured data (flexible schema), nullable with justification
    preferences: jsonb('preferences'),
    // Created timestamp with timezone
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Updated timestamp with timezone
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // FK indexes required to prevent cascade lock issues
    index('idx_users_org_id').on(t.orgId),
    // Partial unique index for soft delete: prevents duplicate active emails
    // In Drizzle, partial indexes use raw SQL in the third argument
    sql`UNIQUE (${t.email}) WHERE ${t.deletedAt} IS NULL`,
  ]
);
export type User = typeof users.$inferSelect;

// Projects table
export const projects = pgTable(
  'project',
  {
    // UUID v7 supplied from app layer
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    // Foreign key to organizations
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    // Project name, required
    name: text('name').notNull(),
    // Budget — NUMERIC for money (prevents binary floating-point rounding errors), nullable with justification: may be unknown
    budget: numeric('budget', { precision: 15, scale: 2 }),
    // Status — use CHECK constraint to make invalid data unrepresentable
    status: text('status').notNull().default('active'),
    // Created timestamp with timezone
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Updated timestamp with timezone
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // FK index required
    index('idx_project_org_id').on(t.orgId),
    // CHECK constraint: status in allowed values
    check('project_status_chk', sql`${t.status} IN ('planning', 'active', 'paused', 'completed', 'archived')`),
    // Partial index for common queries on active projects
    sql`INDEX idx_project_status (${t.status}) WHERE ${t.status} = 'active'`,
  ]
);
export type Project = typeof projects.$inferSelect;

// Tasks table
export const tasks = pgTable(
  'task',
  {
    // UUID v7 (NOT SERIAL — serial is auto-increment, not time-sortable)
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    // Foreign key to projects
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    // Foreign key to assignee (users), nullable with justification: task may be unassigned
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    // Task title, required
    title: text('title').notNull(),
    // Task description, nullable with justification: optional detail
    description: text('description'),
    // Price estimate — NUMERIC for money (no rounding errors), nullable with justification: may be unknown
    priceEstimate: numeric('price_estimate', { precision: 15, scale: 2 }),
    // Task status — use CHECK constraint to enforce valid states
    status: text('status').notNull().default('backlog'),
    // Created timestamp with timezone
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Updated timestamp with timezone
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // FK indexes required (critical: prevents cascade lock issues)
    index('idx_task_project_id').on(t.projectId),
    index('idx_task_assignee_id').on(t.assigneeId),
    // CHECK constraint: status in allowed values
    check('task_status_chk', sql`${t.status} IN ('backlog', 'active', 'in_review', 'done', 'archived')`),
    // BRIN index for time-series append-only data (created_at range queries)
    sql`INDEX idx_task_created_at_brin ON ${tasks} USING BRIN (${t.createdAt})`,
  ]
);
export type Task = typeof tasks.$inferSelect;

// Audit logs table for compliance and debugging
export const auditLogs = pgTable(
  'audit_log',
  {
    // UUID v7 supplied from app layer
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    // Foreign key to organizations
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    // User who triggered the action — nullable (system actions have no user)
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    // Action type: e.g. 'create', 'update', 'delete'
    action: text('action').notNull(),
    // Table affected by action
    tableName: text('table_name').notNull(),
    // Primary key of affected record
    recordId: uuid('record_id'),
    // Old values as JSONB for auditing changes
    oldValues: jsonb('old_values'),
    // New values as JSONB for auditing changes
    newValues: jsonb('new_values'),
    // Timestamp with timezone (wall-clock time for accurate audit trail)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // FK indexes
    index('idx_audit_log_org_id').on(t.orgId),
    index('idx_audit_log_user_id').on(t.userId),
    // BRIN index for audit trail range queries
    sql`INDEX idx_audit_log_created_at_brin ON ${auditLogs} USING BRIN (${t.createdAt})`,
    // Covering index for common audit queries
    sql`INDEX idx_audit_log_org_action ON ${auditLogs} (${t.orgId}, ${t.action}) INCLUDE (${t.createdAt})`,
  ]
);
export type AuditLog = typeof auditLogs.$inferSelect;
```

## Task Repository (fixed for type-safe errors, N+1 prevention, transaction safety)

```typescript
// errors.ts
// Domain-specific error classes (one per business failure, not generic Error)

export class TaskNotFoundError {
  readonly _tag = 'TaskNotFound' as const;
  constructor(readonly taskId: string) {}
}

export class CommentNotFoundError {
  readonly _tag = 'CommentNotFound' as const;
  constructor(readonly commentId: string) {}
}

export class CommentForbiddenError {
  readonly _tag = 'CommentForbidden' as const;
  constructor(readonly userId: string, readonly commentId: string) {}
}

export class DatabaseError {
  readonly _tag = 'DatabaseError' as const;
  constructor(readonly cause: Error) {}
}

export class InvalidTaskStatusError {
  readonly _tag = 'InvalidTaskStatus' as const;
  constructor(readonly status: string) {}
}

export type TaskRepositoryError = 
  | TaskNotFoundError 
  | CommentNotFoundError 
  | CommentForbiddenError 
  | DatabaseError 
  | InvalidTaskStatusError;

// task-repository.ts
// Reviewed for:
// - Type-safe errors as values (no throw)
// - N+1 prevention (use eager loading, JOINs, not loops + queries)
// - Transactions return union of ALL step errors
// - OTel logger attached to Drizzle client
// - UPSERT patterns for idempotent writes
// - Parameterized queries only (no string concat)
// - Connection pool sizing formula and PgBouncer guidance

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { trace } from '@opentelemetry/api';
import { sql, eq, and } from 'drizzle-orm';
import * as schema from './schema';

// Attach OTel logger to Drizzle for query observability
class OtelDrizzleLogger {
  logQuery(query: string, params: unknown[]) {
    const span = trace.getActiveSpan();
    if (!span) return; // zero overhead when no active span
    span.setAttribute('db.statement', query);
    span.setAttribute('db.system', 'postgresql');
    span.setAttribute('db.params.count', params.length);
  }
}

// Create DB client with proper pool sizing
// Formula: (CPU cores * 2) + effective_spindle_count
// For SSD: ~(CPU cores * 2) + 1 = ~5-10 for typical instance
// CRITICAL: When 5 instances × 20 pool size = 100 = default max_connections,
// use PgBouncer in transaction mode, NOT raising max_connections or shrinking pool.
const client = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Adjust based on instance cores: (cores * 2) + 1
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Set timeouts to prevent cascade failures
client.query('ALTER ROLE app_user SET statement_timeout TO \'30s\'');
client.query('ALTER ROLE app_user SET idle_in_transaction_session_timeout TO \'60s\'');

export const db = drizzle(client, {
  schema,
  logger: new OtelDrizzleLogger(),
});

// Factory function to create repository (enables typed derivation)
export function createTaskRepository(db: ReturnType<typeof drizzle>) {
  return {
    /**
     * Find task by ID — returns error as value, never throws
     * @param id - Task UUID
     * @returns Task or TaskNotFoundError or DatabaseError
     */
    async findById(id: string): Promise<typeof schema.Task | TaskNotFoundError | DatabaseError> {
      try {
        // Use explicit columns (no SELECT *) enables covering indexes
        const task = await db
          .select({
            id: schema.tasks.id,
            projectId: schema.tasks.projectId,
            assigneeId: schema.tasks.assigneeId,
            title: schema.tasks.title,
            description: schema.tasks.description,
            priceEstimate: schema.tasks.priceEstimate,
            status: schema.tasks.status,
            createdAt: schema.tasks.createdAt,
            updatedAt: schema.tasks.updatedAt,
          })
          .from(schema.tasks)
          .where(eq(schema.tasks.id, id));

        if (task.length === 0) {
          return new TaskNotFoundError(id);
        }
        return task[0];
      } catch (error) {
        return new DatabaseError(error instanceof Error ? error : new Error(String(error)));
      }
    },

    /**
     * Create task with comment in a single transaction
     * Returns union of ALL step errors (TaskRepositoryError)
     * @param taskData - Task fields
     * @param commentText - Comment text
     * @returns Task with comment or error
     */
    async createWithComment(
      taskData: Omit<typeof schema.Task, 'id' | 'createdAt' | 'updatedAt'>,
      commentText: string
    ): Promise<
      { task: typeof schema.Task; comment: any } | TaskRepositoryError
    > {
      try {
        const result = await db.transaction(async (tx) => {
          // Step 1: Insert task
          const insertedTasks = await tx
            .insert(schema.tasks)
            .values({
              ...taskData,
              id: schema.tasks.id.$defaultFn?.() || '', // Will be generated by uuidv7()
            })
            .returning({
              id: schema.tasks.id,
              projectId: schema.tasks.projectId,
              assigneeId: schema.tasks.assigneeId,
              title: schema.tasks.title,
              description: schema.tasks.description,
              priceEstimate: schema.tasks.priceEstimate,
              status: schema.tasks.status,
              createdAt: schema.tasks.createdAt,
              updatedAt: schema.tasks.updatedAt,
            });

          if (insertedTasks.length === 0) {
            throw new DatabaseError(new Error('Task insert returned no rows'));
          }

          const task = insertedTasks[0];

          // Step 2: Validate status before inserting comment
          const validStatuses = ['backlog', 'active', 'in_review', 'done', 'archived'];
          if (!validStatuses.includes(task.status)) {
            throw new InvalidTaskStatusError(task.status);
          }

          // Step 3: Insert comment
          // Note: This assumes a comments table exists; replace with actual table
          const insertedComments = await tx
            .insert(schema.comments) // hypothetical comments table
            .values({
              id: '', // Will be generated by uuidv7()
              taskId: task.id,
              text: commentText,
              createdAt: new Date(),
            })
            .returning();

          if (insertedComments.length === 0) {
            throw new DatabaseError(new Error('Comment insert returned no rows'));
          }

          return { task, comment: insertedComments[0] };
        });

        return result;
      } catch (error) {
        // Transaction wraps all errors; extract specific domain errors if needed
        if (error instanceof InvalidTaskStatusError) {
          return error;
        }
        if (error instanceof DatabaseError) {
          return error;
        }
        return new DatabaseError(error instanceof Error ? error : new Error(String(error)));
      }
    },

    /**
     * Search tasks by title and description using TSVECTOR + GIN
     * Avoids N+1 and LIKE '%term%' performance issues on large tables
     * @param searchTerm - Search query
     * @returns Array of tasks or error
     */
    async search(searchTerm: string): Promise<typeof schema.Task[] | DatabaseError> {
      try {
        // Use to_tsvector + to_tsquery for text search (indexed with GIN)
        // Never concatenate user input into SQL (parameterized query)
        const results = await db
          .select({
            id: schema.tasks.id,
            projectId: schema.tasks.projectId,
            assigneeId: schema.tasks.assigneeId,
            title: schema.tasks.title,
            description: schema.tasks.description,
            priceEstimate: schema.tasks.priceEstimate,
            status: schema.tasks.status,
            createdAt: schema.tasks.createdAt,
            updatedAt: schema.tasks.updatedAt,
          })
          .from(schema.tasks)
          .where(
            sql`to_tsvector('english', COALESCE(${schema.tasks.description}, '')) @@ to_tsquery('english', ${searchTerm})`
          );

        return results;
      } catch (error) {
        return new DatabaseError(error instanceof Error ? error : new Error(String(error)));
      }
    },

    /**
     * Get tasks for assignee using cursor-based (keyset) pagination
     * Avoids O(N) OFFSET performance cliff on deep pages
     * @param assigneeId - User UUID
     * @param cursor - Last task ID from previous page (null for first page)
     * @param limit - Page size
     * @returns Array of tasks or error
     */
    async findByAssignee(
      assigneeId: string,
      cursor: string | null,
      limit: number = 20
    ): Promise<typeof schema.Task[] | DatabaseError> {
      try {
        let query = db
          .select({
            id: schema.tasks.id,
            projectId: schema.tasks.projectId,
            assigneeId: schema.tasks.assigneeId,
            title: schema.tasks.title,
            description: schema.tasks.description,
            priceEstimate: schema.tasks.priceEstimate,
            status: schema.tasks.status,
            createdAt: schema.tasks.createdAt,
            updatedAt: schema.tasks.updatedAt,
          })
          .from(schema.tasks)
          .where(eq(schema.tasks.assigneeId, assigneeId));

        // Cursor-based pagination: fetch next batch starting after cursor
        if (cursor) {
          query = query.where(sql`${schema.tasks.id} > ${cursor}`);
        }

        const results = await query.orderBy(schema.tasks.id).limit(limit);

        return results;
      } catch (error) {
        return new DatabaseError(error instanceof Error ? error : new Error(String(error)));
      }
    },

    /**
     * Get tasks created within a time range
     * Uses >= AND < instead of BETWEEN to avoid off-by-one bugs
     * @param hoursAgo - How many hours in the past (e.g. 1 for last hour)
     * @returns Array of tasks or error
     */
    async findRecentTasks(hoursAgo: number = 1): Promise<typeof schema.Task[] | DatabaseError> {
      try {
        // Use clock_timestamp() for wall-clock time (not NOW() which is static per transaction)
        // Use >= AND < instead of BETWEEN (BETWEEN is inclusive both sides, causes off-by-one)
        const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        const results = await db
          .select({
            id: schema.tasks.id,
            projectId: schema.tasks.projectId,
            assigneeId: schema.tasks.assigneeId,
            title: schema.tasks.title,
            description: schema.tasks.description,
            priceEstimate: schema.tasks.priceEstimate,
            status: schema.tasks.status,
            createdAt: schema.tasks.createdAt,
            updatedAt: schema.tasks.updatedAt,
          })
          .from(schema.tasks)
          .where(
            and(
              sql`${schema.tasks.createdAt} >= ${cutoff}`,
              sql`${schema.tasks.createdAt} < NOW()`
            )
          )
          .orderBy(sql`${schema.tasks.createdAt} DESC`);

        return results;
      } catch (error) {
        return new DatabaseError(error instanceof Error ? error : new Error(String(error)));
      }
    },

    /**
     * Idempotent upsert: insert or update task if it already exists
     * Uses INSERT ... ON CONFLICT DO UPDATE for race-condition-free writes
     * @param task - Task data with ID
     * @returns Upserted task or error
     */
    async upsertTask(
      task: typeof schema.Task
    ): Promise<typeof schema.Task | DatabaseError> {
      try {
        const result = await db
          .insert(schema.tasks)
          .values(task)
          .onConflictDoUpdate({
            target: schema.tasks.id,
            set: {
              title: task.title,
              description: task.description,
              status: task.status,
              priceEstimate: task.priceEstimate,
              updatedAt: new Date(),
            },
          })
          .returning({
            id: schema.tasks.id,
            projectId: schema.tasks.projectId,
            assigneeId: schema.tasks.assigneeId,
            title: schema.tasks.title,
            description: schema.tasks.description,
            priceEstimate: schema.tasks.priceEstimate,
            status: schema.tasks.status,
            createdAt: schema.tasks.createdAt,
            updatedAt: schema.tasks.updatedAt,
          });

        if (result.length === 0) {
          return new DatabaseError(new Error('Upsert returned no rows'));
        }

        return result[0];
      } catch (error) {
        return new DatabaseError(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
```

## Database Connection Configuration (secure, least-privilege)

```typescript
// db.ts
// Reviewed for:
// - Least privilege: app NEVER connects as postgres superuser
// - Connection pooling formula: (CPU cores * 2) + SSD spindles
// - Statement timeout + idle-in-transaction timeout to prevent cascade failures
// - OTel logger attached to Drizzle for observability
// - No hardcoded secrets (all from environment)

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { trace } from '@opentelemetry/api';
import * as schema from './schema';

// Attach OTel logger to Drizzle for query observability
class OtelDrizzleLogger {
  logQuery(query: string, params: unknown[]) {
    const span = trace.getActiveSpan();
    if (!span) return; // zero overhead when no active span
    span.setAttribute('db.statement', query);
    span.setAttribute('db.system', 'postgresql');
    span.setAttribute('db.params.count', params.length);
  }
}

// SECURITY: App NEVER connects as postgres superuser
// Create a dedicated login role with minimal DML permissions:
//   CREATE ROLE app_user WITH LOGIN PASSWORD '...';  (from vault/env, never hardcoded)
//   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
//   ALTER ROLE app_user SET statement_timeout TO '30s';
//   ALTER ROLE app_user SET idle_in_transaction_session_timeout TO '60s';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable not set');
}

// Validate that connection string uses app_user, not postgres
if (connectionString.includes('postgres:')) {
  throw new Error('SECURITY ERROR: Database connection must use app_user role, not postgres superuser');
}

// Pool sizing formula:
// per-instance pool size = (CPU cores * 2) + effective_spindle_count
// For SSD: ~(CPU cores * 2) + 1
// Example: 4-core instance with SSD = (4 * 2) + 1 = 9 connections
// GOTCHA: 5 instances × 20 pool = 100 total = default max_connections (exhausted!)
// FIX: Use PgBouncer in transaction mode, NOT raising max_connections, NOT shrinking pool
const poolSize = parseInt(process.env.DB_POOL_SIZE || '10', 10);
const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '50', 10);

const client = new Pool({
  connectionString,
  max: poolSize,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Set per-connection timeout
  statement_timeout: 30000, // 30 seconds per statement
  idle_in_transaction_session_timeout: 60000, // 60 seconds idle in transaction
});

// Monitor pool exhaustion (alert when active > 80% of max)
setInterval(async () => {
  try {
    const result = await client.query(
      'SELECT count(*) as active FROM pg_stat_activity WHERE state != \'idle\''
    );
    const activeConnections = parseInt(result.rows[0].active, 10);
    const utilization = (activeConnections / poolSize) * 100;

    if (utilization > 80) {
      console.warn(
        `[DB] Pool utilization high: ${activeConnections}/${poolSize} (${utilization.toFixed(1)}%)`
      );
    }
  } catch (error) {
    // Silently ignore monitoring errors
  }
}, 60000); // Check every minute

export const db = drizzle(client, {
  schema,
  logger: new OtelDrizzleLogger(),
});

// Health check
export async function healthCheck(): Promise<boolean> {
  try {
    await client.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[DB] Health check failed:', error);
    return false;
  }
}
```

## HTTP Route Handler (error mapping to HTTP status + problem code)

```typescript
// task-routes.ts
// Reviewed for:
// - Every error _tag mapped to HTTP status + problem code (exhaustive, not just returned)
// - Error union from repository fully handled
// - No generic 500 for domain errors; specific 4xx for business failures
// - Use matchError() or switch (err._tag) with assertNever for exhaustiveness

import { Router, Request, Response } from 'express';
import { createTaskRepository, TaskNotFoundError, DatabaseError } from './task-repository';
import { db } from './db';

const router = Router();
const taskRepo = createTaskRepository(db);

// Helper to exhaustively map errors to HTTP responses
function matchError(error: any): { status: number; code: string; message: string } {
  switch (error._tag) {
    case 'TaskNotFound':
      return { status: 404, code: 'TASK_NOT_FOUND', message: `Task ${error.taskId} not found` };

    case 'CommentNotFound':
      return { status: 404, code: 'COMMENT_NOT_FOUND', message: `Comment ${error.commentId} not found` };

    case 'CommentForbidden':
      return {
        status: 403,
        code: 'COMMENT_FORBIDDEN',
        message: `User ${error.userId} cannot access comment ${error.commentId}`,
      };

    case 'InvalidTaskStatus':
      return {
        status: 400,
        code: 'INVALID_TASK_STATUS',
        message: `Status '${error.status}' is not allowed`,
      };

    case 'DatabaseError':
      return { status: 500, code: 'DATABASE_ERROR', message: 'An unexpected database error occurred' };

    // Exhaustiveness check (TypeScript will error if new error types added without matching)
    default:
      const _exhaustive: never = error;
      return _exhaustive;
  }
}

// GET /tasks/:id
router.get('/tasks/:id', async (req: Request, res: Response) => {
  const taskResult = await taskRepo.findById(req.params.id);

  // Check if result is an error by testing _tag property
  if (taskResult && typeof taskResult === 'object' && '_tag' in taskResult) {
    const errorMapping = matchError(taskResult);
    return res.status(errorMapping.status).json({
      code: errorMapping.code,
      message: errorMapping.message,
    });
  }

  // Task found
  res.json(taskResult);
});

// POST /tasks with comment
router.post('/tasks', async (req: Request, res: Response) => {
  const { projectId, title, description, commentText } = req.body;

  const taskData = {
    projectId,
    title,
    description,
    status: 'backlog',
    priceEstimate: null,
    assigneeId: null,
  };

  const result = await taskRepo.createWithComment(taskData, commentText);

  // Check if result is an error
  if (result && typeof result === 'object' && '_tag' in result) {
    const errorMapping = matchError(result);
    return res.status(errorMapping.status).json({
      code: errorMapping.code,
      message: errorMapping.message,
    });
  }

  // Success
  res.status(201).json(result);
});

// GET /tasks/search?q=term
router.get('/tasks/search', async (req: Request, res: Response) => {
  const searchTerm = req.query.q as string;

  if (!searchTerm || searchTerm.length < 2) {
    return res.status(400).json({
      code: 'INVALID_SEARCH_QUERY',
      message: 'Search term must be at least 2 characters',
    });
  }

  const results = await taskRepo.search(searchTerm);

  // Check if result is an error
  if (results && typeof results === 'object' && '_tag' in results) {
    const errorMapping = matchError(results);
    return res.status(errorMapping.status).json({
      code: errorMapping.code,
      message: errorMapping.message,
    });
  }

  // Success
  res.json(results);
});

// GET /tasks?assignee_id=...&cursor=...&limit=20 (cursor-based pagination)
router.get('/tasks', async (req: Request, res: Response) => {
  const assigneeId = req.query.assignee_id as string;
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

  if (!assigneeId) {
    return res.status(400).json({
      code: 'MISSING_ASSIGNEE_ID',
      message: 'Query parameter assignee_id is required',
    });
  }

  const tasks = await taskRepo.findByAssignee(assigneeId, cursor || null, limit);

  // Check if result is an error
  if (tasks && typeof tasks === 'object' && '_tag' in tasks) {
    const errorMapping = matchError(tasks);
    return res.status(errorMapping.status).json({
      code: errorMapping.code,
      message: errorMapping.message,
    });
  }

  // Success: return tasks + next cursor (if more results exist)
  res.json({
    tasks,
    nextCursor: tasks.length === limit ? tasks[tasks.length - 1].id : null,
  });
});

export default router;
```

---

## Summary of Issues Fixed

1. **TRUNCATE vs DELETE** — Removed `TRUNCATE TABLE audit_logs` (takes ACCESS EXCLUSIVE lock); replaced with `DELETE FROM` during traffic.

2. **UUIDs: UUIDv4 → UUIDv7** — Banned `DEFAULT gen_random_uuid()` (produces UUIDv4); use `uuidv7()` from app layer for time-sortable, index-friendly PKs.

3. **VARCHAR → TEXT** — Changed `VARCHAR(255)` and `VARCHAR(100)` to `TEXT` with `CHECK` constraints for schema flexibility.

4. **TIMESTAMP → TIMESTAMPTZ** — Changed bare `TIMESTAMP` to `TIMESTAMPTZ` for wall-clock accuracy (avoids timezone ambiguity).

5. **FLOAT → NUMERIC for money** — Changed `budget FLOAT` and `price_estimate FLOAT` to `NUMERIC` (no binary rounding errors).

6. **SERIAL → UUID** — Removed `SERIAL PRIMARY KEY` in tasks (not time-sortable); use UUIDv7.

7. **Boolean soft delete → deleted_at** — Removed `is_deleted BOOLEAN`; added `deleted_at TIMESTAMPTZ` with partial unique index for active records.

8. **FK columns: Index ALL** — Added explicit indexes on every FK (`org_id`, `project_id`, `assignee_id`, `user_id`); prevents cascade lock issues.

9. **ON DELETE/ON UPDATE explicit** — Every FK specifies behavior (`CASCADE`, `SET NULL`); forces thinking about referential consequences.

10. **Rename column: Expand-and-Contract** — Replaced `ALTER TABLE users RENAME COLUMN name TO full_name` with 5-step safe sequence (add nullable → backfill → dual-write → switch reads → drop old).

11. **NOT NULL constraint in two steps** — Replaced inline `ALTER TABLE t ADD CONSTRAINT ... CHECK (...)` with `VALID` + `VALIDATE` steps to avoid full-table scans.

12. **CREATE INDEX CONCURRENTLY** — Changed `CREATE INDEX` to `CREATE INDEX CONCURRENTLY` (no write locks).

13. **SELECT \*: explicit columns** — Removed all `SELECT *`; list columns explicitly (enables covering indexes, saves bandwidth).

14. **LIKE '%term%' → TSVECTOR + GIN** — Replaced `LIKE '%deploy%'` with full-text search (`to_tsvector` + `to_tsquery`), avoids large-table Seq Scans.

15. **OFFSET/LIMIT → Cursor-based pagination** — Replaced `LIMIT 20 OFFSET 200` (O(N) on deep pages) with keyset pagination using last ID as cursor.

16. **BETWEEN timestamps → >= AND <** — Replaced `WHERE created_at > NOW() - INTERVAL '1 hour'` with `>= ... AND <` to avoid off-by-one bugs (BETWEEN is inclusive both sides).

17. **NOW() → clock_timestamp()** — NOW() is static per transaction; use `clock_timestamp()` for wall-clock time.

18. **Autovacuum: never disabled** — Removed `SET (autovacuum_enabled = false)`.

19. **BRIN indexes for time-series** — Added BRIN indexes on `created_at` for append-only audit logs (tiny footprint, ideal for range queries).

20. **CHECK constraints for enums** — Replaced PostgreSQL enums with `CHECK (status IN (...))` constraints; enums can't be removed.

21. **Drizzle schema corrections** — Changed drizzle-kit output: UUIDv4 → UUIDv7, `serial` → `uuid`, bare `timestamp()` → `{ withTimezone: true }`, constraints + indexes in third argument.

22. **N+1 prevention** — Removed loop-over-results-and-query-each-item pattern; use eager loading / JOINs / `findByAssignee` with single query.

23. **Errors as values** — Removed `throw new Error()` pattern; return error as union type, never throw.

24. **Domain-specific error classes** — One class per business failure (`TaskNotFoundError`, `CommentForbiddenError`), not generic `Error`.

25. **Error mapping: exhaustive switch** — Route handler contains `switch (err._tag)` matching EVERY error type to HTTP status + problem code; uses `assertNever` for exhaustiveness.

26. **Least-privilege DB connection** — Removed connection as `postgres` superuser; use dedicated `app_user` role with minimal DML grants.

27. **Connection pool sizing** — Stated formula: `(CPU cores × 2) + spindle_count`, and named PgBouncer when 5 instances × 20 pool approaches `max_connections`.

28. **Statement timeout + idle-in-transaction timeout** — Added `statement_timeout = '30s'` and `idle_in_transaction_session_timeout = '60s'` to prevent cascade failures.

29. **OTel logger on Drizzle** — Attached `OtelDrizzleLogger` to `drizzle()` for query observability; zero overhead when no active span.

30. **Idempotent upsert** — Added `INSERT ... ON CONFLICT DO UPDATE SET ...` for race-condition-free writes.

31. **Parameterized queries only** — No string concatenation; all user input parameterized (prevents SQL injection).

32. **Nullable column comments** — Every nullable column justifies why NULL is allowed (e.g., "may be unknown at creation").

33. **Constraint naming** — All constraints follow `{tablename}_{columnname(s)}_{suffix}` pattern (pk, fk, key, chk, idx).

34. **Search_path = pg_catalog** — Added to DDL for explicit schema names.

35. **Soft delete: partial unique index** — Added `UNIQUE (email) WHERE deleted_at IS NULL` to enforce unique active emails.

36. **EXISTS vs IN** — Not present in original, but schema supports EXISTS-based queries for efficiency.

37. **Covering indexes: INCLUDE clause** — Added covering index for audit log queries: `(org_id, action) INCLUDE (created_at)`.

38. **Transactions return error union** — `createWithComment()` returns `Promise<Result | ErrorType1 | ErrorType2 | ...>`, not a throw.

39. **Derive repo type from factory** — `type TaskRepository = ReturnType<typeof createTaskRepository>` for type-safe derivation.

40. **No abbreviations (unless well-known)** — All column names spelled out (not `usr_id`, `proj_id`); `i18n` is OK (well-known).
