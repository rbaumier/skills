# Timing, Easing & Testing

## Duration Thresholds

- **Hover/press feedback**: 120-180ms
- **User-initiated transitions**: 300ms max
- **Small state changes**: 180-260ms
- **UI transitions**: 300-500ms
- **Page transitions**: 500-800ms
- **Stagger per item**: max 50ms

## Easing Cross-Library

| Feel | GSAP | Motion |
|------|------|--------|
| Smooth | `power2.out` | `[0.16, 1, 0.3, 1]` |
| Snappy | `power4.out` | `[0.87, 0, 0.13, 1]` |
| Bouncy | `back.out(1.7)` | `{ type: 'spring', stiffness: 300, damping: 20 }` |
| Dramatic | `power4.inOut` | `[0.76, 0, 0.24, 1]` |

## Core Principles

- Only animate `transform` and `opacity` (GPU-accelerated)
- Use `will-change` sparingly -- apply before animation, remove after
- Easing: ease-out for entrances, ease-in for exits, no linear for motion
- Springs for gestures, interruptible motion, velocity preservation
- Scale deformation range: 0.95-1.05 (never from 0)

## Enter Animation Recipe (Jakub)

```jsx
initial={{ opacity: 0, translateY: 8, filter: "blur(4px)" }}
animate={{ opacity: 1, translateY: 0, filter: "blur(0px)" }}
transition={{ type: "spring", duration: 0.45, bounce: 0 }}
```

## The Golden Rule

> "The best animation is that which goes unnoticed."

Exception: kids apps and playful contexts where delight IS the goal.

## Testing Checklist

- [ ] 60fps on scroll (Chrome DevTools Performance)
- [ ] Keyboard navigation works
- [ ] Respects `prefers-reduced-motion`
- [ ] No layout shifts (CLS)
- [ ] Mobile touch works
- [ ] ScrollTrigger markers removed in prod
- [ ] No memory leaks on unmount
- [ ] `contextSafe()` used for GSAP event handlers
- [ ] `'use client'` added in Next.js App Router
- [ ] `ScrollTrigger.refresh()` called after dynamic content
- [ ] Tested on low-end devices
- [ ] Sound has visual equivalent and toggle setting
