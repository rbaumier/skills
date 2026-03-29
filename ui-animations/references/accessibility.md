# Accessibility

**This is not optional.** Motion can cause discomfort, nausea, or distraction for many users.

---

## Respect User Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**What this does**: Effectively disables animations while preserving final states (so layouts don't break).

---

## Functional vs. Decorative Motion

| Type | Purpose | Reduced Motion Behavior |
|------|---------|------------------------|
| **Functional** | Indicates state changes, spatial relationships, orientation | May need alternative (instant state change, no transition) |
| **Decorative** | Pure delight, visual interest | Can be fully removed |

**The test**: Does removing this animation break the user's ability to understand what happened? If yes, it's functional.

---

## When NOT to Animate

Some interactions must be instant. Animation in these contexts adds latency without value.

### No Animation for High-Frequency Interactions
If users trigger this action hundreds of times per session, remove the animation entirely.

```tsx
// INCORRECT: animated on every keystroke
function SearchInput() {
  return (
    <motion.div animate={{ scale: [1, 1.02, 1] }}>
      <input onChange={handleSearch} />
    </motion.div>
  );
}

// CORRECT: no animation
function SearchInput() {
  return <input onChange={handleSearch} />;
}
```

### No Animation for Keyboard Navigation
Keyboard shortcuts and focus navigation should be instant. Animation here penalizes power users and accessibility tool users.

```tsx
// INCORRECT: animated focus movement
function Menu() {
  return items.map(item => (
    <motion.li
      whileFocus={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
    />
  ));
}

// CORRECT: CSS focus-visible only, no motion
function Menu() {
  return items.map(item => (
    <li className={styles.menuItem} />
  ));
}
```

### No Entrance Animation for Context Menus
Context menus should appear instantly. Users expect immediate response to right-click. Exit animations are acceptable.

```tsx
// INCORRECT: entrance animation on context menu
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0 }}
/>

// CORRECT: exit only, no entrance
<motion.div exit={{ opacity: 0, scale: 0.95 }} />
```

---

## Cognitive Load & Staging

Animation affects cognitive load. Poorly staged animations split attention and increase confusion.

### Single Focal Point
Only one element should animate prominently at a time. Competing animations split attention and reduce clarity.

```tsx
// INCORRECT: two elements competing for attention
<motion.div animate={{ scale: 1.1 }} />
<motion.div animate={{ scale: 1.1 }} />

// CORRECT: one focal point, others remain neutral
<motion.div animate={{ scale: 1.1 }} />
<motion.div animate={{ scale: 1 }} />
```

### Dim Background for Focus
Modal/dialog backgrounds should dim to direct focus. Transparent overlays fail to isolate the modal from surrounding content.

```css
/* INCORRECT: transparent overlay */
.overlay { background: transparent; }

/* CORRECT: dimmed overlay */
.overlay { background: var(--black-a6); }
```

### Z-Index Layering for Animated Elements
Animated elements (tooltips, popovers, modals) must respect z-index layering. Missing z-index causes them to render behind other content.

```css
/* INCORRECT: no z-index, may render behind other elements */
.tooltip { /* ... */ }

/* CORRECT: explicit z-index */
.tooltip { z-index: 50; }
```

---

## Motion Sensitivity Considerations

- Avoid large-scale motion (full-screen transitions, parallax)
- Avoid continuous or looping animations that can't be paused
- Provide pause controls for any ambient animation
- Be especially careful with vestibular triggers: zooming, spinning, parallax

---

## Touch & Pointer Accessibility

### Minimum Hit Areas
Interactive elements must have at least **44px** touch target (WCAG 2.5.8). Use pseudo-elements to expand hit area without affecting visual size:
```css
.small-button {
  position: relative;
}
.small-button::after {
  content: '';
  position: absolute;
  inset: -8px; /* expand to meet 44px minimum */
}
```

### Hover on Touch Devices
Hover effects should only apply to devices with a real pointer. Touch devices emulate hover on tap, causing sticky/unexpected states:
```css
@media (hover: hover) and (pointer: fine) {
  .element:hover {
    transform: scale(1.05);
  }
}
```

---

## Implementation Checklist

- [ ] Tested with `prefers-reduced-motion: reduce` enabled
- [ ] No vestibular triggers (excessive zoom, spin, parallax)
- [ ] Looping animations can be paused
- [ ] Functional animations have non-motion alternatives
- [ ] Users can complete all tasks with animations disabled
- [ ] Touch targets are at least 44px (use pseudo-elements if needed)
- [ ] Hover effects gated behind `@media (hover: hover) and (pointer: fine)`
- [ ] High-frequency interactions have no animation
- [ ] Keyboard navigation is instant (no motion on focus)
- [ ] Context menus have no entrance animation (exit only)
- [ ] Only one element animates prominently at a time (single focal point)
- [ ] Modals/dialogs dim background for focus isolation
- [ ] Animated overlays have explicit z-index layering
