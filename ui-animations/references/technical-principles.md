# Technical Principles

---

## 1. Enter & Exit Animations

### Enter Animation Recipe (Jakub)
A standard enter animation combines three properties:
- **Opacity**: 0 → 1
- **TranslateY**: ~8px → 0 (or calc(-100% - 4px) for full container slides)
- **Blur**: 4px → 0px

```jsx
initial={{ opacity: 0, translateY: "calc(-100% - 4px)", filter: "blur(4px)" }}
animate={{ opacity: 1, translateY: 0, filter: "blur(0px)" }}
transition={{ type: "spring", duration: 0.45, bounce: 0 }}
```

**Why blur?** It creates a "materializing" effect that feels more physical than opacity alone. The element appears to come into focus, not just fade in.

### Exit Animation Subtlety (Jakub)
**Key Insight**: Exit animations should be subtler than enter animations.

When a component exits, it doesn't need the same amount of movement or attention as when entering. The user's focus is moving to what comes next, not what's leaving.

```jsx
// Instead of full exit movement:
exit={{ translateY: "calc(-100% - 4px)" }}

// Use a subtle fixed value:
exit={{ translateY: "-12px", opacity: 0, filter: "blur(4px)" }}
```

**Why this works**: Exits become softer, less jarring, and don't compete for attention with whatever is entering or remaining.

**When NOT to use subtle exits**:
- When the exit itself is meaningful (user-initiated dismissal)
- When you need to emphasize something leaving (error clearing, item deletion)
- Full-page transitions where directional continuity matters

### Fill Mode for Persistence (Jhey)
Use `animation-fill-mode` to prevent jarring visual resets:
- `forwards`: Element retains animation styling after completion
- `backwards`: Element retains style from first keyframe before animation starts
- `both`: Retains styling in both directions

**Critical for**: Fade-in sequences with delays. Without `backwards`, elements flash at full opacity before their delayed animation starts, then pop to invisible, then fade in.

---

## 2. Easing & Timing

### Duration Impacts Naturalness
> "Duration is all about timing, and timing has a big impact on the movement's naturalness." — Jhey Tompkins

### Duration Rules

| Context | Duration | Example |
|---------|----------|---------|
| **User-initiated actions** | Max 300ms | Button press, toggle, dropdown open |
| **Press & hover feedback** | 120-180ms | `:hover` background, `:active` scale |
| **Small state changes** | 180-260ms | Toggle switch, checkbox, icon swap |
| **If it feels slow** | Shorten duration first | Before tweaking easing curves |

**Consistent timing**: Similar elements must use identical timing values.

```css
/* INCORRECT: inconsistent timing across similar elements */
.button-primary { transition: 200ms; }
.button-secondary { transition: 150ms; }

/* CORRECT: consistent timing */
.button-primary { transition: 200ms; }
.button-secondary { transition: 200ms; }
```

**Shorten duration before adjusting curve**: If an animation feels slow, reduce the duration first — do not reach for exotic easing curves.

```css
/* INCORRECT: compensating with curve */
.element { transition: 400ms cubic-bezier(0, 0.9, 0.1, 1); }

/* CORRECT: shorter duration */
.element { transition: 200ms ease-out; }
```

### Custom Easing is Essential (Emil)
> "Easing is the most important part of any animation. It can make a bad animation feel great."

Built-in CSS easing (`ease`, `ease-in-out`) lacks strength. Always use custom Bézier curves for professional results. Resources: easing.dev, easings.co

### Easing Selection Guidelines (Jhey)
Each easing curve communicates something to the viewer. **Context matters more than rules.**

| Easing | Feel | Good For |
|--------|------|----------|
| `ease-out` | Fast start, gentle stop | **Entrances** — elements arriving into view |
| `ease-in` | Gentle start, fast exit | **Exits** — elements departing from view |
| `ease-in-out` | Gentle both ends | **State transitions** — view/mode transitions, elements changing while visible |
| `linear` | Constant speed | **Progress only** — progress bars, timers. Never for motion |
| `spring` | Natural deceleration | **Interactive elements** — gestures, interruptible, professional UI |

### Easing Concrete Rules

