# Full-Sweep Refactoring — Tailwind v4 + React 19

Below is the complete refactored code for all files. Every issue has been addressed according to Tailwind v4 and React 19 best practices.

---

## `app.css` — v4 entry point with design tokens and dark mode

```css
/* v4: @import replaces @tailwind directives */
@import "tailwindcss";

/* v4: @theme replaces tailwind.config.ts — OKLCH color tokens */
@theme {
  --color-*: initial; /* clear defaults before custom palette */

  --color-primary: oklch(0.59 0.2 264);
  --color-primary-hover: oklch(0.53 0.2 264);
  --color-secondary: oklch(0.65 0.17 162);

  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.15 0 0);
  --color-muted: oklch(0.95 0 0);
  --color-muted-foreground: oklch(0.45 0 0);
  --color-border: oklch(0.88 0 0);

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  --z-overlay: 40;
  --z-modal: 50;
}

/* v4: dark mode via custom variant */
@custom-variant dark (&:where(.dark, .dark *));

.dark {
  --color-background: oklch(0.15 0 0);
  --color-foreground: oklch(0.95 0 0);
  --color-muted: oklch(0.25 0 0);
  --color-muted-foreground: oklch(0.65 0 0);
  --color-border: oklch(0.3 0 0);
}

/* Base layer — @apply is acceptable here for global resets */
@layer base {
  body {
    @apply bg-background text-foreground;
  }
  * {
    @apply border-border;
  }
}
```

**Deleted**: `tailwind.config.ts` — v4 uses CSS-first config via `@theme`. No `content` array needed (auto content detection). Never include `node_modules` in content.

**Deleted**: `styles/card.css` — `@apply` in component styles defeats utility-first. Replaced with `cva()` in the Card component below.

---

## `lib/utils.ts` — cn() helper

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## `components/card.tsx` — cva() variants, no forwardRef, proper spacing

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card variants using cva() — replaces manual ternary + @apply.
 * Spacing uses scale increments of 4 (p-4, not p-5).
 * Class order: layout > sizing > spacing > typography > visual > dark > responsive.
 */
