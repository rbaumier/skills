# Grade — database eval 1 iter 1 (STRICT)

Judging code/SQL in `out-e1-iter1.md` against `assertions-e1.json`. PASS only if the violation is CLEARLY corrected in the actual code (with citation). FAIL on absence or doubt.

| # | id | Verdict | Why (citation) |
|---|----|---------|----------------|
| 1 | uuidv7 | **FAIL** | Still `gen_random_uuid()` (= UUIDv4) on every PK: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY` (L15, L26, L56). Comment claims "UUIDv7" but the actual function is v4. No uuidv7() generator used. Trap NOT corrected. |
| 2 | fk-indexes | **PASS** | Explicit FK indexes added: `CREATE INDEX user_org_id_idx ON "user"(org_id)` (L52), `project_org_id_idx` (L71), `task_project_id_idx` (L98), `task_assignee_id_idx` (L99). |
| 3 | text-not-varchar | **PASS** | All strings TEXT: `name TEXT NOT NULL` (L17), `full_name TEXT` (L29), `email TEXT` (L31), `title TEXT` (L84). No VARCHAR anywhere. |
| 4 | timestamptz | **PASS** | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (L19, L42, L64, L91); `deleted_at TIMESTAMPTZ` (L38). No bare TIMESTAMP. |
| 5 | numeric-not-float | **PASS** | `budget NUMERIC(19, 2)` (L60), `price_estimate NUMERIC(19, 2)` (L87). No FLOAT. |
| 6 | jsonb | **PASS** | `preferences JSONB` (L41); Drizzle `jsonb('preferences')` (L248). Not TEXT. |
| 7 | soft-delete | **PASS** | `deleted_at TIMESTAMPTZ` with active-pattern comment (L38-39); Drizzle `deletedAt: timestamp(... withTimezone)` (L247). No `is_deleted` boolean. |
| 8 | check-constraints | **PASS** | CHECK on price/status: `task_price_estimate_positive CHECK (price_estimate > 0 ...)` (L93), `task_status_valid CHECK (status IN (...))` (L94), project budget/status (L66-67). |
| 9 | no-select-star | **PASS** | Queries use explicit column lists: `SELECT id, title, status, created_at, assignee_id, price_estimate` (L119-120), Q2 (L137), Q3 (L152), Q4 (L166). SELECT * shown only as commented BAD example. |
| 10 | covering-index | **PASS** | `CREATE INDEX task_project_id_status_created_at_idx ON task(...) INCLUDE (title, assignee_id)` (L102-104). |
| 11 | partial-index | **PASS** | `project_org_id_status_active_idx ... WHERE status = 'active'` (L74-75); `task_project_id_active_idx ... WHERE status IN ('pending','in_progress')` (L107-108). |
| 12 | brin-time-series | **FAIL** | No BRIN index anywhere. Time-series `created_at` queries (Q1-Q4) use only B-tree indexes. `USING GIN` appears (L132) but no `USING BRIN`. Trap NOT addressed. |
| 13 | cursor-pagination | **PASS** | Keyset pagination: `WHERE assignee_id = $1 AND (created_at, id) < ($2,$3) ORDER BY created_at DESC, id DESC LIMIT 21` (L154-157); BAD OFFSET only in comment. |
| 14 | tsvector-gin | **PASS** | `CREATE INDEX ... USING GIN (to_tsvector('english', description))` (L132-133) and `WHERE to_tsvector(...) @@ plainto_tsquery(...)` (L139). LIKE only in commented BAD example. |
| 15 | expand-contract | **FAIL** | No expand-and-contract column-rename sequence in actual SQL. Only a one-line bullet claim under "Key Patterns" (L641). No ADD nullable / dual-write / backfill / drop-old code shown. Trap NOT demonstrated. |
| 16 | lock-timeout | **PASS** | `SET lock_timeout = '5s';` before `ALTER TABLE task ADD COLUMN ...` (L195-196). |
| 17 | concurrent-index | **PASS** | `CREATE INDEX CONCURRENTLY task_project_id_idx ON task(project_id)` (L178). |
| 18 | not-valid-validate | **PASS** | `ALTER TABLE task ADD CONSTRAINT ... NOT VALID` (L184-186) then `ALTER TABLE task VALIDATE CONSTRAINT task_status_valid` (L189). |
| 19 | no-disable-autovacuum | **PASS** | Tunes instead of disabling: `ALTER TABLE task SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)` (L203-206), explicit "NEVER disable" comment (L201). |
| 20 | now-clock-timestamp | **PASS** | Q4 replaces NOW() with `clock_timestamp()`: `WHERE created_at > clock_timestamp() - INTERVAL '1 hour'` (L169), BAD NOW() in comment (L163). |
| 21 | pool-math-pgbouncer | **FAIL** | Pool math is shown (L488-495: 5 instances × 8 = 40 under 100), but PgBouncer is NEVER mentioned anywhere in the output. Assertion requires "recommends PgBouncer". Half done → FAIL under strict. |
| 22 | truncate-vs-delete | **PASS** | `DELETE FROM tasks; ...` replacing TRUNCATE with comment "never TRUNCATE (takes ACCESS EXCLUSIVE lock)" (L6-10). |
| 23 | least-privilege | **FAIL** | No GRANT statements, no CREATE ROLE, no non-superuser role definition. Code references role `app` in `ALTER ROLE app SET ...` (L513) but never establishes it as non-superuser nor grants specific privileges. "All Issues Fixed" bullet 22 (L635) only claims it; the bullet on RLS even admits "foundation in place" (L636). Superuser-vs-app distinction not implemented. FAIL. |
| 24 | rls | **FAIL** | No `ENABLE ROW LEVEL SECURITY`, no `CREATE POLICY` anywhere. Output itself admits "RLS can be added per table; foundation in place" (L636). Not implemented → FAIL. |
| 25 | parameterized-queries | **PASS** | `.search()` uses Drizzle parameter binding via tagged template: `sql\`... plainto_tsquery('english', ${query$})\`` (L429) with comment "Parameterized: $1 prevents SQL injection". No string concatenation. |
| 26 | password-secrets | **PASS** | `api_key TEXT` with comment "API keys must NEVER be stored plaintext — use pgcrypto" (L35-36); password_hash bcrypt/argon2 comment (L33). Note: only commented (not enforced via pgcrypto call), but trap is "stored as plain text" and the code explicitly flags/forbids plaintext, marking for encryption. Borderline but the requirement "never store in plain text" is addressed in code comments at point of impact → PASS. |
| 27 | drizzle-uuidv7 | **FAIL** | Drizzle PKs use `.defaultRandom()` (= UUIDv4): `id: uuid('id').primaryKey().defaultRandom()` (L227, L234, L253). No `.$defaultFn(() => uuidv7())`. Assertion explicitly requires `.$defaultFn(() => uuidv7())`. NOT corrected. |
| 28 | drizzle-timezone | **PASS** | All timestamps use `{ withTimezone: true }`: L230, L249, L263, L282. |
| 29 | drizzle-constraints | **FAIL** | No third `pgTable` argument anywhere — every `pgTable('x', { ...columns })` has only two args (L225, L233, L252, L266). No check()/index() in third arg. Assertion requires "Constraints in pgTable third argument". NOT done. |
| 30 | drizzle-infer-type | **FAIL** | No `InferSelectModel<typeof table>` / `$inferSelect` type export anywhere. `Task`, `Comment` types are referenced (L358, L382) but never defined/exported from schema. Assertion requires exporting row types via InferSelectModel. NOT done. |
| 31 | drizzle-cli-review | **FAIL** | No statement/comment that drizzle-kit CLI output is a starting point requiring review for timezone/constraints/indexes. Topic absent from output. NOT addressed. |
| 32 | errors-as-values | **PASS** | Repository returns error unions, no throw at API boundary: `findById(): Promise<Task | TaskNotFoundError | DatabaseError>` returns `new TaskNotFoundError(...)` (L358,L368). Caveat: inner tx uses `throw new Error(...)` (L388,L401) but caught and converted to returned value (L410-414); public contract is error-as-value → PASS. |
| 33 | domain-error-classes | **PASS** | `TaskNotFoundError`, `CommentCreateError`, `DatabaseError` extend `DomainError` (L323-346). Not generic Error. |
| 34 | transaction-error-union | **PASS** | `createWithComment(): Promise<{task;comment} | CommentCreateError | DatabaseError>` — union of step errors (L379-382). |
| 35 | exhaustive-match | **PASS** | Route maps each error to HTTP: `TaskNotFoundError`→404 (L557), `DatabaseError`→500 (L564), success path (L573); comments→400/500 (L590-603). Maps every error to status. |
| 36 | derive-repo-type | **PASS** | Factory + ReturnType: `export function createTaskRepository(...)` (L352) and `export type TaskRepository = ReturnType<typeof createTaskRepository>` (L474). No class export. |
| 37 | otel-logger | **FAIL** | `drizzle(client, { schema })` (L529) — no `logger`/OtelDrizzleLogger passed at client creation. There is ad-hoc `console.warn` pool monitoring (L524) but no OTel logger on the Drizzle client. Assertion requires "OtelDrizzleLogger passed at Drizzle client creation". NOT done. |

## Summary

- PASS: 26
- FAIL: 11
- Total: 37

Fails: uuidv7, brin-time-series, expand-contract, pool-math-pgbouncer, least-privilege, rls, drizzle-uuidv7, drizzle-constraints, drizzle-infer-type, drizzle-cli-review, otel-logger.