**Entrances MUST use ease-out** (arrive fast, settle gently):
```css
/* INCORRECT */
.modal-enter { animation-timing-function: ease-in; }

/* CORRECT */
.modal-enter { animation-timing-function: ease-out; }
```

**Exits MUST use ease-in** (build momentum before departure):
```css
/* INCORRECT */
.modal-exit { animation-timing-function: ease-out; }

/* CORRECT */
.modal-exit { animation-timing-function: ease-in; }
```

**No linear easing for motion** — linear feels mechanical; reserve for progress indicators:
```css
/* INCORRECT */
.card-slide { transition: transform 200ms linear; }

/* CORRECT — linear for progress only */
.progress-bar { transition: width 100ms linear; }
```

**System-initiated state changes use easing curves** (not springs):
```tsx
// INCORRECT: spring for system announcement
<motion.div animate={{ y: 0 }} transition={{ type: "spring" }} />

// CORRECT: easing for system announcement
<motion.div animate={{ y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} />
```

**The Context Rule**:
> "You wouldn't use 'Elastic' for a bank's website, but it might work perfectly for an energetic site for children."

Brand personality should drive easing choices. A playful brand can use bouncy, elastic easing. A professional brand should use subtle springs or ease-out.

**When NOT to use bouncy/elastic easing**:
- Professional/enterprise applications
- Frequently repeated interactions (gets tiresome)
- Error states or serious UI
- When users need to complete tasks quickly

### Spring Animations (Jakub)
Prefer spring animations over linear/ease for more natural-feeling motion:
```jsx
transition={{ type: "spring", duration: 0.45, bounce: 0 }}
transition={{ type: "spring", duration: 0.55, bounce: 0.1 }}
```

**Why `bounce: 0`?** It gives smooth deceleration without overshoot—professional and refined. Reserve bounce > 0 for playful contexts.

### The linear() Function (Jhey)
CSS `linear()` enables bounce, elastic, and spring effects in pure CSS:
```css
:root {
  --bounce-easing: linear(
    0, 0.004, 0.016, 0.035, 0.063, 0.098, 0.141 13.6%, 0.25, 0.391, 0.563, 0.765,
    1, 0.891 40.9%, 0.848, 0.813, 0.785, 0.766, 0.754, 0.75, 0.754, 0.766, 0.785,
    0.813, 0.848, 0.891 68.2%, 1 72.7%, 0.973, 0.953, 0.941, 0.938, 0.941, 0.953,
    0.973, 1, 0.988, 0.984, 0.988, 1
  );
}
```

Use Jake Archibald's linear() generator for custom curves: https://linear-easing-generator.netlify.app/

### Stagger Techniques (Jhey)
`animation-delay` only applies once (not per iteration). Approaches:

1. **Different delays with finite iterations** — Works for one-time sequences
2. **Pad keyframes** to create stagger within the animation:
```css
@keyframes spin {
  0%, 50% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

3. **Negative delays** for "already in progress" effects:
```css
.element { animation-delay: calc(var(--index) * -0.2s); }
```
This makes animations appear mid-flight from the start—useful for staggered continuous animations.

---

## 3. Visual Effects

### Shadows Instead of Borders (Jakub)
In light mode, prefer subtle multi-layer box-shadows over solid borders:
```css
.card {
  box-shadow:
    0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 2px -1px rgba(0, 0, 0, 0.06),
    0px 2px 4px 0px rgba(0, 0, 0, 0.04);
}

