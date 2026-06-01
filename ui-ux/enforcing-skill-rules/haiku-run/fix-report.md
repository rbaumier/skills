# Fix Report: ui-ux eval 1 (Haiku executor)

## Result before fix
7/35 (28 fails). Haiku iter 1.

## Root-cause analysis (NOT 28 independent bugs)

The 7 PASSES and 28 FAILS split cleanly along ONE axis: **was the rule LOUD in the SKILL.md body, or buried in a `references/*.md` file the executor never opened?**

- **All 7 passes** map to guidance that already lives in the SKILL.md body: View State Completeness (loading skeleton, empty-state redesign) and Accessibility Essentials (icon-button aria-label, input label, touch targets). Haiku read the body, saw these LOUD, and fixed them well (it even added a shimmer skeleton and a contextual empty state with CTA).
- **All 28 fails** map to rules that existed ONLY in reference files (`anti-ai-slop.md`, `typography.md`, `motion-design.md`, `shadows.md`, `interaction-design.md`, `spatial-design.md`). A weak executor does not progressively-disclose into 12 reference files during a single "fix this code" pass. The guidance was present in the skill but undiscoverable at this capacity.

So this was a **discoverability gap, not a content gap.** The skill already knew every answer; it just hid them.

## Fix applied (general, not eval-overfit)

Added a **"Pre-Output Checklist (DO NOT SKIP)"** to the SKILL.md BODY (per the "values in the corps, not reference/" directive). Every previously-buried rule now has a concrete, greppable trigger + exact fix, grouped by theme:

- Typography: ban Inter; max 2 weights = 400+700; hierarchy via weight/color/space; `text-balance`; `tabular-nums` on changing numbers.
- Color: max 1 accent <80% sat; max 2-3 text shades; alpha-token borders (`border-white/10`); status not color-alone.
- Shadows/motion: never `transition: box-shadow`/`transition-all` on hover-shadow (pseudo-element opacity instead); no pure-black shadows; no generic `ease` (use `cubic-bezier(0.16,1,0.3,1)`); mandatory `prefers-reduced-motion`.
- Interaction/a11y: `outline-none` needs `focus-visible:ring-*` (not `focus:border`); tactile `active:scale-[0.98]`; `aria-hidden` on ALL decorative icons incl. search; error state must be real UI not a comment.
- Layout: no 3-col equal grid; no centered hero at VARIANCE>=4; concentric radius; no nested cards; deliberate spacing scale.
- Content: no generic names (John Doe / Sarah Chen); no filler ("seamlessly"); no "Learn More".

These are stated as general principles with concrete numbers, not as patches to this one eval. The 7 already-passing rules were left untouched (their body guidance is unchanged).

## Assertion review (A)

Per instructions, I audited the anti-AI-slop assertions for being too literal / not testable. Findings:
- `no-generic-names-john-doe` / `-sarah`, `no-inter-font`, `emerald-as-second-accent`, `no-filler-copy-seamlessly`, `no-learn-more-link`: literal but FAIR — each is greppable and each cited string is explicitly named as a tell in `references/anti-ai-slop.md` (#19, #31, #35, #48). Kept as-is.
- `search-decorative-icon`: the iter-1 grade was strict (Haiku added `aria-hidden` to feed icons but not the search icon). The assertion is sound — the trap target genuinely was uncorrected. The body now explicitly says "including the search-input icon." Kept.
- `max-2-font-weights` vs `weight-contrast-too-narrow`: these look like they could conflict but are coherent — "use exactly two weights" + "make those two 400 and 700." The body now states 400+700 explicitly to resolve the ambiguity for weak executors. Kept both.

**No assertion was buggy or contradictory. assertion_changes = none. No sync needed** (assertions-e1.json and evals.json verified byte-identical, 35/35).

## Capacity ceiling (HONEST)

**A 35-rule mega-trap in a single pass is at or beyond Haiku's working-set capacity.** Even with a LOUD body checklist, expecting a weak model to hold 35 distinct corrections in one "output fixed code only" pass is optimistic. The checklist meaningfully raises the per-pass ceiling (the failures were discoverability-bound, and discoverability is exactly what the body checklist fixes), but I will NOT claim a guaranteed 35/35 in one Haiku pass.

Recommendations, in order of preference:
1. **Accept a per-pass ceiling** for this eval at Haiku tier; measure improvement (expect a large jump from 7 as the 28 buried rules are now in-body), not perfection.
2. **Split the eval** into themed sub-evals (typography / color / motion-shadow / a11y-interaction / layout / content), ~5-7 rules each. This matches how a real reviewer batches passes and is the realistic route to 100% at Haiku tier.
3. If single-pass 35/35 is a hard requirement, raise the executor tier; the skill content is no longer the bottleneck.

## Expected post-fix outcome
Large jump from 7 (the 28 buried rules are now LOUD and greppable in-body). Not asserting 35/35 single-pass at Haiku — see capacity note. Re-run to measure.
