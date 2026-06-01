# Grade e1 iter2 — ui-animations (STRICT)

| # | id | verdict | evidence / why |
|---|----|---------|----------------|
| 1 | animate-presence-sidebar | FAIL | `{showPanel && (<div className="sidebar">…)}` (L14-18) is still a bare conditional render with no `AnimatePresence` wrapper and not even a `motion.div`. Trap uncorrected. |
| 2 | animate-tab-swap | FAIL | `{activeTab === 'home' ? <HomeContent /> : <SettingsContent />}` (L20) is still an instant ternary swap, no animation/AnimatePresence. Uncorrected. |
| 3 | loading-content-transition | PASS | L51-61: loading→content wrapped in `<AnimatePresence mode="wait">` with opacity in/out and `transition={{ duration: 0.2 }}`. Smooth, not instant. |
| 4 | no-scale-from-zero | PASS | L26 `initial={{ opacity: 0, scale: 0.95 }}` — scale floor 0.95, no scale(0). |
| 5 | duration-too-long | FAIL | Card `transition={{ duration: 0.5, … }}` (L28). 0.5s = 500ms on a user-facing card entrance exceeds the 300ms max for user-initiated transitions. Not corrected. |
| 6 | no-linear-easing | PASS | Card uses `ease: [0.16, 1, 0.3, 1]` (L28); no `ease: 'linear'` anywhere in code. |
| 7 | stagger-too-slow | PASS | L28 `delay: i * 0.05` = 50ms per item, within max. |
| 8 | spring-for-interactive | PASS | Sliding drawer (interactive, driven by showPanel) uses `type: 'spring'` (L132-133). |
| 9 | enter-recipe | FAIL | Enter animations use opacity + translateY/scale but no `blur`/`filter` anywhere. Card (L26-27), tooltip (L37-38), notifications (L66-67) lack the blur component of the Jakub recipe. Not present. |
| 10 | button-press-feedback | FAIL | Toggle button (L44-49) and action-btn (L180) have no press/active scale (`whileTap`/`:active scale(0.97)`). No press feedback added. |
| 11 | hover-duration | PASS | Hover uses `animation: hoverPulse 0.2s` (L173) = 200ms; no 500ms `transition: all 0.5s`. (Note: it's a keyframe — see #25 — but duration itself is in range.) |
| 12 | gpu-only-properties | PASS | No `width`/`height` animation remains. Sidebar uses static `style={{ width: 300 }}` (not animated); mobile-nav animates `clipPath` (L115), not width. Animated props are transform/opacity/clipPath. |
| 13 | will-change-sparingly | PASS | No `willChange` present anywhere — trap (permanent multi-prop will-change) absent. |
| 14 | no-transition-all | PASS | Toggle button uses `transition: 'opacity 0.3s cubic-bezier(...)'` (L46) — specific property, not `all`. No `transition: all` in code. |
| 15 | prefers-reduced-motion | FAIL | No `prefers-reduced-motion` media query, `useReducedMotion`, or any reduced-motion handling anywhere in the code. Uncorrected. |
| 16 | no-continuous-purposeless | FAIL | L75-79: decorative spinner still `animate={{ rotate: 360 }}` with `transition={{ repeat: Infinity, duration: 2 }}`, `className="decorative-spinner"`. Continuous, purposeless, not pausable. Uncorrected. |
| 17 | keyboard-no-animate | PASS | L82-89 keyboard handler sets `setSearchOpen(true)` only; no animation triggered by the keyboard action. |
| 18 | tooltip-first-delayed | FAIL | Tooltip (L35-42) still uses a flat `transition={{ duration: 0.3 }}` with no first-vs-subsequent delay logic. Uncorrected. |
| 19 | exit-subtler-than-enter | PASS | Dropdown menu: enter `y: -12` (L94), exit `y: -6` (L96) — exit translateY smaller than enter; same opacity. Subtler exit. |
| 20 | custom-bezier-not-default-ease | PASS | slide-in-banner uses `ease: [0.16, 1, 0.3, 1]` (L108), a custom Bézier, not `'ease'`. |
| 21 | clip-path-for-reveals | PASS | mobile-nav animates `clipPath` (L115) instead of width. |
| 22 | no-vestibular-triggers | PASS | Hero `whileInView={{ scale: 1.05 }}` (L123) — capped at 1.05, no 0.5→1.3 excessive zoom. |
| 23 | animations-interruptible | PASS | Sliding drawer now uses framer-motion `variants` with spring (L128-137), state-driven and interruptible; no CSS keyframe `slideIn`. |
| 24 | shadows-not-borders | PASS | feature-card uses `boxShadow: '0 1px 3px rgba(0,0,0,0.1)'` on `background: var(--card-bg)` (L141-143); no `border: 1px solid`. |
| 25 | expandable-animate-height | FAIL | FAQ answer (L154-167) is wrapped in AnimatePresence but reveals via `clipPath: 'inset(10% 0 90% 0)'`, not an animated height/expand. The assertion requires height animation for expandable sections; clip-path does not animate height. Trap (instant show/hide) replaced with clip-path, not height — does not satisfy "animate height". |
| 26 | css-transitions-not-keyframes-for-interruptible | FAIL | Hover effect still uses `animation: hoverPulse 0.2s forwards` with `@keyframes hoverPulse` (L172-178). Trap explicitly is "@keyframes instead of CSS transition — not interruptible"; still a keyframe animation, not a CSS `transition`. Uncorrected. |
