Audit the call graph of code the diff introduces/modifies. Per exported function/method/type/constant the diff touches: do callers justify the shape?

Trust boundaries: {trust_boundaries}. Doesn't change method — only means dead code on auth/billing path has same severity as elsewhere (no "it's only a wrapper" downgrade).

## Method (mechanical, in order)

Scope: **exported** symbols the diff introduces OR whose signature it modifies. Pre-existing exports with unchanged signatures out of scope unless diff *adds* a new call site (audit the caller, not the export).

Per in-scope symbol:

1. **Enumerate callers.** Grep whole repo (not diff slice) for identifier. Count distinct call sites — direct + re-exports forwarding unchanged. List with file:line + literal arg-tuple.
2. **Bin:**
   - `0 callers` → `zero-callers-dead`. `severity: bug`.
   - `1 caller` AND body < 20 lines → `single-caller-inlinable`. `severity: suggestion` (may be deliberate for testability/clarity).
   - `≥ 2 callers` → step 3.
3. **Walk params.** Per param, list value each caller passes:
   - No caller passes non-default → `unused-param`. `severity: suggestion`.
   - Every caller computes default's input *before* calling, function only reconstructs what caller had → `derivable-default`. `severity: suggestion`.
4. **Sibling cross-check.** Diff introduces ≥2 exported functions, bodies share ≥80% lines, callers disjoint → `redundant-overload`. `severity: bug` (diff is source — fixing later harder).

Controlled-vocabulary slugs for `signature`. Downstream dedup collapses cross-agent overlap.

## Don't flag

- Internal (non-exported) helpers — `simplify` + Funnel L2 own. Stay on exports.
- Public API surfaces with external consumers — `index.ts` re-exports, framework lifecycle hooks, plugin contracts, package `exports` maps, JSDoc `@public`. 0-caller there = external callers, not dead.
- Test helpers — tests scope helpers per-test-file. Apply Context verification "test context" first.
- Pre-existing 1-caller functions in unchanged code.
- Truly generic utilities at 1 caller — `pick<T,K>`, `clamp(n,min,max)`. Shape *is* contract.
- Bodies < 5 lines where name > body in info value.
- Params required by interface/trait/abstract class — signature contract-fixed. Grep interface before `unused-param`.
- Intentional-comment signals: `// keep: testability`, `// future caller in <branch>`, `// API surface — do not inline`. Match must be specific.

Severity derived from slug (see `reference/output-format.md`): `zero-callers-dead`/`redundant-overload` → `bug`; `single-caller-inlinable`/`unused-param`/`derivable-default` → `suggestion`.

## Worked example

Diff introduces `enumFilter(values, options, opts = defaults)` in `src/filters/enum.ts`.

1. `grep -rn 'enumFilter\b'` → 2 hits: definition + `src/search/buildQuery.ts:88`. Distinct call sites: **1**.
2. Body 14 lines (< 20). Not re-export. Not in `exports` map. No `@public`.
3. Emit `single-caller-inlinable`, severity `suggestion`, signature `src/filters/enum.ts:12:single-caller-inlinable`, fix_prompt: "In src/filters/enum.ts `enumFilter` has one caller (src/search/buildQuery.ts:88). Inline body at call site, delete export."

0 distinct call sites → `bug` / `zero-callers-dead`.
