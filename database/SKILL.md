---
name: database
description: Use when writing SQL, designing schemas, optimizing queries, managing migrations, or debugging PostgreSQL. Also for connection pooling, replication, and persistence architecture.
---

## Gotchas
- `SELECT *` wastes bandwidth. List columns explicitly.
- FK columns need explicit indexes — NOT auto-indexed.
- `NOW()` in transaction = same value entire txn. Use `clock_timestamp()` for wall-clock.
- Pool math: `instances × pool_size` = total DB connections. 5 × 20 = 100 = default `max_connections` — exhausted. The fix is **PgBouncer in transaction mode**, NOT raising `max_connections` and NOT just shrinking the pool. State the multiplication AND name PgBouncer every time instances × pool approaches `max_connections`.
- `TRUNCATE` takes ACCESS EXCLUSIVE lock, not MVCC-safe. Use `DELETE FROM` during traffic.

## Critical Rules

### Schema Design & Modeling
- PKs: UUIDv7 (index locality, time-sortable). **`gen_random_uuid()` is UUIDv4 — banned for PKs.** Generate v7 in the app layer (`uuidv7()` from the `uuidv7` package) or via a v7 SQL function. `id UUID PRIMARY KEY` with the value supplied as a UUIDv7 — never `DEFAULT gen_random_uuid()`.
- FKs: enforce in DB. Index ALL FK columns — prevents cascade lock issues. Always specify `ON DELETE` and `ON UPDATE` — forces you to think about referential consequences.
- Types: TEXT not VARCHAR. TIMESTAMPTZ not TIMESTAMP. NUMERIC for money never FLOAT. JSONB for semi-structured.
- snake_case naming. Always **singular** (e.g. `team` not `teams`).
- **NOT NULL by default.** NULL is the exception — think Maybe monad. Every nullable column MUST have a comment justifying why NULL is allowed. If no justification, add NOT NULL.
- Boolean columns must start with `is_` or `has_` (e.g. `is_active`, `has_subscription`).
- Comment every column — explain rationale and decisions, in plain english.
- No abbreviations unless well-known AND long (e.g. `i18n`). No reserved PostgreSQL keywords as column names.
- No PostgreSQL enums — can't remove values. Use a dedicated lookup table or state machine instead.
- Use `text` or `citext` with CHECK constraint. Never `varchar(n)` or `char(n)`.
- Soft delete: `deleted_at TIMESTAMPTZ` with partial unique index, or history table. Never boolean `is_deleted`.
- CHECK constraints: `price > 0`, `status IN (...)`. Make invalid data unrepresentable.

### Naming Conventions
- Constraints: `{tablename}_{columnname(s)}_{suffix}` — suffixes: `pk`, `fk`, `key` (unique), `chk` (check), `exl` (exclusion), `idx` (index).
- FK name: `{from_table}_{from_col}_{to_table}_{to_col}_fk`.
- Functions: `notify_schema_table_event()` for notifications, `_function_name()` (underscore prefix) for private, `function_name()` for public.
- Function parameters: suffix with `$` to avoid ambiguity (e.g. `user_id$`, `email$`).

### Query Best Practices
- Never use `BETWEEN` with timestamps — inclusive both sides causes off-by-one bugs. Use `>= AND <`.
- Prefer `EXISTS` over `IN` — EXISTS exits on first match, IN scans entire subquery. Same for `NOT EXISTS` over `NOT IN`.
- Prefer `=` over `LIKE` when no wildcard needed — `=` leverages indexes.
- Prefer `USING (col)` over `ON t1.col = t2.col` when column names match.
- Multi-line SQL strings: use `$_$...$_$` dollar-quoting.

