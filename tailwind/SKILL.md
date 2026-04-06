---
name: tailwind
description: "Tailwind CSS styling, design tokens, responsive, dark mode. Trigger on 'tailwind', 'utility classes', 'design tokens', 'OKLCH'."
---

## Gotchas
- Dynamic `bg-${color}-500` purged in production; use complete strings or safelist
- `@apply` in components defeats utility-first; only for base layer
- v4 uses CSS-first config (`@theme`), don't mix with tailwind.config.js

## Rules

### Class Management
- Always cn() (twMerge + clsx) for conditional/merged classes
- cva() for component variants, NOT @apply
- **3+ variants threshold**: use utilities directly in markup as the primary approach. Abstract with CVA/tailwind-variants only when you have 3+ variants of the same component. Under 3 variants, inline utilities are simpler and cheaper
- **CVA vs tailwind-variants decision**: CVA when you only need variant props on a single element (buttons, badges). tailwind-variants when you need slots (compound components with multiple styled elements) or responsive variants. CVA is lighter (~1KB), tailwind-variants is heavier (~5KB) but handles `slots` natively. If you catch yourself nesting CVA inside CVA for sub-elements, switch to tailwind-variants
- Avoid @apply except global base/typography prose
- Class order: layout > sizing > spacing > typography > visual > interactive > dark > responsive
- tailwind-merge resolves conflicting utilities

### Spacing & Sizing
- Spacing scale increments of 4 (4,6,8,12,16,24); avoid odd p-5 mb-7
- size-* shorthand when w and h equal
- Tailwind size classes (text-base) not arbitrary px (text-[16px])

### Design Tokens
- **Iron Law: read the project's @theme configuration before applying any utility classes.** Verify which design tokens exist (colors, radii, fonts) and use them — never assume defaults. Applying `bg-blue-500` when the project defines `--color-brand-primary` is wrong
- Colors in @theme { --color-*: value } with OKLCH format. Define raw OKLCH values in @theme (not wrapped in `oklch()`). Tailwind generates the function wrapper. Double-wrapping `oklch(oklch(...))` breaks colors silently. Same for opacity modifiers — `bg-primary/50` only works when the variable is a raw value
- color-mix() in oklab for semi-transparent variants
- --color-*: initial to clear defaults before custom palette
- @theme block for token definitions; radius as --radius-sm/md/lg/xl
- Animation tokens: --animate-* and @keyframes in @theme

### Responsive & Layout
- Mobile-first: base=mobile, add sm:/md:/lg:
- Container queries: @container parent + @lg:/@2xl: children. Name containers for specificity: `@container/sidebar` on parent, `@lg/sidebar:` on children — avoids wrong container matching when nested
- min-w-0 + truncate in grid cells to prevent overflow
- Responsive text: text-4xl sm:text-5xl lg:text-6xl

### Accessibility
- Focus: focus:ring-2 focus:ring-offset-2 on all interactive elements
- 44x44px minimum touch targets on mobile
- sr-only for screen-reader text; icon buttons need aria-label
- contrast-more: variant for high-contrast support
- motion-reduce:transition-none for animations

### Animations
- Only GPU properties (transform, opacity); avoid transition-all with w/h
- Skeleton: animate-pulse + rounded-md bg-gray-200 dark:bg-gray-800
- Prefer `tw-animate-css` package over custom @keyframes for standard entrance animations (fade-in, slide-up, scale-in). Only write custom @keyframes for brand-specific animations
- @starting-style for native popover/entry animations

### Dark Mode
- v4: @custom-variant dark (&:where(.dark, .dark *))
- Override via .dark { --color-*: value }
- Set bg-background text-foreground on body, border-border on *

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
- Radix primitives for accessible unstyled components
- React 19: ref is regular prop, no forwardRef
- Never concatenate dynamic classes; use full string maps

### General (non-discriminating)
- Semantic tokens over raw colors; CSS variable theming
- aspect-video + object-cover; define z-index tokens in @theme as `--z-dropdown: 10`, `--z-sticky: 20`, `--z-overlay: 30`, `--z-modal: 40`, `--z-toast: 50`. Never use arbitrary z-index values
- truncate single line, line-clamp-N multi-line
- Zod + React Hook Form for validation
