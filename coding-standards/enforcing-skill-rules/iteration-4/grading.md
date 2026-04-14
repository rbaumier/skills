# Iteration 4 — LoB + Workflow-First + Extract-by-Responsibility

**Date:** 2026-04-13
**Change:** Added Locality of Behavior, workflow-first, colocation, inline-single-use, file-length-is-a-smell rules. Replaced hard caps (max 30 lines / max 200 lines) with responsibility-based judgment.
**Grading:** Manual strict grading against trap code

## Trap design

Multi-file trap with 4 TypeScript files:
- `src/features/signup/signup-handler.ts` (main workflow)
- `src/utils/email-validator.ts` (1 caller)
- `src/utils/welcome-formatter.ts` (1 caller)
- `src/utils/password-hasher.ts` (1 caller)

Each helper has exactly one call site. Prompt states "this is the ENTIRE codebase — no other callers" to make LoB applicable.

## Assertions

| ID | Description |
|---|---|
| `loc-inline-single-use` | The 3 single-use helpers are inlined (not kept in separate utils/ files) |
| `loc-workflow-first` | Signup feature lives in a single file (or minimal files driven by responsibility) |
| `loc-no-new-utils-files` | Refactor does not create new *.ts helper files |

## Results

| Run | inline-single-use | workflow-first | no-new-utils-files | Notes |
|---|---|---|---|---|
| Baseline | FAIL | FAIL | FAIL | Kept `src/utils/password-hasher.ts` rationalizing "crypto is worth isolating". 3 files total |
| Run 1 | PASS | PASS | PASS | 1 file (`signup.ts`) — fully collapsed |
| Run 2 | PASS* | **FAIL** | **FAIL** | Inlined the 3 original utils, but created `src/shared/result.ts` + `src/shared/with-timeout.ts` with 1 consumer each, calling them "standard shared primitives" |
| Run 3 | PASS | PASS | PASS | 2 files (`signup.ts` + `types.ts` for infra ports). All utils inlined |

*loc-inline-single-use grades the 3 ORIGINAL utils being inlined. Run 2 did inline those.

## Summary

| Assertion | Baseline | With skill | Delta |
|---|---|---|---|
| `loc-inline-single-use` | 0/1 | 3/3 | **+100%** |
| `loc-workflow-first` | 0/1 | 2/3 | **+67%** |
| `loc-no-new-utils-files` | 0/1 | 2/3 | **+67%** |
| **Total** | **0/3** | **7/9 (78%)** | **+78%** |

## Failure pattern analysis

**Run 2 failure:** the model created `shared/result.ts` and `shared/with-timeout.ts` as "shared primitives" despite having only ONE consumer today. It rationalized "these are standard primitives I'm referencing" and moved them into `shared/` based on an imagined future consumer.

This is the same pattern as the earlier "softening because to so" failure on `fs-enduring-reader`: the model follows the letter of the rule (inlined the 3 specific helpers mentioned in the trap) but violates the spirit by creating new helper files for generic-looking code.

## Fix applied

Strengthened the LoB rule in SKILL.md to explicitly close the "shared primitive" loophole:

> **"Shared primitive" is NOT an exception**: Result types, `ok`/`err` helpers, `withTimeout`, date utilities, string helpers — if there is exactly ONE caller today, they live inlined in the caller's file. Move them to `shared/` only when a SECOND caller genuinely appears and imports them. "I'm going to need this elsewhere" is not a second caller.

Added explicit callouts:
- Extended forbidden file patterns to include `shared/*.ts`
- Listed specific examples the model over-extracts (Result, withTimeout, date utils, string helpers)
- Explicit "RIGHT NOW" on "2+ real consumers"
- Explicit rejection of "I'm going to need this elsewhere"

## Notes

- `fs-extract-by-responsibility` (the updated version of the old `fs-max-30-lines`) was not re-tested in this iteration because the trap doesn't exercise it directly. The new trap is about file structure, not function structure.
- Baseline failing on all 3 confirms these rules are discriminating — Sonnet defaults to creating helper files for single-use code.
- +78% delta is strong. A re-run after the rule strengthening would likely push it to 100% but the core lesson is captured: the skill teaches LoB correctly, and the remaining gap is a specific rationalization that's now explicitly closed.
