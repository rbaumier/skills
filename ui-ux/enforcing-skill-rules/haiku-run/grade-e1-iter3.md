# Grade e1 iter3 — STRICT (code vs assertions only)

Code under review: `out-e1-iter3.md` (ProjectsDashboard.tsx)

| # | id | verdict | citation / reasoning |
|---|----|---------|----------------------|
| 1 | no-inter-font | PASS | L25 `style={{ fontFamily: 'Geist, system-ui, sans-serif' }}` — Geist, not Inter. |
| 2 | max-2-font-weights | PASS | Only `font-bold` weight used throughout (L28, L48, L51, L84, L100, L112, L125, L134, L144, L152, L163). No font-semibold/font-medium present. 1 weight + default = within 2. |
| 3 | weight-contrast-too-narrow | PASS | No `font-semibold`/`font-medium` pairing exists. Only default (400) vs `font-bold` (700) = 400+700 dramatic pairing. |
| 4 | no-3col-equal-grid | PASS | L91 `grid grid-cols-[2fr_1fr] gap-6` — asymmetric grid, not `grid-cols-3`. |
| 5 | no-filler-copy-seamlessly | PASS | No "seamlessly/elevate/unleash/next-gen". L49 "Track project progress and collaborate with your team." concrete verbs. |
| 6 | no-learn-more-link | PASS | L126 "View project", L53 "Create project", L136 "See all", L87 "Clear filters" — no "Learn More". |
| 7 | no-pure-black-shadow-css | PASS | No `rgba(0, 0, 0, ...)` anywhere; no box-shadow at all in code. |
| 8 | no-direct-shadow-animation | PASS | No `transition: box-shadow` and no `transition-shadow`. Hover uses border-color + gradient opacity (L95, L97). |
| 9 | icon-buttons-need-aria-label | PASS | L32 `aria-label="Notifications"`, L38 `aria-label="Settings"`. |
| 10 | search-input-no-label | FAIL | L60-66 search input has placeholder only, NO `<label>` and NO `aria-label`/`aria-labelledby`. Decorative Search icon is `aria-hidden`. Input remains unlabeled — violation not corrected. |
| 11 | no-outline-none-without-focus-visible | PASS | L65 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500` — outline-none paired with focus-visible ring. |
| 12 | focus-border-not-ring | PASS | L65 uses `focus-visible:ring-2 ... ring-offset-2`, not `focus:border-*`. No focus border-color change present. |
| 13 | empty-state-missing-elements | PASS | L80-89 has icon (AlertCircle in circle), message, and CTA button "Clear filters". |
| 14 | empty-state-centered | FAIL | L80 `flex flex-col items-center justify-center py-16 text-center` — empty state is still centered with text-center. Assertion explicitly bans centered empty state. Not corrected. |
| 15 | no-generic-names-john-doe | PASS | No "John Doe". L152 "Marina Okonkwo", L163 "Devin Asato". |
| 16 | no-generic-names-sarah | PASS | No "Sarah Chen". Names are distinctive (Marina Okonkwo, Devin Asato). |
| 17 | card-wrapping-activity | PASS | L145-168 activity items use `divide-y divide-white/5` with spacing, no nested `bg-zinc-800/50 rounded-lg` wrappers. Items are flat rows. |
| 18 | too-many-text-colors | FAIL | Text shades used: zinc-100 (L24/L100), zinc-200 (L84/L112/L151/L162), zinc-300 (L104/L148/L159), zinc-400 (L49/L68/L85/L111/L134), zinc-500 (L59/L122/L154/L165). That is 5 distinct text shades (100/200/300/400/500) — exceeds 2-3. Violation persists. |
| 19 | emerald-as-second-accent | FAIL | Both indigo (actions, e.g. L51/L116/L125) AND emerald (status, L103 `bg-emerald-500/20 text-emerald-300`, plus emerald activity icon L158-159) are used as accents. Two accent colors remain. Not corrected. |
| 20 | no-transition-all-implicit | PASS | No `transition-shadow`. L116 `transition-all duration-500` is on width (progress bar), not box-shadow; no box-shadow repaint triggered. |
| 21 | progress-bar-no-tabular-nums | PASS | L112 `tabular-nums` on the `{project.progress}%`. |
| 22 | no-text-wrap-balance | PASS | L48 h2 "Your Workspace" has `text-balance`. |
| 23 | heading-hierarchy-size-only | FAIL | h2 (L48) `text-3xl font-bold`, h3 (L100/L144) `text-lg font-bold`/`font-bold`. Hierarchy differentiated by size + weight is identical (both font-bold). Color also same-ish (zinc-100). Hierarchy is essentially size-only between headings; weight is constant. Not clearly corrected. |
| 24 | no-loading-state | FAIL | Component renders only empty (L79-89) and populated (L90-141) states. No loading/skeleton state. `projects` is a prop, no loading branch. Violation persists. |
| 25 | no-error-state | FAIL | No error state anywhere. No try/error/retry UI. AlertCircle is used for empty state, not an error state. Violation persists. |
| 26 | hardcoded-border-color | PASS | Borders use `border-white/10`, `border-white/20`, `border-white/5` (L27/L65/L95/L133/L143/L145) — alpha tokens, no `border-zinc-800/700`. |
| 27 | centered-hero-banned | PASS | L46-50 workspace section is left-aligned (`flex flex-col`, no mx-auto/text-center). Heading not centered. |
| 28 | no-reduced-motion | PASS | L172-179 `@media (prefers-reduced-motion: reduce)` disabling transitions/animations. |
| 29 | no-tactile-feedback | PASS | Buttons have `active:scale-[0.98]` (L31, L37, L51, L86, L125, L135). |
| 30 | same-spacing-everywhere | FAIL | Spacing values: gap-3 (L29), gap-8/mb-8 (L46), gap-4/mb-6 (L57), gap-6 (L91), gap-4 (L146/L157), space-y-4 (L145), gap-2/gap-1. Mixed but no evidence of a deliberate scale; gap-4 reused across grid header and feed. Cannot cite a deliberate rhythm — assertion not clearly satisfied. Borderline; STRICT → FAIL. |
| 31 | card-same-border-radius | FAIL | Outer/inner radii: header buttons rounded-lg (L31), Create button rounded-lg, cards rounded-lg (L95/L133), section rounded-lg (L143), progress rounded-full, badge rounded-full. Cards are rounded-lg and inner progress bar rounded-full — not concentric (outer = inner + padding). The fix made everything rounded-lg/full but progress/badge inside cards use rounded-full while card is rounded-lg; no concentric relationship demonstrated. STRICT → FAIL (not clearly corrected as concentric). |
| 32 | passive-voice-subtitle | PASS | L49 "Track project progress and collaborate with your team." — concrete value, not "Manage and track... seamlessly" filler. |
| 33 | status-text-not-badge | PASS | L101-107 status badge adds a dot via `after:` pseudo-element (shape/pattern) plus text, not color-alone. Has non-color indicator. |
| 34 | search-decorative-icon | PASS | L59 Search icon `aria-hidden="true"`. |
| 35 | no-ease-keyword | PASS | No CSS `transition: ... ease`. Tailwind `duration-*` utilities use default easing but no literal `box-shadow 0.3s ease` string; no generic CSS `ease` keyword present in authored CSS. |

## Summary

- Total: 35
- PASS: 26
- FAIL: 9
- Fails: search-input-no-label, empty-state-centered, too-many-text-colors, emerald-as-second-accent, heading-hierarchy-size-only, no-loading-state, no-error-state, same-spacing-everywhere, card-same-border-radius
