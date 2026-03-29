---
name: tailwind
description: "Tailwind CSS styling, design tokens, responsive, dark mode. Trigger on 'tailwind', 'utility classes', 'design tokens', 'OKLCH'."
---

## When to use
- Styling components with Tailwind utility classes
- Configuring tailwind.config.ts or v4 @theme in CSS
- Building design systems / token-based themes
- Implementing design tokens, OKLCH colors, component libraries
- Standardizing UI patterns across a codebase
- Responsive layouts, dark mode, animations
- Migrating Tailwind v3 to v4
- Creating component variants with cva/cn
- Writing custom Tailwind plugins or @utility directives
- Building production-ready UI components

## When not to use
- CSS Modules or styled-components projects
- Pure CSS/Sass without Tailwind
- Email templates (use inline styles)
- Projects using another utility framework (UnoCSS, Tachyons)
- Simple one-off pages not needing a design system

## Gotchas
- Dynamic class names like `bg-${color}-500` are purged in production. Use complete strings: `bg-red-500`, `bg-blue-500`, or safelist them.
- `@apply` in components defeats the purpose of utility-first. Use it only in base layer styles or when you genuinely need CSS extraction.
- Tailwind v4 uses CSS-first config (`@theme` in CSS) instead of `tailwind.config.js`. Don't mix both.
- `dark:` variant requires either `class` strategy (manual toggle) or `media` strategy (OS preference). They are mutually exclusive in config.

## Rules
- Always use cn() helper (twMerge + clsx) for conditional/merged classes
- Use cva() for reusable component variants, not @apply
- Avoid @apply except for global base/typography prose styles
- Class order: layout > sizing > spacing > typography > visual > interactive > dark > responsive
- Always design mobile-first: base = mobile, add sm:/md:/lg: for larger
- Use spacing scale increments of 4 (4, 6, 8, 12, 16, 24), avoid odd values like p-5 mb-7
- Prefer semantic tokens (bg-primary, bg-card, text-foreground) over raw colors (bg-white, bg-blue-500)
- CSS variable-based theming with rgb() for opacity support
- Never concatenate dynamic classes (text-${color}-500); use full string maps or safelist
- Scope content paths tightly; never include node_modules or overly broad globs
- Use tailwind-merge to resolve conflicting utility classes
- Z-index: systematic increments of 10 (0, 10, 20, 40, 50)
- Only animate GPU-accelerated properties (transform, opacity); avoid transition-all with w/h
- Respect motion-reduce: add motion-reduce:transition-none for animations
- Focus styles required on all interactive elements (focus:ring-2 focus:ring-offset-2)
- Minimum 44x44px touch targets on mobile interactive elements
- Use sr-only for screen-reader-only text; icon buttons need aria-label
- Use contrast-more: variant for high-contrast mode support
- Add min-w-0 + truncate in grid cells to prevent text overflow
- Use aspect-video/aspect-square with object-cover to prevent layout shift on images
- Use Tailwind size classes (text-base) not arbitrary px values (text-[16px])
- Use size-* shorthand instead of w-* h-* when both dimensions are equal
- Responsive text: text-4xl sm:text-5xl lg:text-6xl, never fixed large sizes
- Skeleton loading: animate-pulse + rounded-md bg-gray-200 dark:bg-gray-800
- Truncation: truncate for single line, line-clamp-N for multi-line
- Define colors in @theme { --color-*: value } with OKLCH format
- Use color-mix() in oklab for semi-transparent color variants
- Use --color-*: initial to clear defaults before custom palette
- Define radius tokens as --radius-sm/md/lg/xl in @theme
- Define animation tokens as --animate-* and @keyframes inside @theme blocks
- Set border-border on * and bg-background text-foreground on body
- Use compound component pattern for complex UI (Card, Dialog)
- Use Radix primitives for accessible unstyled components
- React 19: ref is a regular prop, no forwardRef needed
- Validate forms with Zod + React Hook Form
- Use @starting-style for native popover/entry animations
- Replace tailwindcss-animate plugin with native CSS animations in v4
- Replace custom plugins with @utility directives in v4
- Use @theme inline when referencing other CSS vars
- Use @theme static to always generate vars even if unused
- Override dark colors via .dark { --color-*: value } in CSS
- v4: @import "tailwindcss" replaces @tailwind directives
- v4: @theme {} in CSS replaces tailwind.config.ts theme config
- v4: content detection is automatic, no content array needed
- v4: use opacity modifier syntax (bg-black/50) not bg-opacity-50
- v4: @utility directive for custom utilities with variant support
- v4: @custom-variant for custom conditional styles (dark mode, data attributes)
- v4: @variant directive to apply variants in CSS blocks
- v4: use @tailwindcss/postcss or @tailwindcss/vite for build integration
- v4: container queries via --container-* tokens in @theme
- v3 plugins: use tailwindcss/plugin API for addUtilities/addVariant
- Key plugins: @tailwindcss/typography, @tailwindcss/forms, tailwindcss-animate
- Container queries: @container parent + @lg:/@2xl: children for component-level responsiveness
- Dark mode v3: darkMode 'class' in config + .dark on html element
- Dark mode v4: built-in, use @custom-variant dark (&:where(.dark, .dark *))
- Restart dev server after config changes if custom values not showing
- See references/ for extended patterns and templates/components/ for production React components
