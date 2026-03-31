# Response: Performance Best Practices for Scroll Animations & Drag

## Rule 1: Only Animate Transform & Opacity

Never animate layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`). These trigger layout recalculations and repaints. Only `transform` and `opacity` are GPU-accelerated and composited on their own layer.

## Rule 2: `will-change` -- Sparingly

`will-change` creates a new compositor layer. Apply it **before** animation starts, **remove after** animation completes. Never leave it on permanently -- each layer consumes GPU memory.

```tsx
// Apply just before animation
element.style.willChange = 'transform'
gsap.to(element, {
  x: 100,
  onComplete: () => {
    element.style.willChange = 'auto' // Remove after
  }
})
```

Permanent `will-change` on many elements = GPU memory exhaustion on mobile.

## Rule 3: Drag Operations -- Direct Style Updates

For drag/pan interactions, use **direct style manipulation**, not CSS variables:

```tsx
// GOOD: Direct style update in RAF
const onDrag = (e: PointerEvent) => {
  element.style.transform = `translate(${x}px, ${y}px)`
}

// BAD: CSS variable indirection adds overhead
element.style.setProperty('--x', `${x}px`)
```

CSS variables go through style recalculation. Direct `transform` updates skip that step for drag operations where every frame matters.

## Rule 4: Velocity-Based Swipe Dismiss

Use **velocity thresholds**, not distance, for swipe-to-dismiss:

```tsx
const handlePointerUp = (e: PointerEvent) => {
  const velocity = getVelocity() // px/ms from pointer tracking
  const VELOCITY_THRESHOLD = 0.5 // px/ms

  if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
    // Dismiss in direction of velocity
    dismiss(velocity > 0 ? 'right' : 'left')
  } else if (Math.abs(offset) > DISTANCE_FALLBACK) {
    // Fallback: also dismiss if dragged far enough
    dismiss(offset > 0 ? 'right' : 'left')
  } else {
    // Snap back
    snapBack()
  }
}
```

Why velocity over distance? A fast flick (high velocity, low distance) should dismiss. A slow drag past halfway (low velocity, high distance) should also dismiss. Velocity captures user intent better.

## Rule 5: CSS Transitions for Interruptible Animations

Use CSS transitions (not `@keyframes`) for animations that users can interrupt mid-flight. CSS transitions automatically interpolate from the current value when re-triggered:

```css
.panel {
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

`@keyframes` restart from the beginning, causing jarring jumps.

## Performance Checklist

- [ ] 60fps on scroll (Chrome DevTools Performance)
- [ ] Tested on low-end devices
- [ ] No continuous animations without purpose
- [ ] `will-change` applied/removed dynamically, not permanent
- [ ] No layout property animations
- [ ] Drag uses direct style, not CSS variables
- [ ] ScrollTrigger markers removed in production
