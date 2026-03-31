# Response: Timing & Easing for SaaS Dashboard

For hover effects on a SaaS dashboard, I'd recommend using CSS transitions with a duration of around **200-300ms** and `ease-in-out` easing. This gives a smooth, professional feel.

For page transitions, you can use **300-500ms** with a standard `ease` curve. Here's an example:

```css
.button:hover {
  background-color: #3b82f6;
  transition: background-color 0.25s ease-in-out;
}
```

For page transitions with React, you can use Framer Motion:

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  {children}
</motion.div>
```

Some tips:
- Keep animations short so they don't feel sluggish
- Use `ease-in-out` for most transitions
- Consider using `transform: scale()` for interactive feedback, like scaling a button down to `scale(0.95)` on click
- Make sure animations work well on mobile devices too
