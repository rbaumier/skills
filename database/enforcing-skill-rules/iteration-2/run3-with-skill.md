# PostgreSQL + Drizzle ORM + TypeScript — Complete Review & Fix

## Issues Found (mapped to skill rules)

### Legend
- **Rule** = SKILL.md section violated
- **Severity** = CRITICAL / HIGH / MEDIUM / LOW

---

## 1. SQL Schema Issues

### 1.1 `TRUNCATE TABLE audit_logs` under traffic

| | |
|---|---|
| **Rule** | Gotchas: "`TRUNCATE` takes ACCESS EXCLUSIVE lock" |
| **Severity** | CRITICAL |
| **Problem** | `TRUNCATE` blocks all concurrent reads/writes. Under traffic this causes a full outage on `audit_logs`. |
| **Fix** | Use `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'` in batches, or partition by time and `DROP` old partitions. |

```sql
-- BEFORE (broken)
TRUNCATE TABLE audit_logs;

-- AFTER (safe under traffic — batched delete)
DELETE FROM audit_logs
WHERE id IN (
  SELECT id FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
  ORDER BY created_at
  LIMIT 10000
);
-- Run in a loop until 0 rows affected.
```

---

### 1.2 `VARCHAR(100)` / `VARCHAR(255)` instead of `TEXT`

| | |
|---|---|
| **Rule** | Schema Design: "TEXT not VARCHAR" |
| **Severity** | MEDIUM |
| **Problem** | PostgreSQL stores TEXT and VARCHAR identically. VARCHAR adds a length-check constraint with zero performance benefit and creates friction during migrations when limits need raising. |
| **Fix** | Use `TEXT` with `CHECK` constraints where a real business limit exists. |

```sql
-- BEFORE
name VARCHAR(100) NOT NULL
full_name VARCHAR(255) NOT NULL
email VARCHAR(255) UNIQUE

-- AFTER
name TEXT NOT NULL CHECK (char_length(name) <= 100)
full_name TEXT NOT NULL
email TEXT NOT NULL UNIQUE  -- also NOT NULL, see §1.5
```

---

### 1.3 `TIMESTAMP` without time zone

| | |
|---|---|
| **Rule** | Schema Design: "TIMESTAMPTZ not TIMESTAMP" |
| **Severity** | HIGH |
| **Problem** | `TIMESTAMP` (without time zone) silently drops timezone info. Across servers with different `timezone` settings, data becomes ambiguous and corrupted. |
| **Fix** | Use `TIMESTAMPTZ` everywhere. |

```sql
-- BEFORE
created_at TIMESTAMP DEFAULT NOW()

-- AFTER
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

---

### 1.4 `FLOAT` for money (`budget`, `price_estimate`)

| | |
|---|---|
| **Rule** | Schema Design: "NUMERIC for money never FLOAT" |
| **Severity** | CRITICAL |
| **Problem** | IEEE 754 floating-point cannot represent `0.1` exactly. Financial calculations accumulate rounding errors: `0.1 + 0.2 = 0.30000000000000004`. |
| **Fix** | Use `NUMERIC(12,2)` (or appropriate precision). Add `CHECK` constraint. |

```sql
-- BEFORE
budget FLOAT
price_estimate FLOAT

-- AFTER
budget NUMERIC(12,2) CHECK (budget >= 0)
price_estimate NUMERIC(12,2) CHECK (price_estimate >= 0)
```

---

### 1.5 `DEFAULT gen_random_uuid()` — UUIDv4

| | |
|---|---|
| **Rule** | Schema Design: "UUIDv7 (index locality, time-sortable). Never random UUIDv4" |
| **Severity** | HIGH |
| **Problem** | `gen_random_uuid()` produces UUIDv4 — random, non-sortable. On B-tree primary keys this causes random I/O, page splits, and poor cache locality at scale. |
| **Fix** | Use UUIDv7. Generate in application layer via `uuidv7()` or use a PG extension (`pg_uuidv7`). |

```sql
-- BEFORE
id UUID DEFAULT gen_random_uuid() PRIMARY KEY

-- AFTER (with pg_uuidv7 extension)
CREATE EXTENSION IF NOT EXISTS pg_uuidv7;
id UUID DEFAULT uuid_generate_v7() PRIMARY KEY

