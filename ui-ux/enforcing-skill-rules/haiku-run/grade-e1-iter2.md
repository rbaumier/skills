# Grade — ui-ux / e1 / iter2

Code: `out-e1-iter2.md`. STRICT: PASS only if the violation is clearly fixed in real code (cited). FAIL on doubt/aspirational/delegated.

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | no-inter-font | PASS | L25 `fontFamily: 'Geist, system-ui, sans-serif'` — Geist, not Inter |
| 2 | max-2-font-weights | PASS | Only `font-bold` appears (12x); no semibold/medium/normal anywhere. ≤2 weights satisfied |
| 3 | weight-contrast-too-narrow | PASS | No 600+500 pairing exists; only `font-bold` used. The narrow-contrast trap is absent |
| 4 | no-3col-equal-grid | PASS | L85 `grid grid-cols-2 gap-6` + L90 `idx % 3 === 2 ? 'col-span-2'` — asymmetric, not 3-col equal |
| 5 | no-filler-copy-seamlessly | PASS | No "seamlessly"/"elevate"/"unleash"/"next-gen" anywhere; subtitle filler removed entirely |
| 6 | no-learn-more-link | PASS | L118 "View project" + ChevronRight; no "Learn More" |
| 7 | no-pure-black-shadow-css | PASS | No `<style>`/CSS block; no `rgba(0, 0, 0, ...)` shadow anywhere |
| 8 | no-direct-shadow-animation | PASS | No `transition: box-shadow` / `transition-shadow`; transitions are `transition-colors` only |
| 9 | icon-buttons-need-aria-label | PASS | L30 `aria-label="Notifications"`, L33 `aria-label="Settings"` |
| 10 | search-input-no-label | FAIL | L53-59 search input has placeholder only; no `<label>`, no `aria-label`, no `aria-labelledby`. Violation NOT fixed |
| 11 | no-outline-none-without-focus-visible | PASS | No `outline-none` used; inputs/buttons use `focus-visible:ring-2 ...` |
| 12 | focus-border-not-ring | PASS | No `focus:border-*`; focus uses `focus-visible:ring-2 ring-offset` (L58 etc.) |
| 13 | empty-state-missing-elements | PASS | L73-83 empty state has icon (FolderOpen), message, CTA button ("Create first project") |
| 14 | empty-state-centered | PARTIAL→FAIL | L73 still `flex-col items-center justify-center ... text-center`. Assertion bans centered afterthought-style empty state; it remains centered. Not fixed |
| 15 | no-generic-names-john-doe | PASS | "Maya Patel" (L135), "Devin Asato" (L146); no "John Doe" |
| 16 | no-generic-names-sarah | PASS | No "Sarah Chen"/"Sarah"; names are distinctive |
| 17 | card-wrapping-activity | PASS | L128 `divide-y divide-white/5`; activity rows are not wrapped in nested `bg-*/rounded-*` cards |
| 18 | too-many-text-colors | FAIL | text-zinc-100/200/300/400/500 = 5 distinct text shades. Assertion requires 2-3. Still >3 |
| 19 | emerald-as-second-accent | PASS | No emerald and no indigo; status uses neutral zinc (L97-98). No second accent |
| 20 | no-transition-all-implicit | PASS | No `transition-shadow`/box-shadow animation; only `transition-colors duration-200` |
| 21 | progress-bar-no-tabular-nums | PASS | L106 `font-bold tabular-nums` on `{project.progress}%` |
| 22 | no-text-wrap-balance | PASS | L42 h2 `text-balance`; also L94/L127 headings |
| 23 | heading-hierarchy-size-only | FAIL | h2 (L42) `text-3xl font-bold`, h3 (L94/L127) `font-bold`. Hierarchy is size-only; same weight (bold) and color (zinc-100). Weight/color not used to differentiate. Not fixed |
| 24 | no-loading-state | FAIL | Only populated + empty branches (L72-124). No loading/skeleton state. Not fixed |
| 25 | no-error-state | FAIL | No error/retry/catch handling anywhere. Not fixed |
| 26 | hardcoded-border-color | PASS | All borders `border-white/10` / `divide-white/5` alpha tokens; no `border-zinc-700/800` |
| 27 | centered-hero-banned | PASS | L40 section heading uses `flex items-start justify-between` left-aligned; no centered `mx-auto` hero |
| 28 | no-reduced-motion | FAIL | No `@media (prefers-reduced-motion)` / `motion-reduce:`. Multiple transitions remain unguarded. Not fixed |
| 29 | no-tactile-feedback | PASS | Buttons have `active:scale-[0.98]` (L30,33,44,79,117) |
| 30 | same-spacing-everywhere | PASS | Deliberate scale: gap-2/3/4/6/8, mb-1/2/4/6/8, py-1/2/4/8/24 — varied, rhythmic, not uniform |
| 31 | card-same-border-radius | PASS | Cards use `rounded-xl`; no inner content card with mismatched `rounded-lg` nested at same level. Badge/buttons are distinct element types. Concentric concern not present |
| 32 | passive-voice-subtitle | PASS | Directive filler subtitle removed entirely; only the h2 "Your Workspace" remains, no redundant restated copy |
| 33 | status-text-not-badge | FAIL | L95-101 status is still a color/text badge ("◆ Active"). Relies on text+shape badge; the `◆` glyph is decorative (no aria), no accessible semantic indicator. Color-alone concern only partially mitigated (now zinc not emerald) but assertion = "not rely on color alone / add icon or pattern accessibly" — the badge is still a non-semantic visual chip. STRICT: not clearly fixed |
| 34 | search-decorative-icon | PASS | L52 search icon `aria-hidden="true"` |
| 35 | no-ease-keyword | PASS | No CSS `transition: ... ease`; no generic `ease` easing keyword (Tailwind `transition-colors` uses default but no literal `ease` curve string). Trap (box-shadow 0.3s ease) is absent |

## Summary

- PASS: 27
- FAIL: 8 — search-input-no-label, empty-state-centered, too-many-text-colors, heading-hierarchy-size-only, no-loading-state, no-error-state, no-reduced-motion, status-text-not-badge

### Notes on borderline judgments (STRICT)
- **empty-state-centered (14):** still `text-center` + centered flex; the very layout the assertion bans persists. FAIL.
- **too-many-text-colors (18):** 5 distinct zinc text shades, assertion caps at 2-3. FAIL.
- **heading-hierarchy-size-only (23):** all headings share `font-bold` + zinc-100; only `text-3xl` vs default size differs. Weight/color not used. FAIL.
- **status-text-not-badge (33):** remains a text/color chip with a decorative ◆ glyph (no aria), no real semantic/pattern indicator. Not clearly fixed. FAIL.
- **no-loading-state / no-error-state (24,25):** absent entirely. FAIL.
- **no-reduced-motion (28):** no reduced-motion guard. FAIL.
- **search-input-no-label (10):** placeholder only. FAIL.
