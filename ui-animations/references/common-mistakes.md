# Common Mistakes

---

## From Emil's Perspective (Purposeful Restraint)

- **Animating high-frequency interactions** — If users trigger this 100s of times daily, remove the animation
- **Animating keyboard-initiated actions** — Keyboard shortcuts should NEVER animate
- **Animations over 300ms** — UI animations should be under 300ms; 180ms feels more responsive than 400ms
- **Animating from scale(0)** — Start from `scale(0.9)` or higher for natural motion
- **Same tooltip behavior everywhere** — First tooltip: delayed + animated. Subsequent: instant
- **Using default CSS easing** — Built-in `ease` and `ease-in-out` lack strength; use custom curves
- **Ignoring transform-origin** — Dropdowns should expand from their trigger, not center
- **Expecting delight in productivity tools** — Users of high-frequency tools prioritize speed over delight
- **Using keyframes for interruptible animations** — Keyframes can't retarget mid-flight; use CSS transitions with state
- **CSS variables for frequent updates** — Causes expensive style recalculation; update styles directly on element
- **Distance thresholds for dismissal** — Use velocity (distance/time) instead; fast short gestures should work
- **Abrupt boundary stops** — Use damping; things slow down before stopping in real life

---

## From Jakub's Perspective (Production Polish)

- **Making enter and exit animations equally prominent** — Exits should be subtler
- **Using solid borders when shadows would adapt better** — Especially on varied backgrounds
- **Forgetting optical alignment** — Buttons with icons, play buttons, asymmetric shapes
- **Over-animating** — If users notice the animation itself, it's too much
- **Using the same animation everywhere** — Context should drive timing and easing choices
- **Ignoring hover state transitions** — Even small transitions (150-200ms) feel more polished than instant changes

---

## From Jhey's Perspective (Creative Learning)

- **Filtering ideas based on "usefulness" too early** — Make first, judge later
- **Not documenting random creative sparks** — Keep notebooks everywhere, including by your bed
- **Thinking CSS art is useless** — It teaches real skills (clip-path, layering, complex shapes)
- **Focusing on "How do I learn X?" instead of "How do I make Y?"** — Let ideas drive learning
- **Following tutorials without experimenting** — Tutorials teach techniques; experimentation teaches problem-solving
- **Giving up when something doesn't work** — The struggle is where learning happens

---

## Exit Animation Pitfalls (AnimatePresence)

- **Missing AnimatePresence wrapper** — Conditional motion elements without wrapper silently skip exit animations
- **Missing exit prop** — Elements inside AnimatePresence without `exit` defined won't animate out
- **Using index as key** — Dynamic lists need stable unique keys; index causes wrong elements to animate
- **Asymmetric exit/initial** — Exit should mirror initial for visual symmetry (unless intentionally subtler)

```tsx
// BAD: No AnimatePresence wrapper — exit never fires
{isVisible && (
  <motion.div exit={{ opacity: 0 }} />
)}

// GOOD: Wrapped in AnimatePresence
<AnimatePresence>
  {isVisible && (
    <motion.div exit={{ opacity: 0 }} />
  )}
</AnimatePresence>
```

```tsx
// BAD: Missing exit prop inside AnimatePresence
<AnimatePresence>
  {isOpen && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
  )}
</AnimatePresence>

// GOOD: exit prop defined
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

```tsx
// BAD: Index as key — wrong items animate on removal
<AnimatePresence>
  {items.map((item, index) => (
    <motion.div key={index} exit={{ opacity: 0 }} />
  ))}
</AnimatePresence>

// GOOD: Stable unique key
<AnimatePresence>
  {items.map((item) => (
    <motion.div key={item.id} exit={{ opacity: 0 }} />
  ))}
</AnimatePresence>
```

```tsx
// BAD: Asymmetric exit (unrelated to entrance)
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ scale: 0 }}
/>

// GOOD: Symmetric exit mirrors initial
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 20 }}
/>
```

---

## Presence Pitfalls (usePresence / useIsPresent)

- **useIsPresent called in parent** — Must be called from the child component inside AnimatePresence, not the parent
- **Missing safeToRemove** — When using `usePresence` with async cleanup, always call `safeToRemove()` or the element leaks
- **Clickable during exit** — Disable interactions on exiting elements using `isPresent`

```tsx
// BAD: useIsPresent in parent — always returns true
function Parent() {
  const isPresent = useIsPresent();
  return (
    <AnimatePresence>
      {show && <Child />}
    </AnimatePresence>
  );
}

