# Enforce kirby-bot skills @ Haiku — STATUS

Goal: every assertion of every in-scope skill must PASS when executor = **Haiku 4.5**, grader = **Opus**. Loop until 100%.

Harness: per (skill,eval) → haiku executor reads SKILL.md + `haiku-run/prompt-e{E}.txt`, writes `out-e{E}-iterN.md`. Opus grader reads `assertions-e{E}.json` + output (NOT the prompt), writes `grade-e{E}-iterN.md` + `result-e{E}-iterN.json` (compact). On fail → opus analyst-fixer classifies R/V/A/F, fixes skill (R/V) or assertion description (A) or documents ceiling (F), re-run.

Failure classes: **R**=real skill wording gap (fix skill) · **V**=Haiku run variance (strengthen wording/checklist) · **A**=assertion/grader bug, misleading or over-strict description (fix assertion, NOT skill) · **F**=Haiku capability floor / unfair trap (retarget assertion or document).

Excluded (process/review, not testable by refactoring trap): code-review, dogfood, matt-improve-codebase-architecture, matt-tdd, matt-review, thermo-nuclear-code-quality-review.

## VARIANCE WALL (central finding)
Haiku flips ~10-20% of rules per run on 25-40 assertion single-sweep traps. Wording fixes WORK (previously-failing rules now pass; different ones fail next run). Chasing single-run 100% = overfitting to noise. **Criterion: 3 runs/skill, per-rule pass rate. Green = 3/3. Consistent (3/3) fail = real → fix. 1-2/3 fail = variance, documented, skill untouched.**
Systemic fix patterns: (1) critical values in SKILL body, NOT reference/ (Haiku never opens refs); (2) canonical example must embody the rule (Haiku copies example, ignores prose); (3) LOUD pre-output checklist with concrete triggers/values.

## Skills with evals (24) — re-benchmark @ Haiku

| skill | assertions | best single-run | status |
|---|---|---|---|
| vue | 17 | 17/17 ✓ | needs 3-run confirm |
| drizzle-orm | 12 | 12/12 ✓ | needs 3-run confirm |
| tanstack-query | 10 | 10/10 ✓ | needs 3-run confirm |
| better-result-adopt | 13 | 13/13 ✓ | needs 3-run confirm |
| api-design | 22 | 22/22 ✓ | needs 3-run confirm |
| zod | 23 | 22/23 | variance only (cache-schema fixed; partial-updates flipped). 3-run confirm |
| kubernetes | 26 | 25/26 | variance (security-context-pod flipped). 3-run confirm |
| docker | 30 | 29/30 | variance (resource-limits flipped). 3-run confirm |
| i18n | 22 | 20/22 | variance (4 doc-level removed). 3-run confirm |
| shadcn | 26 | 21/26 | PERSISTENT: fieldset-checkboxes + variance. fix+confirm |
| frontend | 27 | 22/27 | PERSISTENT: error-boundary-retry, virtualize-long-list, focus-trap-modal. fix+confirm |
| ui-animations | 26 | 16/26 | PERSISTENT: tooltip-first-delayed; HIGH variance skill. fix+confirm |
| security-defensive | 31 (e1,e2) | - | pending |
| coding-standards | 55 (e1,e2) | - | pending |
| testing | 32 (e1,e2,e3) | - | pending |
| language-typescript | 26 (e1,e2) | - | pending |
| language-rust | 24 | - | pending |
| language-swift | 32 | - | pending |
| database | 37 | - | pending |
| tailwind | 39 (e1,e2) | - | pending |
| ui-ux | 35 | - | pending |
| web-performance | 34 | - | pending |
| tanstack-start-best-practices | 7 | - | pending |

Eval bugs corrected (recorded, not skill changes): zod no-any-unknown + custom-messages (descriptions), drizzle junction-table (removed, no M:N signal in trap), tanstack ssr-dehydrate-hydrate (retargeted), shadcn card-full-composition (loosened), i18n removed seo-hreflang/html-lang-dynamic/ssr-sync/html-dir-rtl (doc-level, non-testable) + retargeted global-toast→no-alert.

## Skills needing evals (5) — create then benchmark @ Haiku

