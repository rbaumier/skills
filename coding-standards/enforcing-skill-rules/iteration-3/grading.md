# Iteration 3 — Enduring Reader + No Archaeology Rules

**Date:** 2026-04-13
**Change:** Added `fs-no-archaeology` and `fs-enduring-reader` assertions
**Grading model:** Opus (cross-model — executor is Sonnet)

## Two new assertions

| ID | Description | Category |
|---|---|---|
| `fs-no-archaeology` | The 'refactored from a class in Q3' archaeology comment is removed. No comment references past implementation | format |
| `fs-enduring-reader` | getInstanceConfig comment rewritten to describe the stable domain purpose — NO single-caller anchor | format |

## Iteration 3a (initial rule wording)

| Run | no-archaeology | enduring-reader |
|---|---|---|
| Baseline (no skill) | PASS (Sonnet removed it spontaneously) | **FAIL** — kept `// Exposed for the admin dashboard's instance settings page.` |
| Run 1 (with skill) | PASS | PASS — listed multi-consumer (admin dashboard, alerting, CLI) |
| Run 2 (with skill) | PASS | **FAIL** — softened `because` to `so`: `// Exposed so the admin dashboard can render them` |
| Run 3 (with skill) | PASS | PASS — listed multi-consumer |

**Pattern detected:** Run 2's failure showed the model would soften "because" to "so" / "for" while keeping the single-caller anchor. The rule needed an explicit workaround ban.

## Iteration 3b (strengthened rule wording)

Rule strengthened to forbid:
- `because [caller]`
- `so [caller]`
- `for [caller]`
- `needed by [caller]`
- `added for [caller]`

With explicit ban: "Softening `because` to `so` or `for` is NOT a fix"
Plus the test: "remove the caller name entirely; if the comment still explains what the data means, it was wrong"
Plus a positive example: listing multiple consumers IS allowed (it demonstrates multi-caller intent rather than anchoring to one)

| Run | no-archaeology | enduring-reader |
|---|---|---|
| Run 1 v2 (with skill) | PASS | PASS — `Consumers — admin dashboard, alerting pipeline, CLI — decide` |
| Run 2 v2 (with skill) | PASS | PASS — `consumers (admin UI, alerting pipelines, CLI tooling) read these` + ASCII state diagram |
| Run 3 v2 (with skill) | PASS | PASS — `Consumers — admin dashboard, alerting pipeline, CLI — decide... without a single source here, every consumer would hardcode its own numbers` |

## Final summary

| Assertion | Baseline | With skill (v2) | Delta |
|---|---|---|---|
| `fs-no-archaeology` | 1/1 (100%) | 3/3 (100%) | 0% — non-discriminating, Sonnet already removes archaeology |
| `fs-enduring-reader` | 0/1 (0%) | 3/3 (100%) | **+100%** — discriminating, skill teaches the rule |

## Notes

- `fs-no-archaeology` is non-discriminating — Sonnet spontaneously removes "refactored from a class in Q3" comments without prompting. The rule is still worth keeping in the skill for code-review mode and consistency, but it doesn't add value in the refactoring eval.
- `fs-enduring-reader` is highly discriminating. Initial rule wording allowed a `because → so/for` workaround that one of three runs took. After strengthening with an explicit workaround ban + positive multi-consumer example, all three runs pass.
- Key learning: subtle anchoring patterns ("exposed so X can...") need explicit bans, not just abstract guidance. Same lesson as boolean-flag elimination needing "ternary is NOT a fix".
