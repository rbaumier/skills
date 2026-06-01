---
name: ui-animations
version: "2.1"
description: "Use when adding animations, transitions, scroll effects, parallax, hover states, or micro-interactions — GSAP, Framer Motion, Lenis, generative art."
tags: [animation, motion-design, gsap, framer-motion, motion, anime-js, lenis, scroll, parallax, audit, accessibility, performance, sound-design, generative-art, physics, three-js]
---

# UI Animations

Audit motion design quality AND build premium 60fps animations.

Match your need below, then read the linked file.

| Need | Read |
|------|------|
| Review/audit existing animations (3-designer framework) | [audit-workflow.md](audit-workflow.md) |
| Pick a library, install, configure React setup | [library-setup.md](library-setup.md) |
| Copy-paste components (magnetic, stagger, modal, parallax, reveal, transitions, loading) | [quick-patterns.md](quick-patterns.md) |
| Duration thresholds, easing cross-library, testing checklist | [timing-and-easing.md](timing-and-easing.md) |
| UI sound design rules, Web Audio API | [sound-design.md](sound-design.md) |
| Brutalist, minimalist, abstract, neo-brutalist style guide | [design-philosophy.md](design-philosophy.md) |

## Performance Rendering Pipeline

The browser renders in 4 stages: Style > Layout > Paint > Composite. Animate ONLY composite properties (`transform`, `opacity`, `filter`) to skip Layout and Paint, running on the GPU compositor thread. Never animate: `width`, `height`, `top`, `left`, `margin`, `padding` (trigger Layout). Avoid: `color`, `background`, `box-shadow`, `border-radius` (trigger Paint). Use `will-change` sparingly -- it allocates GPU memory; remove after animation completes.

**Layout thrashing & FLIP**: reading DOM measurements (`getBoundingClientRect`, `offsetHeight`) then writing styles in the same frame forces synchronous layout recalculation. Fix: batch all reads, then batch all writes. For position animations, use FLIP (First, Last, Invert, Play): measure start position, apply final state, calculate delta, animate the inversion back to zero.

## MANDATORY Pre-Output Checklist — READ THIS LAST, BEFORE YOU WRITE CODE

This is the single source of truth. Verify EVERY numbered item against EVERY animated element before returning code. These are hard rules with concrete values — apply them verbatim, do not approximate, do not swap one disallowed value for another. Do not stop after fixing a few; a partial pass FAILS. If a rule's target state is absent from the snippet, ADD the corrected pattern rather than skipping it.

**Properties & values**
1. **GPU-only properties.** Animate ONLY `transform` (x/y/scale/rotate) and `opacity` (and `filter` for blur). NEVER animate `width`, `height`, `top`, `left`, `margin`, `padding`. To grow/shrink a box use `scaleX`/`scaleY`; to reveal use `clip-path`.
2. **Expandable height without animating `height`.** For collapse/expand (FAQ, accordion), DO NOT animate `height: 0 → auto` (not GPU, and `auto` is not animatable). Use the CSS grid-rows trick: wrap content in a `motion.div` animating `gridTemplateRows: '0fr' → '1fr'` (child `overflow: hidden`), or animate `clip-path`. This is how you satisfy "expandable animates" AND rule 1 simultaneously.
3. **Never `scale(0)`.** Entrances start at `scale: 0.95` (floor) + `opacity: 0`, never `scale: 0`. Deformation range is 0.95–1.05.
4. **No `will-change` left on permanently.** Do NOT set `willChange` on multiple props as a static style. Omit it, or apply then remove after the animation.
5. **No `transition: all`.** Never `transition: 'all 0.5s'`. List exact properties, e.g. `transition: 'transform 0.15s cubic-bezier(0.16,1,0.3,1)'`.

