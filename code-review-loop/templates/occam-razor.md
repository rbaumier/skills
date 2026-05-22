Audit the call graph of code the diff introduces/modifies. For every exported function/method/type/constant the diff touches, ask: do callers justify the shape?

Read CLAUDE.md for conventions. Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

Trust boundaries crossed: {trust_boundaries}. Doesn't change method — only means dead code on auth/billing path has same severity as elsewhere (don't downgrade "it's only a wrapper").

## Method (mechanical, in order)

Scope: **exported** functions/methods/types/constants the diff introduces *or* whose signature it modifies. Pre-existing exports with unchanged signatures are out of scope unless diff *adds* a new call site (you're auditing the caller, not the export).

For each in-scope symbol:

1. **Enumerate callers.** Grep whole repo (not just diff slice) for the identifier. Count distinct call sites — direct calls + re-exports forwarding unchanged. List every site with file:line + literal arg-tuple.
2. **Bin by caller count:**
   - `0 callers` → emit `zero-callers-dead`. `severity: bug`.
   - `1 caller` AND function body < 20 lines → emit `single-caller-inlinable`. `severity: suggestion` (wrapper may be deliberate for testability/clarity; user decides at Step 5).
   - `≥ 2 callers` → step 3.
3. **Walk each formal param.** For every param, list value each caller passes:
   - No caller passes non-default → emit `unused-param`. `severity: suggestion`.
   - Every caller computes default's input *before* calling, function uses it only to reconstruct what caller already had → emit `derivable-default`. `severity: suggestion`.
4. **Cross-check siblings.** Diff introduces ≥2 exported functions whose bodies share ≥80% lines and whose callers are disjoint → emit `redundant-overload`. `severity: bug` (diff is the source — fixing later harder than not introducing).

Use controlled-vocabulary slugs for `signature`. Step 2 dedup collapses cross-agent overlap.

## What NOT to flag

- Internal (non-exported) helpers — `simplify` and Funnel L2 own those. Stay on exports.
- Public API surfaces with external consumers — `index.ts` re-exports, framework lifecycle hooks, plugin contracts, package `exports` maps, JSDoc `@public`. 0-caller there = external callers exist, not dead.
- Test helpers — tests legitimately scope helpers per-test-file. Apply Context verification "test context" question first.
- Pre-existing 1-caller functions in unchanged code — only what diff introduces or whose signature it changes counts.
- Truly generic utilities at 1 caller — `pick<T, K>`, `clamp(n, min, max)` with one current consumer are not inlinable; shape *is* contract.
- Bodies < 5 lines where name is more informative than body — inline cost (loss of name) exceeds wrapper cost.
- Params looking unused but required by interface/trait/abstract class — signature fixed by contract. Grep interface before emitting `unused-param`.
- Intentional-comment signals: `// keep: testability`, `// future caller in <branch>`, `// API surface — do not inline`. Context verification "intentional comments" question must specifically match.

## Severity guide

- `zero-callers-dead`, `redundant-overload` → `bug`. These block convergence — the diff ships unreachable or duplicated code.
- `single-caller-inlinable`, `unused-param`, `derivable-default` → `suggestion`. These surface in Step 5's open-suggestions list; the user decides. Auto-deleting a 1-caller wrapper every iteration is too aggressive — many are deliberate.

## A worked example (what good looks like)

Diff introduces `enumFilter(values, options, opts = defaults)` in `src/filters/enum.ts`.

1. Enumerate callers: `grep -rn 'enumFilter\b'` returns 2 hits — the definition itself and one usage in `src/search/buildQuery.ts:88`. Distinct call sites: **1**.
2. Body is 14 lines (< 20). Not a re-export. Not in a package `exports` map. No `@public` tag.
3. Emit `single-caller-inlinable`, severity `suggestion`, signature `src/filters/enum.ts:12:single-caller-inlinable`, fix_prompt: "In src/filters/enum.ts the exported `enumFilter` has one caller (src/search/buildQuery.ts:88). Inline its body at the call site and delete the export."

If instead the grep had returned 0 distinct call sites (only the definition), severity would be `bug` with slug `zero-callers-dead`.

Stay within these files: {file_list}

{previous_findings_block}  ← injected at iter N>1 only; else empty