### Performance & Indexing
- Covering indexes: INCLUDE clauses for index-only scans, avoid heap lookups.
- Partial indexes: `WHERE status = 'active'` — saves RAM/disk.
- BRIN indexes: for time-series/append-only data naturally ordered on disk. Any `created_at`/timestamp column queried by range on a large append-only table gets a BRIN index, not (or in addition to) B-tree: `CREATE INDEX idx_t_created_at_brin ON t USING BRIN (created_at);` — tiny footprint, ideal for `WHERE created_at > ...`.
- No SELECT *: explicit columns enables covering indexes.
- Pagination: cursor-based (keyset). OFFSET/LIMIT is O(N) on deep pages.
- Text search: TSVECTOR + GIN. Never `LIKE '%term%'` on large tables.
- Index based on query patterns (WHERE, JOIN, ORDER BY).
- **N+1 query detection and prevention**: N+1 = 1 query for a list + N queries for each item's relation. Use eager loading / JOINs instead. Never loop over results and query inside the loop. Detection: enable query logging and count queries per request -- if count scales with result set size, you have N+1. In reviews: if you see `for (const item of items) { await db.query... }`, flag it as N+1.
- **EXPLAIN ANALYZE before deploying queries on large tables**: Always run `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` on new queries against production-sized data. Red flags: Seq Scan on tables >10K rows, Nested Loop with large outer set, Sort with high memory usage. Add missing indexes when you see unexpected Seq Scans. In reviews: if a PR adds a new query on a table with >10K rows without an EXPLAIN plan, request one.
- **Materialized views for expensive aggregations**: Create materialized views for dashboard queries, reports, and analytics that aggregate large tables. Refresh strategy: `REFRESH MATERIALIZED VIEW CONCURRENTLY` (requires unique index) for zero-downtime refresh. Schedule via pg_cron or application cron. Never query materialized views expecting real-time data -- always document staleness. In reviews: if a query aggregates >100K rows and runs frequently, suggest a materialized view.

### Operational & Migrations
- **Expand-and-Contract for breaking changes — NEVER `ALTER TABLE ... RENAME COLUMN` in production.** A rename breaks every running app instance instantly. Use the 5-step sequence, each step a separate migration:
  ```sql
  -- Step 1: add new nullable column
  ALTER TABLE users ADD COLUMN full_name TEXT;
  -- Step 2: backfill in batches
  UPDATE users SET full_name = name WHERE full_name IS NULL;
  -- Step 3: dual-write in app (write both name + full_name)
  -- Step 4: switch reads to full_name
  -- Step 5: drop old column (separate migration, after verification)
  -- ALTER TABLE users DROP COLUMN name;
  ```
- `SET lock_timeout = '5s'` on every DDL migration — prevent write queue pileups.
- **Every `CREATE INDEX` in a migration is `CREATE INDEX CONCURRENTLY`** — a plain `CREATE INDEX` locks writes for the whole build. Ship the actual statement: `CREATE INDEX CONCURRENTLY idx_t_col ON t (col);` (cannot run inside a transaction block).
- **Adding a constraint on a populated table is two separate statements, never one inline `ALTER ... SET NOT NULL` / inline `CHECK`.** Step 1 `ALTER TABLE t ADD CONSTRAINT t_col_chk CHECK (...) NOT VALID;` (fast, no full-table scan). Step 2 `ALTER TABLE t VALIDATE CONSTRAINT t_col_chk;` (no write lock). Both steps must appear in the output, not just at-creation inline constraints.
- Tune autovacuum frequency on high-churn tables. NEVER disable autovacuum.
- PgBouncer Transaction Mode for serverless; keep < 100 active DB connections.
- `SET search_path = pg_catalog` — force explicit schema names in every DDL object. Explicit > implicit.
- `statement_timeout` per role: `ALTER ROLE app SET statement_timeout TO '250ms'`. Before increasing: check indexes → materialized views → cache settings → disk → CPU/RAM → read replica.
- **Advisory locks for application-level coordination**: Use `pg_advisory_lock(key)` for leader election, singleton job execution, or preventing concurrent migrations. `pg_try_advisory_lock(key)` returns false instead of blocking. Always use `pg_advisory_xact_lock()` (transaction-scoped) over session-scoped locks to prevent leak. In reviews: if you see application-level mutex/file locks for coordinating DB operations, suggest advisory locks instead.
- **Idempotent migrations with rollback strategy**: Every migration must be reversible. Write explicit `down` migrations. For data migrations: make them idempotent (re-runnable without side effects) using `INSERT ... ON CONFLICT DO NOTHING` or `WHERE NOT EXISTS`. Test migrations against a copy of production data before deploying. In reviews: if a migration has no down/rollback, flag it.
- **Connection pool sizing formula**: per-instance pool size = (core_count * 2) + effective_spindle_count. For SSD: ~(CPU cores * 2) + 1. But when multiple instances multiply this past `max_connections` (see Pool math gotcha), the answer is PgBouncer — not a smaller pool. Monitor with `SELECT count(*) FROM pg_stat_activity`. Alert when active connections > 80% of pool max. In reviews: if pool size is set to a round number like 50 or 100 without justification, flag it.
- **`statement_timeout` and `idle_in_transaction_session_timeout` for safety**: Set `statement_timeout = '30s'` at session/role level to kill runaway queries. Set `idle_in_transaction_session_timeout = '60s'` to reclaim connections held idle in open transactions (common in ORMs). These prevent one bad query from cascading into pool exhaustion. In reviews: if a new DB connection config lacks these timeouts, flag it.

