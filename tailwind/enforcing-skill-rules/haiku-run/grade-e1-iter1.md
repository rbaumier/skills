# Grade e1-iter1 — tailwind

STRICT grading. PASS only if violation is CLEARLY fixed in real code (with citation). FAIL on doubt.

| # | id | Verdict | Evidence / Reason |
|---|-----|---------|-------------------|
| 1 | cn-merge | PASS | `card.tsx` L24 `className={cn(baseClasses, variantClass)}`; `button.tsx` L83-87 uses `cn(...)`. No template-literal class concat. |
| 2 | cva-variants | FAIL | No `cva()` anywhere. `button.tsx` L65-75 uses plain object maps + `buttonVariants[color]` lookup (L78-79), not `cva()`. `card.tsx` L19-22 still uses a manual ternary for variant class. Description requires cva() for variants. |
| 3 | no-apply-components | PASS | `@apply` appears only in base layer: `app.css` L271-279 `@layer base { * { @apply border-border } body { @apply bg-background... } }`. No `@apply` in component styles (no card.css present). |
| 4 | spacing-scale | FAIL | Report claims p-5→p-6, mb-7→mb-8 fixed. But code introduces off-scale values: `button.tsx` L73 `py-1.5`, `dialog.tsx`/`dropdown` `mt-1` (L242), `space-y-3` (L185), `mt-3` (L263). `mt-1`/`mt-3`/`space-y-3`/`py-1.5` are not on the {4,6,8,12,16,24} increment scale. Doubt → FAIL. |
| 5 | tailwind-sizes | PASS | No arbitrary px text sizes; uses `text-sm`, `text-base`, `text-lg`, `text-4xl`, etc. Report L300 confirms `text-[12px]`→`text-sm`, `text-[16px]`→`text-base`. |
| 6 | no-dynamic-classes | PASS | `button.tsx` L65-79 uses full static string maps (`bg-red-500`, `bg-blue-500`, `bg-green-500`) with object lookup, no `bg-${color}-500` interpolation. |
| 7 | oklch-tokens | PASS | `theme.css` L121-125 colors in `oklch(...)`; `dark-mode.css` L210-211 oklch. No hex colors anywhere. |
| 8 | v4-theme-css | PASS | `theme.css` L120 `@theme { ... }` in CSS; config comment L1-4 says remove tailwind.config.ts, use @theme. No config file emitted. |
| 9 | v4-import | PASS | `@import "tailwindcss"` at L118, L204, L269. No `@tailwind base/components/utilities` directives. |
| 10 | no-content-node-modules | PASS | No `content` array and no `node_modules` reference anywhere (v4 auto-detection). |
| 11 | bg-opacity-slash | PASS | Uses slash syntax: `bg-black/50` (L39), `bg-gray-100/50` (L21). No `bg-opacity-*`. |
| 12 | focus-ring | FAIL | Most interactive elements have `focus:ring-2 focus:ring-offset-2`, BUT the dropdown `<li>` items (L244-248) are clickable (`onClick`) interactive elements with no focus styles (and not even keyboard-focusable). Assertion: focus styles on ALL interactive elements. Doubt → FAIL. |
| 13 | touch-targets | FAIL | No 44x44px min touch target enforced. `MenuButton` L51-52 is `p-2` around a `w-5 h-5` svg = ~36px, below 44px. No `min-h-[44px]`/`min-w-[44px]` or `size-11` anywhere. Trap not corrected. |
| 14 | sr-only-icons | PASS | `MenuButton` L51-54 now has `aria-label="Menu"` on the icon-only button. Trap corrected. |
| 15 | motion-reduce | PASS | `motion-reduce:transition-none` added wherever `transition-*` is used: L40, L84, L100, L235, L247. |
| 16 | gpu-properties | FAIL | `dialog.tsx` L40 still uses `transition-all` (animates non-GPU props). Assertion explicitly says avoid `transition-all`; only GPU properties. `transition-all` remains → not corrected. |
| 17 | no-forwardRef | FAIL | `card.tsx` L15 still uses `React.forwardRef<HTMLDivElement, CardProps>` with `ref` arg and `displayName` (L30). React 19 wants `ref` as a regular prop, no forwardRef. Trap NOT corrected; report L285 even admits "use React.forwardRef". |
| 18 | compound-dialog | PASS | `dialog.tsx` L33-46 uses Radix compound API `Dialog.Root/Portal/Overlay/Content`. Compound pattern present. |
| 19 | z-index-systematic | PASS | `theme.css` L127-131 defines `--z-dropdown:10 ... --z-toast:50`; usages reference `z-[var(--z-modal)]`, `z-[var(--z-dropdown)]`. No `z-999`. |
| 20 | dark-mode-tokens | PASS | `dark-mode.css` L206-213 `@custom-variant dark` + `:where(.dark){ --color-background/foreground override }`. Dark mode via token overrides present. |
| 21 | mobile-first | FAIL | `dialog.tsx` L40 still has fixed `w-[480px]` with no responsive override (e.g. `w-full sm:w-[480px]`). The exact trap (fixed width `w-[480px]`) is uncorrected. |
| 22 | size-shorthand | PASS | `avatar.tsx` L111,113 uses `size-8` for equal w/h. Report L309 confirms w-8 h-8 → size-8. |
| 23 | color-mix-oklab | PASS | `theme.css` L139-143 `color-mix(in oklab, var(--color-primary) ..., transparent)` utility for semi-transparent variant. |
| 24 | color-initial | FAIL | `@theme` (L120-136) defines custom colors but never emits `--color-*: initial` to clear defaults first. Trap uncorrected; no such line anywhere. |
| 25 | animation-tokens-theme | FAIL | `animate-pulse` used in skeleton (L187-189) but `@theme` defines NO `--animate-*` tokens and NO `@keyframes`. Assertion requires animation tokens + keyframes in @theme. Uncorrected. |
| 26 | container-queries | FAIL | `container-card.tsx` L259-265 has no `@container` on parent and no `@lg:`/`@2xl:` on children. Trap uncorrected. |
| 27 | grid-truncate-min-w-0 | PASS | `user-grid.tsx` L163 cell has `min-w-0`, children L165-166 use `truncate`. min-w-0 + truncate present. |
| 28 | contrast-more | FAIL | `price-tag.tsx` L174-179 has no `contrast-more:` variant. Trap uncorrected. |
| 29 | skeleton-pattern | PASS | `skeleton.tsx` L187-189 `bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse`. Matches required pattern. |
| 30 | starting-style-popover | FAIL | `popover.tsx` L195-201 native `popover` has no `@starting-style` / entry-animation handling. Trap uncorrected. |
| 31 | custom-variant-dark | PASS | `dark-mode.css` L206 `@custom-variant dark (&:where(.dark, .dark *));`. Exactly the required v4 syntax. |
| 32 | body-semantic-tokens | PASS | `app.css` L272-278 `* { @apply border-border }` and `body { @apply bg-background text-foreground }`. (Also layout.tsx L149 bg-background text-foreground.) Both halves satisfied. |
| 33 | radix-primitives | PASS | `dialog.tsx` L33 imports `@radix-ui/react-dialog` and builds dialog from Radix primitives. (Note: dropdown still hand-rolled, but assertion trap was the dialog/component using Radix — Radix is now used.) |

## Summary

Passed: 21 / 33
Failed: 12 / 33

Fails: cva-variants, spacing-scale, focus-ring, touch-targets, gpu-properties, no-forwardRef, mobile-first, color-initial, animation-tokens-theme, container-queries, contrast-more, starting-style-popover.