-- Or generate in app layer (Drizzle .$defaultFn(() => uuidv7()))
```

---

### 1.6 `is_deleted BOOLEAN DEFAULT false`

| | |
|---|---|
| **Rule** | Schema Design: "Soft delete: `deleted_at TIMESTAMPTZ` … Never boolean `is_deleted`" |
| **Severity** | MEDIUM |
| **Problem** | A boolean loses *when* deletion happened. Cannot implement retention policies, undo windows, or audit trails. Cannot create partial unique indexes on active records cleanly. |
| **Fix** | Replace with `deleted_at TIMESTAMPTZ`. |

```sql
-- BEFORE
is_deleted BOOLEAN DEFAULT false

-- AFTER
deleted_at TIMESTAMPTZ  -- NULL = not deleted
-- Partial unique index for "active" email uniqueness:
CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
```

---

### 1.7 Missing `CHECK` constraints

| | |
|---|---|
| **Rule** | Schema Design: "CHECK constraints: `price > 0`, `status IN (...)`. Make invalid data unrepresentable." |
| **Severity** | HIGH |
| **Problem** | `status TEXT` accepts any garbage. `budget`/`price_estimate` can be negative. No data integrity at the DB level. |
| **Fix** | Add CHECK constraints. |

```sql
-- projects.status
status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'))

-- tasks.status
status TEXT NOT NULL DEFAULT 'backlog'
  CHECK (status IN ('backlog', 'active', 'in_review', 'done', 'cancelled'))