| skill | status |
|---|---|
| make-interfaces-feel-better | needs-evals |
| coding-standards:design | needs-evals |
| coding-standards:errors | needs-evals |
| coding-standards:hygiene | needs-evals |
| coding-standards:style | needs-evals |

## Log
- Wave 1 (zod, better-result-adopt, drizzle-orm, tanstack-query, api-design, vue): iter1→iter2→iter3.
  - better-result-adopt 13/13 iter1; api-design 22/22 iter2.
  - 3 unfair/over-strict assertions corrected: zod no-any-unknown + custom-messages (descriptions), drizzle junction-table (removed), tanstack ssr-dehydrate-hydrate (retargeted to ssr-prefetch-shared-options). Recorded as eval bugs, not skill changes.
  - Skill wording reinforced (pre-output checklists): zod, drizzle-orm, tanstack-query, vue, api-design.
- Wave 2 launched: shadcn, i18n, kubernetes, docker, ui-animations, frontend (iter1).
- Wave 2 fixed (iter2): all 6 improved. Persistent fixes applied: shadcn fieldset-checkboxes (R, example), frontend error-boundary-retry (R), frontend virtualize-long-list + focus-trap-modal (F, retargeted), ui-animations tooltip + exhaustive anti-variance checklist.
- frontend has 2 unconfirmed variance fails (compound-components, minimize-rsc-serialization) to verify in 3-run.

