---
name: tailwind
description: "Use when styling with Tailwind CSS — utility classes, design tokens, responsive layouts, dark mode, and OKLCH colors."
---

## Gotchas
- Dynamic `bg-${color}-500` purged in production; use complete strings or safelist
- `@apply` in components defeats utility-first; only for base layer
- v4 uses CSS-first config (`@theme`), don't mix with tailwind.config.js

## Rules

### Class Management
- Always cn() (twMerge + clsx) for conditional/merged classes
- **cva() for variants — NOT ternaries OR object maps.** A `variant === 'x' ? '...' : '...'` ternary AND a hand-rolled `{ primary: '...', ghost: '...' }[variant]` lookup are BOTH violations. The fix for a 3+ variant component is `cva()`, not an object map:
  ```tsx
  // ❌ ternary            // ❌ object map (still wrong)
  const c = v === 'primary' ? 'bg-primary' : 'bg-gray-100';
  const variants = { primary: 'bg-primary', ghost: 'bg-transparent' }[v];
  // ✅ cva
  const card = cva('rounded-lg p-4', {
    variants: { variant: { primary: 'bg-primary text-white', ghost: 'bg-transparent' } },
  });
  <div className={cn(card({ variant }))}>
  ```
- **3+ variants threshold — UNDER 3 = RIP OUT CVA, inline instead.** Count the variant keys. If a component has only 2 variants (e.g. `primary`/`secondary`), CVA is over-engineering: delete it and put the utilities inline (`className={cn(variant === 'primary' ? '...' : '...')}` or pass classes per call site). Abstract with CVA/tailwind-variants ONLY at 3+ variants of the same component. This cuts both ways — seeing CVA with 2 variants is as wrong as a ternary with 5
- **CVA vs tailwind-variants decision**: CVA when you only need variant props on a single element (buttons, badges). tailwind-variants when you need slots (compound components with multiple styled elements) or responsive variants. CVA is lighter (~1KB), tailwind-variants is heavier (~5KB) but handles `slots` natively. If you catch yourself nesting CVA inside CVA for sub-elements, switch to tailwind-variants
- Avoid @apply except global base/typography prose
- Class order: layout > sizing > spacing > typography > visual > interactive > dark > responsive
- tailwind-merge resolves conflicting utilities

### Spacing & Sizing
- **Spacing scale: stick to 1, 2, 3, 4, 6, 8, 12, 16, 24.** Map odd values UP/DOWN to the nearest scale step: `p-5`→`p-4` or `p-6`, `mb-7`→`mb-6` or `mb-8`. NEVER introduce half-steps (`py-1.5`, `gap-2.5`) or off-rhythm values while fixing — if you reach for `py-1.5`, use `py-1` or `py-2`. Check every spacing class you ADD, not just the ones you change
- size-* shorthand when w and h equal: `w-8 h-8`→`size-8`, `w-11 h-11`→`size-11`
- Tailwind size classes (text-base) not arbitrary px (text-[16px]): `text-[12px]`→`text-xs`/`text-sm`, `text-[16px]`→`text-base`

### Design Tokens
- **Iron Law: read the project's @theme configuration before applying any utility classes.** Verify which design tokens exist (colors, radii, fonts) and use them — never assume defaults. Applying `bg-blue-500` when the project defines `--color-brand-primary` is wrong
- Colors in @theme use the `oklch()` function ONCE: `--color-primary: oklch(0.6 0.25 260)`. If you see `oklch(oklch(...))` double-wrapping, UNWRAP the inner one — `oklch(oklch(0.98 0.01 250))`→`oklch(0.98 0.01 250)`. Double-wrapping breaks the color silently. (The deeper "store raw values, let Tailwind wrap" guidance applies in advanced setups, but the always-correct fix for a double-wrap is to delete the redundant inner `oklch(`.)
- **Semi-transparent color variants use `color-mix(in oklab, ...)`, NEVER `rgba()`.** A token like `--color-primary-50: rgba(59,130,246,0.05)` is a violation — it hardcodes the channel values instead of deriving from the base token, so it breaks the moment the brand color changes. Mix the existing token with `transparent` in the oklab space:
  ```css
  @theme {
    --color-primary: oklch(0.6 0.25 260);
    /* ❌ rgba hardcodes the color, drifts from --color-primary */
    --color-primary-50: rgba(59, 130, 246, 0.05);
    /* ✅ derive the tint from the token itself, in oklab */
    --color-primary-50: color-mix(in oklab, var(--color-primary) 5%, transparent);
    --color-primary-10: color-mix(in oklab, var(--color-primary) 10%, transparent);
  }
  ```