/* Slightly darker on hover */
.card:hover {
  box-shadow:
    0px 0px 0px 1px rgba(0, 0, 0, 0.08),
    0px 1px 2px -1px rgba(0, 0, 0, 0.08),
    0px 2px 4px 0px rgba(0, 0, 0, 0.06);
}
```

**Why shadows over borders?**
- Shadows adapt to any background (images, gradients, varied colors) because they use transparency
- Borders are solid colors that may clash with dynamic backgrounds
- Multi-layer shadows create depth; single borders feel flat
- Shadows can be transitioned smoothly with `transition: box-shadow`

**When borders are fine**:
- Dark mode (shadows less visible anyway)
- When you need hard edges intentionally
- Simple interfaces where depth isn't needed

### Gradients & Color Spaces (Jakub)
- Use `oklch` for gradients to avoid muddy midpoints:
```css
element { background: linear-gradient(in oklch, blue, red); }
```

- **Color hints** control where the blend midpoint appears (different from color stops)
- Layer gradients with `background-blend-mode` for unique effects

**Why oklch?** It interpolates through perceptually uniform color space, avoiding the gray/muddy zone that sRGB hits when blending complementary colors.

### Blur as a Signal (Jakub)
Blur (via `filter: blur()`) combined with opacity and translate creates a "materializing" effect. Use blur to signal:
- **Entering focus**: blur → sharp
- **Losing relevance**: sharp → blur
- **State transitions**: blur during, sharp after

---

## 4. Optical Alignment

### Geometric vs. Optical (Jakub)
> "Sometimes it's necessary to break out of geometric alignment to make things feel visually balanced."

**Buttons with icons**: Reduce padding on the icon side so content appears centered:
```
[  Icon Text  ] ← Geometric (mathematically centered, feels off)
[ Icon Text   ] ← Optical (visually centered, feels right)
```

**Play button icons**: The triangle points right, creating visual weight on the left. Shift it slightly right to appear centered.

**Icons in general**: Many icon packs account for optical balance, but asymmetric shapes (arrows, play, chevrons) may need manual margin/padding adjustment.

**The rule**: If it looks wrong despite being mathematically correct, trust your eyes and adjust.

---

## 5. Icon & State Animations (Jakub)

### Contextual Icon Transitions
When icons change contextually (copy → check, loading → done), animate:
- Opacity
- Scale
- Blur

```jsx
<AnimatePresence mode="wait">
  {isCopied ? (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
    >
      <CheckIcon />
    </motion.div>
  ) : (
    <motion.div ...>
      <CopyIcon />
    </motion.div>
  )}
</AnimatePresence>
```

**Why animate icon swaps?** Instant swaps feel jarring and can be missed. Animated transitions:
- Draw attention to the state change
- Feel responsive and polished
- Give the user confidence their action registered

---

## 6. Shared Layout Animations (Jakub)

### FLIP Technique via layoutId
Motion's `layoutId` prop enables smooth transitions between completely different components:
```jsx
// In one location:
<motion.div layoutId="card" className="small-card" />

// In another location:
<motion.div layoutId="card" className="large-card" />
```

Motion automatically animates between them using the FLIP technique (First, Last, Inverse, Play).

### Best Practices
- Keep elements with `layoutId` **outside** of `AnimatePresence` to avoid conflicts
- If inside `AnimatePresence`, the initial/exit animations will trigger during layout animation (looks bad with opacity)
- Multiple elements can animate if each has a unique `layoutId`
- Works for different heights, widths, positions, and even component types (card → modal)

---

## 7. CSS Custom Properties & @property (Jhey)

### Type Specification Unlocks Animation
The `@property` rule lets you declare types for CSS variables, enabling smooth interpolation:

```css
@property --hue {
  initial-value: 0;
  inherits: false;
  syntax: '<number>';
}

@keyframes rainbow {
  to { --hue: 360; }
}
```

**Available types**: length, number, percentage, color, angle, time, integer, transform-list

**Why this matters**: Without `@property`, CSS sees custom properties as strings. Strings can't interpolate—they just swap. With a declared type, the browser knows how to smoothly transition between values.

### Decompose Complex Transforms
Instead of animating a monolithic transform (which can't interpolate curved paths), split into typed properties:

```css
@property --x { syntax: '<percentage>'; initial-value: 0%; inherits: false; }
@property --y { syntax: '<percentage>'; initial-value: 0%; inherits: false; }

.ball {
  transform: translateX(var(--x)) translateY(var(--y));
  animation: throw 1s;
}