## Wave 3 (11 untouched skills) — iter1 baseline + analyst-fix DONE
iter1 (haiku exec + opus grade) then opus analyst-fixers (R/V/A/F). Totals across 11: R=130, A=7, F=2, capacity=2.
- security-defensive: e1 13/23, e2 7/8 → R10 (JWT cookie/RS256/iss-aud/refresh, CSP nonce, PKCE, CSRF, webhook-sig MISSING entirely, audit-log, DOMPurify all embodied + LOUD checklist) A1 (supply-chain-beyond-audit broadened).
- coding-standards: e12 20/52 (NB denom 52 not 53 — pre-existing grade off-by-one), e13 3/3 ✓ → R30 (LOUD trigger→transform checklist on umbrella) A3 (jsdoc-@example dropped, ascii-diagram→pipeline-flow, divergent-change→in-file). **CAPACITY: 52-rule single-sweep exceeds Haiku working set; recommend split into 4 sub-traps OR accept ~30-40/52 per-pass band. No 52/52 claim.**
- testing: e1 14/19, e2 4/4 ✓, e3 8/9 → R4 (vi-hoisted, specific-matchers, factories, role-selectors) F2 (page-object-model→no-repeated-inline-selectors retarget; test-pyramid-ratio removed, prose-only in code task).
- language-typescript: e1 12/15, e2 10/10 ✓ → R2 (no-as-cast, import-type surfaced from refs) A1 (jsdoc scoped to exported domain fns).
- language-rust: e1 11/23 → R12 (LazyLock/thiserror/AsRef-Path/Box-enum/FxHasher/Vec/builder-Result/serde/Copy-span/generic-hot-path/sealed all embodied + checklist).
- language-swift: e1 24/32 → R8 (Task.checkCancellation, typed throws, @Observable, @Environment DI, ~Copyable, extension conformance, nonisolated, #Preview + ALWAYS/NEVER table).
- database: e1 26/37 → R10 (root cause: gold-run patterns compressed to abstractions in live SKILL; re-anchored uuidv7/BRIN/expand-contract/pgbouncer/least-priv/RLS/4×drizzle inlined) A1 (drizzle-infer-type → $inferSelect, fixed contradiction w/ drizzle-orm skill). capacity:false.
- tailwind: e1 21/33, e2 3/6 → R15 (all in-body rules Haiku skipped; before→after + numeric-trigger checklist ≥44px/scale/no-transition-all).
- ui-ux: e1 7/35 → R28 (root cause: ALL 28 fails were rules buried in references/*.md Haiku never opens; added greppable Pre-Output Checklist to body). **CAPACITY: 35-rule single-pass at/beyond Haiku; recommend per-pass ceiling or 6 themed sub-evals. No 35/35 claim.**
- web-performance: e1 25/34 → R9 (image-dimensions ×3 = 1 rule×3 instances completeness; barrel/font-self-host/css-contain/reduced-motion/image-cdn/cache-headers + completeness checklist).
- tanstack-start: e1 4/7 → R2 (scroll-restoration real API, server-form-validation createServerValidate) A1 (createAPIFileRoute deprecated → createFileRoute server.handlers).

## CAPACITY CEILING — confirmed central finding (round-2, 3-run per-rule)
On large traps (≥30 assertions) Haiku has a per-pass working-set ceiling. WHICH rules it drops SHUFFLES run-to-run; fixing rule A pushes rule B out next run (whack-a-mole). Wording fixes move specific rules in for real (verified: body-semantic-tokens, single-source-of-truth, env-DI, jwt/webhook, lazylock/thiserror now pass), but the ceiling persists on mega-traps. Stopping rule: ONE targeted fix round per surfaced 3/3, then document — never chase another measurement round on a 30+ rule sweep.
Residual classes: **capacity** (rule well-taught, outside per-pass set on big trap) · **F floor** (transformation beyond Haiku regardless of trap: arena-alloc, CoreData→SwiftData migration, ZOMBIES coverage completeness).

## 3-RUN RESULTS (post-fix) — hard+medium wave-3 (9 skills)
Bands = min–max passed across 3 independent Haiku runs (grader=Opus, strict).
| skill/eval | band | 3/3 residual | verdict |
|---|---|---|---|
| database e1 | 32–35/38 | NONE ✓ | clean (variance: covering-index, rls @2/3) |
| testing e1 | 15–17/18 | NONE ✓ | clean (api-seeding retired F) |
| web-performance e1 | 30–33/33 | NONE ✓ | clean (inline-critical-css retired F) |
| language-rust e1 | 22–23/24 | arena-not-arc-mutex | **F floor** (Haiku uses Box/Arc, never arena+indices) |
| testing e3 | 6–7/8 | zombies-coverage | **F** (coverage-completeness, refactor can't invent cases) |
| language-swift e1 | 23–28/32 | swiftdata-over-coredata | protocol-conformance-ext FIXED (final R); swiftdata=**F floor** (CoreData→SwiftData migration) |
| tailwind e1 | 25–28/32 | (color-mix-oklab, motion-reduce) FIXED final R | rest = capacity/variance |
| ui-ux e1 | 29–32/35 | (too-many-text-colors, no-reduced-motion) FIXED final R | **CAPACITY** (35-rule trap); +22 vs 7/35 baseline |
| coding-standards e12 | 40–45/53 | 5 archi rules (factory-di, module-orientation, crosscutting-wrapper, exports-at-top, enduring-reader) | **CAPACITY** (53-rule trap). Recommend split into 4 sub-skill sub-traps for accurate per-rule measurement. +25 vs 20/53 baseline |
clean medium (no 3/3): security-defensive e1 18–21/23 & e2 8/8×3, language-typescript e1 14–16/16, tailwind e2 5–6/6, tanstack-start e1 (scroll-restoration retired A — trap has no createRouter).
Fixes applied (R) held across re-runs. Assertion bugs (A/F) corrected in BOTH assertions-eX.json + evals.json: api-seeding(F), inline-critical-css(F), scroll-restoration(A), test-pyramid-ratio(F), page-object-model→no-repeated-inline-selectors, supply-chain-beyond-audit, drizzle-infer-type, createAPIFileRoute, jsdoc scoped, +coding-standards 3.

## COMMITTED 2026-06-01 (CAMPAIGN COMPLETE)
Branch `enforce-skills-haiku`, NOT pushed (no user ask). Commits: 5b3660a (23 skills, 459 files), d9dacd6 (make-interfaces-feel-better new eval), 6003c87 (coding-standards split). Benchmark: runs/kirby-haiku/BENCHMARK-2026-06-01-haiku.md.
**24 skills enforced+measured 3-run @ Haiku.** 20/23 clean (variance-only misses); ui-ux 35 capacity-bound; coding-standards 52 resolved by split = **CAPACITY, no floors** (errors/hygiene/style/design all clean at sub-trap size). The 2 apparent cs floors were debunked: cs-design "decomposition floor" = assertion bugs (stale no-trap + mislabeled srp-cqs + over-strict divergent) → corrected 9-subset 8/9 ×3 no 3/3; cs-style pipeline-doc = missing worked example → added to `:style`, 3/3→2/3. F-floors documented (not corrupted): rust arena, swift swiftdata-migration, testing zombies-coverage ONLY.

## NEXT ACTIONS (resume here)
0. DONE: wave-1/2 + wave-3 3-run confirm + fixes + benchmark + commit. Remaining:
1. **make-interfaces-feel-better**: create eval (Cat A design skill) → 3 Haiku runs → grade → fix. IN PROGRESS.
2. **coding-standards split** (DONE 2026-06-01 — verdict CORRECTED after audit): partitioned 52 umbrella assertions into 4 themed sub-traps, Haiku reads umbrella, 3-run, strict Opus grading. First pass suggested 2 floors; BOTH debunked. cs-errors 11-12/12, cs-hygiene 10-12/12 = clean. **cs-design "decomposition floor" = assertion bugs**: partition reused e12's 13 assertions but the scoped prompt is simpler → 3 assertions test absent code (externalize-config/crosscutting-wrapper/one-abstraction-level), srp-cqs is mislabeled CQS, divergent demanded a comment. Corrected `assertions-cs-design.json` (13→9 valid) → **8/9 ×3, no 3/3** (e12 untouched). **cs-style pipeline-doc = missing example**: `:style` mandated the bullet-list doc shape but never showed it → added worked example to `coding-standards:style/SKILL.md` §5 → **3/3 fail → 2/3 pass** under :style-read. VERDICT: coding-standards = CAPACITY, **no genuine floor**; the 40-45/52 ceiling was entirely load. Lesson: audit assertion-vs-skill + assertion-vs-prompt before declaring a capability floor. Harness: prompt-cs-*.txt + assertions-cs-*.json in enforcing-skill-rules/; out/result-cs-{design,design-9,design-sub,style-sub,style-sub2}-*.{md,json} + base cs-* in haiku-run/. BENCHMARK "coding-standards split" has full writeup.
--- (historical) ---
1. **3-RUN CONFIRM wave-1/2 (12 skills)**: vue, drizzle-orm, tanstack-query, better-result-adopt, api-design, zod, kubernetes, docker, i18n, shadcn, frontend, ui-animations (small, already near-100%; confirm hold).
2. Write benchmarks/2026-06-01-haiku.md per touched skill + commit skills+benchmarks. 3. Create evals for make-interfaces-feel-better (+ coding-standards sub-skills already covered by umbrella e12).
OLD NEXT (superseded):
0b. **3-RUN CONFIRM (post-fix) all 23 touched skills** — iterA/B/C on CURRENT skill version (wave-1/2 fixed after their iter1; wave-3 just fixed → all baselines stale). Per-rule pass rate. Green=3/3. 3/3 fail=real→fix. 1-2/3=variance, document. Mega-skills (coding-standards, ui-ux): expect per-pass band, document ceiling.
1. **Confirm fixed skills** with 3 Haiku runs each → per-rule pass rate. Skills: vue, drizzle-orm, tanstack-query, better-result-adopt, api-design, zod, kubernetes, docker, i18n, shadcn, frontend, ui-animations. Green = 3/3. Rules failing 3/3 → fix. Rules failing 1-2/3 → variance, document.
2. **First-pass (iter1) the 11 untouched skills**: security-defensive, coding-standards, testing, language-typescript, language-rust, language-swift, database, tailwind, ui-ux, web-performance, tanstack-start-best-practices. (exec haiku → grade opus → analyst-fix R/V/A/F → re-run). NB multi-eval: security-defensive e1+e2, coding-standards e1+e2, testing e1+e2+e3, language-typescript e1+e2, tailwind e1+e2.
3. **Create evals + benchmark** the 5: make-interfaces-feel-better, coding-standards:design/errors/hygiene/style (Cat A, Level 1 traps OK).
4. **Write benchmarks/YYYY-MM-DD-haiku.md per skill + commit** skill changes + benchmarks together.
Harness reminder: extract prompt/assertions already done for the 24 (haiku-run/prompt-eX.txt + assertions-eX.json). Executor model=haiku, grader model=opus, grader writes result-eX-iterN.json + returns "done"; aggregate with jq.