- **`--color-*: initial` FIRST to clear Tailwind's default palette before defining a custom one.** When a project ships its own color tokens, emit `--color-*: initial;` as the first line inside `@theme` so stray defaults (`bg-red-500` etc.) can't leak in:
  ```css
  @theme {
    --color-*: initial;          /* ← clears defaults, must come first */
    --color-primary: oklch(0.6 0.25 260);
  }
  ```
- @theme block for token definitions; radius as --radius-sm/md/lg/xl
- **Root surfaces use SEMANTIC tokens, never raw palette colors. `body` + every page/section/card/overlay/popover root that paints a background or text color maps brute→token.** A raw `bg-white`/`bg-zinc-950`/`bg-gray-50` on a body or container surface is a violation — and so is "fixing" it with `bg-white dark:bg-zinc-950` (two raw colors is still raw; the token already encodes the dark value). Map every surface color you touch:
  ```
  bg-white  / bg-zinc-950 / bg-neutral-900   → bg-background   (page/body root)
  bg-gray-50 / bg-gray-100 / bg-white (card)  → bg-card
  text-gray-900 / text-black / text-white     → text-foreground
  text-gray-500 / text-gray-600 (secondary)   → text-muted-foreground
  border-gray-200 / border-zinc-800           → border-border
  ```
  Scan EVERY container root for a raw `bg-*`/`text-*`/`border-*` and swap it for the matching token — not just the body. The whole point of tokens is one definition themes light + dark for free, so `dark:` raw overrides on a surface are the tell you skipped the token.
- **`body` gets `bg-background text-foreground`; clear the default border color globally with `* { @apply border-border }` in `@layer base`.** Both halves are required — the global `*` border rule is what makes bare `border` utilities use the themed color instead of Tailwind's gray-200 default:
  ```css
  @layer base {
    * { @apply border-border; }
    body { @apply bg-background text-foreground; }
  }
  ```
- **Animation tokens: every `animate-X` utility you use MUST have a matching `--animate-X` token AND its `@keyframes` in @theme.** Using `animate-pulse`/`animate-fade` without defining the token + keyframes is a violation. Fix:
  ```css
  @theme {
    --animate-pulse: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;
    @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
  }
  ```

### Responsive & Layout
- **Mobile-first: base classes = the SMALLEST screen, scale UP with sm:/md:/lg:. NO fixed widths, NO `max-*` breakpoints.** A bare `w-[480px]` is a violation — it doesn't shrink on phones. Fix with mobile base + breakpoint cap: `w-[480px]`→`w-full max-w-[480px]` or `w-full sm:w-[480px]`. If you write a `max-md:`/`max-lg:` prefix you're doing desktop-first — invert it
- Container queries: wrap the component in `@container` then size children with `@sm:`/`@lg:`/`@2xl:` instead of viewport `sm:`/`lg:`. A reusable card that should adapt to its slot (not the viewport) needs `@container` on its root and `@lg:` etc. on its contents:
  ```tsx
  <div className="@container rounded-lg border p-4">
    <h3 className="text-base @lg:text-lg">Title</h3>
  </div>
  ```
  Name containers for specificity: `@container/sidebar` on parent, `@lg/sidebar:` on children — avoids wrong container matching when nested
- **min-w-0 + truncate in grid/flex cells** — `truncate` alone does NOT work inside a grid/flex child; the cell needs `min-w-0` or it won't shrink below content width
- Responsive text: text-4xl sm:text-5xl lg:text-6xl

