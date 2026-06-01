# Grade — tailwind eval 2, iter 1

Code: `out-e2-iter1.md` | Assertions: `assertions-e2.json` | Mode: STRICT

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | read-theme-first | PASS | Primary colors use project tokens: `bg-brand`, `text-brand-foreground` (defined in `@theme` L6-7). Trap value `bg-blue-500` absent. |
| 2 | oklch-double-wrap | FAIL | `@theme` defines `--color-brand: oklch(0.7 0.15 250)` (L6) and `--color-brand-foreground: oklch(0.98 0.01 250)` (L7) wrapped in `oklch()`. Rule requires RAW values; Tailwind wraps automatically. Values are not raw. |
| 3 | cva-3-variant-threshold | FAIL | `cardVariants` (L25-32) and `buttonVariants` (L42-49) each use CVA for only 2 variants (`primary`, `secondary`). Rule: inline utilities for <3 variants, CVA for 3+. Exact trap. |
| 4 | z-index-tokens | PASS | `@theme` defines `--z-nav: 20` (L9), `--z-toast: 50` (L10); usage references tokens `z-[theme(--z-nav)]` (L58), `z-[theme(--z-toast)]` (L59). No arbitrary `z-[999]`. |
| 5 | tw-animate-css | FAIL | Custom `@keyframes fadeIn` (L13-16) for a standard fade entrance + `--animate-fade: fadeIn ...` (L8). Rule: prefer `tw-animate-css` for standard entrance animations. Exact trap. |
| 6 | plugin-directive | PASS | `@plugin "@tailwindcss/typography";` (L18) in CSS, no `plugins` array. Correct v4. |

**Passed: 3 / 6**
