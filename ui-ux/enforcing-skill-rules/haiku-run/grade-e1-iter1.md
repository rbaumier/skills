# Grade: ui-ux eval 1, iter 1

Code: `out-e1-iter1.md` vs assertions `assertions-e1.json`. STRICT: PASS only if the violation is clearly corrected in the real code.

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | no-inter-font | FAIL | L26 still `fontFamily: 'Inter, system-ui, sans-serif'`. Inter unchanged. |
| 2 | max-2-font-weights | FAIL | Mix persists: `font-semibold` (L30,124,151), `font-bold` (L51,197), `font-medium` (L56,153,168,205,216). 3+ weights. |
| 3 | weight-contrast-too-narrow | FAIL | `font-semibold`(600) + `font-medium`(500) still adjacent (e.g. L151 semibold name vs L153 medium badge). No 400+700 dramatic pairing. |
| 4 | no-3col-equal-grid | FAIL | L90 and L144 both `grid grid-cols-3 gap-4`. Classic equal grid unchanged. |
| 5 | no-filler-copy-seamlessly | FAIL | L52 `...all your projects seamlessly in one place.` "seamlessly" still present. |
| 6 | no-learn-more-link | FAIL | L187 button text `Learn More`. Generic link unchanged. |
| 7 | no-pure-black-shadow-css | PASS | No `rgba(0,0,0,...)` anywhere; shadows now Tailwind `shadow-md/lg` (L148), no pure-black CSS shadow remains. |
| 8 | no-direct-shadow-animation | FAIL | L148 `hover:shadow-lg ... transition-all duration-300` animates box-shadow directly. No pseudo-element opacity technique. |
| 9 | icon-buttons-need-aria-label | PASS | Bell L33 `aria-label="Notifications"`, Settings L39 `aria-label="Settings"`. |
| 10 | search-input-no-label | PASS | L72 `aria-label="Search projects by name"` on the input. |
| 11 | no-outline-none-without-focus-visible | FAIL | L73 input has `outline-none` with only `focus:border` + `focus:ring-...500/30`; uses `focus:` not `focus-visible:`, and the ring is a low-alpha decoration paired with border-change (assertion targets focus-visible replacement). Not clearly corrected. |
| 12 | focus-border-not-ring | FAIL | L73 still `focus:border-indigo-500`. Border-color change for focus persists. |
| 13 | empty-state-missing-elements | PASS | L119-140 empty state has icon (FolderOpen L122), why-message (L127-131), CTA button (L132-138). |
| 14 | empty-state-centered | PASS | Empty state redesigned with icon badge, heading, message, primary CTA (L119-139) — no longer bare centered text. |
| 15 | no-generic-names-john-doe | FAIL | L205 `John Doe` still present. |
| 16 | no-generic-names-sarah | FAIL | L216 `Sarah Chen` still present. |
| 17 | card-wrapping-activity | FAIL | L199 & L210 activity items still wrapped in `bg-zinc-800/50 rounded-lg` inside bordered section L196. No divide-y/flatten. |
| 18 | too-many-text-colors | FAIL | Still many zinc text shades: zinc-100 (L30,124,151), zinc-200 (L204,215), zinc-300 (L168), zinc-400 (L52,127), zinc-500 (L66,182,201). 5+ shades. |
| 19 | emerald-as-second-accent | FAIL | emerald (L155,211,212) + indigo (L34,56,148,etc) both present and saturated. Two accents persist. |
| 20 | no-transition-all-implicit | FAIL | L148 `transition-all duration-300` with `hover:shadow-lg` — box-shadow repaint. L174 `transition-all`. Not fixed. |
| 21 | progress-bar-no-tabular-nums | FAIL | L169 `{project.progress}%` has no tabular-nums. grep confirms zero `tabular` in file. |
| 22 | no-text-wrap-balance | FAIL | grep confirms no `text-wrap`/`balance` anywhere. Headings unbalanced. |
| 23 | heading-hierarchy-size-only | FAIL | L51 h2 `text-3xl font-bold`; h3 `font-semibold`. Hierarchy still size+weight only, no deliberate color/space system. |
| 24 | no-loading-state | PASS | L89-116 loading skeleton with shimmer matching card layout. |
| 25 | no-error-state | FAIL | No error state rendered. Comment L233 admits only "framework ready"; no error UI/retry exists in JSX. |
| 26 | hardcoded-border-color | FAIL | L29,73,94,148,196 etc still `border-zinc-800/700`. No alpha tokens (border-white/10). |
| 27 | centered-hero-banned | PASS | Hero L49-61 uses `flex items-center justify-between` left-aligned, no `mx-auto` centering on the heading block. |
| 28 | no-reduced-motion | FAIL | grep confirms no `prefers-reduced-motion` anywhere. Many transitions remain unguarded. |
| 29 | no-tactile-feedback | FAIL | Buttons use `active:bg-*` color only (L34,56,134); no `-translate-y`/`scale-[0.98]` press transform. |
| 30 | same-spacing-everywhere | FAIL | Arbitrary mix persists: gap-4 (L64,90,144), gap-3 (L31,199), space-y-3 (L198), mb-3/4/6/8. No deliberate scale. |
| 31 | card-same-border-radius | FAIL | Outer card `rounded-xl` (L196) contains items `rounded-lg` (L199,210); not concentric. Grid cards rounded-xl with rounded-full badge — not reconciled. |
| 32 | passive-voice-subtitle | FAIL | L52 subtitle "Manage and track all your projects seamlessly in one place" still directive filler restating the obvious. |
| 33 | status-text-not-badge | FAIL | L152-161 status still color-only badge (emerald text on tint); has aria-label but no icon/pattern — relies on color alone visually. |
| 34 | search-decorative-icon | FAIL | L66 Search icon has only `pointer-events-none`, NOT `aria-hidden="true"`. The trap target is uncorrected (activity icons L201/212 got aria-hidden, but not the search icon). |
| 35 | no-ease-keyword | FAIL | No deliberate curve added; uses Tailwind default easing (`transition-*` w/o ease-[cubic-bezier]). grep confirms no cubic-bezier. Generic easing persists. |

## Note on #34 (search-decorative-icon)
Assertion requires `aria-hidden="true"` on the decorative search icon. L66 search icon has only `pointer-events-none`, NOT `aria-hidden`. The activity-feed decorative icons (L201,212) DID get `aria-hidden="true"`, but the specific trap target (search icon) did not. STRICT → FAIL (the cited trap is not corrected).

(Re-grading #34 as FAIL — see corrected verdict in result JSON.)