### Accessibility
- **Focus ring on EVERY interactive element — buttons, links, AND clickable `<div>`/`<li>`/menu items.** Use `focus-visible:ring-2 focus-visible:ring-offset-2` (focus-visible, not focus, to avoid rings on mouse click). A clickable `<li onClick>` in a dropdown counts — it also needs `tabIndex={0}` to be focusable. Scan for every `onClick`/`role="button"` and confirm a focus style is present
- **Touch targets ≥ 44×44px on mobile.** An icon button like `p-2` around a small svg (~36px) is too small. Enforce a minimum: add `size-11` (44px) or `min-h-11 min-w-11` to icon-only buttons and other small tap targets
- sr-only for screen-reader text; icon buttons need aria-label
- **`contrast-more:` variant on low-contrast text** so high-contrast users get a stronger color — e.g. muted `text-gray-500`/`text-gray-600` should add `contrast-more:text-gray-900` (and `contrast-more:font-semibold` where helpful)
- **EVERY `transition-*`/`animate-*` you touch MUST get a `motion-reduce:` companion — no exceptions.** When you keep or add a `transition-[transform,opacity]`, a `transition-colors`, or an `animate-pulse`/`animate-spin`, also emit `motion-reduce:transition-none` (or `motion-reduce:animate-none`) so users with `prefers-reduced-motion` aren't moved. A bare `transition-all`→`transition-[transform,opacity]` fix that DOESN'T add `motion-reduce:transition-none` is still incomplete:
  ```tsx
  // ❌ animates, ignores reduced-motion
  <div className="transition-[transform,opacity] animate-spin" />
  // ✅ honors the OS setting
  <div className="transition-[transform,opacity] motion-reduce:transition-none animate-spin motion-reduce:animate-none" />
  ```

