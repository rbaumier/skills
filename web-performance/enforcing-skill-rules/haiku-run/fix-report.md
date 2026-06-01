# Fix Report — web-performance, eval 1, iter 1 (Haiku / WEAK executor)

Baseline: 25/34. Failures (9): barrel-import, avatar-image-dimensions, brand-image-dimensions,
footer-image-dimensions, font-self-host, css-containment, reduced-motion, image-cdn,
cache-headers-static.

## Classification (R = reinforce rule, V = verifier issue, A = add/fix description, F = retarget/retire)

All 9 → **R**. None are description/triggering problems (the skill fired and Haiku attempted a full
rewrite), and none are truly infra-impossible — the grader explicitly accepts in-output config
snippets (it rejected `revalidate:60` *because* it expected a real Cache-Control header, which is
emittable in a `next.config.js` block in the same answer).

| id | R/V/A/F | root cause | fix applied |
|----|---------|-----------|-------------|
| barrel-import | R | Rule existed only as a Phase-5 *check*, not an actionable Rules-list directive. Haiku kept `from '@/components'` and even used `import('@/components').then(m=>...)`. | Added LOUD Rules-list entry with before/after example, explicitly covering the lazy `import().then` barrel variant. |
| avatar-image-dimensions | R | Same rule as the two below. Haiku added dims to the images it kept inline (hero, products) but **extracted** avatars/brands/footer into `dynamic()` child components and dropped their dimensions. Completeness/capability gap, not a missing rule. | Rewrote the dimensions rule: "EVERY image, NO EXCEPTIONS, count the tags, dimensions move WITH images when extracted." + completeness checklist. |
| brand-image-dimensions | R | idem (same rule, 2nd instance). | idem. |
| footer-image-dimensions | R | idem (same rule, 3rd instance). | idem. |
| font-self-host | R | Self-host was buried at the tail of a dense multi-clause font line; Haiku satisfied `display=swap` but kept the Google Fonts `<link>`. | Pulled self-host into its own standalone rule with `@font-face` local-woff2 example; states keeping the Google link fails even with swap. |
| css-containment | R | Rule was terse ("Use CSS containment for layout isolation") with no example; ignored. | Expanded with concrete `contain: layout` / `content-visibility: auto` example targeting grids/sections. |
| reduced-motion | R | Rule lived only in Phase 4. Haiku "fixed" it by deleting the float animation but added unguarded `scroll-behavior: smooth`. | Added Rules-list entry: ANY remaining motion (incl. `scroll-behavior: smooth`) MUST be guarded; deleting isn't the fix; full `@media (prefers-reduced-motion: reduce)` example. |
| image-cdn | R (not F) | Achievable single-file by switching src host / configuring loader; Haiku left bare `/images/`. | Expanded rule with CDN-origin + Next loader/remotePatterns example. |
| cache-headers-static | R (not F) | Borderline infra, but grader accepts a `next.config.js headers()` snippet (it rejected ISR `revalidate` as HTML-only). | Expanded rule: needs real Cache-Control headers, not ISR; full `next.config.js headers()` example; "still add this config block when fixing a single component." |

## Cross-cutting guardrail
Added a **"Before You Output: Completeness Checklist"** block before the Audit Report Template. It
forces the WEAK executor to (1) enumerate every image and confirm dims+lazy survive extraction, and
(2) re-check the five easily-dropped infra rules (barrel, self-host, containment, reduced-motion,
CDN, cache headers). This directly targets the dominant failure mode here: Haiku does the obvious
wins then stops mid-sweep.

## Regression safety
No passing rule was weakened or removed — every edit only *adds* specificity/examples or sharpens an
already-present rule. The 25 passing assertions are untouched. Changes stay general (no eval-specific
strings beyond illustrative examples that mirror common real-world patterns).

## Follow-up — 5 systematic failures over Haiku iters 2/3/4 (re-graded)

After re-running, 5 assertions failed 3/3 across iters 2–4. Re-classified:

| id | R/F | decision |
|----|-----|----------|
| responsive-images | R | Concrete in JSX. Added LOUD rule: every viewport-scaling `<img>` needs `srcset` (w descriptors) + `sizes`, not just width/height; raw `<img>` doesn't auto-emit srcset. + checklist line. |
| preconnect | R | Concrete in `<head>`. Old rule was terse with no example. Added `<link rel="preconnect">`-per-origin directive (CDN/analytics/widget/font) + example + checklist line. |
| code-split-components | R | Trap exercises it (conditionally-rendered `Modal` is a textbook `dynamic()` candidate; passed in iter1). Skill only had a Phase-5 *check*, no actionable rule. Added rule: convert static imports of conditional/below-fold components to `dynamic()`/`React.lazy`; per-path imports ≠ code-splitting. + checklist line. |
| lazy-load-everything-upfront | R | Verified the assertion tests the correct direction (defer below-fold reviews/brands/footer, keep above-fold eager) — NOT an inverted anti-pattern. Added concrete `dynamic(..., {ssr:false})` directive for below-fold sections + explicit "above-fold stays eager" + checklist line. |
| inline-critical-css | **F (retired)** | Not naturally testable in a single-file component: "defer non-critical CSS" needs a separate stylesheet + deferred `<link>` (multi-file/build tooling), and critical-vs-non-critical in one `<style>` block is subjective. iter1's PASS rewarded *deleting* styles, which conflicts with the reduced-motion rule ("don't delete to fix") and surgical-change principles. Removed from `assertions-e1.json` and `evals.json` rather than corrupt the skill with a "delete your CSS" directive. Eval count 34 → 33. |

No skill rule was added for `inline-critical-css`; the existing terse Rules-list line (38) is left untouched as general guidance but is no longer asserted.