@keyframes throw {
  0% { --x: -500%; }
  50% { --y: -250%; }
  100% { --x: 500%; }
}
```

This creates curved motion paths that would be impossible with standard transform animation—the ball arcs through space rather than moving in straight lines.

### Scoped Variables for Dynamic Behavior (Jhey)
CSS custom properties respect scope, enabling powerful patterns:
```css
.item { --delay: 0; animation-delay: calc(var(--delay) * 100ms); }
.item:nth-child(1) { --delay: 0; }
.item:nth-child(2) { --delay: 1; }
.item:nth-child(3) { --delay: 2; }
```

Use scoped variables to create varied behavior from a single animation definition.

---

## 8. 3D CSS (Jhey)

### Think in Cuboids
> "Think in cubes instead of boxes" — Jhey Tompkins

Complex 3D scenes are assemblies of cube-shaped elements (like LEGO). Decompose any 3D object into cuboids.

### Essential Setup
```css
.scene {
  transform-style: preserve-3d;
  perspective: 1000px;
}
```

### Responsive 3D
Use CSS variables for dimensions and `vmin` units:
```css
.cube {
  --size: 10vmin;
  width: var(--size);
  height: var(--size);
}
```

---

## 9. Clip-Path Animations (Emil)

### Why clip-path?
- Hardware-accelerated rendering
- No layout shifts
- No additional DOM elements needed
- Smoother than width/height animations

### Basic Syntax
```css
clip-path: inset(top right bottom left);
clip-path: circle(radius at x y);
clip-path: polygon(coordinates);
```

### Image Reveal Effect
```css
.reveal {
  clip-path: inset(0 0 100% 0); /* Hidden */
  animation: reveal 1s forwards cubic-bezier(0.77, 0, 0.175, 1);
}

@keyframes reveal {
  to { clip-path: inset(0 0 0 0); } /* Fully visible */
}
```

### Tab Transitions
Duplicate tab lists with different styling. Animate the overlay's clip-path to reveal only the active tab—creates smooth color transitions without timing issues.

### Scroll-Driven with clip-path
```javascript
const clipPathY = useTransform(scrollYProgress, [0, 1], ["100%", "0%"]);
const motionClipPath = useMotionTemplate`inset(0 0 ${clipPathY} 0)`;
```

### Text Mask Effect
Stack elements with complementary clip-paths:
```css
.top { clip-path: inset(0 0 50% 0); }    /* Shows top half */
.bottom { clip-path: inset(50% 0 0 0); } /* Shows bottom half */
```
Adjust values on mouse interaction for seamless transitions.

---

## 10. Button & Interactive Feedback (Emil)

### Scale on Press
Add immediate tactile feedback:
```css
button:active {
  transform: scale(0.97);
}
```

### Don't Animate from scale(0)
```jsx
// BAD: Unnatural motion
initial={{ scale: 0 }}

