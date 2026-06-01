# Grade — database / e1 / iter4

Strict grading: PASS only if the violation is CLEARLY corrected in the real code (cited). FAIL on doubt, aspirational, or delegated ("would use", "in app layer").

| id | verdict | evidence |
|----|---------|----------|
| uuidv7 | PASS | `id UUID PRIMARY KEY,  -- populated by app layer with uuidv7()` (L14-16, 27, 45, 61); Drizzle `$defaultFn(() => uuidv7())` (L195). No `gen_random_uuid()`. |
| fk-indexes | PASS | `CREATE INDEX idx_task_project_id ON task(project_id);` `idx_task_assignee_id` (L76-77); `index('idx_user_org_id')` (L225), `idx_project_org_id` (L252). |
| text-not-varchar | PASS | All string cols are `TEXT` (`name TEXT NOT NULL` L17, `full_name TEXT` L29, etc.). No VARCHAR present. |
| timestamptz | PASS | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (L17, 35, 50, 68); Drizzle `{ withTimezone: true }` (L197). |
| numeric-not-float | PASS | `budget NUMERIC(12, 2)` (L48), `price_estimate NUMERIC(10, 2)` (L66); `numeric('budget', {precision,scale})` (L247). No FLOAT. |
| jsonb | PASS | `preferences JSONB,  -- semi-structured settings` (L34). |
| soft-delete | PASS | `deleted_at TIMESTAMPTZ,  -- NULL = active; soft delete pattern` (L33); Drizzle `deletedAt` timestamp (L219). No `is_deleted`. |
| check-constraints | PASS | `CHECK (status IN ('backlog','active','done'))` (L52), `CHECK (budget IS NULL OR budget > 0)` (L53), task status/price CHECKs (L71-72). |
| no-select-star | PASS | Explicit column lists in every query (L99-106, L122-128) and repo `.select({...})` (L344-352). No `SELECT *`. |
| covering-index | PASS | `CREATE INDEX idx_task_project_status ON task(project_id, status) INCLUDE (created_at, title);` (L84). |
| partial-index | PASS | `CREATE INDEX idx_task_active ON task(project_id) WHERE status = 'active' AND deleted_at IS NULL;` (L87). |
| brin-time-series | PASS | `CREATE INDEX idx_task_created_at_brin ON task USING BRIN (created_at);` (L81). |
| cursor-pagination | PASS | Cursor/keyset: `created_at > (SELECT created_at FROM task WHERE id = $2)` (L110-112), `id > $2` (L154); repo `findByAssignee` cursor (L457). No OFFSET. |
| tsvector-gin | PASS | `to_tsvector(...) @@ plainto_tsquery(...)` query (L130-131) + `CREATE INDEX ... USING GIN (to_tsvector(...))` (L136-137). |
| expand-contract | FAIL | Only aspirational: "would use expand-and-contract pattern in real migration" (L581). No actual ADD-new-col / backfill / drop-old DDL in code. |
| lock-timeout | FAIL | No `SET lock_timeout` anywhere in the migrations/DDL. Absent entirely. |
| concurrent-index | FAIL | All `CREATE INDEX` (L76-87, L136) are plain — no `CONCURRENTLY`. Absent entirely. |
| not-valid-validate | FAIL | No `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT` pattern. CHECKs added inline at CREATE TABLE only; no separate validate step. |
| no-disable-autovacuum | FAIL | No autovacuum config/tuning in code; only a summary sentence "never disable autovacuum; high-churn tables need tuning" (L582). Described, not implemented. |
| now-clock-timestamp | PASS | `created_at >= clock_timestamp() - INTERVAL '1 hour'` (L173) with comment warning NOW() is frozen in transaction (L162). |
| pool-math-pgbouncer | PASS | Pool math computed `5 instances × 20 pool size = 100 connections` (L488) and "Use PgBouncer in transaction mode" (L489, L522-524). |
| truncate-vs-delete | PASS | `DELETE FROM audit_logs;` with comment that TRUNCATE takes ACCESS EXCLUSIVE lock (L8-9). |
| least-privilege | FAIL | Only a comment claim (`user: app_user` L491, L484). No `GRANT`/`REVOKE` or role definition in code — delegated to "vault/env", not corrected in the schema/DDL. |
| rls | FAIL | `ENABLE ROW LEVEL SECURITY` only on `user` table (L40); assertion requires RLS on every table for multi-tenant isolation, and no `CREATE POLICY` exists ("policy defined in app layer", delegated). |
| parameterized-queries | PASS | Parameterized `$1..$3` in SQL; repo uses Drizzle bound params `eq(task.id, taskId)` (L354) and `sql\`... ${searchTerm}\`` (L425). No string concat. |
| password-secrets | PASS | `password_hash`/`api_key` removed from schema, commented "managed separately via vault" (L31-32); secrets not stored plain in tables. |
| drizzle-uuidv7 | PASS | `id: uuid('id').primaryKey().$defaultFn(() => uuidv7())` (L195, 212, 241, 268). No serial. |
| drizzle-timezone | PASS | `timestamp('created_at', { withTimezone: true })` (L197, 221, 249, 281). |
| drizzle-constraints | PASS | Constraints/indexes in third arg callback `(t) => [ index(...), check(...) ]` (L251-255, 283-294). |
| drizzle-infer-type | PASS | `export type User = typeof user.$inferSelect;` (L233, 258, 297). Not legacy InferSelectModel. |
| drizzle-cli-review | FAIL | No statement that CLI output is a starting point requiring review for tz/constraints/indexes. Summary L561 mentions InferSelectModel only; the cli-review concern is not addressed. |
| errors-as-values | PASS | Methods return errors as values (`return new TaskNotFoundError(taskId)` L357, `return new DatabaseError(...)` L360). No throw in repo methods. |
| domain-error-classes | PASS | `TaskNotFoundError`, `CommentCreateError`, `DatabaseError` domain classes (L311-330). |
| transaction-error-union | PASS | `createWithComment(...): Promise<{task;comment} \| CommentCreateError \| DatabaseError>` (L370), returns step errors inside tx (L383, 397). |
| exhaustive-match | FAIL | No `matchError()` / exhaustive error→HTTP-status mapping anywhere in the code. Absent entirely. |
| derive-repo-type | PASS | Factory + ReturnType present: `export const createTaskRepository = ...` and `export type TaskRepositoryType = ReturnType<typeof createTaskRepository>` (L468-469). |
| otel-logger | PASS | `OtelDrizzleLogger` passed at client creation: `drizzle(pool, { schema, logger: new OtelDrizzleLogger() })` (L513-516). |

## Totals
- Total: 38
- PASS: 29
- FAIL: 9
- Fails: expand-contract, lock-timeout, concurrent-index, not-valid-validate, no-disable-autovacuum, least-privilege, rls, drizzle-cli-review, exhaustive-match