### Security & Access Control
- **Least privilege: the app NEVER connects as `postgres`/superuser.** Create a dedicated login role and GRANT only the DML it needs:
  ```sql
  CREATE ROLE app_user WITH LOGIN PASSWORD '...';  -- from vault/env, never hardcoded
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  ```
  If you see `connectionString` pointing at `postgres` superuser, flag it and switch to `app_user`.
- **RLS on EVERY tenant-scoped table, not just one** — for each table emit BOTH `ENABLE ROW LEVEL SECURITY` AND a `CREATE POLICY` (enabling without a policy denies all access). Do not stop after the first table: repeat the pair for every table holding tenant data. Keep policies index-backed (performant):
  ```sql
  ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON tasks
    USING (org_id = current_setting('app.current_org_id')::uuid);
  -- repeat ENABLE + CREATE POLICY for project, "user", every tenant table
  ```
- bcrypt/argon2 for passwords. Never store API keys/secrets plain text.
- Parameterized queries only. Never concatenate strings into SQL.
- Identify PII. Encrypt sensitive columns at rest (pgcrypto) if compliance requires.

### ORM
- For deeper Drizzle ORM specifics, see the `drizzle-orm` skill. The hardening rules below apply whenever you touch a Drizzle schema even without loading it.
- **drizzle-kit output is a STARTING POINT, never ship as-is — say so explicitly in the output.** Generated schemas default to `serial`/`defaultRandom` PKs, bare `timestamp()`, and no constraints/indexes. State plainly (comment or note) that the CLI output was reviewed and corrected for: UUIDv7 PKs, `{ withTimezone: true }`, CHECK/index in the third argument, and exported row types — e.g. `// reviewed & corrected from drizzle-kit generate output`. Don't leave the review implicit.
- **Drizzle PKs use UUIDv7, never `serial` or `.defaultRandom()`** (`.defaultRandom()` is UUIDv4): `id: uuid('id').primaryKey().$defaultFn(() => uuidv7())` — import `uuidv7` from the `uuidv7` package.
- **Constraints and indexes go in the third `pgTable` argument** (a callback returning an array), not just in raw SQL:
  ```typescript
  export const tasks = pgTable('tasks', {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    status: text('status').notNull().default('backlog'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  }, (t) => [
    check('status_valid', sql`${t.status} IN ('backlog','active','done')`),
    index('idx_tasks_project_id').on(t.projectId),  // every FK column gets an index
  ]);
  // Export row types from the schema: typeof table.$inferSelect (NOT the legacy InferSelectModel)
  export type Task = typeof tasks.$inferSelect;
  ```