// GOOD: Natural, gentle motion
initial={{ scale: 0.9, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
```

### Tooltip Delay Pattern
First tooltip in a group: delay + animation. Subsequent tooltips: instant.
```css
[data-instant] {
  transition-duration: 0ms;
}
```

### Blur as a Bridge
When state transitions aren't smooth enough, add subtle blur (under 20px) to mask imperfections:
```css
.transitioning {
  filter: blur(2px);
}
```
Keep blur values low — under 20px. Higher values look obviously filtered rather than naturally smooth.

### Subtle Squash and Stretch
Squash/stretch deformation must stay within the **0.95-1.05 range**. Anything beyond feels cartoonish and distracts from the interface.

```tsx
// INCORRECT: excessive deformation
<motion.div whileTap={{ scale: 0.8 }} />

// CORRECT: subtle deformation
<motion.div whileTap={{ scale: 0.98 }} />
```

### Stagger Under 50ms Per Item
Stagger delays must not exceed **50ms per item**. Excessive stagger delays list readiness and feels sluggish.

```tsx
// INCORRECT: excessive stagger (150ms per item)
transition={{ staggerChildren: 0.15 }}

// CORRECT: reasonable stagger (30ms per item)
transition={{ staggerChildren: 0.03 }}
```

---

## 11. CSS Transitions vs Keyframes (Emil)

### Interruptibility Problem
CSS keyframes can't be interrupted mid-animation. When users rapidly trigger actions, elements "jump" to new positions rather than smoothly retargeting.

**Solution**: Use CSS transitions with state-driven classes:
```jsx
useEffect(() => {
  setMounted(true);
}, []);
```

```css
.element {
  transform: translateY(100%);
  transition: transform 400ms ease;
}
.element.mounted {
  transform: translateY(0);
}
```

### Direct Style Updates for Performance
CSS variables cause style recalculation across all children. For frequent updates (drag operations), update styles directly:

```javascript
// BAD: CSS variable (expensive cascade)
element.style.setProperty('--drag-y', `${y}px`);

// GOOD: Direct style (no cascade)
element.style.transform = `translateY(${y}px)`;
```

### Momentum-Based Dismissal
Use velocity (distance / time) instead of distance thresholds:
```javascript
const velocity = dragDistance / elapsedTime;
if (velocity > 0.11) dismiss();
```

Fast, short gestures should work—users shouldn't need to drag far.

### Damping for Natural Boundaries
When dragging past boundaries, reduce movement progressively. Things in real life slow down before stopping.

---

## 12. Spring Physics (Emil)

### Key Parameters
| Parameter | Effect |
|-----------|--------|
| **Stiffness** | How quickly spring reaches target (higher = faster) |
| **Damping** | How quickly oscillations settle (higher = less bounce) |
| **Mass** | Weight of object (higher = more momentum) |

### Balanced Spring Parameters
Spring parameters must be balanced to avoid excessive oscillation. High stiffness with low damping creates jittery, cartoonish motion.

```tsx
// INCORRECT: too bouncy (stiffness:damping ratio too extreme)
transition={{ type: "spring", stiffness: 1000, damping: 5 }}

// CORRECT: balanced
transition={{ type: "spring", stiffness: 500, damping: 30 }}
```

### Spring for Mouse Position
```javascript
const springConfig = { stiffness: 300, damping: 30 };
const x = useSpring(mouseX, springConfig);
const y = useSpring(mouseY, springConfig);
```

Use `useSpring` for any value that should interpolate smoothly rather than snap—nothing in the real world changes instantly.

### Springs for Gesture-Driven Motion
Gesture-driven motion (drag, flick, swipe) must use springs — easing curves cannot respond naturally to variable user input velocity.

```tsx
// INCORRECT: easing for drag
<motion.div drag="x" transition={{ duration: 0.3, ease: "easeOut" }} />

// CORRECT: spring for drag
<motion.div drag="x" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
```

### Springs Preserve Input Velocity
When velocity matters (e.g., drag release), use springs and pass the velocity so the animation continues the user's gesture energy.

```tsx
// INCORRECT: velocity ignored on drag end
onDragEnd={(e, info) => {
  animate(target, { x: 0 }, { duration: 0.3 });
}}

// CORRECT: velocity preserved
onDragEnd={(e, info) => {
  animate(target, { x: 0 }, {
    type: "spring",
    velocity: info.velocity.x,
  });
}}
```

### Springs for Interruptible Motion
Motion that can be interrupted mid-play must use springs. Easing-based animations jump when retargeted; springs blend smoothly.

```tsx
// INCORRECT: easing for interruptible motion
<motion.div animate={{ x: isOpen ? 200 : 0 }} transition={{ duration: 0.3 }} />

// CORRECT: spring for interruptible motion
<motion.div animate={{ x: isOpen ? 200 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} />
```

### Springs for Overshoot and Settle
When an element should bounce/settle into position, springs are required — easing curves cannot produce natural overshoot.

```tsx
// INCORRECT: easing for bounce effect
<motion.div transition={{ duration: 0.3, ease: "easeOut" }} />

// CORRECT: spring physics
<motion.div transition={{ type: "spring", stiffness: 500, damping: 30 }} />
```

### Interruptibility
Great animations can be interrupted mid-play:
- Framer Motion supports interruption natively
- CSS transitions allow smooth interruption before completion
- Test by clicking rapidly—animations should blend, not queue

---

## 12. Origin-Aware Animations (Emil)

Animations should originate from their logical source:

```css
/* Dropdown from button should expand from button, not center */
.dropdown {
  transform-origin: top center;
}
```

**Component library support:**
- Base UI: `--transform-origin` CSS variable
- Radix UI: `--radix-dropdown-menu-content-transform-origin`

---

## 13. Scroll-Driven Animations (Jhey)

### The Core Problem
Scroll-driven animations are tied to scroll **speed**. If users scroll slowly, animations play slowly. This feels wrong for most UI—you want animations to trigger at a scroll position, not be controlled by scroll speed.

### Duration Control Pattern
Use two coordinated animations:
1. **Trigger animation**: Scroll-driven, toggles a custom property when element enters view
2. **Main animation**: Traditional duration-based, activated via Style Query

This severs the connection between scroll speed and animation timing—the animation runs over a fixed duration once triggered, regardless of how fast the user scrolled.

### Progressive Enhancement
Always provide fallbacks:
```javascript
// IntersectionObserver fallback for browsers without scroll-driven animation support
if (!CSS.supports('animation-timeline', 'scroll()')) {
  // Use IntersectionObserver instead
}
```


---

## 14. Container Animation

### The Two-Div Pattern
Use an outer animated div and an inner measured div. **Never measure and animate the same element** — it creates a feedback loop.

```tsx
// INCORRECT: measure and animate same element — creates feedback loop
function AnimatedContainer({ children }) {
  const [ref, bounds] = useMeasure();
  return (
    <motion.div ref={ref} animate={{ height: bounds.height }}>
      {children}
    </motion.div>
  );
}

// CORRECT: separate measure and animate targets
function AnimatedContainer({ children }) {
  const [ref, bounds] = useMeasure();
  return (
    <motion.div animate={{ height: bounds.height }} style={{ overflow: "hidden" }}>
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}
```

### Guard Against Zero on Initial Render
On initial render, measured bounds are 0. Guard against animating from 0 to actual size.

```tsx
// INCORRECT: animates from 0 on mount
<motion.div animate={{ width: bounds.width }}>
  <div ref={ref}>{children}</div>
</motion.div>

// CORRECT: falls back to auto on first frame
<motion.div animate={{ width: bounds.width > 0 ? bounds.width : "auto" }}>
  <div ref={ref}>{children}</div>
</motion.div>
```

### Use ResizeObserver for Measurement
Use ResizeObserver to track element dimensions. It fires on resize without causing layout thrashing. Avoid `getBoundingClientRect()` on every render.

```tsx
// INCORRECT: measuring on every render
function useMeasure(ref) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    }
  });
  return bounds;
}

