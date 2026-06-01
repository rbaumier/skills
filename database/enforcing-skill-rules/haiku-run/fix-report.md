# Fix Report — database skill, eval1 (Haiku weak executor)

iter1: 26/37 PASS. 11 FAILs analyzed below.

## Diagnosis (overall)

`iteration-3/compressed-run1.md` is a prior gold run that passed all 37 — it carried **concrete
patterns** (actual SQL/TS) for every rule. The current live `SKILL.md` compressed those into
one-line abstractions. Result: Haiku *reads* the rule, even *names* it in a comment, but cannot
*incarnate* it (e.g. writes `gen_random_uuid()` while commenting "UUIDv7"). This is not a
"too many rules / capacity" problem — a model CAN pass all 37 here. It is an **anchoring**
problem: the 11 fails are exactly the rules that had no concrete pattern in the body.

So 10 of 11 are **R (reinforce)**: put the value + concrete pattern back into the body so a
weak executor can copy it. 1 is **A (assertion bug)**.

## Per-fail classification

| id | class | fix |
|---|---|---|
| uuidv7 | **R** | Body now states `gen_random_uuid()` IS UUIDv4 and is banned for PKs; shows app-layer `uuidv7()` generation. The executor knew the rule (commented it) but not the mechanism. |
| brin-time-series | **R** | One buried line → added concrete `CREATE INDEX ... USING BRIN (created_at)` tied explicitly to range-queried timestamp columns (matches Q1–Q4 trap). |
| expand-contract | **R** | Was TWO redundant abstract lines (a duplicate). Consolidated into ONE concrete 5-step SQL block, LOUD "NEVER `ALTER TABLE ... RENAME COLUMN` in production". Removed the redundant "Zero-downtime migrations" duplicate. |
| pool-math-pgbouncer | **R** | Executor did the math but never said PgBouncer — diluted by the competing "pool sizing formula" rule. Made PgBouncer the mandatory answer ("State the multiplication AND name PgBouncer"), and edited the sizing-formula rule to defer to PgBouncer for the multi-instance case instead of competing. |
| least-privilege | **R** | Abstract GRANT line → concrete `CREATE ROLE app_user` + `GRANT ... ON ALL TABLES` block; explicit "flag superuser connectionString". Anchored in trap. |
| rls | **R** | Abstract "RLS on every table" → concrete `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` block; note that enable-without-policy denies all. Anchored in trap. |
| drizzle-uuidv7 | **R** | DB skill deferred all Drizzle to another skill (weak executor won't load it). Added inline rule + `.$defaultFn(() => uuidv7())` pattern, banned `serial`/`.defaultRandom()`. |
| drizzle-constraints | **R** | Added concrete third-`pgTable`-argument callback example (check + index). |
| drizzle-cli-review | **R** | Added explicit "drizzle-kit output is a STARTING POINT, never ship as-is" rule listing what to review. |
| otel-logger | **R** | Added `OtelDrizzleLogger` class + `drizzle(client, { schema, logger })` pattern; banned bare `drizzle(client, { schema })`. |
| drizzle-infer-type | **A** | **Assertion bug.** It demanded `InferSelectModel<typeof table>`, but the `drizzle-orm` skill body (line 17) explicitly says use `typeof table.$inferSelect` **"(not InferSelectModel)"** — `InferSelectModel` is the legacy form. The assertion contradicted the skill's own correct idiom. Fixed the assertion in BOTH eval files to require `typeof table.$inferSelect`; taught the same idiom in the body. |

## F / capacity

- No **F** (no rule retargeted/retired). All 10 R-rules are anchored in the trap (the prompt
  contains a column rename, superuser connection, no-RLS note, Drizzle schema, bare `drizzle()`),
  so none are "infra-only / no anchor". `least-privilege`, `rls`, `expand-contract`,
  `pool-math` were candidates for F but the trap DOES anchor each — they just lacked concrete
  patterns → R, not F.
- **capacity = false.** The 37-rule trap is large but the prior gold run proves full pass is
  achievable; the gap was missing concrete anchors, not executor capacity.

## Regression safety (the 26 passing)

The 26 passing rules were left textually unchanged. Edits only ADD concrete patterns to the 10
weak rules and disambiguate the one pool-sizing competition. No passing rule's wording was
touched. SKILL.md grew from 125 → 171 lines (concrete examples), removed 1 redundant line.
