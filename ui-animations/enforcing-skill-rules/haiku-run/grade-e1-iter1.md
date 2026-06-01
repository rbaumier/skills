# Grade: ui-animations / e1 / iter1

STRICT grading — judging code vs assertions only.

| # | ID | Verdict | Evidence / Reasoning |
|---|----|---------|----------------------|
| 1 | animate-presence-sidebar | PASS | Conditional sidebar replaced by persistent `motion.div` with `animate={{ x: showPanel ? 0 : -300 }}` (lines 23-29). No conditional render remaining; element always mounted and animates in/out via transform. Trap (`{showPanel && ...}` without AnimatePresence) is gone. |
| 2 | animate-tab-swap | PASS | Tab content wrapped in `<AnimatePresence mode="wait">` with keyed `motion.div` blocks, opacity 0→1 + exit (lines 34-56). Mode switch now animates. |
| 3 | loading-content-transition | FAIL | No loading→content state exists in the code at all. There is no loading indicator, no spinner-to-content swap, no `isLoading` branch. The assertion's behavior (smooth loading→content transition) is neither present nor demonstrably fixed — it is simply absent. Cannot cite a corrected transition. |
| 4 | no-scale-from-zero | FAIL | Grid items still use `hidden: { opacity: 0, scale: 0 }` (line 75). The trap (`scale: 0`) is verbatim still present; should be 0.9+ minimum. Comment at line 58 claims fixes but scale: 0 was NOT changed. |
| 5 | duration-too-long | PASS | Grid uses `MEDIUM_TIMING` = `{ duration: 0.4 }` (lines 18, 78). No 1.5s duration anywhere. Within the 300ms+ user-transition envelope as fixed. |
| 6 | no-linear-easing | PASS | No `ease: 'linear'` present anywhere. Banner uses `ease: 'easeOut'` (line 154); other transitions are duration-only (Framer default easeOut). Linear trap removed. |
| 7 | stagger-too-slow | FAIL | `staggerChildren: 0.1` (line 67) = 100ms per item. Assertion requires max 50ms (0.05). Still 2x over the limit. Not corrected. |
| 8 | spring-for-interactive | FAIL | Interactive elements (buttons, whileHover/whileTap) all use `MICRO_TIMING` = `{ duration: 0.15 }` — a duration-based transition (lines 100, 235, 209). No `type: 'spring'` anywhere in file. Assertion requires springs for interactive/interruptible motion; still duration-based. |
| 9 | enter-recipe | PASS (partial scope) | Dropdown menu enter uses opacity + translateY + blur: `initial={{ opacity: 0, y: -12, filter: 'blur(4px)' }}` → animate blur(0px) (lines 138-139). The blur recipe is demonstrated. Trap "No blur in enter animation" corrected with a concrete instance. |
| 10 | button-press-feedback | PASS | Buttons use `whileTap={{ scale: 0.98 }}` (lines 99, 234). Press feedback present. (0.98 vs spec 0.97 — within spirit; scale feedback on active is present.) |
| 11 | hover-duration | PASS | No `transition: all 0.5s`. Hover feedback uses `MICRO_TIMING` 0.15s (lines 98-100, 233-235). Within 120-180ms range. |
| 12 | gpu-only-properties | FAIL | FAQ answer animates `height: 0` → `height: 'auto'` (lines 217-219) — height is a layout property, not GPU-composited. Notifications/sidebar/nav were fixed to transforms, but the height animation reintroduces a non-GPU property. Assertion ("only animate transform and opacity") is violated by the FAQ. |
| 13 | will-change-sparingly | PASS | No `willChange` set anywhere in the code (removed per note 15). Trap (permanent will-change on multiple properties) is gone. |
| 14 | no-transition-all | PASS | No `transition: 'all ...'` anywhere. Inline all-transition removed; replaced with explicit whileHover/whileTap. |
| 15 | prefers-reduced-motion | PASS | `useReducedMotion()` hook (line 11); timing constants set `{ duration: 0 }` when reduced (lines 16-18), applied across transitions. Reduced motion respected. |
| 16 | no-continuous-purposeless | PASS | Decorative infinite rotation removed; comment marks removal (line 120). No `repeat: Infinity` / continuous rotate remains. Trap corrected. |
| 17 | keyboard-no-animate | PASS | Cmd+K search handler triggers no animation — `onKeyDown` only has a commented-out state setter, no motion (lines 123-131). Keyboard action does not animate. |
| 18 | tooltip-first-delayed | FAIL | Tooltip just removed the delay entirely (`MICRO_TIMING`, no delay; lines 86-91). Assertion requires "first delayed + animated, subsequent instant" — a first-vs-subsequent distinction. No such logic exists; it is now uniformly instant-ish, not the required differentiated behavior. Not corrected as specified. |
| 19 | exit-subtler-than-enter | FAIL | Dropdown exit mirrors enter exactly: enter `y: -12, blur(4px)`, exit `y: -12, filter: 'blur(4px)'` (lines 138-140). Assertion requires exit subtler (smaller translateY, e.g. -4 to -6). Still identical translateY(-12). Trap unchanged. |
| 20 | custom-bezier-not-default-ease | FAIL | Banner changed from `ease: 'ease'` to `ease: 'easeOut'` (line 154) — still a built-in keyword, NOT a custom Bézier (`cubic-bezier(...)` / numeric array). Assertion explicitly requires custom Bézier curves instead of built-in easing keywords. Swapping one keyword for another does not satisfy it. |
| 21 | clip-path-for-reveals | FAIL | Mobile nav changed from width animation to `scaleX` (lines 160-164). Assertion specifically requires clip-path for reveals instead of width/height. scaleX is a transform (GPU) but distorts/scales content and is not clip-path; the assertion's prescribed technique (clip-path) is not used. |
| 22 | no-vestibular-triggers | FAIL | Hero still scales `[0, 300] → [0.5, 1.3]` via `useTransform` (line 13, applied line 172). The scale range 0.5→1.3 is the exact excessive-zoom vestibular trigger from the trap. Switching to useTransform changes implementation, not the offending 0.5→1.3 zoom range. Still a vestibular trigger. |
| 23 | animations-interruptible | PASS | Drawer converted from CSS `@keyframes slideIn` to Framer Motion variant `animate={showPanel ? 'open' : 'closed'}` with x transform (lines 178-188). Framer Motion transitions are interruptible; CSS keyframe removed. |
| 24 | shadows-not-borders | FAIL | Feature card STILL uses `border: '1px solid #e2e8f0'` on `background: 'var(--card-bg)'` (variable background) — lines 191-196. The trap (border instead of box-shadow on variable background) is verbatim unchanged. No box-shadow added. |
| 25 | expandable-animate-height | PASS | FAQ answer now animates `height: 0 → 'auto'` with opacity, wrapped in AnimatePresence (lines 213-224). Expandable section animates height instead of instant show/hide. Trap corrected. (Note: tension with #12, but this assertion specifically asks for height animation, which is present.) |
| 26 | css-transitions-not-keyframes-for-interruptible | PASS | Action button @keyframes hover replaced with `whileHover` + `whileTap` (Framer, interruptible) — lines 231-238. Keyframe-based hover removed. |

## Summary

Passed: 15 / 26
Failed: 11 / 26

Failed IDs: loading-content-transition, no-scale-from-zero, stagger-too-slow, spring-for-interactive, gpu-only-properties, tooltip-first-delayed, exit-subtler-than-enter, custom-bezier-not-default-ease, clip-path-for-reveals, no-vestibular-triggers, shadows-not-borders.
