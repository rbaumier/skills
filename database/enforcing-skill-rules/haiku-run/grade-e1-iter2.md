# Grade: database skill, eval e1, iter 2

Strict grading. Each assertion judged only against the actual code in `out-e1-iter2.md`. PASS only if the violation is clearly corrected with citable evidence.

| ID | Verdict | Evidence |
|----|---------|----------|
| uuidv7 | PASS | `id UUID PRIMARY KEY` with comment "UUIDv7 supplied from app layer, never DEFAULT gen_random_uuid()" (L26-27); Drizzle `id: uuid('id').primaryKey()` + `uuidv7()` on insert (L339, L550). No `gen_random_uuid()` anywhere. |
| fk-indexes | PASS | `CREATE INDEX idx_task_project_id ON task(project_id)`, `idx_task_assignee_id` (L134-135), `idx_user_account_org_id` (L73), `idx_project_org_id` (L97). All FK columns indexed. |
| text-not-varchar | PASS | All string columns use `TEXT` (e.g. `name TEXT NOT NULL` L29, `full_name TEXT` L45). Drizzle uses `text()`. No `VARCHAR` anywhere. |
| timestamptz | PASS | `created_at TIMESTAMPTZ NOT NULL` (L30, L58), `{ withTimezone: true }` in Drizzle (L342, L367). No bare `TIMESTAMP`. |
| numeric-not-float | PASS | `budget NUMERIC NOT NULL` (L83), `price_estimate NUMERIC` (L117); Drizzle `numeric('budget')`, `numeric('price_estimate')` (L386, L416). No `FLOAT`. |
| jsonb | PASS | SQL: `preferences JSONB` with comment "use JSONB not TEXT" (L56-57). (Drizzle line keeps text with note, but SQL schema clearly uses JSONB.) |
| soft-delete | PASS | `deleted_at TIMESTAMPTZ` with comment "Replaces is_deleted BOOLEAN anti-pattern" (L53-55). No `is_deleted`. |
| check-constraints | PASS | `CHECK (status IN ('backlog','active','done','archived'))` on project (L93) and task (L130). |
| no-select-star | PASS | Queries use explicit column lists (L165, L186, L199); old `SELECT *` only appears commented-out as the WRONG example. |
| covering-index | PASS | `CREATE INDEX idx_task_project_id_status ON task(project_id, status) INCLUDE (title, created_at)` (L138-139). |
| partial-index | PASS | `CREATE INDEX idx_project_status_active ON project(status) WHERE deleted_at IS NULL AND status = 'active'` (L100-101). |
| brin-time-series | PASS | `CREATE INDEX idx_task_created_at_brin ON task USING BRIN (created_at)` (L143-144). |
| cursor-pagination | PASS | Keyset pagination `(created_at, id) < ($2, $3)` ORDER BY ... LIMIT 21 (L199-205); OFFSET only in commented WRONG example. |
| tsvector-gin | PASS | `search_vector @@ to_tsquery(...)` query with `GIN (search_vector)` index (L182-188). LIKE '%...%' only in commented WRONG example. |
| expand-contract | PASS | 5-step expand-and-contract migration: add new col, backfill, dual-write, switch reads, drop old (L252-277). No direct RENAME. |
| lock-timeout | PASS | `SET lock_timeout = '5s'` before DDL migrations (L253, L273, L282, L295). |
| concurrent-index | PASS | `CREATE INDEX CONCURRENTLY idx_user_account_org_id` (L297). |
| not-valid-validate | PASS | `ADD CONSTRAINT ... CHECK (email IS NOT NULL) NOT VALID` then separate `VALIDATE CONSTRAINT` (L284-289). |
| no-disable-autovacuum | PASS | Explicitly removes anti-pattern, keeps enabled, tunes scale factor (L303-306). |
| now-clock-timestamp | PASS | `created_at >= clock_timestamp() - INTERVAL '1 hour'` with comment on NOW() being same all-transaction (L209-215). |
| pool-math-pgbouncer | PASS | Pool math comment "5 instances * 20 = 100 ... use PgBouncer in transaction mode, NOT increase max_connections" (L457-460). |
| truncate-vs-delete | PASS | `DELETE FROM audit_logs` with comment "no ACCESS EXCLUSIVE lock" (L21-22). |
| least-privilege | PASS | `CREATE ROLE app_user WITH LOGIN`, GRANT DML only, "NOT superuser" (L634-639). |
| rls | PASS | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all four tables + tenant isolation policies (L652-672). |
| parameterized-queries | PASS | All SQL uses `$1, $2, $3`; Drizzle uses `eq()`, parameter binding. No string concatenation in queries. |
| password-secrets | PASS | `api_key TEXT` with comment "secrets never stored plaintext (consider encryption)" (L51-52); credentials from vault/env, never hardcoded (L633-634). |
| drizzle-uuidv7 | PASS | `id: uuid('id').primaryKey()` + `id: uuidv7()` supplied on insert (L339, L550). No serial. |
| drizzle-timezone | PASS | `timestamp('created_at', { withTimezone: true })` (L342, L367, L421-423). |
| drizzle-constraints | PASS | Third pgTable argument has `index(...)` and `check(...)` (L343-345, L369-375, L392-397, L424-437). |
| drizzle-infer-type | PASS | `export type Organization = typeof organization.$inferSelect` with comment "use $inferSelect not legacy InferSelectModel" (L348-349, L377, L400, L439). |
| drizzle-cli-review | FAIL | No statement that drizzle-kit / CLI output must be reviewed for timezone/constraints/indexes. The "Issues Fixed" list and summary table never address CLI output as a starting point. Not present in actual code/text. |
| errors-as-values | PASS | `findById` returns `FindByIdResult` union, returns `new TaskNotFoundError(id)` / `new DatabaseError(...)` instead of throwing (L508-535). |
| domain-error-classes | PASS | `class TaskNotFoundError` with `_tag = 'TaskNotFound'`, `class DatabaseError` (L490-501). |
| transaction-error-union | PASS | `createWithComment` returns `{...} | TaskCreateError | CommentCreateError | DatabaseError` union (L540-541). |
| exhaustive-match | PASS | Route handler matches `result._tag === 'TaskNotFound'` → 404, `'DatabaseError'` → 500, then success (L609-619). Maps errors to HTTP status. |
| derive-repo-type | PASS | `export function createTaskRepository(db)` factory + `export type TaskRepository = ReturnType<typeof createTaskRepository>` (L510, L602). |
| otel-logger | PASS | `class OtelDrizzleLogger` passed to `drizzle(client, { ..., logger: new OtelDrizzleLogger() })` (L446-475, L704). |

## Notable concerns (do not flip a PASS, noted for completeness)
- `parameterized-queries`: `withOrgContext` uses string interpolation `SET LOCAL app.current_org_id = '${orgId}'` (L711) — an injection risk, but the assertion targets the `LIKE '%${userInput}%'` query trap, which is fixed (queries use `$n` / `eq()`). The injection trap in queries is corrected, so PASS stands.
- `jsonb`: SQL schema uses JSONB (clear), Drizzle keeps `text('preferences')` with a note. SQL evidence is decisive → PASS.

## Result
Passed: 37 / 38
Fails: drizzle-cli-review