const cardVariants = cva(
  "rounded-lg p-4 mb-8", // base: layout > spacing (fixed p-5->p-4, mb-7->mb-8)
  {
    variants: {
      variant: {
        primary: "bg-primary text-white dark:bg-primary/90",
        ghost: "bg-muted/50 dark:bg-muted",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

type CardProps = React.ComponentProps<"div"> & VariantProps<typeof cardVariants>;

/**
 * React 19: ref is a regular prop — no forwardRef needed.
 * cn() merges classes with tailwind-merge conflict resolution.
 */
export function Card({ variant, className, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}
```

---

## `components/dialog.tsx` — compound component pattern, systematic z-index, responsive, accessible

```tsx
import { createContext, useContext } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * Compound component pattern: Dialog.Root, Dialog.Trigger, Dialog.Content.
 * Uses Radix primitives for built-in accessibility (focus trap, aria, esc-close).
 */

/** Dialog.Root — state container */
function Root({ children, ...props }: DialogPrimitive.DialogProps) {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;
}

/** Dialog.Trigger — accessible trigger button */
function Trigger({ children, ...props }: DialogPrimitive.DialogTriggerProps) {
  return (
    <DialogPrimitive.Trigger {...props}>{children}</DialogPrimitive.Trigger>
  );
}

/**
 * Dialog.Content — overlay + panel.
 * - z-50 from systematic scale (not z-999).
 * - Mobile-first responsive width: full on mobile, max-w-lg on md+.
 * - GPU-only transitions (opacity + transform), not transition-all.
 * - motion-reduce:transition-none for accessibility.
 * - focus:ring on interactive overlay for accessibility.
 */
function Content({
  children,
  className,
  ...props
}: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-40 bg-foreground/50",
          "transition-opacity duration-200",
          "motion-reduce:transition-none"
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-4 top-1/2 z-50 -translate-y-1/2",
          "mx-auto w-full max-w-lg",
          "rounded-xl p-6",
          "bg-background text-foreground",
          "transition-[opacity,transform] duration-200",
          "motion-reduce:transition-none",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          "dark:border dark:border-border",
          "md:inset-x-auto",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Dialog.Close — accessible close button */
function Close({ children, ...props }: DialogPrimitive.DialogCloseProps) {
  return <DialogPrimitive.Close {...props}>{children}</DialogPrimitive.Close>;
}

export const Dialog = { Root, Trigger, Content, Close };
```

---

## `components/button.tsx` — full string maps, cva(), accessible, touch targets

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button with cva() variants.
 * - Full string maps for colors — never concatenate dynamic classes (purge-safe).
 * - Tailwind size tokens (text-sm, text-base) — not arbitrary px.
 * - Spacing on scale of 4 (px-2, py-1, px-4, py-2).
 * - min-h-11 ensures 44px minimum touch target on mobile.
 * - focus:ring for keyboard accessibility.
 * - GPU-only transition (colors = background-color, color, border-color).
 * - motion-reduce:transition-none for reduced-motion preference.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "min-h-11",
    "rounded-md",
    "font-medium",
    "transition-colors duration-150",
    "focus:ring-2 focus:ring-offset-2 focus:outline-none",
    "motion-reduce:transition-none",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      color: {
        primary:
          "bg-primary text-white hover:bg-primary-hover focus:ring-primary dark:bg-primary/90 dark:hover:bg-primary",
        secondary:
          "bg-secondary text-white hover:bg-secondary/90 focus:ring-secondary dark:bg-secondary/80 dark:hover:bg-secondary/90",
      },
      size: {
        sm: "px-2 py-1 text-sm",
        md: "px-4 py-2 text-base",
      },
    },
    defaultVariants: {
      color: "primary",
      size: "md",
    },
  }
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({
  color,
  size,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ color, size }), className)} {...props}>
      {children}
    </button>
  );
}
```

---

## `components/hero.tsx` — semantic tokens, responsive, dark mode, accessible

```tsx
import { Button } from "./button";

/**
 * Hero section.
 * - Semantic tokens (bg-background, text-foreground) — no raw hex colors.
 * - Mobile-first responsive: base padding for mobile, wider on md+/lg+.
 * - Responsive text scaling: text-3xl base -> sm:text-4xl -> lg:text-5xl.
 * - Dark mode works automatically via semantic tokens.
 * - Button inherits accessibility (focus ring, touch target) from Button component.
 */
export function Hero() {
  return (
    <section className="bg-background px-4 py-16 text-foreground sm:px-8 md:py-24 lg:px-12">
      <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">Welcome</h1>
      <p className="mt-4 text-muted-foreground">Subtitle here</p>
      <Button color="primary" size="md" className="mt-8">
        Get Started
      </Button>
    </section>
  );
}
```

---

## Summary of fixes applied

| # | Issue | Fix |
|---|-------|-----|
| 1 | Template literal class concatenation | `cn()` (twMerge + clsx) everywhere |
| 2 | Manual ternary for variants | `cva()` for Card and Button variants |
| 3 | `@apply` in card.css component | Deleted; replaced with `cva()` |
| 4 | `p-5`, `mb-7` odd spacing | `p-4`, `mb-8` (scale of 4) |
| 5 | `text-[12px]`, `text-[16px]` arbitrary | `text-sm`, `text-base` |
| 6 | `bg-${color}-500` dynamic classes | Full string map in cva variants |
| 7 | Hex `#3b82f6` colors | OKLCH tokens in `@theme` |
| 8 | `tailwind.config.ts` | Deleted; `@theme {}` in CSS |
| 9 | `@tailwind` directives | `@import "tailwindcss"` |
| 10 | `node_modules` in content array | Removed; v4 auto-detects content |
| 11 | `bg-opacity-50` | `bg-muted/50` (slash syntax) |
| 12 | No focus styles | `focus:ring-2 focus:ring-offset-2` on all interactive elements |
| 13 | No min touch target | `min-h-11` (44px) on buttons |
| 14 | No sr-only / aria consideration | Radix primitives handle aria; Button uses `children` not bare `label` |
| 15 | `transition-all` without motion-reduce | `motion-reduce:transition-none` on all animations |
| 16 | `transition-all` animates width/height | GPU-only: `transition-colors`, `transition-[opacity,transform]` |
| 17 | `forwardRef` in Card | React 19: `ref` as regular prop |
| 18 | Dialog as single component | Compound pattern: `Dialog.Root`, `.Trigger`, `.Content`, `.Close` |
| 19 | `z-999` arbitrary | Systematic `z-40` (overlay), `z-50` (modal) |
| 20 | No dark mode | `.dark` overrides in CSS, semantic tokens, `dark:` variants |
| 21 | Fixed `w-[480px]`, no responsive | Mobile-first: `w-full max-w-lg`, responsive padding breakpoints |