**Timing & easing**
6. **Durations.** User-initiated transitions ≤ 300ms (`duration: 0.3`). Card/list entrances ≤ 300ms — NEVER `duration: 1.5`. Hover/press feedback 120–180ms (`duration: 0.15`), NEVER `0.5`.
7. **Stagger ≤ 50ms per item.** Use `staggerChildren: 0.05` max (or `delay: i * 0.05`). Never `i * 0.2` / `staggerChildren: 0.1`.
8. **Custom Bézier, never built-in keywords.** Never `ease: 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'linear'` for production motion. Use a numeric cubic-bezier array, e.g. `ease: [0.16, 1, 0.3, 1]` (smooth) or `[0.87, 0, 0.13, 1]` (snappy). (CSS: `cubic-bezier(0.16, 1, 0.3, 1)`.) Swapping `'ease'`→`'easeOut'` still FAILS.
9. **Springs for interactive/interruptible motion.** Gestures, drags, hover/press, drawers, modals → `transition={{ type: 'spring', stiffness: 300, damping: 30 }}`. Duration-based easing is for entrances only.
10. **CSS transitions, not `@keyframes`, for interruptible motion.** Hover/state effects use a CSS `transition` (or Framer `whileHover`/`whileTap`), NEVER `animation: x 0.3s` + `@keyframes`. State-driven motion (drawer) uses Framer variants, not a CSS keyframe `animation`.

**Enter / exit / reveal**
11. **Enter recipe = opacity + translateY + blur.** Entrances animate all three: `initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}` → `animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}`. Plain opacity+y is incomplete.
12. **Exit subtler than enter.** Exit keeps the same opacity/blur but a SMALLER translate, e.g. enter `y: -12` → exit `y: -4` (range -4 to -6). Never mirror the enter translate exactly.
13. **Clip-path for reveals.** Reveal/hide of nav, panels, drawers uses `clip-path` (e.g. `inset(0 100% 0 0)` → `inset(0 0 0 0)`), NOT width/height animation and NOT `scaleX` (which distorts content).
14. **Wrap conditional renders in `AnimatePresence`.** Any `{flag && <X/>}` or unmount must be a keyed `motion.div` inside `<AnimatePresence>` so it animates out, not pops.
15. **Animate tab/mode swaps.** `cond ? <A/> : <B/>` swaps go through `<AnimatePresence mode="wait">` with keyed `motion.div` (opacity in/out), not an instant ternary.
16. **Loading → content is a crossfade.** Wrap `isLoading ? <Spinner/> : <Content/>` in `AnimatePresence mode="wait"` with keyed `motion.div` (opacity fade). Even if no loading state exists in the snippet, ADD the scaffold.

