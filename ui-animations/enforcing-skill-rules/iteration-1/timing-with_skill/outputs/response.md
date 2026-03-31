# Response: Timing & Easing for SaaS Dashboard

## Hover Effects

Use **120-180ms** for hover/press feedback. This is the sweet spot -- fast enough to feel instant, slow enough to register visually.

**Critical**: Only animate `transform` and `opacity` (GPU-accelerated properties). Never animate `background-color`, `box-shadow`, or layout properties directly.

Use custom Bezier curves, not built-in `ease` or `ease-in-out`:

```css
/* Snappy hover -- custom curve */
.button {
  transition: transform 150ms cubic-bezier(0.87, 0, 0.13, 1),
              opacity 150ms cubic-bezier(0.87, 0, 0.13, 1);
}

.button:active {
  transform: scale(0.97); /* Scale range: 0.95-1.05, never from 0 */
}
```

## Page Transitions

Page transitions should use **500-800ms** with a smooth ease-out curve:

```tsx
<motion.div
  key={pathname}
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} // Custom smooth curve
>
  {children}
</motion.div>
```

## Duration Reference

| Context | Duration |
|---------|----------|
| Hover/press feedback | 120-180ms |
| Small state changes | 180-260ms |
| UI transitions | 300-500ms |
| Page transitions | 500-800ms |
| Stagger per item | max 50ms |

## Key Rules

- **No linear easing** for motion -- linear feels mechanical and robotic. Use ease-out for entrances, ease-in for exits.
- **Custom Bezier curves** over defaults: `[0.16, 1, 0.3, 1]` (smooth), `[0.87, 0, 0.13, 1]` (snappy).
- **Scale deformation**: Stay within 0.95-1.05 range. Never scale from 0 -- use 0.9+ minimum to avoid the "popping from nothing" effect.
- **Springs** for interactive/gesture-driven elements (interruptible, velocity-preserving).
- Use `will-change` sparingly -- apply before animation, remove after.
