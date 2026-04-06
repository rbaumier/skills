---
name: ui-animations
version: "2.1"
description: "Web animations and motion design. Trigger on 'animation', 'transition', 'scroll effect', 'parallax', 'hover state', 'micro-interaction', 'GSAP', 'Framer Motion', 'Lenis', 'generative art'."
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