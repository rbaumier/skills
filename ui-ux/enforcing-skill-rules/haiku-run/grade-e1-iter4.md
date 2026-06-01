# Grade — ui-ux / e1 / iter4

Code graded against assertions. STRICT: PASS only if the violation is clearly corrected in the real code (with citation). FAIL on absence, doubt, aspirational, or delegated.

| id | category | verdict | evidence (line) |
|----|----------|---------|-----------------|
| no-inter-font | format | PASS | L23 `fontFamily: 'Geist, system-ui, sans-serif'` — Inter removed, Geist used |
| max-2-font-weights | format | PASS | Only `font-bold` appears as a weight class everywhere (L25,42,79,92,…); default is normal. No semibold/medium → 2 tiers |
| weight-contrast-too-narrow | format | PASS | Pairing is normal (400) vs `font-bold` (700) — dramatic contrast, no 600+500 narrow pairing remains |
| no-3col-equal-grid | format | PASS | L70 `grid grid-cols-1 md:grid-cols-[2fr_1fr]` — asymmetric, not 3-col equal |
| no-filler-copy-seamlessly | format | PASS | L40 "Track active and completed projects at a glance." — no "seamlessly"/filler; concrete |
| no-learn-more-link | format | PASS | L101 "View details" replaces "Learn More" — specific verb+noun |
| no-pure-black-shadow-css | format | PASS | L76 `rgba(100, 116, 139, 0.1)` (slate-tinted), not pure black `rgba(0,0,0,…)` |
| no-direct-shadow-animation | behavior | PASS | L76 pseudo-overlay div with `opacity-0 group-hover:opacity-100 transition-opacity`; box-shadow not transitioned |
| icon-buttons-need-aria-label | security | PASS | L27 `aria-label="Notifications"`, L30 `aria-label="Settings"` |
| search-input-no-label | security | FAIL | L51-57 input has placeholder only; no `<label>`, no `aria-label`, no `aria-labelledby`. Still a violation |
| no-outline-none-without-focus-visible | security | PASS | L56 `focus-visible:outline-none focus-visible:ring-2 …` — ring replacement present |
| focus-border-not-ring | gotcha | PASS | L56 uses `focus-visible:ring-2 ring-offset`, no `focus:border-*` |
| empty-state-missing-elements | behavior | PASS | L123-135 has icon (L125-127), message (L128-129), CTA button (L130-133) |
| empty-state-centered | behavior | FAIL | L124 empty state is still `text-center py-16` with `mx-auto` icon — the description requires off-center visual weight; remains centered |
| no-generic-names-john-doe | format | PASS | "Keiko Tanaka"/"Amir Patel" (L146,157) — no "John Doe" |
| no-generic-names-sarah | format | PASS | No "Sarah Chen"; replaced with distinctive names |
| card-wrapping-activity | format | PASS | L139 `divide-y divide-white/5`, items are flex rows (L140,151) — no nested bg-card wrappers |
| too-many-text-colors | format | FAIL | text shades: zinc-100,200,300,400,500 = 5 distinct text colors (L23,59,92,99,128…). Description allows only 2-3. Still noise |
| emerald-as-second-accent | format | PASS | No emerald; status uses indigo tint (L82), single accent family |
| no-transition-all-implicit | behavior | PASS | No `transition-shadow`; only `transition-colors`/`transition-opacity`/`transition-all` on width bar (L95) — box-shadow not animated |
| progress-bar-no-tabular-nums | format | PASS | L92 `tabular-nums`, L113 `tabular-nums` on percentages |
| no-text-wrap-balance | format | PASS | L25,39,138 `text-balance` on headings |
| heading-hierarchy-size-only | format | FAIL | h2 (L39 text-3xl font-bold) vs h3 (L138 text-lg font-bold) differ by size only; both font-bold, similar zinc-100. No weight/color differentiation between heading levels |
| no-loading-state | behavior | FAIL | Component renders populated + empty only. No loading/skeleton state anywhere |
| no-error-state | behavior | FAIL | No error/retry state. Fetch-failure path absent |
| hardcoded-border-color | gotcha | PASS | All borders `border-white/10`, `divide-white/5`, `border-white/20` — alpha tokens, no border-zinc-* |
| centered-hero-banned | format | PASS | L37-41 "Your Workspace" is left-aligned in a flex justify-between, no mx-auto centering of the hero |
| no-reduced-motion | security | PASS | L166-172 `@media (prefers-reduced-motion: reduce)` disables transitions/animations |
| no-tactile-feedback | behavior | PASS | `active:scale-[0.98]` on buttons (L27,30,42,130), `active:scale-[0.95]` (L100) |
| same-spacing-everywhere | format | FAIL | Spacing varied somewhat (mb-8, gap-6, gap-3, mt-12, py-3) but no deliberate documented scale; values still ad hoc (gap-4 L48, gap-6 L37/70, gap-3 L26). Mixed, not a clear rhythm — doubt → FAIL |
| card-same-border-radius | format | FAIL | Outer card rounded-lg (L74,108,137) and inner status badge rounded-full (L80), progress bars rounded-full (L94,115). Not concentric (outer = inner + padding) reasoning; just shared rounded-lg without concentric system |
| passive-voice-subtitle | format | PASS | L40 "Track active and completed projects at a glance." — concrete value, not directive filler |
| status-text-not-badge | security | PASS | L85 adds a dot indicator `<span … rounded-full bg-indigo-400 />` plus text — not color-only |
| search-decorative-icon | security | PASS | L50 Search icon has `aria-hidden="true"` |
| no-ease-keyword | behavior | FAIL | No CSS `transition: … ease`, but no deliberate `cubic-bezier(...)` curve is defined either; Tailwind `duration-*` uses default ease implicitly. Description requires explicit ease-out-expo curve — absent → FAIL |

## Summary
- Total: 35
- Passed: 26
- Failed: 9

### Fails
search-input-no-label, empty-state-centered, too-many-text-colors, heading-hierarchy-size-only, no-loading-state, no-error-state, same-spacing-everywhere, card-same-border-radius, no-ease-keyword
