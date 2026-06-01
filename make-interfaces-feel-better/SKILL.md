---
name: make-interfaces-feel-better
description: Design engineering principles for making interfaces feel polished. Use when building UI components, reviewing frontend code, implementing animations, hover states, shadows, borders, typography, micro-interactions, enter/exit animations, or any visual detail work. Triggers on UI polish, design details, "make it feel better", "feels off", stagger animations, border radius, optical alignment, font smoothing, tabular numbers, image outlines, box shadows.
---

# Details that make interfaces feel better

Great interfaces rarely come from a single thing. It's usually a collection of small details that compound into a great experience. Apply these principles when building or reviewing UI code.

## Two reflexes to apply on every component

These two are the easiest to miss because the default-looking code already "works" — but they are the signature of a polished interface. Before you finish, scan for these two patterns and replace them:

### Depth comes from shadows, not borders

Replace **every decorative `border`/`ring`** (one drawn purely for elevation or to separate a card from its background) with a **layered shadow**. A solid 1px line reads as a hard seam; a shadow reads as real depth and adapts to any background. Only keep a border when it is a true structural divider (e.g. a table row rule, a split panel).

```tsx
// WRONG — decorative border for elevation
<div className="rounded-xl border border-slate-200 p-4">…</div>

// RIGHT — depth from a layered shadow (+ a faint ring only in dark mode)
<div className="rounded-xl shadow-sm dark:ring-1 dark:ring-white/10 p-4">…</div>
// deeper elevation → shadow-md / shadow-lg; the depth always comes from the shadow, not the line
```

### Interactive animations use Motion, never `@keyframes` / class-toggle

Any animation tied to an **interactive state** (open/close, toggle, hover, expand) must be **interruptible** — if the user clicks again mid-flight, it must reverse smoothly. A `@keyframes` animation fired by toggling a `.open` class **cannot** be interrupted: it always plays to the end and snaps. Drive these with Motion (`animate` / `variants`) — or, if no motion library is installed, a CSS `transition` between two states. Reserve `@keyframes` for one-shot sequences that never reverse (a loading spinner, a confetti burst).

```tsx
// WRONG — keyframe + class toggle drives an interactive open/close (snaps, can't interrupt)
// .drawer.open { animation: slideIn 0.3s ease-out forwards; }
// @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
<div className={isOpen ? "drawer open" : "drawer"} />

// RIGHT — Motion animates between states and interrupts mid-flight
<motion.div animate={{ x: isOpen ? 0 : "100%" }} transition={{ type: "spring", duration: 0.3, bounce: 0 }} />
```

## Quick Reference

| Category | When to Use |
| --- | --- |
| [Typography](typography.md) | Text wrapping, font smoothing, tabular numbers |
| [Surfaces](surfaces.md) | Border radius, optical alignment, shadows, image outlines, hit areas |
| [Animations](animations.md) | Interruptible animations, enter/exit transitions, icon animations, scale on press |
| [Performance](performance.md) | Transition specificity, `will-change` usage |

## Core Principles

### 1. Concentric Border Radius

Outer radius = inner radius + padding. Mismatched radii on nested elements is the most common thing that makes interfaces feel off.

### 2. Optical Over Geometric Alignment

When geometric centering looks off, align optically. Content with asymmetric visual weight is *geometrically* centered but looks *visually* off-center, so you nudge it. Two cases come up constantly:

- **Text + icon button** — symmetric padding (`px-4`) pushes the icon too far from the edge. Use less padding on the icon side: `icon-side = text-side − 2px`. So `px-4` becomes `pl-4 pr-3.5` (icon on the right) or `pl-3.5 pr-4` (icon on the left).
- **Play triangle / asymmetric icon** — a play triangle's geometric center sits left of its visual center, so a perfectly centered triangle looks shoved left. Nudge it right with `ml-px` (or `style={{ marginLeft: 2 }}`). Best of all, fix it in the SVG `viewBox`/path so no component-level margin is needed.

```tsx
// Text + icon button: less padding on the icon side
<button className="flex items-center gap-2 pl-4 pr-3.5">
  <span>Open details</span>
  <StarIcon />
</button>

// Play triangle: optical nudge right (geometric center looks shoved left)
<button className="flex items-center justify-center rounded-full">
  <PlayIcon className="ml-px" />
</button>
```