// GOOD: useIsPresent in child
function Child() {
  const isPresent = useIsPresent();
  return <motion.div data-exiting={!isPresent} />;
}
```

```tsx
// BAD: Missing safeToRemove — element never unmounts
function AsyncComponent() {
  const [isPresent, safeToRemove] = usePresence();
  useEffect(() => {
    if (!isPresent) {
      cleanup();
    }
  }, [isPresent]);
}

// GOOD: safeToRemove called after async work
function AsyncComponent() {
  const [isPresent, safeToRemove] = usePresence();
  useEffect(() => {
    if (!isPresent) {
      cleanup().then(safeToRemove);
    }
  }, [isPresent, safeToRemove]);
}
```

```tsx
// BAD: Button still clickable during exit animation
function Card() {
  const isPresent = useIsPresent();
  return <button onClick={handleClick}>Click</button>;
}

// GOOD: Disabled during exit
function Card() {
  const isPresent = useIsPresent();
  return (
    <button onClick={handleClick} disabled={!isPresent}>
      Click
    </button>
  );
}
```

---

## AnimatePresence Mode Pitfalls

- **`mode="wait"` doubles perceived duration** — Exit plays fully before enter starts; halve your timing values
- **`mode="sync"` causes layout conflicts** — Exiting and entering elements compete for space; use `popLayout` instead
- **Default mode for lists** — Use `popLayout` for list reordering to prevent layout shifts

```tsx
// BAD: mode="wait" with normal duration feels sluggish
<AnimatePresence mode="wait">
  <motion.div transition={{ duration: 0.3 }} />
</AnimatePresence>

// GOOD: Halved timing for "wait" mode
<AnimatePresence mode="wait">
  <motion.div transition={{ duration: 0.15 }} />
</AnimatePresence>
```

```tsx
// BAD: Default mode causes layout shifts in lists
<AnimatePresence>
  {items.map(item => <ListItem key={item.id} />)}
</AnimatePresence>

// GOOD: popLayout prevents shifts
<AnimatePresence mode="popLayout">
  {items.map(item => <ListItem key={item.id} />)}
</AnimatePresence>
```

---

## Nested AnimatePresence Pitfalls

- **Missing `propagate` prop** — Without it, inner AnimatePresence children vanish instantly when parent exits
- **Uncoordinated parent-child timing** — Parent must not exit faster than its children

```tsx
// BAD: Children vanish instantly when parent exits
<AnimatePresence>
  {isOpen && (
    <motion.div exit={{ opacity: 0 }}>
      <AnimatePresence>
        {items.map(item => (
          <motion.div key={item.id} exit={{ scale: 0 }} />
        ))}
      </AnimatePresence>
    </motion.div>
  )}
</AnimatePresence>

// GOOD: propagate on both for coordinated exits
<AnimatePresence propagate>
  {isOpen && (
    <motion.div exit={{ opacity: 0 }}>
      <AnimatePresence propagate>
        {items.map(item => (
          <motion.div key={item.id} exit={{ scale: 0 }} />
        ))}
      </AnimatePresence>
    </motion.div>
  )}
</AnimatePresence>
```

```tsx
// BAD: Parent exits faster than children
<motion.div exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
  <motion.div exit={{ scale: 0 }} transition={{ duration: 0.5 }} />
</motion.div>

// GOOD: Coordinated timing (parent >= children)
<motion.div exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
  <motion.div exit={{ scale: 0 }} transition={{ duration: 0.15 }} />
</motion.div>
```

---

## Container Animation Pitfalls

- **Measuring and animating same element** — Creates a feedback loop; use the two-div pattern
- **Animating from zero on initial render** — Guard against bounds being 0 on mount
- **Using getBoundingClientRect on every render** — Use ResizeObserver instead to avoid layout thrashing
- **Missing overflow: hidden** — Content overflows during size transitions
- **Using useRef for measurement** — Callback ref guarantees the node is ready when observer attaches

```tsx
// BAD: Measure and animate same element — feedback loop
function AnimatedContainer({ children }) {
  const [ref, bounds] = useMeasure();
  return (
    <motion.div ref={ref} animate={{ height: bounds.height }}>
      {children}
    </motion.div>
  );
}

