# Advanced Browser APIs

Techniques that push interfaces beyond conventional limits. Each requires progressive enhancement.

## View Transitions: Same-Document Morphing

Shared-element morphing between UI states (button -> dialog, list item -> detail).

```ts
// Morph a card into a detail view
card.style.viewTransitionName = "hero";
document.startViewTransition(() => {
  card.style.viewTransitionName = "";
  detail.style.viewTransitionName = "hero";
  detail.hidden = false;
});
```

## `@starting-style`: Entry Animations from `display: none`

Animate elements appearing without JS. Works with `dialog`, `popover`, conditional rendering.

```css
dialog[open] {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 300ms, transform 300ms, display 300ms allow-discrete;

  @starting-style {
    opacity: 0;
    transform: translateY(8px);
  }
}
```

## Scroll-Driven Animations

CSS-only parallax, progress bars, scroll-linked reveals. No JS, no scroll listeners.

```css
.progress-bar {
  animation: grow-width linear;
  animation-timeline: scroll();
}

@keyframes grow-width {
  from { width: 0; }
  to   { width: 100%; }
}

/* Always provide static fallback */
@supports not (animation-timeline: scroll()) {
  .progress-bar { width: 100%; }
}
```

View-timeline for element-scoped triggers:

```css
.reveal {
  animation: fade-in linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

Browser support: Chrome/Edge/Safari. Firefox: flag only.

## `@property`: Animating Gradients and Custom Properties

CSS cannot interpolate gradients natively. Register a typed custom property to enable it.

```css
@property --gradient-pos {
  syntax: "<percentage>";
  initial-value: 0%;
  inherits: false;
}

.shimmer {
  background: linear-gradient(90deg, transparent, white var(--gradient-pos), transparent);
  transition: --gradient-pos 600ms ease-out;
}
.shimmer:hover { --gradient-pos: 100%; }
```

Works for animating: `<color>`, `<length>`, `<angle>`, `<percentage>`, `<number>`.

## Spring Physics vs Cubic-Bezier

| Use | When |
|-----|------|
| **Cubic-bezier** | Fixed-duration, predictable (menus, tooltips, fades) |
| **Spring** | Interruptible, velocity-aware, physical feel (dragging, dialogs, gesture-driven) |

Springs have no fixed duration -- they settle naturally based on mass/tension/damping. Use when:
- Animation can be interrupted mid-flight (drag release, repeated clicks)
- Element should "catch up" to a moving target
- You want overshoot that feels physical, not decorative

Libraries: `motion` (React), GSAP, or a ~20-line spring solver for vanilla JS.

## Virtual Scrolling

Render only visible rows for massive datasets. DOM stays small regardless of data size.

```tsx
// TanStack Virtual -- handles variable row heights, horizontal, grid
import { useVirtualizer } from "@tanstack/react-virtual";

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
});

// Render only virtualizer.getVirtualItems() -- not all items
```

When to use: >500 items in a scrollable list/table. Below that, DOM is fine.

## Progressive Enhancement Pattern

```css
/* Baseline: works everywhere */
.card { opacity: 1; }

/* Enhancement: only if supported */
@supports (animation-timeline: scroll()) {
  .card {
    animation: reveal linear both;
    animation-timeline: view();
  }
}
```

```ts
// JS feature detection
if (document.startViewTransition) {
  document.startViewTransition(() => updateDOM());
} else {
  updateDOM(); // instant swap, still functional
}
```

## Performance Rules for Advanced Effects

- **60fps or simplify.** If dropping below 50fps on mid-range devices, reduce complexity.
- **Pause off-screen.** `IntersectionObserver` to start/stop animations outside viewport.
- **Lazy-init heavy resources.** WebGL contexts, large virtualizers -- create when near viewport.
- **`prefers-reduced-motion`**: replace spatial motion with opacity fades. Non-negotiable.
- **Test on real hardware.** Your M-series Mac lies to you about performance.
