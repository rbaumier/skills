---
name: database
description: Data architecture, SQL engineering, persistence strategies, PostgreSQL internals, query optimization, migrations, connection pooling, replication, and operational best practices.
---

## Gotchas
- `SELECT *` wastes bandwidth. List columns explicitly.
- FK columns need explicit indexes — NOT auto-indexed.
- `NOW()` in transaction = same value entire txn. Use `clock_timestamp()` for wall-clock.
- Pool math: 5 instances × 20 pool = 100 = default max_connections limit. Use PgBouncer.
- `TRUNCATE` takes ACCESS EXCLUSIVE lock, not MVCC-safe. Use `DELETE FROM` during traffic.

## Critical Rules

### Schema Design & Modeling
- PKs: UUIDv7 (index locality, time-sortable). Never random UUIDv4 for clustered keys.
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
- BRIN indexes: for time-series/append-only data naturally ordered on disk.
- No SELECT *: explicit columns enables covering indexes.
- Pagination: cursor-based (keyset). OFFSET/LIMIT is O(N) on deep pages.
- Text search: TSVECTOR + GIN. Never `LIKE '%term%'` on large tables.
- Index based on query patterns (WHERE, JOIN, ORDER BY).
- **N+1 query detection and prevention**: N+1 = 1 query for a list + N queries for each item's relation. With Drizzle: use `.findMany({ with: { relation: true } })` or explicit JOINs. Never loop over results and query inside the loop. Detection: enable query logging and count queries per request -- if count scales with result set size, you have N+1. In reviews: if you see `for (const item of items) { await db.query... }`, flag it as N+1.
- **EXPLAIN ANALYZE before deploying queries on large tables**: Always run `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` on new queries against production-sized data. Red flags: Seq Scan on tables >10K rows, Nested Loop with large outer set, Sort with high memory usage. Add missing indexes when you see unexpected Seq Scans. In reviews: if a PR adds a new query on a table with >10K rows without an EXPLAIN plan, request one.
- **Materialized views for expensive aggregations**: Create materialized views for dashboard queries, reports, and analytics that aggregate large tables. Refresh strategy: `REFRESH MATERIALIZED VIEW CONCURRENTLY` (requires unique index) for zero-downtime refresh. Schedule via pg_cron or application cron. Never query materialized views expecting real-time data -- always document staleness. In reviews: if a query aggregates >100K rows and runs frequently, suggest a materialized view.
- **N+1 query detection in reviews** -- any loop that calls a database/API inside the loop body is an N+1 bug. Reviews: `for (const item of items) { await db.query(...item.id) }` -> flag 'batch this query'. Use `Promise.all` + `WHERE IN` or DataLoader pattern.

### Operational & Migrations
- Expand-and-Contract for breaking changes: 1) add nullable col 2) dual-write 3) backfill 4) switch reads 5) drop old.
- `SET lock_timeout = '5s'` on every DDL migration — prevent write queue pileups.
- CREATE INDEX CONCURRENTLY. ADD CONSTRAINT NOT VALID then VALIDATE separately — avoid table locks.
- Tune autovacuum frequency on high-churn tables. NEVER disable autovacuum.
- PgBouncer Transaction Mode for serverless; keep < 100 active DB connections.
- `SET search_path = pg_catalog` — force explicit schema names in every DDL object. Explicit > implicit.
- `statement_timeout` per role: `ALTER ROLE app SET statement_timeout TO '250ms'`. Before increasing: check indexes → materialized views → cache settings → disk → CPU/RAM → read replica.
- **Advisory locks for application-level coordination**: Use `pg_advisory_lock(key)` for leader election, singleton job execution, or preventing concurrent migrations. `pg_try_advisory_lock(key)` returns false instead of blocking. Always use `pg_advisory_xact_lock()` (transaction-scoped) over session-scoped locks to prevent leak. In reviews: if you see application-level mutex/file locks for coordinating DB operations, suggest advisory locks instead.
- **Idempotent migrations with rollback strategy**: Every migration must be reversible. Write explicit `down` migrations. For data migrations: make them idempotent (re-runnable without side effects) using `INSERT ... ON CONFLICT DO NOTHING` or `WHERE NOT EXISTS`. Test migrations against a copy of production data before deploying. In reviews: if a migration has no down/rollback, flag it.
- **Connection pool sizing formula**: Optimal pool size = (core_count * 2) + effective_spindle_count. For SSD: ~(CPU cores * 2) + 1. For serverless: keep total connections across all instances under `max_connections - 10` (reserve for admin). Monitor with `SELECT count(*) FROM pg_stat_activity`. Alert when active connections > 80% of pool max. In reviews: if pool size is set to a round number like 50 or 100 without justification, flag it.
- **`statement_timeout` and `idle_in_transaction_session_timeout` for safety**: Set `statement_timeout = '30s'` at session/role level to kill runaway queries. Set `idle_in_transaction_session_timeout = '60s'` to reclaim connections held idle in open transactions (common in ORMs). These prevent one bad query from cascading into pool exhaustion. In reviews: if a new DB connection config lacks these timeouts, flag it.
- **Zero-downtime migrations (expand-contract)**: Never rename columns directly in production. Step 1: Add new column + backfill. Step 2: Deploy app reading both. Step 3: Drop old column. Separate data backfills from schema changes into independent migrations. Always test against a production data copy.

