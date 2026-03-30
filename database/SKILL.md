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
- FKs: enforce in DB. Index ALL FK columns — prevents cascade lock issues.
- Types: TEXT not VARCHAR. TIMESTAMPTZ not TIMESTAMP. NUMERIC for money never FLOAT. JSONB for semi-structured.
- snake_case naming. Consistent plural/singular.
- Soft delete: `deleted_at TIMESTAMPTZ` with partial unique index, or history table. Never boolean `is_deleted`.
- CHECK constraints: `price > 0`, `status IN (...)`. Make invalid data unrepresentable.

### Performance & Indexing
- Covering indexes: INCLUDE clauses for index-only scans, avoid heap lookups.
- Partial indexes: `WHERE status = 'active'` — saves RAM/disk.
- BRIN indexes: for time-series/append-only data naturally ordered on disk.
- No SELECT *: explicit columns enables covering indexes.
- Pagination: cursor-based (keyset). OFFSET/LIMIT is O(N) on deep pages.
- Text search: TSVECTOR + GIN. Never `LIKE '%term%'` on large tables.
- Index based on query patterns (WHERE, JOIN, ORDER BY).

### Operational & Migrations
- Expand-and-Contract for breaking changes: 1) add nullable col 2) dual-write 3) backfill 4) switch reads 5) drop old.
- `SET lock_timeout = '5s'` on every DDL migration — prevent write queue pileups.
- CREATE INDEX CONCURRENTLY. ADD CONSTRAINT NOT VALID then VALIDATE separately — avoid table locks.
- Tune autovacuum frequency on high-churn tables. NEVER disable autovacuum.
- PgBouncer Transaction Mode for serverless; keep < 100 active DB connections.

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