**Feedback, separation, motion safety**
17. **Button press feedback.** Every button gets `whileTap={{ scale: 0.97 }}` (Framer) or `:active { transform: scale(0.97) }` (CSS).
18. **Shadows, not borders, on variable backgrounds.** When `background` is a variable/token (e.g. `var(--card-bg)`) or can change, use `box-shadow` for separation, not `border: 1px solid`.
19. **No vestibular triggers.** No large zoom, spin, or parallax tied to scroll. Cap any scroll/scale to the 0.95–1.05 range. A hero scaling `0.5 → 1.3` is forbidden — clamp to ≤1.05 or remove.
20. **No continuous purposeless animation.** Remove decorative `repeat: Infinity` rotations/loops, or make them pausable. A purely decorative `animate={{ rotate: 360 }}` infinite spinner must go.
21. **Keyboard-initiated actions don't animate.** A Cmd+K / keyboard handler that opens UI should NOT trigger an entrance animation (Emil's rule) — open instantly.
22. **`prefers-reduced-motion`.** Add reduced-motion handling: `useReducedMotion()` (set `duration: 0` when true) and/or a CSS `@media (prefers-reduced-motion: reduce)` kill switch. Always animate to the final state, just skip the motion.
23. **Tooltip: first delayed, rest instant.** First tooltip in a group gets a delay + animation; while a group/`skipDelay` flag is active, subsequent tooltips appear with `delay: 0` and `duration: 0`. Do NOT give every tooltip the same fixed delay, and do NOT just remove the delay. Copy the pattern in [Tooltip Group: first delayed, rest instant](#tooltip-group-first-delayed-rest-instant) below — implement it, don't approximate.

After fixing, RE-SCAN the code against items 1–23 once more. Any remaining trap = fail.

### Tooltip Group: first delayed, rest instant

The first tooltip you hover gets the full delay + enter animation. Once one is open, a shared group flag makes the rest open instantly (and only resets after the cursor has left the group long enough). This is the concrete `delay`/`duration` differentiation rule 23 requires — paste and adapt it, never collapse it to a single fixed delay.

```tsx
import { createContext, useContext, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Shared flag: true = "a tooltip was recently open, skip the delay".
const TooltipGroupContext = createContext<{ skipDelay: boolean; open: () => void; close: () => void }>({
  skipDelay: false, open: () => {}, close: () => {},
})

function TooltipGroup({ children }: { children: React.ReactNode }) {
  const [skipDelay, setSkipDelay] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()
  const open = () => { clearTimeout(resetTimer.current); setSkipDelay(true) }
  // Only return to "delayed" mode after the pointer has been away ~300ms.
  const close = () => { resetTimer.current = setTimeout(() => setSkipDelay(false), 300) }
  return <TooltipGroupContext.Provider value={{ skipDelay, open, close }}>{children}</TooltipGroupContext.Provider>
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const { skipDelay, open, close } = useContext(TooltipGroupContext)
  const [show, setShow] = useState(false)
  return (
    <span onMouseEnter={() => { setShow(true); open() }} onMouseLeave={() => { setShow(false); close() }}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 2 }}
            // First tooltip: 500ms delay + 200ms enter. Subsequent (skipDelay): instant.
            transition={skipDelay ? { duration: 0, delay: 0 } : { duration: 0.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}
```

## Timing Duration Guidelines

| Interaction type | Duration | Notes |
|---|---|---|
| Micro-feedback (hover, button press) | 100-150ms | |
| Small transitions (toggles, dropdowns) | 200-300ms | |
| Medium transitions (modals, panels) | 300-500ms | |
| Complex choreography (page transitions) | 500ms+ | Never exceed 1000ms |
| Mobile | +50-100ms | Account for touch feedback delay |

## Purposeful Motion

Motion should communicate, not decorate. Four purposes: (1) **Feedback** -- confirm action occurred, (2) **Orientation** -- show where elements come from/go to, (3) **Focus** -- direct attention to changes, (4) **Continuity** -- maintain context during transitions. Test: "Remove this animation -- does the user lose information?" If yes, it's functional. If no, it's decorative and should be cut or minimized.

## Reference Files

**Audit**: [audit-checklist.md](audit-checklist.md), [references/emil-kowalski.md](references/emil-kowalski.md), [references/jakub-krehel.md](references/jakub-krehel.md), [references/jhey-tompkins.md](references/jhey-tompkins.md), [references/philosophy.md](references/philosophy.md)

**Libraries**: [references/gsap-react.md](references/gsap-react.md), [references/motion-patterns.md](references/motion-patterns.md), [references/lenis-react.md](references/lenis-react.md), [references/animejs-react.md](references/animejs-react.md), [references/text-effects.md](references/text-effects.md), [references/advanced-patterns.md](references/advanced-patterns.md)

**Creative**: [references/algorithmic-art.md](references/algorithmic-art.md), [references/geometric-shapes.md](references/geometric-shapes.md), [references/geometric-puzzles.md](references/geometric-puzzles.md), [references/audio-reactive.md](references/audio-reactive.md), [references/physics-2d.md](references/physics-2d.md), [references/design-philosophy.md](references/design-philosophy.md), [references/sound-design.md](references/sound-design.md)

**Quality**: [references/accessibility.md](references/accessibility.md), [references/common-mistakes.md](references/common-mistakes.md), [references/performance.md](references/performance.md), [references/technical-principles.md](references/technical-principles.md)

## Framer Motion Quick Reference

Copy-paste snippets for the most common animation needs. These cover 80% of real-world UI animation work.

### CSS Scroll-Driven Animations

Native CSS API linking keyframe progress to scroll position or element visibility. No JS needed. `animation-timeline: scroll()` for scroll progress, `animation-timeline: view()` for element visibility. Replaces IntersectionObserver + JS for many reveal-on-scroll effects. Progressive enhancement: falls back to static state in unsupported browsers.

### View Transitions API

Prefer `document.startViewTransition()` for page/state transitions before reaching for Framer Motion. Assign `view-transition-name` to elements that should animate between states -- browser handles cross-fade, position interpolation, and cleanup. Works for SPAs (same-document) and MPAs (cross-document with `@view-transition` rule). Zero bundle cost. Fall back to Framer Motion for complex choreography.

### Page Transitions (Framer Motion)

Wrap your page content in `AnimatePresence` + `motion.div` keyed by pathname. The `mode="wait"` ensures exit animation finishes before enter starts — without it, both pages render simultaneously.

```tsx
import { motion, AnimatePresence } from 'framer-motion'

const pageVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
}

// key={pathname} is critical — it tells AnimatePresence "this is a new page"
function PageTransition({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="initial" animate="animate" exit="exit"
        variants={pageVariants}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

### Staggered List Animation

Parent controls the stagger delay, children inherit via `variants`. Each child doesn't need its own timing — just `variants={itemVariants}` and the parent orchestrates.

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

function AnimatedList({ items }: { items: Item[] }) {
  return (
    <motion.ul variants={containerVariants} initial="hidden" animate="visible">
      {items.map((item) => (
        <motion.li key={item.id} variants={itemVariants}>{item.name}</motion.li>
      ))}
    </motion.ul>
  )
}
```

### Modal Animation

Spring physics on the modal itself (feels snappy), simple fade on the backdrop. The `exit` variant is what AnimatePresence uses when the component unmounts.

```tsx
const overlayVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } }
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2 } },
}

function AnimatedModal({ isOpen, onClose, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="hidden"
            onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
            className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-xl p-6">
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
```

### Gesture Animations (Drag to Dismiss)

```tsx
// onDragEnd fires with velocity and offset info — use offset.x to decide if the user
// dragged far enough to "dismiss". 100px threshold works well on desktop, consider less on mobile.
function DraggableCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 100) onDismiss() }}
      className="p-4 bg-white rounded-lg shadow cursor-grab active:cursor-grabbing"
    >
      Swipe to dismiss
    </motion.div>
  )
}
```

### Number Counter Animation

Animates from 0 to target value. Uses `useMotionValue` + `useTransform` so the DOM updates happen outside React's render cycle (= smooth 60fps, no re-renders).

```tsx
import { useMotionValue, useTransform, animate, motion } from 'framer-motion'

function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(0)
  const formatted = useTransform(count, (v) =>
    v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  )
  useEffect(() => {
    const controls = animate(count, value, { duration: 0.5, ease: 'easeOut' })
    return controls.stop
  }, [value, count])
  return <motion.span>{formatted}</motion.span>
}
```

### Library Selection by Complexity

- **AutoAnimate** (3.28KB) -- for basic add/remove/reorder list animations. One line: `useAutoAnimate(parentRef)`. Detects DOM mutations and animates automatically. Use instead of Framer Motion for simple list cases.
- **Lottie** (lottie-web or dotLottie) -- for designer-created animations from After Effects (JSON export). Use for loading indicators, onboarding flows, empty states, brand animations. Do NOT use for interactive animations that respond to user input (use Framer Motion/GSAP instead).
- **Framer Motion** (34KB) -- for complex choreography, gestures, scroll effects, layout animations.
- **GSAP** -- for timeline-based orchestration, ScrollTrigger, advanced easing.

### prefers-reduced-motion

Some users get motion sick — always respect their OS preference. Two approaches:

**CSS (global kill switch)** — good for CSS animations/transitions:
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

**Framer Motion (per-component)** — good for JS-driven animations:
```tsx
import { useReducedMotion } from 'framer-motion'

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.div
      animate={{ x: 100 }}
      // duration: 0 means it jumps instantly — still reaches final state, no motion
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
    />
  )
}
```

**Rule of thumb**: always animate to the final state, just skip the motion. The user should see the same end result, just without the movement.