### Security & Access Control
- Least privilege: app never superuser. GRANT only SELECT/INSERT/UPDATE/DELETE on specific tables.
- RLS on every table. Keep policies performant.
- bcrypt/argon2 for passwords. Never store API keys/secrets plain text.
- Parameterized queries only. Never concatenate strings into SQL.
- Identify PII. Encrypt sensitive columns at rest (pgcrypto) if compliance requires.

### Drizzle ORM
- `pgTable()` with typed columns. `InferSelectModel<typeof table>` for row types — never deprecated `InferModel`.
- UUIDv7: `.$defaultFn(() => uuidv7())` on PKs. Never `defaultRandom()` (UUIDv4).
- Timestamps: always `{ withTimezone: true }`. Never bare `timestamp()`.
- Constraints in third argument: `check()`, `uniqueIndex()`, `index()`.
- Export table + `InferSelectModel` type from same file.
- CLI output (drizzle-kit, better-auth) is a starting point, NOT production-ready. Always review for: `withTimezone: true`, CHECK constraints, custom indexes, snake_case.
- **ON CONFLICT (UPSERT) patterns**: Use `INSERT ... ON CONFLICT (key) DO UPDATE SET ...` for idempotent writes. For conditional upserts: `DO UPDATE SET value = EXCLUDED.value WHERE table.updated_at < EXCLUDED.updated_at` (last-write-wins with timestamp guard). For insert-if-not-exists: `ON CONFLICT DO NOTHING`. In Drizzle: `db.insert(table).values(data).onConflictDoUpdate({ target: table.id, set: { ... } })`. In reviews: if you see SELECT-then-INSERT patterns, recommend UPSERT to eliminate race conditions.

### Repository Pattern & Typed Errors
- Return errors as values, never throw: `Promise<Entity | DomainError | DatabaseError>`.
- Domain-specific error classes: `DiffNotFoundError`, `CommentForbiddenError`. One class per business failure, not generic `Error`.
- `DatabaseError` wraps unexpected DB failures — preserves original `cause` for debugging.
- Colocate error types in `errors.ts` alongside repository and service.
- Exhaustive `matchError()` in routes: every error `_tag` maps to specific HTTP status + problem code.
- Transactions return union of ALL step errors: `Promise<Result | ThreadCreateError | CommentCreateError | DatabaseError>`.
- Derive repo type from factory: `type DiffRepository = ReturnType<typeof createDiffRepository>`.

### OTel Query Logging
- `OtelDrizzleLogger` attaches `db.statement`/`db.system` to active OTel span.
- Guard with `trace.getActiveSpan()`. Zero overhead when no span active.
- Pass at client creation: `drizzle(pgClient, { schema, logger: new OtelDrizzleLogger() })`.

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
