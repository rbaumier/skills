# Fix report — language-typescript (eval1, weak executor / Haiku)

Baseline: eval1 12/15, eval2 10/10. Fails on eval1: `jsdoc-with-example`, `no-as-cast`, `import-type`.

Classification: **R** = renforce skill (rule correct but under-specified), **V** = vague/contradiction,
**A** = assertion wrong/too strict, **F** = false-positive grading.

## no-as-cast — R (Renforce)

Model emitted `connection as unknown as AsyncDisposable` (double-cast, explicitly banned) and the
`(data as Record<string, unknown>).id` idiom repeated inside `isUser`.

Why R: the rule is correct, concrete and testable. But it lived only in a dense table cell
("No `any`/`as`"), and the skill never showed how to write a **type guard without `as`** — so the
weak model reached for the most common cast-based guard idiom. Reinforced with:
- an explicit Style bullet "**Never `as X`**" naming the two allowed forms (`as const`, single `as unknown`)
  and re-banning the `as unknown as T` double-cast at the point of impact,
- a WRONG/RIGHT type-guard example proving `'id' in data` narrows so `typeof data.id` needs no cast.

File: `SKILL.md` (Style section).

## import-type — R (Renforce)

Model wrote `import { DatabaseConnection } from './db'` for a type-only use (parameter at L112).

Why R: concrete and testable. The rule is even fully documented in
`references/module-organization.md` with the exact `DatabaseConfig` example — but a weak executor
doesn't open reference files, and SKILL.md's main body only mentioned `verbatimModuleSyntax`, which
the model didn't connect to "write `import type`". Surfaced the rule directly into the Style section
with a one-line trigger: *any `import { X }` where `X` appears only after a `:` -> `import type`*.

File: `SKILL.md` (Style section).

## jsdoc-with-example — A (Assertion too strict) + skill clarification

Model put JSDoc only on the non-exported `isUser` helper; exported functions had none. The grader
read the assertion as "ALL exported functions (incl. trivial `ok`/`err`) must carry `@example`",
which is stricter than the skill ever stated.

Why A: the skill's Style line described the JSDoc *format* but never stated JSDoc is *required* on
exported functions, nor scoped which ones. Two-file fix per instruction:
1. `SKILL.md`: made the rule explicit — JSDoc-with-`@example` required on **exported** functions,
   internal helpers exempt — with a concrete `getUser` example.
2. `evals.json` + `assertions-e1.json`: clarified the assertion description to target exported
   **domain** functions, exempt trivial re-exported utilities (`ok`/`err`) and non-exported helpers.

Files: `SKILL.md`, `enforcing-skill-rules/evals/evals.json`,
`enforcing-skill-rules/haiku-run/assertions-e1.json`.

## Regression guard

All edits are additive (new Style bullets / clarified descriptions). No existing rule text was
altered, so the 12 passing eval1 assertions and the 10 passing eval2 assertions are untouched.

Counts: R=2, V=0, A=1, F=0.