-- budget & price_estimate covered in §1.4
```

---

### 1.8 Missing FK indexes

| | |
|---|---|
| **Rule** | Gotchas: "FK columns need explicit indexes — NOT auto-indexed" / Schema Design: "Index ALL FK columns" |
| **Severity** | HIGH |
| **Problem** | `users.org_id`, `projects.org_id`, `tasks.assignee_id` have no index. FK cascading deletes on `organizations` will seqscan these tables and hold locks. |
| **Fix** | Index every FK column. |

```sql
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_projects_org ON projects(org_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
-- idx_tasks_project already exists from the migration
```

---

### 1.9 `password_hash TEXT` / `api_key TEXT` — plaintext secrets

| | |
|---|---|
| **Rule** | Security: "bcrypt/argon2 for passwords. Never store API keys/secrets plain text." |
| **Severity** | CRITICAL |
| **Problem** | Schema implies `password_hash` is already hashed (good naming), but `api_key TEXT` is stored in plaintext. If the DB is compromised, all API keys leak. |
| **Fix** | Store only a hash of the API key. Keep a short prefix for display. |

```sql
-- AFTER
api_key_hash TEXT,          -- argon2id hash of the full key
api_key_prefix CHAR(8),     -- first 8 chars for user display ("sk_abc1...")
```

---

### 1.10 `preferences TEXT` — unstructured

| | |
|---|---|
| **Rule** | Schema Design: "JSONB for semi-structured" |
| **Severity** | LOW |
| **Problem** | `TEXT` cannot be queried, validated, or indexed. |
| **Fix** | Use `JSONB`. |

```sql
-- BEFORE
preferences TEXT

-- AFTER
preferences JSONB DEFAULT '{}'::jsonb
```

---

## 2. Query Issues

### 2.1 `SELECT *` everywhere

| | |
|---|---|
| **Rule** | Gotchas/Performance: "`SELECT *` wastes bandwidth. List columns explicitly." |
| **Severity** | HIGH |
| **Problem** | Fetches all columns (including large `description` TEXT). Defeats covering indexes. Schema changes silently break consumers. |
| **Fix** | List columns explicitly. |

```sql
-- BEFORE
SELECT * FROM tasks WHERE project_id = $1 AND status = 'active' ORDER BY created_at DESC;

-- AFTER
SELECT id, project_id, assignee_id, title, price_estimate, status, created_at
FROM tasks
WHERE project_id = $1 AND status = 'active'
ORDER BY created_at DESC;
```

---

### 2.2 `LIKE '%deploy%'` — full table scan

| | |
|---|---|
| **Rule** | Performance: "TSVECTOR + GIN. Never `LIKE '%term%'` on large tables." |
| **Severity** | HIGH |
| **Problem** | Leading wildcard prevents any index usage. Full sequential scan on every call. |
| **Fix** | Add a tsvector column + GIN index and use `@@` full-text search. |

```sql
-- Migration
ALTER TABLE tasks ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX idx_tasks_search ON tasks USING GIN(search_vector);

-- Query
SELECT id, title, status, created_at
FROM tasks
WHERE search_vector @@ plainto_tsquery('english', $1);
```

---

### 2.3 `OFFSET 200` — deep pagination

| | |
|---|---|
| **Rule** | Performance: "Pagination: cursor-based (keyset). OFFSET/LIMIT is O(N) on deep pages." |
| **Severity** | HIGH |
| **Problem** | `OFFSET 200` forces PG to fetch and discard 200 rows. At page 100 (`OFFSET 2000`), this is devastating. |
| **Fix** | Cursor-based (keyset) pagination. |

```sql
-- BEFORE
SELECT * FROM tasks
WHERE assignee_id = $1
ORDER BY created_at DESC
LIMIT 20 OFFSET 200;

-- AFTER (cursor-based)
SELECT id, title, status, created_at
FROM tasks
WHERE assignee_id = $1
  AND created_at < $2   -- $2 = last row's created_at from previous page
ORDER BY created_at DESC
LIMIT 20;

-- Supporting index (covering)
CREATE INDEX idx_tasks_assignee_cursor
  ON tasks(assignee_id, created_at DESC)
  INCLUDE (id, title, status);
```

---

### 2.4 `NOW()` in transaction context

| | |
|---|---|
| **Rule** | Gotchas: "`NOW()` in transaction = same value entire txn. Use `clock_timestamp()`" |
| **Severity** | LOW |
| **Problem** | `NOW() - INTERVAL '1 hour'` is fine for single statements but misleading inside transactions. |
| **Fix** | Use `clock_timestamp()` if wall-clock precision matters. For this query pattern `NOW()` is acceptable since it runs as a single statement, but document the gotcha. |

```sql
-- Acceptable for single-statement use:
SELECT id, title, status, created_at
FROM tasks
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Add BRIN index (append-only, time-ordered data)
CREATE INDEX idx_tasks_created_brin ON tasks USING BRIN(created_at);
```

---

## 3. Migration Issues

### 3.1 Missing `lock_timeout` on DDL

| | |
|---|---|
| **Rule** | Operational: "`SET lock_timeout = '5s'` on every DDL migration" |
| **Severity** | HIGH |
| **Problem** | `ALTER TABLE users RENAME COLUMN` and `ALTER TABLE users ALTER COLUMN email SET NOT NULL` take `ACCESS EXCLUSIVE` locks. On busy tables, these queue behind long-running queries and then block all subsequent queries — cascading outage. |
| **Fix** | Set lock_timeout on every migration statement. |

```sql
SET lock_timeout = '5s';
ALTER TABLE users RENAME COLUMN name TO full_name;

SET lock_timeout = '5s';
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

---

### 3.2 `CREATE INDEX` not `CONCURRENTLY`

| | |
|---|---|
| **Rule** | Operational: "CREATE INDEX CONCURRENTLY" |
| **Severity** | HIGH |
| **Problem** | `CREATE INDEX idx_tasks_project ON tasks(project_id)` takes a `SHARE` lock, blocking all writes for the entire index build. |
| **Fix** | Use `CONCURRENTLY`. Note: cannot run inside a transaction block. |

```sql
-- BEFORE
CREATE INDEX idx_tasks_project ON tasks(project_id);

-- AFTER
CREATE INDEX CONCURRENTLY idx_tasks_project ON tasks(project_id);
```

---

### 3.3 `autovacuum_enabled = false`

| | |
|---|---|
| **Rule** | Operational: "NEVER disable autovacuum" |
| **Severity** | CRITICAL |
| **Problem** | Disabling autovacuum on `tasks` causes: dead tuple bloat, index bloat, transaction ID wraparound (eventually forces emergency full-table vacuum that halts writes). |
| **Fix** | Remove. Tune frequency instead. |

```sql
-- BEFORE (DANGEROUS)
ALTER TABLE tasks SET (autovacuum_enabled = false);

-- AFTER (tune, don't disable)
ALTER TABLE tasks SET (
  autovacuum_vacuum_scale_factor = 0.01,     -- vacuum after 1% dead rows
  autovacuum_analyze_scale_factor = 0.005,   -- analyze after 0.5% changes
  autovacuum_vacuum_cost_delay = 2           -- less throttling
);
```

---

### 3.4 Expand-and-Contract violation on RENAME

| | |
|---|---|
| **Rule** | Operational: "Expand-and-Contract for breaking changes" |
| **Severity** | HIGH |
| **Problem** | `RENAME COLUMN name TO full_name` instantly breaks all running app instances that reference `name`. Zero-downtime deploy is impossible. |
| **Fix** | 5-step expand-and-contract. |

```sql
-- Step 1: Add new column (nullable)
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Step 2: Dual-write (app writes both columns) + backfill
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Step 3: Switch reads to full_name, verify

-- Step 4: Make full_name NOT NULL
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Step 5: Drop old column (after all app instances updated)
ALTER TABLE users DROP COLUMN name;
```

---

## 4. Pool / Connection Issues

### 4.1 5 instances × 20 pool = 100 connections

| | |
|---|---|
| **Rule** | Gotchas: "5 instances × 20 pool = 100 = default max_connections limit. Use PgBouncer." |
| **Severity** | CRITICAL |
| **Problem** | 100 connections = PostgreSQL default `max_connections`. Zero headroom for superuser, migrations, monitoring, or connection spikes. One extra instance = immediate connection failures. |
| **Fix** | Put PgBouncer in front. Reduce per-instance pool to 5. |

```
# PgBouncer config (transaction mode)
[databases]
mydb = host=pg-primary port=5432 dbname=mydb

[pgbouncer]
pool_mode = transaction
default_pool_size = 30
max_client_conn = 200
max_db_connections = 80   # leaves 20 for superuser/monitoring
```

```typescript
// App pool config — per instance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // points to PgBouncer
  max: 5,  // 5 instances × 5 = 25 client connections to PgBouncer
});
```

---

### 4.2 App connects as `postgres` superuser

| | |
|---|---|
| **Rule** | Security: "Least privilege: app never superuser. GRANT only SELECT/INSERT/UPDATE/DELETE." |
| **Severity** | CRITICAL |
| **Problem** | Superuser can: drop databases, read `pg_shadow`, modify `pg_hba.conf`, install extensions, bypass RLS. A single SQL injection = total compromise. |
| **Fix** | Create a dedicated app role with minimal permissions. |

```sql
-- Create app role
CREATE ROLE app_service LOGIN PASSWORD 'rotated-secret';

-- Grant minimum required
GRANT CONNECT ON DATABASE mydb TO app_service;
GRANT USAGE ON SCHEMA public TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_service;

-- Ensure future tables get the same grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_service;
```

---

### 4.3 No RLS

| | |
|---|---|
| **Rule** | Security: "RLS on every table. Keep policies performant." |
| **Severity** | HIGH |
| **Problem** | Without RLS, any query can access any org's data. A single application bug = cross-tenant data leak. |
| **Fix** | Enable RLS with org-scoped policies. |

```sql
-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- App sets org context per request
-- In app: SET LOCAL app.current_org_id = '<org-uuid>';

CREATE POLICY org_isolation ON users
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY org_isolation ON projects
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY org_isolation ON tasks
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );
```

---

## 5. Drizzle ORM Issues

### 5.1 `serial` PK instead of UUIDv7

| | |
|---|---|
| **Rule** | Drizzle: "UUIDv7: `.$defaultFn(() => uuidv7())` on PKs" |
| **Severity** | HIGH |

### 5.2 `real` for price instead of `numeric`

| | |
|---|---|
| **Rule** | Drizzle: maps to FLOAT; Schema Design says NUMERIC |
| **Severity** | CRITICAL |

### 5.3 Bare `timestamp()` without `withTimezone`

| | |
|---|---|
| **Rule** | Drizzle: "Timestamps: always `{ withTimezone: true }`" |
| **Severity** | HIGH |

### 5.4 No type export

| | |
|---|---|
| **Rule** | Drizzle: "Export table + `InferSelectModel` type from same file" |
| **Severity** | MEDIUM |

### 5.5 drizzle-kit output used as-is

| | |
|---|---|
| **Rule** | Drizzle: "CLI output … is a starting point, NOT production-ready. Always review." |
| **Severity** | HIGH |

**Complete fixed Drizzle schema:**

```typescript
// schema/organizations.ts
import { pgTable, text, uuid, check } from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { uuidv7 } from "uuidv7";
import type { InferSelectModel } from "drizzle-orm";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export type Organization = InferSelectModel<typeof organizations>;
```

```typescript
// schema/users.ts
import { pgTable, text, uuid, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { uuidv7 } from "uuidv7";
import { organizations } from "./organizations";
import { sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  apiKeyHash: text("api_key_hash"),
  apiKeyPrefix: text("api_key_prefix"),
  deletedAt: timestamptz("deleted_at"),              // soft delete
  preferences: jsonb("preferences").default({}),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_users_email_active")
    .on(table.email)
    .where(sql`deleted_at IS NULL`),
  index("idx_users_org").on(table.orgId),
]);

export type User = InferSelectModel<typeof users>;
```

```typescript
// schema/projects.ts
import { pgTable, text, uuid, numeric, index, check } from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { uuidv7 } from "uuidv7";
import { organizations } from "./organizations";
import { sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  budget: numeric("budget", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("draft"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_projects_org").on(table.orgId),
  check("budget_positive", sql`budget >= 0`),
  check("status_valid", sql`status IN ('draft', 'active', 'paused', 'completed', 'archived')`),
]);

export type Project = InferSelectModel<typeof projects>;
```

```typescript
// schema/tasks.ts
import { pgTable, text, uuid, numeric, index, check } from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { uuidv7 } from "uuidv7";
import { projects } from "./projects";
import { users } from "./users";
import { sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  assigneeId: uuid("assignee_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  priceEstimate: numeric("price_estimate", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("backlog"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_tasks_project").on(table.projectId),
  index("idx_tasks_assignee").on(table.assigneeId),
  index("idx_tasks_assignee_cursor").on(table.assigneeId, table.createdAt),
  check("price_positive", sql`price_estimate >= 0`),
  check("status_valid", sql`status IN ('backlog', 'active', 'in_review', 'done', 'cancelled')`),
]);

export type Task = InferSelectModel<typeof tasks>;
```

```typescript
// schema/columns.ts — shared helpers
import { timestamp } from "drizzle-orm/pg-core";

/**
 * Always-with-timezone timestamp helper.
 * Prevents bare timestamp() which drops timezone info.
 */
export const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
```

---

## 6. Repository Pattern Issues

### 6.1 `throw Error` instead of errors-as-values

| | |
|---|---|
| **Rule** | Repository: "Return errors as values, never throw" |
| **Severity** | HIGH |
| **Problem** | `throw new Error(...)` bypasses type checking. Callers don't know which errors to handle. Unhandled throws crash the process. |

### 6.2 SQL injection in search

| | |
|---|---|
| **Rule** | Security: "Parameterized queries only. Never concatenate strings into SQL." |
| **Severity** | CRITICAL |
| **Problem** | String interpolation in a search query = direct SQL injection vector. |

### 6.3 No OTel logger

| | |
|---|---|
| **Rule** | OTel: "`OtelDrizzleLogger` attaches `db.statement`/`db.system` to active OTel span." |
| **Severity** | MEDIUM |

**Complete fixed repository + errors + logger:**

```typescript
// errors.ts
// Domain-specific error classes — one per business failure

/** Base for all domain errors — enables exhaustive matching via _tag */
interface DomainError {
  readonly _tag: string;
  readonly message: string;
}

export class TaskNotFoundError implements DomainError {
  readonly _tag = "TaskNotFoundError" as const;
  constructor(readonly message: string, readonly taskId: string) {}
}

export class ProjectNotFoundError implements DomainError {
  readonly _tag = "ProjectNotFoundError" as const;
  constructor(readonly message: string, readonly projectId: string) {}
}

export class DatabaseError implements DomainError {
  readonly _tag = "DatabaseError" as const;
  constructor(readonly message: string, readonly cause: unknown) {}
}

export type TaskRepoError = TaskNotFoundError | ProjectNotFoundError | DatabaseError;

/**
 * Exhaustive error matcher — forces callers to handle every error type.
 * Compile error if a new error is added but not mapped here.
 */
export function matchTaskError(
  error: TaskRepoError,
): { status: number; code: string; message: string } {
  switch (error._tag) {
    case "TaskNotFoundError":
      return { status: 404, code: "TASK_NOT_FOUND", message: error.message };
    case "ProjectNotFoundError":
      return { status: 404, code: "PROJECT_NOT_FOUND", message: error.message };
    case "DatabaseError":
      return { status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred" };
  }
}
```

```typescript
// otel-logger.ts
import { type Logger } from "drizzle-orm";
import { trace } from "@opentelemetry/api";

/**
 * Drizzle logger that attaches SQL statements to the active OTel span.
 * Zero overhead when no span is active (guard check first).
 */
export class OtelDrizzleLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    const span = trace.getActiveSpan();
    if (!span) return; // no-op when tracing is off

    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.statement", query);
    // Do NOT log params — may contain PII
  }
}
```

```typescript
// db.ts — client creation
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { OtelDrizzleLogger } from "./otel-logger";
import * as schema from "./schema";

// Connects to PgBouncer, NOT directly to PG superuser
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // app_service role via PgBouncer
  max: 5, // per instance; 5 instances × 5 = 25 to PgBouncer
});

export const db = drizzle(pool, {
  schema,
  logger: new OtelDrizzleLogger(),
});
```

```typescript
// task-repository.ts
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { tasks } from "./schema/tasks";
import { db } from "./db";
import {
  TaskNotFoundError,
  ProjectNotFoundError,
  DatabaseError,
  type TaskRepoError,
} from "./errors";
import type { Task } from "./schema/tasks";

/**
 * Creates a task repository with errors-as-values pattern.
 * Every public method returns a discriminated union — callers
 * handle each error via matchTaskError() exhaustively.
 */
export function createTaskRepository(database: typeof db) {

  /** Fetch active tasks for a project — explicit columns, partial index-friendly */
  async function findActiveByProject(
    projectId: string,
  ): Promise<Task[] | DatabaseError> {
    try {
      return await database
        .select({
          id: tasks.id,
          projectId: tasks.projectId,
          assigneeId: tasks.assigneeId,
          title: tasks.title,
          priceEstimate: tasks.priceEstimate,
          status: tasks.status,
          createdAt: tasks.createdAt,
          description: tasks.description,
        })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "active")))
        .orderBy(desc(tasks.createdAt));
    } catch (error) {
      return new DatabaseError("Failed to fetch active tasks", error);
    }
  }

  /**
   * Full-text search — uses tsvector + GIN index.
   * PARAMETERIZED: search term goes through plainto_tsquery, never interpolated.
   */
  async function search(
    term: string,
  ): Promise<Task[] | DatabaseError> {
    try {
      // Parameterized — $1 is bound by the driver, zero injection risk
      return await database
        .select({
          id: tasks.id,
          projectId: tasks.projectId,
          assigneeId: tasks.assigneeId,
          title: tasks.title,
          priceEstimate: tasks.priceEstimate,
          status: tasks.status,
          createdAt: tasks.createdAt,
          description: tasks.description,
        })
        .from(tasks)
        .where(sql`search_vector @@ plainto_tsquery('english', ${term})`);
    } catch (error) {
      return new DatabaseError("Failed to search tasks", error);
    }
  }

  /**
   * Cursor-based pagination for assignee's tasks.
   * Uses keyset pagination — O(1) regardless of page depth.
   *
   * @param cursor - The `created_at` value of the last item from the previous page.
   *                 Pass undefined for the first page.
   */
  async function findByAssignee(
    assigneeId: string,
    cursor?: Date,
    limit = 20,
  ): Promise<Task[] | DatabaseError> {
    try {
      const conditions = [eq(tasks.assigneeId, assigneeId)];

      // Keyset: filter by cursor instead of OFFSET
      if (cursor) {
        conditions.push(lt(tasks.createdAt, cursor));
      }

      return await database
        .select({
          id: tasks.id,
          projectId: tasks.projectId,
          assigneeId: tasks.assigneeId,
          title: tasks.title,
          priceEstimate: tasks.priceEstimate,
          status: tasks.status,
          createdAt: tasks.createdAt,
          description: tasks.description,
        })
        .from(tasks)
        .where(and(...conditions))
        .orderBy(desc(tasks.createdAt))
        .limit(limit);
    } catch (error) {
      return new DatabaseError("Failed to fetch assignee tasks", error);
    }
  }

  /** Find recent tasks (last hour) — uses BRIN index on created_at */
  async function findRecent(): Promise<Task[] | DatabaseError> {
    try {
      return await database
        .select({
          id: tasks.id,
          projectId: tasks.projectId,
          assigneeId: tasks.assigneeId,
          title: tasks.title,
          priceEstimate: tasks.priceEstimate,
          status: tasks.status,
          createdAt: tasks.createdAt,
          description: tasks.description,
        })
        .from(tasks)
        .where(sql`created_at > NOW() - INTERVAL '1 hour'`);
    } catch (error) {
      return new DatabaseError("Failed to fetch recent tasks", error);
    }
  }

  return { findActiveByProject, search, findByAssignee, findRecent };
}

/** Derive repo type from factory — no manual interface maintenance */
export type TaskRepository = ReturnType<typeof createTaskRepository>;
```

---

## 7. Complete Fixed SQL Schema

```sql
-- =====================================================
-- Fixed schema — all skill rules applied
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_uuidv7;

-- Organizations
CREATE TABLE organizations (
  id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,                     -- bcrypt/argon2 hash
  api_key_hash TEXT,                      -- argon2id hash of API key
  api_key_prefix CHAR(8),                -- display prefix only
  deleted_at TIMESTAMPTZ,                -- soft delete (NULL = active)
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique: email uniqueness only among active users
CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_org ON users(org_id);

-- Projects
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  budget NUMERIC(12,2) CHECK (budget >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_org ON projects(org_id);

-- Tasks
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  assignee_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  price_estimate NUMERIC(12,2) CHECK (price_estimate >= 0),
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'active', 'in_review', 'done', 'cancelled')),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK indexes
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);

-- Query-pattern indexes
CREATE INDEX idx_tasks_project_active ON tasks(project_id, created_at DESC)
  WHERE status = 'active';                                    -- partial index
CREATE INDEX idx_tasks_assignee_cursor ON tasks(assignee_id, created_at DESC)
  INCLUDE (id, title, status);                                -- covering index
CREATE INDEX idx_tasks_search ON tasks USING GIN(search_vector);  -- full-text
CREATE INDEX idx_tasks_created_brin ON tasks USING BRIN(created_at); -- time-range

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON users
  USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY org_isolation ON projects
  USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY org_isolation ON tasks
  USING (project_id IN (
    SELECT id FROM projects WHERE org_id = current_setting('app.current_org_id')::uuid
  ));

-- Autovacuum tuning (NEVER disable)
ALTER TABLE tasks SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005,
  autovacuum_vacuum_cost_delay = 2
);
```

---

## Summary — 25 Issues Found

| # | Issue | Severity | Skill Rule |
|---|---|---|---|
| 1.1 | TRUNCATE under traffic | CRITICAL | Gotchas |
| 1.2 | VARCHAR instead of TEXT | MEDIUM | Schema Design |
| 1.3 | TIMESTAMP without timezone | HIGH | Schema Design |
| 1.4 | FLOAT for money | CRITICAL | Schema Design |
| 1.5 | UUIDv4 instead of UUIDv7 | HIGH | Schema Design |
| 1.6 | Boolean soft delete | MEDIUM | Schema Design |
| 1.7 | Missing CHECK constraints | HIGH | Schema Design |
| 1.8 | Missing FK indexes | HIGH | Schema Design |
| 1.9 | Plaintext API keys | CRITICAL | Security |
| 1.10 | TEXT instead of JSONB for preferences | LOW | Schema Design |
| 2.1 | SELECT * | HIGH | Performance |
| 2.2 | LIKE '%term%' | HIGH | Performance |
| 2.3 | OFFSET pagination | HIGH | Performance |
| 2.4 | NOW() gotcha awareness | LOW | Gotchas |
| 3.1 | No lock_timeout on DDL | HIGH | Operational |
| 3.2 | Non-concurrent index creation | HIGH | Operational |
| 3.3 | autovacuum disabled | CRITICAL | Operational |
| 3.4 | Rename without expand-and-contract | HIGH | Operational |
| 4.1 | Pool exhausts max_connections | CRITICAL | Gotchas |
| 4.2 | Superuser for app | CRITICAL | Security |
| 4.3 | No RLS | HIGH | Security |
| 5.1 | serial PK in Drizzle | HIGH | Drizzle ORM |
| 5.2 | real() for price in Drizzle | CRITICAL | Drizzle ORM |
| 5.3 | Bare timestamp in Drizzle | HIGH | Drizzle ORM |
| 5.4 | No type export from Drizzle schema | MEDIUM | Drizzle ORM |
| 6.1 | throw Error in repository | HIGH | Repository Pattern |
| 6.2 | SQL injection in search | CRITICAL | Security |
| 6.3 | No OTel logger | MEDIUM | OTel |
