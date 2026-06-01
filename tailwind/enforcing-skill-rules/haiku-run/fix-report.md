# Fix report — tailwind (weak executor: Haiku)

Baseline: e1 21/33, e2 3/6. 15 distinct fails. Triggering worked in both evals (skill loaded, all traps in-scope) → no A/description changes needed. No contradictions among rules → no V. All traps are concrete, in-scope Tailwind/CSS rules already present in the body → all **R (reinforce)**. None retargeted/removed → no F.

Classification: **R=15, V=0, A=0, F=0.**

Reinforcement strategy applied to every fail: (1) keep the canonical value in the rule BODY, (2) embed a concrete before→after example that incarnates the fix, (3) add a LOUD final-pass checklist with numeric/explicit triggers so the silently-skipped rules get re-scanned. Edits are surgical — passing rules (cn-merge, oklch-tokens, v4-import, size-shorthand, skeleton-pattern, plugin-directive, z-index-tokens, etc.) were left intact.

## E1 fails (12) — all R

| id | why Haiku missed | reinforcement |
|----|------------------|---------------|
| cva-variants | used object-map lookup instead of cva() | "NOT ternaries OR object maps" + ❌/✅ code; object map called out as still-wrong |
| spacing-scale | introduced NEW off-scale values (py-1.5, mt-1, space-y-3) | "no half-steps", "check every class you ADD", explicit scale {1,2,3,4,6,8,12,16,24} |
| focus-ring | missed clickable `<li>` | "EVERY interactive incl. clickable div/li", focus-visible, tabIndex, "scan every onClick" |
| touch-targets | never applied | "≥44×44px", concrete fix `size-11`/`min-h-11 min-w-11`, p-2 example flagged |
| gpu-properties | left transition-all in dialog | "NEVER transition-all", →`transition-[transform,opacity]`, "zero left" |
| no-forwardRef | kept forwardRef wrapper | "DELETE every forwardRef", ❌/✅ React 19 ref-as-prop code |
| mobile-first | left fixed w-[480px] | "NO fixed widths, NO max-* breakpoints", →`w-full max-w-[480px]` |
| color-initial | never emitted | "`--color-*: initial` FIRST", code with "must come first" comment |
| animation-tokens-theme | animate-pulse w/o token+keyframes | "every animate-X MUST have --animate-X + @keyframes", code example |
| container-queries | plain card, no @container | "wrap in @container + @lg: not viewport", code example, "reusable card" trigger |
| contrast-more | never applied | "low-contrast/muted text → contrast-more:text-gray-900" |
| starting-style-popover | native popover no @starting-style | "[popover] entry needs @starting-style", CSS example |

## E2 fails (3) — all R

| id | why Haiku missed | reinforcement |
|----|------------------|---------------|
| oklch-double-wrap | didn't unwrap seeded oklch(oklch(...)) | "UNWRAP the inner one", →`oklch(0.98 0.01 250)`, "always-correct fix = delete redundant inner oklch(" |
| cva-3-variant-threshold | kept CVA for 2 variants | "UNDER 3 = RIP OUT CVA, inline instead", "count the variant keys", "2 variants is over-engineering" |
| tw-animate-css | kept custom @keyframes fadeIn | "standard entrances → tw-animate-css, do NOT hand-write @keyframes", delete + @import instruction |

## Sections edited (via Edit)
- Class Management (cva-variants, cva-3-variant-threshold)
- Spacing & Sizing (spacing-scale + size/text examples)
- Design Tokens (oklch-double-wrap, color-initial, animation-tokens-theme)
- Responsive & Layout (mobile-first, container-queries, min-w-0)
- Accessibility (focus-ring, touch-targets, contrast-more)
- Animations (gpu-properties, tw-animate-css, starting-style-popover)
- Components (no-forwardRef, radix for dropdowns)
- NEW "Before you emit — LOUD final pass" checklist (numeric triggers for all 15)

## No-regression notes
- `animate-pulse` token rule vs tw-animate-css rule do NOT conflict: pulse is a built-in skeleton loop (kept by passing skeleton-pattern assertion), tw-animate-css covers fade/slide/scale ENTRANCES — different utilities.
- General/v4 sections (passing assertions) untouched except adding "Radix for dropdowns" clause to an already-passing radix-primitives rule (e1 radix passed on the dialog; dropdown is a latent gap, harmless reinforcement).