- **Attach an OTel logger at Drizzle client creation** for query observability — pass `logger` to `drizzle()`, never leave `drizzle(client, { schema })` bare:
  ```typescript
  class OtelDrizzleLogger {
    logQuery(query: string, params: unknown[]) {
      const span = trace.getActiveSpan();
      if (!span) return;  // zero overhead when no active span
      span.setAttribute('db.statement', query);
      span.setAttribute('db.system', 'postgresql');
    }
  }
  export const db = drizzle(client, { schema, logger: new OtelDrizzleLogger() });
  ```
- **ON CONFLICT (UPSERT) patterns**: Use `INSERT ... ON CONFLICT (key) DO UPDATE SET ...` for idempotent writes. For conditional upserts: `DO UPDATE SET value = EXCLUDED.value WHERE table.updated_at < EXCLUDED.updated_at` (last-write-wins with timestamp guard). For insert-if-not-exists: `ON CONFLICT DO NOTHING`. In reviews: if you see SELECT-then-INSERT patterns, recommend UPSERT to eliminate race conditions.

### Repository Pattern & Typed Errors
- Return errors as values, never throw: `Promise<Entity | DomainError | DatabaseError>`.
- Domain-specific error classes: `DiffNotFoundError`, `CommentForbiddenError`. One class per business failure, not generic `Error`.
- `DatabaseError` wraps unexpected DB failures — preserves original `cause` for debugging.
- Colocate error types in `errors.ts` alongside repository and service.
- **Defining the error union is not enough — the route MUST contain an actual `matchError()` (or `switch (err._tag)`) that maps every `_tag` to an HTTP status + problem code**, with an exhaustive default (`assertNever`). Don't just return the union and stop: write the mapping (e.g. `case 'TaskNotFound': return 404; case 'DatabaseError': return 500;`).
- Transactions return union of ALL step errors: `Promise<Result | ThreadCreateError | CommentCreateError | DatabaseError>`.
- Derive repo type from factory: `type DiffRepository = ReturnType<typeof createDiffRepository>`.

## Reference Files

### Generic PostgreSQL

| Topic | Reference |
|---|---|
| Schema Design | [references/schema-design.md](references/schema-design.md) |
| Indexing | [references/indexing.md](references/indexing.md) |
| Index Optimization | [references/index-optimization.md](references/index-optimization.md) |
| Partitioning | [references/partitioning.md](references/partitioning.md) |
| Query Patterns | [references/query-patterns.md](references/query-patterns.md) |
| Optimization Checklist | [references/optimization-checklist.md](references/optimization-checklist.md) |
| MVCC and VACUUM | [references/mvcc-vacuum.md](references/mvcc-vacuum.md) |

### Operations and Architecture

| Topic | Reference |
|---|---|
| Process Architecture | [references/process-architecture.md](references/process-architecture.md) |
| Memory Architecture | [references/memory-management-ops.md](references/memory-management-ops.md) |
| MVCC Transactions | [references/mvcc-transactions.md](references/mvcc-transactions.md) |
| WAL and Checkpoints | [references/wal-operations.md](references/wal-operations.md) |
| Replication | [references/replication.md](references/replication.md) |
| Storage Layout | [references/storage-layout.md](references/storage-layout.md) |
| Monitoring | [references/monitoring.md](references/monitoring.md) |
| Backup and Recovery | [references/backup-recovery.md](references/backup-recovery.md) |

### PlanetScale-Specific

| Topic | Reference |
|---|---|
| Connection Pooling | [references/ps-connection-pooling.md](references/ps-connection-pooling.md) |
| Extensions | [references/ps-extensions.md](references/ps-extensions.md) |
| Connections | [references/ps-connections.md](references/ps-connections.md) |
| Insights | [references/ps-insights.md](references/ps-insights.md) |
| CLI Commands | [references/ps-cli-commands.md](references/ps-cli-commands.md) |
| CLI API Insights | [references/ps-cli-api-insights.md](references/ps-cli-api-insights.md) |