Never leave symmetric padding on a text+icon button, and never leave a play/triangle icon with no shift. See [surfaces.md](surfaces.md#optical-alignment) for more.

### 3. Shadows Over Borders

Layer multiple transparent `box-shadow` values for natural depth. Shadows adapt to any background; solid borders don't. Replace **every decorative `border`/`ring`** (drawn for elevation, not as a structural divider) with a shadow — the depth must come from the shadow, not the line.

```tsx
// WRONG
<div className="rounded-xl border border-slate-200 p-4">…</div>
// RIGHT
<div className="rounded-xl shadow-sm dark:ring-1 dark:ring-white/10 p-4">…</div>
```

### 4. Interruptible Animations

Use Motion (`animate`/`variants`) or CSS transitions for interactive state changes — they can be interrupted mid-animation. **Never** drive an interactive open/close/toggle with a `@keyframes` animation fired by a `.open` class toggle: keyframes always play to the end and snap, so a second click mid-flight can't reverse. Reserve `@keyframes` for one-shot sequences that never reverse.

```tsx
// WRONG — @keyframes slideIn on a toggled .open class (can't interrupt)
<div className={isOpen ? "drawer open" : "drawer"} />
// RIGHT — Motion animates between states and interrupts mid-flight
<motion.div animate={{ x: isOpen ? 0 : "100%" }} transition={{ type: "spring", duration: 0.3, bounce: 0 }} />
```

### 5. Split and Stagger Enter Animations

Don't animate a single container. Break content into semantic chunks and stagger each with ~100ms delay.

### 6. Subtle Exit Animations

Use a small fixed `translateY` instead of full height. Exits should be softer than enters.

### 7. Contextual Icon Animations

Animate icons with `opacity`, `scale`, and `blur` instead of toggling visibility. Use exactly these values: scale from `0.25` to `1`, opacity from `0` to `1`, blur from `4px` to `0px`. If the project has `motion` or `framer-motion` in `package.json`, use `transition: { type: "spring", duration: 0.3, bounce: 0 }` — bounce must always be `0`. If no motion library is installed, keep both icons in the DOM (one absolute-positioned) and cross-fade with CSS transitions using `cubic-bezier(0.2, 0, 0, 1)` — this gives both enter and exit animations without any dependency.

### 8. Font Smoothing

Apply `-webkit-font-smoothing: antialiased` to the root layout on macOS for crisper text.

### 9. Tabular Numbers

Use `font-variant-numeric: tabular-nums` for any dynamically updating numbers to prevent layout shift. The Tailwind class is exactly **`tabular-nums`** — there is no `font-variant-numeric-*` utility, so never write `font-variant-numeric-tabular-nums`.

```tsx
<div className="tabular-nums">{liveCount} viewers</div>
```

### 10. Text Wrapping

Use `text-wrap: balance` on headings. Use `text-wrap: pretty` for body text to avoid orphans.

The Tailwind classes are exactly **`text-balance`** and **`text-pretty`** — these are the real utility names. There is no `text-wrap-balance` or `text-wrap-pretty` class in Tailwind; writing them produces dead classes that do nothing.

```tsx
<h1 className="text-balance">Your team's performance this quarter</h1>
<p className="text-pretty">A detailed breakdown of how every member contributed…</p>
```

### 11. Image Outlines

Every `<img>` needs a subtle `1px` low-opacity outline for consistent depth. Use this exact Tailwind recipe — all four parts are required:

```tsx
<img className="outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
```

- `outline outline-1` — a 1px outline (outline, not border, so it doesn't affect layout).
- `-outline-offset-1` — negative offset so the outline sits **inset** and the image keeps its intended size.
- `outline-black/10` — pure black at 10% opacity in **light** mode.
- `dark:outline-white/10` — pure white at 10% opacity in **dark** mode (the dark variant is mandatory, not optional).

The color must be **pure** black/white. Never a tinted neutral like `outline-slate-*`, `outline-zinc-*`, or `outline-neutral-*` — a tinted outline picks up the surface color underneath and reads as dirt on the image edge. Never ship an image outline without both the dark variant and the negative offset.

### 12. Scale on Press

A subtle `scale(0.96)` on click gives buttons tactile feedback. Always use `0.96`. Never use a value smaller than `0.95` — anything below feels exaggerated. Add a `static` prop to disable it when motion would be distracting.

### 13. Skip Animation on Page Load

Use `initial={false}` on `AnimatePresence` to prevent enter animations on first render. Verify it doesn't break intentional entrance animations.

### 14. Never Use `transition: all`

Always specify exact properties: `transition-property: scale, opacity`. Tailwind's `transition-transform` covers `transform, translate, scale, rotate`.

### 15. Use `will-change` Sparingly

Only for `transform`, `opacity`, `filter` — properties the GPU can composite. Never use `will-change: all`. Only add when you notice first-frame stutter.

### 16. Minimum Hit Area

Interactive elements need at least 40×40px hit area. Extend with a pseudo-element if the visible element is smaller. Never let hit areas of two elements overlap.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Same border radius on parent and child | Calculate `outerRadius = innerRadius + padding` |
| Text+icon button with symmetric `px-4` | Use `pl-4 pr-3.5` (icon side = text side − 2px) |
| Play/triangle icon centered geometrically | Nudge right with `ml-px` or fix the SVG `viewBox` |
| Image with no outline, or a tinted `outline-slate-*` | `outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10` |
| Decorative `border border-slate-200` for card depth/elevation | Replace with a layered shadow: `shadow-sm dark:ring-1 dark:ring-white/10` (depth from the shadow, not the line) |
| `@keyframes slideIn` + `.open` class toggle for an interactive drawer/menu | Drive it with Motion `animate`/`variants` (or a CSS `transition` between two states) so it interrupts mid-flight |
| Hard borders between sections | Use layered `box-shadow` with transparency |
| Jarring enter/exit animations | Split, stagger, and keep exits subtle |
| Numbers cause layout shift | Apply `tabular-nums` (not `font-variant-numeric-*`) |
| Heading/body text wrapping | `text-balance` on headings, `text-pretty` on body (not `text-wrap-*`) |
| Heavy text on macOS | Apply `antialiased` to root |
| Animation plays on page load | Add `initial={false}` to `AnimatePresence` |
| `transition: all` on elements | Specify exact properties |
| First-frame animation stutter | Add `will-change: transform` (sparingly) |
| Tiny hit areas on small controls | Extend with pseudo-element to 40×40px |

## Review Output Format

Always present changes as a markdown table with **Before** and **After** columns. Include every change you made — not just a subset. Never list findings as separate "Before:" / "After:" lines outside of a table. Group changes by principle using a heading above each table, and keep each row focused on a single diff so the reader can scan the whole list quickly.

### Example

#### Concentric border radius
| Before | After |
| --- | --- |
| `rounded-xl` on card + `rounded-xl` on inner button (`p-2`) | `rounded-2xl` on card (`12 + 8`), `rounded-lg` on inner button |
| `border-radius: 16px` on both nested surfaces | Outer `24px`, inner `16px` with `8px` padding |

#### Tabular numbers
| Before | After |
| --- | --- |
| `<span>{count}</span>` on animated counter | `<span className="tabular-nums">{count}</span>` |
| Default numerals on timer | Added `font-variant-numeric: tabular-nums` to root |

#### Scale on press
| Before | After |
| --- | --- |
| `<button className="...">` | Added `active:scale-[0.96] transition-transform` |
| `scale(0.9)` on press | Raised to `scale(0.96)` — anything below `0.95` feels exaggerated |

Rows should cite the specific file and the specific property that changed when it isn't obvious from the snippet. If a principle was reviewed but nothing needed to change, omit that table entirely — empty tables add noise.

## Review Checklist

- [ ] Nested rounded elements use concentric border radius
- [ ] Text+icon buttons use asymmetric padding (icon side −2px, e.g. `pl-4 pr-3.5`), and play/triangle icons get an optical nudge (`ml-px`) — not symmetric `px-4` and not a centered triangle
- [ ] **Do you see a decorative `border`/`ring`** (e.g. `border border-slate-200`) drawn for elevation? Replace **each one** with a layered shadow (`shadow-sm`/`shadow-md` + `dark:ring-1 dark:ring-white/10`) — the depth comes from the shadow, not the line. Keep only true structural dividers.
- [ ] **Do you see an `@keyframes` / `.open` class-toggle driving an interactive animation** (drawer, menu, accordion, toggle)? Replace it with Motion `animate`/`variants` (or a CSS `transition` between two states) so it can interrupt mid-flight. `@keyframes` is only for one-shot sequences that never reverse.
- [ ] Enter animations are split and staggered
- [ ] Exit animations are subtle
- [ ] Dynamic numbers use the `tabular-nums` class (never `font-variant-numeric-*`)
- [ ] Font smoothing is applied
- [ ] Headings use `text-balance` and body text uses `text-pretty` (never `text-wrap-balance` / `text-wrap-pretty` — those classes don't exist)
- [ ] Every image has `outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10` — pure black/white, both light and dark variants, negative offset (never `outline-slate-*`/`outline-zinc-*` and never missing the dark variant)
- [ ] Buttons use scale on press where appropriate
- [ ] AnimatePresence uses `initial={false}` for default-state elements
- [ ] No `transition: all` — only specific properties
- [ ] `will-change` only on transform/opacity/filter, never `all`
- [ ] Interactive elements have at least 40×40px hit area

## Reference Files

- [typography.md](typography.md) — Text wrapping, font smoothing, tabular numbers
- [surfaces.md](surfaces.md) — Border radius, optical alignment, shadows, image outlines
- [animations.md](animations.md) — Interruptible animations, enter/exit transitions, icon animations, scale on press
- [performance.md](performance.md) — Transition specificity, `will-change` usage
