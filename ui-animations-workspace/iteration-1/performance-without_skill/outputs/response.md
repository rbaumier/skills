# Response: Performance Best Practices for Scroll Animations & Drag

## Scroll Animations

1. **Use `transform` instead of layout properties** -- Animating `top`, `left`, `width`, `height` triggers layout recalculations. Use `transform: translate()` instead.

2. **Use `will-change`** -- Add `will-change: transform` to elements that will be animated to hint the browser to optimize.

3. **Debounce scroll handlers** -- Don't run expensive calculations on every scroll event.

4. **Use `requestAnimationFrame`** -- For smooth, browser-synced updates.

5. **Virtual scrolling** for long lists -- Only render visible items.

## Drag Interactions

1. **Use `transform` for positioning** -- Don't change `top`/`left`.

2. **Set `touch-action: none`** on draggable elements to prevent scroll interference.

3. **Use pointer events** instead of mouse events for cross-device support.

```tsx
const handleDrag = (e: PointerEvent) => {
  requestAnimationFrame(() => {
    element.style.transform = `translate(${x}px, ${y}px)`;
  });
};
```

## General Tips

- Test on low-end devices
- Use Chrome DevTools Performance panel
- Keep animations at 60fps
- Avoid animating too many elements simultaneously
- Use CSS `contain` for layout isolation