// GOOD: Two-div pattern — separate measure and animate
function AnimatedContainer({ children }) {
  const [ref, bounds] = useMeasure();
  return (
    <motion.div animate={{ height: bounds.height }} style={{ overflow: "hidden" }}>
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}
```

```tsx
// BAD: Animates from 0 on mount
<motion.div animate={{ width: bounds.width }}>
  <div ref={ref}>{children}</div>
</motion.div>

// GOOD: Falls back to auto on first frame
<motion.div animate={{ width: bounds.width > 0 ? bounds.width : "auto" }}>
  <div ref={ref}>{children}</div>
</motion.div>
```

---

## General Motion Design Mistakes

- **Animating layout-triggering properties** (width, height, top, left) — Use transform instead
- **No animation at all** — Instant state changes feel broken to modern users
- **Same duration for all animations** — Smaller elements should animate faster
- **Forgetting `prefers-reduced-motion`** — Not optional
- **Hover causes flicker** — Animate the child element, not the parent. When the parent scales/moves on hover, the cursor leaves the hit area, triggering a leave/enter loop

*Note: Duration is designer-dependent. Emil prefers under 300ms for productivity tools. Jakub and Jhey may use longer durations when polish or effect warrants it.*

---

## Red Flags in Code Review

Watch for these patterns:

```jsx
// BAD: Animating layout properties
animate={{ width: 200, height: 100 }}

// GOOD: Use transform
animate={{ scale: 1.2 }}
```

```jsx
// BAD: Same animation for enter and exit
initial={{ opacity: 0, y: 20 }}
exit={{ opacity: 0, y: 20 }}

// GOOD: Subtler exit
initial={{ opacity: 0, y: 20 }}
exit={{ opacity: 0, y: -8 }}
```

```css
/* BAD: No reduced motion support */
.animated { animation: bounce 1s infinite; }

/* GOOD: Respects user preference */
@media (prefers-reduced-motion: no-preference) {
  .animated { animation: bounce 1s infinite; }
}
```

```css
/* BAD: will-change everywhere */
* { will-change: transform; }

/* GOOD: Targeted will-change */
.animated-button { will-change: transform, opacity; }
```

```jsx
// BAD: Animating from scale(0) (Emil)
initial={{ scale: 0 }}
animate={{ scale: 1 }}

// GOOD: Start from higher scale
initial={{ scale: 0.9, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
```

```jsx
// Per Emil: Too slow for productivity UI
transition={{ duration: 0.4 }}

// Per Emil: Fast, snappy (but Jakub/Jhey might use 0.4 for polish)
transition={{ duration: 0.18 }}
```

```css
/* BAD: Dropdown expanding from center (Emil) */
.dropdown {
  transform-origin: center;
}

/* GOOD: Origin-aware animation */
.dropdown {
  transform-origin: top center;
}
```

```css
/* BAD: Keyframes can't be interrupted (Emil) */
@keyframes slideIn {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.toast { animation: slideIn 400ms ease; }

/* GOOD: Transitions can retarget mid-flight */
.toast {
  transform: translateY(100%);
  transition: transform 400ms ease;
}
.toast.mounted {
  transform: translateY(0);
}
```

```css
/* BAD: Hover on parent causes flicker (cursor leaves hit area on scale) */
.card:hover {
  transform: scale(1.05);
}

/* GOOD: Animate a child element instead */
.card:hover .card-inner {
  transform: scale(1.05);
}
```

```javascript
// BAD: CSS variables cause cascade recalc (Emil)
element.style.setProperty('--drag-y', `${y}px`);

// GOOD: Direct style update
element.style.transform = `translateY(${y}px)`;
```

```javascript
// BAD: Distance threshold for dismissal (Emil)
if (dragDistance > 100) dismiss();

// GOOD: Velocity-based (fast short gestures work)
const velocity = dragDistance / elapsedTime;
if (velocity > 0.11) dismiss();
```
