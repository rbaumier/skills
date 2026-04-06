# Benchmark — 2026-04-06 (v7, post-cleanup)

## Context
- Eval cleanup: hint comments removed, `text`→`id`, `trap` fields added, category tags added
- Executor: Sonnet (3 runs each)
- Grader: Opus (strict, cross-model)
- 40 assertions, single full-sweep prompt

## Overall

| | With Skill | Without Skill | Delta |
|---|---|---|---|
| Pass rate | 38/40 (95%) | 20/40 (50%) | +45% |

## Per-category

| Category | With Skill | Without Skill | Delta |
|---|---|---|---|
| format (20) | 19/20 (95%) | 9/20 (45%) | +50% |
| behavior (10) | 9/10 (90%) | 5/10 (50%) | +40% |
| architecture (6) | 6/6 (100%) | 2/6 (33%) | +67% |
| security (1) | 1/1 (100%) | 0/1 (0%) | +100% |
| gotcha (1) | 0/1 (0%) | 0/1 (0%) | +0% |

## Discriminating rules (20 — skill adds value)

| ID | Category | Without | With |
|---|---|---|---|
| fs-module-orientation | format | FAIL | PASS |
| fs-consequence-comments | format | FAIL | PASS |
| fs-term-explanations | format | FAIL | PASS |
| fs-conversational-tone | format | FAIL | PASS |
| fs-inaction-justified | format | FAIL | PASS |
| fs-next-caller-effect | format | FAIL | PASS |
| fs-return-value-intent | format | FAIL | PASS |
| fs-limits-explained | format | FAIL | PASS |
| fs-jsdoc-with-example | format | FAIL | PASS |
| fs-boolean-prefix | format | FAIL | PASS |
| fs-symmetry | format | FAIL | PASS |
| fs-state-narration | format | FAIL | PASS |
| fs-no-boolean-flags | behavior | FAIL | PASS |
| fs-result-not-throw | behavior | FAIL | PASS |
| fs-structured-api-errors | behavior | FAIL | PASS |
| fs-parse-dont-validate | behavior | FAIL | PASS |
| fs-factory-di | architecture | FAIL | PASS |
| fs-dto-mapping | architecture | FAIL | PASS |
| fs-exports-at-top | architecture | FAIL | PASS |
| fs-bound-inputs | security | FAIL | PASS |

## Non-discriminating rules (18 — model already knows)

fs-naming-intent, fs-guard-clauses, fs-switch-or-map, fs-immutable, fs-max-30-lines,
fs-max-3-args, fs-srp-cqs, fs-named-constants, fs-strict-typing, fs-externalize-config,
fs-preserve-cause, fs-intermediate-vars, fs-no-clever-code, fs-blank-lines,
fs-no-commented-code, fs-no-todo-without-issue, fs-invalid-states-unrepresentable,
fs-crosscutting-wrapper

## Failed with-skill (2) — FIXED in iteration-2

| ID | Category | Root cause | Fix applied | Re-run result |
|---|---|---|---|---|
| fs-promise-all | behavior | Result pattern forces sequential for...await | Added "even with Result types: run all async calls with Promise.all, then check each Result" | PASS — `Promise.all(items.map(i => checkStock(i)))` + `results.find(r => !r.ok)` |
| fs-timeout-io | gotcha | Rule too abstract ("timeout on every I/O") | Added concrete example: `withTimeout(db.query(...), 5_000)` + default timeouts | PASS — every db.query/mailer.send wrapped in `withTimeout` |

## Progression

| Iteration | With-Skill | Without | Key change |
|---|---|---|---|
| baseline (2026-03-29) | ~85% | ~50% | Original eval with hint comments |
| v7 (2026-04-06) | 95% (38/40) | 50% (20/40) | Hint comments removed, schema normalized, categories added |
| v7.1 (2026-04-06) | **100% (40/40)** | 50% (20/40) | Fixed Promise.all + timeout rules in SKILL.md |
