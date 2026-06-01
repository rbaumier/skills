# Fix report — coding-standards eval 12 (full-sweep), Haiku executor

## TL;DR
Eval 12 is a **53-rule mega-trap** (one OrderService module seeded with one violation per `fs-*` rule).
Baseline: **20/53 PASS** with a weak (Haiku) single-pass executor.

The 33 fails split into three buckets:
- **3 assertion bugs (A)** — the assertion tested for something the skill *deliberately does not teach*, or that the prompt's own constraints forbid. Fixed in both `haiku-run/assertions-e12.json` and `evals/evals.json`.
- **0 pure wording gaps where the rule was absent** — every other failed rule is already stated, clearly, in a sub-skill. The gap is **recall under load**, not missing wording.
- **30 capacity drops (C)** — clearly-stated rules that a single Haiku pass silently skipped because 53 simultaneous transforms exceed one pass's working set.

The lever for the 30 is a **LOUD pre-output checklist** added to the umbrella `SKILL.md` (a `trigger → transform` recall surface grouped by rule family). This lowers the *capacity required per rule* — the model scans a list instead of recalling 53 distributed rules — but it does **not** make 53/53 reachable in one Haiku pass. See "Capacity ceiling" below.

> **Note on denominator:** the assertion files actually contain **52** assertions, not 53. `grade-e12-iter1.md` says "Total: 53" but its own table has 52 rows — a pre-existing off-by-one in the grade/`result` JSON, not introduced here. Real baseline is **20/52**.

---

## A — Assertion bugs (fixed in both files)

These three asked the executor to do the *opposite* of what coding-standards teaches, or something the prompt forbids. A correct skill-following answer was being marked FAIL.

1. **`fs-jsdoc-with-example`** — demanded "JSDoc with block description **+ `@example` with return value**."
   The skill (`:style` §5) caps function docs at **~5 lines** and defaults to *no comment / extreme concision*. Mandating an `@example` block contradicts the skill. **Fix:** require a function doc (~5 lines) naming the consumer-visible effect / return meaning; `@example` explicitly NOT required.

2. **`fs-ascii-diagram`** → renamed **`fs-pipeline-flow-documented`** — demanded an "**ASCII diagram** in comments." No sub-skill anywhere requires diagrams; `:style` says "Default: no comment, each = tax" and the module-doc shape is "How, as a **bullet list**." An ASCII diagram contradicts the skill. **Fix:** require the pipeline documented as the skill's mandated module-doc bullet-list shape; ASCII diagram NOT required.

3. **`fs-divergent-change-business-domain`** — demanded "the module is **split so each file** covers ONE business domain." The prompt explicitly says **"Output ALL component code inline. No unshown imports. Do not write files."** A multi-file split is impossible by construction. **Fix:** require the unrelated domains to be separated into distinct named sections (and a noted split boundary) within the single inline file; actual file split NOT required for this prompt.

`assertion_changes` (ids touched): `fs-jsdoc-with-example`, `fs-ascii-diagram`→`fs-pipeline-flow-documented`, `fs-divergent-change-business-domain`.

---

## R / C — Reinforcement (wording lever for the capacity drops)

The remaining 30 fails (`fs-naming-intent`, `fs-result-not-throw`, `fs-strict-typing`, `fs-promise-all`, `fs-immutable`, `fs-factory-di`, `fs-timeout-io`, `fs-dto-mapping`, `fs-law-of-demeter`, `fs-no-boolean-flags`, `fs-define-errors-out-of-existence`, `fs-impossible-state-documented`, `fs-exports-at-top`, `fs-one-abstraction-level`, `fs-parse-dont-validate`, `fs-invalid-states-unrepresentable`, `fs-structured-api-errors`, `fs-bound-inputs`, `fs-preserve-cause`, `fs-externalize-config`, `fs-symmetry`, comment-family `fs-consequence-comments` / `fs-conversational-tone` / `fs-term-explanations` / `fs-inaction-justified` / `fs-next-caller-effect` / `fs-return-value-intent` / `fs-limits-explained` / `fs-module-orientation` / `fs-enduring-reader`) are **all already covered** by clear rules in the four sub-skills. The executor simply did not reach them in one pass.

**Change:** added a **"Pre-output checklist — run before returning ANY refactor"** LOUD gate to the umbrella `SKILL.md`, right before the sub-skills table. It is:
- **A flat `trigger → required transform` list**, grouped by family (naming/comments, control-flow/data, types/errors, architecture/structure), each line carrying the concrete trigger and the exact transform (e.g. *"`throw` anywhere → return `Result<T,E>`"*, *"`import { db }` as module global → factory `createOp({ db })`"*).
- **Generic, not eval-specific** — phrased as language-agnostic triggers ("magic number", "raw DB row returned", "`any`"), so it generalises to any refactor, not just this OrderService.
- Closed with an explicit anti-silent-drop instruction: *fix every fired trigger, or state which rules you skipped and why.*

This is a **recall surface**, not new teaching — full rationale stays in the sub-skills (each group is tagged with the owning sub-skill). It reduces the capacity each rule demands (scan-and-match vs recall-from-distributed-prose).

The 20 already-passing rules were not weakened: the checklist re-states them in the same direction (e.g. guard clauses, switch/map, named constants), so it reinforces rather than contradicts.

---

## Capacity ceiling — explicit, do NOT expect 53/53 from one Haiku pass

This trap deliberately stacks **52 independent transforms on one module**. A single weak-model pass has a bounded working set: empirically it lands ~20 and drops the rest regardless of wording, because the bottleneck is *attention/recall budget across 52 simultaneous obligations*, not clarity of any one rule. Wording can raise the per-pass yield (the checklist should push it up materially) but it **cannot** linearise 52 transforms into one pass for a Haiku-class executor.

**Recommendation (pick one):**

1. **Split into sub-traps (preferred).** Decompose eval 12 into 4 focused evals aligned to the sub-skills, each ~12-15 assertions on a smaller seeded module:
   - `12a` comments & naming (`:style`)
   - `12b` control-flow, types, immutability (`:style`/`:design`)
   - `12c` errors, Result, timeouts, invariants (`:errors`)
   - `12d` architecture: DI, DTO, exports, domain split (`:design`)
   Each sub-trap fits one pass → expect high per-eval scores and a meaningful per-rule signal. Keep eval 12 as an aggregate "stress" datapoint only.

2. **Accept a per-pass ceiling and track per-rule yield.** Keep eval 12 whole but stop treating 52/52 as the bar for a single Haiku pass. Track **per-rule pass-rate across N runs** (does each rule pass *sometimes*, proving the wording works) rather than all-rules-in-one-pass. Expected single-pass band after this reinforcement: roughly **30-40 / 52**, with the checklist raising the floor; the residual gap is capacity, not wording.

Either way: **no claim of 53/53 (or 52/52) in one pass via wording alone.** The assertion fixes remove 3 unwinnable rules; the checklist lifts the per-pass yield on the rest; the structural fix for the remainder is decomposition or a multi-pass executor, not more prose.