### Animations
- **NEVER `transition-all` — it animates layout props (width/height/top) off the GPU and janks.** Replace with an explicit GPU-only list: `transition-all`→`transition-[transform,opacity]` (or `transition-colors`/`transition-transform` when that's all that changes). Animate only `transform` and `opacity`
- Skeleton: animate-pulse + rounded-md bg-gray-200 dark:bg-gray-800
- **Standard entrance animations (fade-in, slide-up, scale-in) → use `tw-animate-css`, do NOT hand-write `@keyframes`.** If the seed has a custom `@keyframes fadeIn` + `--animate-fade` for a plain fade, delete them, add `@import "tw-animate-css";`, and use its `animate-in fade-in` utilities. Only write custom @keyframes for brand-specific motion that the package can't express
- **`@starting-style` for native `popover`/entry animations** — a `[popover]` element animating in needs a `@starting-style` block (and `transition` + the from-state) or it pops without transition:
  ```css
  [popover]:popover-open { opacity: 1; transition: opacity .2s; }
  @starting-style { [popover]:popover-open { opacity: 0; } }
  ```

### Dark Mode
- v4: @custom-variant dark (&:where(.dark, .dark *))
- Override via .dark { --color-*: value }
- Root surfaces (body/containers) use semantic tokens, not raw or `dark:`-doubled colors — see Design Tokens

### v4 Migration
- @import "tailwindcss" replaces @tailwind directives
- @theme {} in CSS replaces tailwind.config.ts
- Auto content detection, no content array; never include node_modules
- bg-black/50 not bg-opacity-50
- Replace tailwindcss-animate with native CSS animations
- **`@plugin` directive for third-party plugins**: use `@plugin '@tailwindcss/typography'` in CSS instead of the old `plugins` array in tailwind.config.js. The `@plugin` directive is the v4 way to load plugins
- @utility for custom utilities; @custom-variant for conditional styles
- @tailwindcss/postcss or @tailwindcss/vite for build integration

### v4 Custom Utilities & Theme Modifiers
- `@utility` directive for custom utilities — replaces plugin-based addUtilities. Define once, use with responsive/state variants automatically: `@utility content-grid { display: grid; grid-template-columns: ... }`
- Theme modifiers: access @theme tokens in arbitrary values via `theme()` function — e.g. `bg-[theme(--color-brand-primary)]`. Useful when you need a token value outside normal utility context (SVG fills, box-shadow custom values)
- `@variant` compose existing variants: `@custom-variant hocus (&:hover, &:focus)` — one variant instead of repeating hover: and focus: everywhere

### Components
- Compound component pattern (Dialog.Trigger, Dialog.Content)
- Radix primitives for accessible unstyled components — including dropdowns/menus, not just dialogs. A hand-rolled `useState`+`useRef`+outside-click dropdown should become `@radix-ui/react-dropdown-menu`
- **React 19: `ref` is a plain prop — DELETE every `forwardRef`.** Strip the `forwardRef<T, P>(...)` wrapper, add `ref` to the props type, and use it directly. No `displayName` needed:
  ```tsx
  // ❌ forwardRef                          // ✅ React 19
  const Card = forwardRef<HTMLDivElement, P>((props, ref) => ...);
  function Card({ ref, ...props }: P & { ref?: Ref<HTMLDivElement> }) { return <div ref={ref} .../> }
  ```
- Never concatenate dynamic classes; use full string maps

### General (non-discriminating)
- Semantic tokens over raw colors on EVERY surface (root + containers), CSS variable theming — concrete brute→token map in Design Tokens
- aspect-video + object-cover; define z-index tokens in @theme as `--z-dropdown: 10`, `--z-sticky: 20`, `--z-overlay: 30`, `--z-modal: 40`, `--z-toast: 50`. Never use arbitrary z-index values
- truncate single line, line-clamp-N multi-line
- Zod + React Hook Form for validation

## Before you emit — LOUD final pass

When fixing a file, the EASY wins (hex→oklch, config→@theme, @tailwind→@import, size-8) get caught automatically. These get SILENTLY SKIPPED — re-scan for each:

- [ ] **forwardRef** → deleted everywhere; `ref` is a plain prop (React 19)
- [ ] **transition-all** → replaced with `transition-[transform,opacity]` / `transition-colors`. Zero `transition-all` left
- [ ] **motion-reduce** → CHAQUE `transition-*`/`animate-*` has a `motion-reduce:transition-none` (or `motion-reduce:animate-none`) companion. Zero un-guarded animations left
- [ ] **color-mix oklab** → every semi-transparent token is `color-mix(in oklab, var(--color-x) N%, transparent)`; ZERO `rgba()`/`hsla()` left in @theme tints
- [ ] **CVA count** → 3+ variants use cva(); 2 variants have NO cva (inline); object-map lookups are NOT cva
- [ ] **oklch(oklch(** → unwrapped to a single `oklch(`
- [ ] **Touch targets** → every icon-only button is `size-11` / `min-h-11 min-w-11` (≥44px)
- [ ] **Focus ring** → every `onClick`/interactive element (incl. `<li>`, `<div role>`) has `focus-visible:ring-2`
- [ ] **Fixed widths** → no bare `w-[Npx]`; mobile-first `w-full max-w-[Npx]`, no `max-*` breakpoints
- [ ] **animate-X used** → matching `--animate-X` token + `@keyframes` defined in @theme
- [ ] **--color-*: initial** → present as first @theme line when defining a custom palette
- [ ] **container-queries** → reusable cards use `@container` + `@lg:` (not viewport breakpoints)
- [ ] **contrast-more:** → low-contrast/muted text has a `contrast-more:` override
- [ ] **@starting-style** → native `[popover]` entry animations have it
- [ ] **tw-animate-css** → standard fade/slide/scale entrances use the package, not hand-written `@keyframes`
- [ ] **Spacing scale** → no half-steps (`py-1.5`, `gap-2.5`); every spacing class is on {1,2,3,4,6,8,12,16,24}
- [ ] **Semantic surfaces** → `body` is `bg-background text-foreground`; `@layer base { * { @apply border-border } }` present; ZERO raw `bg-white`/`bg-zinc-950`/`bg-gray-*` (or `dark:`-doubled raw) left on any container root — all mapped to `bg-background`/`bg-card`/`text-foreground`
