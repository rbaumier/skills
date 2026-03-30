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
- Avoid @apply except global base/typography prose
- Class order: layout > sizing > spacing > typography > visual > interactive > dark > responsive
- tailwind-merge resolves conflicting utilities

### Spacing & Sizing
- Spacing scale increments of 4 (4,6,8,12,16,24); avoid odd p-5 mb-7
- size-* shorthand when w and h equal
- Tailwind size classes (text-base) not arbitrary px (text-[16px])

### Design Tokens
- Colors in @theme { --color-*: value } with OKLCH format
- color-mix() in oklab for semi-transparent variants
- --color-*: initial to clear defaults before custom palette
- @theme block for token definitions; radius as --radius-sm/md/lg/xl
- Animation tokens: --animate-* and @keyframes in @theme

### Responsive & Layout
- Mobile-first: base=mobile, add sm:/md:/lg:
- Container queries: @container parent + @lg:/@2xl: children
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
- @utility for custom utilities; @custom-variant for conditional styles
- @tailwindcss/postcss or @tailwindcss/vite for build integration

### Components
- Compound component pattern (Dialog.Trigger, Dialog.Content)
- Radix primitives for accessible unstyled components
- React 19: ref is regular prop, no forwardRef
- Never concatenate dynamic classes; use full string maps

### General (non-discriminating)
- Semantic tokens over raw colors; CSS variable theming
- aspect-video + object-cover; systematic z-index (10,20,40,50)
- truncate single line, line-clamp-N multi-line
- Zod + React Hook Form for validation
