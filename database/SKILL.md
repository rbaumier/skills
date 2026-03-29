---
name: database
description: Data architecture, SQL engineering, persistence strategies, PostgreSQL internals, query optimization, migrations, connection pooling, replication, and operational best practices.
---

## When to use
- Designing schemas (SQL/NoSQL)
- Optimizing queries via EXPLAIN ANALYZE
- Planning production migrations
- Configuring pooling, replication, failover
- Implementing RLS and audit logs
- Debugging deadlocks, lock contention, connection storms
- PostgreSQL internals: MVCC, WAL, vacuum, storage layout
- Backup, recovery, and monitoring
- PlanetScale Postgres operations

## When not to use
- localStorage/IndexedDB logic
- Ephemeral state (Redux/Zustand)
- File/blob storage

## Core Philosophy
- Data Gravity — code is ephemeral; bad data is a resume-generating event
- Postgres for Everything (Initially) — Relational + JSONB + Vector + GIS; specialize only when scale demands it
- Normalize to 3NF — denormalize only when measured read bottleneck proves necessary
- Schema as Code — versioned, reviewed, tested in CI
- Zero-Downtime — no maintenance windows; migrations run while app is live

## Gotchas
- `SELECT *` in production queries wastes bandwidth and breaks when columns are added. Always list columns explicitly.
- Foreign key columns need explicit indexes in PostgreSQL — they are NOT auto-indexed unlike primary keys.
- `NOW()` in a transaction returns the same value for the entire transaction. Use `clock_timestamp()` if you need wall-clock time.
- Connection pools: default `max_connections = 100` in PostgreSQL. With 5 app instances × 20 pool size = 100 → you're at the limit. Use PgBouncer.
- `TRUNCATE` is not MVCC-safe — it takes an `ACCESS EXCLUSIVE` lock. Use `DELETE FROM` in migrations that might run during traffic.

## Critical Rules

### Schema Design & Modeling
- Primary Keys: always required. UUIDv7 for distributed systems (index locality); avoid random UUIDv4 for clustered keys
- Foreign Keys: enforce referential integrity in DB, not app code. Index all FKs to prevent cascade lock issues
- Data Types: TEXT over VARCHAR. TIMESTAMPTZ (UTC) over TIMESTAMP. NUMERIC for money — never FLOAT. JSONB for semi-structured; keep core entities relational
- Naming: snake_case everywhere. Pick plural or singular tables — be consistent
- Soft Deletes: prefer separate history table or deleted_at with partial unique index over cluttering main table
- Constraints: CHECK for validity (price > 0, status IN (...)). Make invalid data unrepresentable

### Performance & Indexing
- Index Golden Rule: index based on actual query patterns (WHERE, JOIN, ORDER BY) — not intuition. Over-indexing hurts writes
- Covering Indexes: INCLUDE clauses for index-only scans; avoid heap lookups
- Partial Indexes: index only relevant subset (WHERE status = 'active') — saves RAM/disk
- BRIN Indexes: for massive time-series/append-only data naturally ordered on disk
- No SELECT *: explicit columns — reduces network I/O, enables covering indexes
- Pagination: cursor-based (keyset) for large datasets. OFFSET/LIMIT is O(N) on deep pages
- Text Search: TSVECTOR + GIN indexes. Never LIKE '%term%' on large tables

### Operational & Migrations
- Expand and Contract: for breaking changes — 1) add nullable column, 2) dual write, 3) backfill, 4) switch reads, 5) drop old column
- Lock Timeouts: set strict lock_timeout (~5s) during migrations — prevent write queue pileups
- Concurrent Operations: CREATE INDEX CONCURRENTLY; ADD CONSTRAINT ... NOT VALID then VALIDATE — avoid table locks
- Vacuum Tuning: tune autovacuum to run more frequently on high-churn tables. Never disable it
- Connection Pooling: PgBouncer in Transaction Mode for serverless/high-concurrency; keep < 100 active DB connections

### Security & Access Control
- Least Privilege: app users never superuser. Grant only SELECT/INSERT/UPDATE/DELETE on specific tables
- RLS: enforce on every table (Supabase/Postgraphile). Keep policies performant — no expensive joins
- No Secrets in DB: bcrypt/argon2 for passwords. Never store API keys/secrets in plain text
- SQL Injection: parameterized queries only. Never concatenate strings into SQL
- PII Protection: identify PII. Encrypt sensitive columns at rest (pgcrypto) if compliance requires

### Drizzle ORM
- Schema as TypeScript: `pgTable()` declarations with typed columns, `InferSelectModel<typeof table>` for row types
- UUIDv7 auto-generation: `.$defaultFn(() => uuidv7())` on primary keys — index-friendly, time-sortable
- Timestamps: always `{ withTimezone: true }` — never bare `timestamp()`
- Constraints in schema: `check()`, `unique()`, `index()` in the table definition's third argument
- Relations: declare with `relations()` for type-safe query builder joins
- Schema = source of truth: export table + `InferSelectModel` type from same file
- Manual schema over CLI-generated when you need: `withTimezone: true`, CHECK constraints, custom indexes, snake_case columns. CLI output (drizzle-kit, better-auth) is a starting point, not production-ready