// CORRECT: ResizeObserver with callback ref
function useMeasure() {
  const [element, setElement] = useState(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const ref = useCallback((node) => setElement(node), []);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds];
}
```

### Use Callback Ref for Measurement
Use a callback ref (not `useRef`) for measurement hooks so the observer attaches when the DOM node is ready.

```tsx
// INCORRECT: useRef may be null on first effect
const ref = useRef(null);
useEffect(() => {
  if (!ref.current) return;
  observer.observe(ref.current);
}, []);

// CORRECT: callback ref guarantees node
const [element, setElement] = useState(null);
const ref = useCallback((node) => setElement(node), []);
useEffect(() => {
  if (!element) return;
  observer.observe(element);
  return () => observer.disconnect();
}, [element]);
```

### Overflow Hidden on Animated Container
Set `overflow: hidden` on the animated outer container to clip content during size transitions.

```tsx
// INCORRECT: content overflows during animation
<motion.div animate={{ height: bounds.height }}>
  <div ref={ref}>{children}</div>
</motion.div>

// CORRECT: clipped during transition
<motion.div animate={{ height: bounds.height }} style={{ overflow: "hidden" }}>
  <div ref={ref}>{children}</div>
</motion.div>
```

### Add Delay for Natural Container Transitions
A small delay (e.g., 50ms) makes the transition feel like it's catching up to the content.

```tsx
<motion.div
  animate={{ height: bounds.height }}
  transition={{ duration: 0.2, delay: 0.05 }}
  style={{ overflow: "hidden" }}
>
  <div ref={ref}>{children}</div>
</motion.div>
```

### Use Animated Bounds Sparingly
Container size animation is a subtle effect. Reserve it for interactive elements that change size.

**Good use cases**: loading state buttons, expandable sections, accordions, FAQs, content reveals.

**Bad use cases**: every container on the page, static layouts, elements that don't change size.