### Repository Pattern & Typed Errors
- Return errors as values, never throw: `Promise<Entity | DomainError | DatabaseError>`
- Domain-specific error classes `RepoNotFoundError`, `DiffNotFoundError`, `CommentForbiddenError`. One error per business failure, not a generic catch-all
- `DatabaseError` only for unexpected DB failures (connection lost, constraint violation) — wraps original `cause` for debugging
- Each feature defines its own error types in `errors.ts` — colocated with repository and service
- Exhaustive error mapping in routes via `matchError()` — every error type maps to a specific HTTP status + problem code
- Transactions return union of all possible errors from each step: `Promise<Result | ThreadCreateError | CommentCreateError | DatabaseError>`
- Derive repository type from factory: `type DiffRepository = ReturnType<typeof createDiffRepository>`

### OTel Query Logging
- Custom Drizzle logger (`OtelDrizzleLogger`) that attaches `db.statement` and `db.system` attributes to the active OTel span
- Zero overhead when no span is active — guard with `trace.getActiveSpan()` first
- Correlates every SQL query with the HTTP request span — enables distributed tracing from HTTP request to exact query
- Pass logger at client creation: `drizzle(pgClient, { schema, logger: new OtelDrizzleLogger() })`

### Observability & Debugging
- EXPLAIN ANALYZE: check for Seq Scan on large tables, high Buffers, estimated vs actual row mismatch
- Log Slow Queries: log_min_duration_statement > 100ms
- Deadlocks: ensure transactions access tables/rows in consistent order everywhere
- Comment Your SQL: explain *why* complex queries use hints, forced order, or specific optimizations

## Reference Files

### Generic PostgreSQL

| Topic                  | Reference                                              | Use for                                                   |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Schema Design          | [references/schema-design.md](references/schema-design.md)                 | Tables, primary keys, data types, foreign keys            |
| Indexing               | [references/indexing.md](references/indexing.md)                           | Index types, composite indexes, performance               |
| Index Optimization     | [references/index-optimization.md](references/index-optimization.md)       | Unused/duplicate index queries, index audit               |
| Partitioning           | [references/partitioning.md](references/partitioning.md)                   | Large tables, time-series, data retention                 |
| Query Patterns         | [references/query-patterns.md](references/query-patterns.md)              | SQL anti-patterns, JOINs, pagination, batch queries       |
| Optimization Checklist | [references/optimization-checklist.md](references/optimization-checklist.md) | Pre-optimization audit, cleanup, readiness checks       |
| MVCC and VACUUM        | [references/mvcc-vacuum.md](references/mvcc-vacuum.md)                     | Dead tuples, long transactions, xid wraparound prevention |

### Operations and Architecture

| Topic                  | Reference                                                        | Use for                                                         |
| ---------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Process Architecture   | [references/process-architecture.md](references/process-architecture.md)   | Multi-process model, connection pooling, auxiliary processes     |
| Memory Architecture    | [references/memory-management-ops.md](references/memory-management-ops.md) | Shared/private memory layout, OS page cache, OOM prevention     |
| MVCC Transactions      | [references/mvcc-transactions.md](references/mvcc-transactions.md)         | Isolation levels, XID wraparound, serialization errors          |
| WAL and Checkpoints    | [references/wal-operations.md](references/wal-operations.md)               | WAL internals, checkpoint tuning, durability, crash recovery    |
| Replication            | [references/replication.md](references/replication.md)                     | Streaming replication, slots, sync commit, failover             |
| Storage Layout         | [references/storage-layout.md](references/storage-layout.md)              | PGDATA structure, TOAST, fillfactor, tablespaces, disk mgmt     |
| Monitoring             | [references/monitoring.md](references/monitoring.md)                       | pg_stat views, logging, pg_stat_statements, host metrics        |
| Backup and Recovery    | [references/backup-recovery.md](references/backup-recovery.md)            | pg_dump, pg_basebackup, PITR, WAL archiving, backup tools      |

### PlanetScale-Specific

| Topic              | Reference                                                          | Use for                                               |
| ------------------ | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Connection Pooling | [references/ps-connection-pooling.md](references/ps-connection-pooling.md) | PgBouncer, pool sizing, pooled vs direct              |
| Extensions         | [references/ps-extensions.md](references/ps-extensions.md)                 | Supported extensions, compatibility                   |
| Connections        | [references/ps-connections.md](references/ps-connections.md)               | Connection troubleshooting, drivers, SSL              |
| Insights           | [references/ps-insights.md](references/ps-insights.md)                     | Slow queries, MCP server, pscale CLI                  |
| CLI Commands       | [references/ps-cli-commands.md](references/ps-cli-commands.md)             | pscale CLI reference, branches, deploy requests, auth |
| CLI API Insights   | [references/ps-cli-api-insights.md](references/ps-cli-api-insights.md)     | Query insights via `pscale api`, schema analysis      |
