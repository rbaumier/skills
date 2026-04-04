# Full-Sweep Refactoring (with skill)

## Issues Identified

1. **tailwind.config.ts** -- v4 uses CSS-first config (`@theme`), not `tailwind.config.ts`
2. **Hex colors** -- Should use OKLCH format in `@theme` design tokens
3. **content array with node_modules** -- v4 auto-detects content; never include node_modules
4. **@tailwind directives** -- v4 uses `@import "tailwindcss"`
5. **forwardRef** -- React 19: ref is a regular prop
6. **Template literal class concatenation** -- Use `cn()` (twMerge + clsx)
7. **Manual ternary for variants** -- Use `cva()` for component variants
8. **Odd spacing (p-5, mb-7)** -- Spacing scale increments of 4
9. **Arbitrary pixel values (text-[12px], text-[16px])** -- Use Tailwind size classes
10. **Dynamic class construction (bg-${color}-500)** -- Use full string maps
11. **bg-opacity-50** -- v4 uses `bg-gray-100/50` slash syntax
12. **@apply in component styles** -- Only allowed for base/typography
13. **No focus styles** -- All interactive elements need `focus:ring-2 focus:ring-offset-2`
14. **No touch targets** -- 44x44px minimum on mobile
15. **transition-all** -- Only GPU properties (transform, opacity)
16. **No motion-reduce** -- Need `motion-reduce:transition-none`
17. **z-999** -- Systematic z-index scale (10, 20, 40, 50)
18. **No dark mode** -- Need `.dark { --color-*: value }` overrides
19. **Fixed width w-[480px]** -- Mobile-first responsive
20. **Dialog as single component** -- Should be compound pattern (Dialog.Trigger, Dialog.Content)
21. **No sr-only / aria considerations** -- Accessibility labels needed

---

## Refactored Code

### `app.css` (replaces both `app.css` and `tailwind.config.ts`)

```css
/* app.css -- Tailwind v4: CSS-first configuration */
@import "tailwindcss";

/* --- Design Tokens --- */
@theme {
  /* Clear defaults before custom palette */
  --color-*: initial;

  /* Primary palette in OKLCH */
  --color-primary: oklch(0.62 0.21 255);
  --color-primary-hover: oklch(0.55 0.23 255);
  --color-secondary: oklch(0.72 0.19 160);
  --color-secondary-hover: oklch(0.65 0.21 160);

  /* Neutral palette */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.15 0.01 260);
  --color-muted: oklch(0.55 0.02 260);
  --color-surface: oklch(0.97 0.005 260);
  --color-border: oklch(0.88 0.01 260);

  /* Semantic */
  --color-overlay: oklch(0.15 0.01 260 / 50%);

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Z-index scale */
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-overlay: 40;
  --z-modal: 50;
}

/* --- Dark Mode --- */
@custom-variant dark (&:where(.dark, .dark *));

.dark {
  --color-background: oklch(0.15 0.01 260);
  --color-foreground: oklch(0.95 0.005 260);
  --color-muted: oklch(0.65 0.02 260);
  --color-surface: oklch(0.22 0.015 260);
  --color-border: oklch(0.35 0.02 260);
  --color-overlay: oklch(0 0 0 / 60%);
}

/* --- Base layer (only place @apply is allowed) --- */
@layer base {
  body {
    @apply bg-background text-foreground antialiased;
  }

  * {
    @apply border-border;
  }
}
```

### `lib/utils.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### `components/card.tsx`

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card variants using cva() -- no manual ternaries, no @apply.
 * Spacing follows 4-scale (p-4, mb-6 instead of p-5, mb-7).
 */
const cardVariants = cva(
  /* base: layout > sizing > spacing > typography > visual */
  "rounded-lg p-4 mb-6",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white dark:bg-primary/90",
        ghost: "bg-surface/50 dark:bg-surface/30",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

type CardProps = React.ComponentProps<"div"> & VariantProps<typeof cardVariants>;

/**
 * Card component.
 * React 19: ref is a regular prop -- no forwardRef needed.
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

### `components/dialog.tsx`

```tsx
import { createContext, useContext, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * Compound component pattern: Dialog.Root, Dialog.Trigger, Dialog.Content.
 * For production, prefer Radix Dialog primitives for full a11y.
 */

type DialogContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("Dialog compound components must be used within Dialog.Root");
  return ctx;
}

/* --- Root: state provider --- */
function Root({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

/* --- Trigger: opens the dialog --- */
function Trigger({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { setOpen } = useDialog();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        /* min 44x44 touch target, focus ring, motion-reduce */
        "min-h-11 min-w-11 rounded-md",
        "focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* --- Content: the modal panel --- */
function Content({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { open, setOpen } = useDialog();
  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  if (!open) return null;

  return (
    /* Overlay -- systematic z-index (50 = modal layer) */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
      onClick={handleClose}
      role="presentation"
    >
      {/* Panel -- mobile-first responsive widths, GPU-only transitions */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-lg mx-4 sm:mx-0",
          "rounded-xl bg-background p-6",
          "transition-opacity duration-200",
          "motion-reduce:transition-none",
          "dark:bg-surface",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

/* --- Compound export --- */
export const Dialog = { Root, Trigger, Content };
```

### `components/button.tsx`

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button with cva() variants.
 * - Full string maps for colors (no dynamic class concatenation).
 * - Tailwind size tokens (text-sm, text-base) instead of arbitrary px.
 * - 44x44 min touch target on mobile.
 * - Focus ring on all interactive elements.
 * - GPU-only transitions (transform, opacity) -- no transition-all.
 * - motion-reduce:transition-none for a11y.
 */
const buttonVariants = cva(
  [
    /* base: layout > sizing > spacing > typography > visual > interactive */
    "inline-flex items-center justify-center",
    "min-h-11 min-w-11",
    "rounded-md font-medium text-white",
    "transition-colors duration-150",
    "focus:ring-2 focus:ring-offset-2",
    "motion-reduce:transition-none",
  ],
  {
    variants: {
      color: {
        primary:
          "bg-primary hover:bg-primary-hover focus:ring-primary",
        secondary:
          "bg-secondary hover:bg-secondary-hover focus:ring-secondary",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
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
  VariantProps<typeof buttonVariants> & {
    label: string;
  };

export function Button({
  label,
  color,
  size,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ color, size }), className)}
      {...props}
    >
      {label}
    </button>
  );
}
```

### `components/hero.tsx`

```tsx
import { cn } from "@/lib/utils";

/**
 * Hero section.
 * - Semantic color tokens (bg-background, text-foreground) instead of raw hex.
 * - Mobile-first responsive: base = mobile, add sm:/md:/lg:.
 * - Responsive text sizing.
 * - Focus ring + min touch target on CTA button.
 * - Dark mode support via semantic tokens.
 * - motion-reduce for transitions.
 */
export function Hero() {
  return (
    <section className="bg-background px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
      <h1 className="text-4xl font-bold text-foreground sm:text-5xl lg:text-6xl">
        Welcome
      </h1>
      <p className="mt-4 text-muted">Subtitle here</p>
      <button
        className={cn(
          "mt-8 inline-flex items-center justify-center",
          "min-h-11 min-w-11 rounded-md px-6 py-3",
          "bg-primary text-white",
          "hover:bg-primary-hover",
          "focus:ring-2 focus:ring-primary focus:ring-offset-2",
          "transition-colors duration-150",
          "motion-reduce:transition-none"
        )}
      >
        Get Started
      </button>
    </section>
  );
}
```

### `styles/card.css` -- DELETED

The old `card.css` used `@apply` for component styles, which defeats utility-first.
Card styling is now handled entirely by `cva()` in `components/card.tsx`.
This file should be removed.

---

## Summary of Rules Applied

| # | Rule | What Changed |
|---|------|-------------|
| 1 | `cn()` for conditional/merged classes | Replaced all template literal concatenation with `cn()` |
| 2 | `cva()` for component variants | Card and Button use `cva()` instead of manual ternaries |
| 3 | No `@apply` in components | Deleted `styles/card.css`; `@apply` only in base layer |
| 4 | Spacing scale (multiples of 4) | `p-5` -> `p-4`, `mb-7` -> `mb-6` |
| 5 | Tailwind size classes | `text-[12px]` -> `text-sm`, `text-[16px]` -> `text-base` |
| 6 | No dynamic class concatenation | `bg-${color}-500` replaced with full string map in `cva()` |
| 7 | OKLCH design tokens | Hex `#3b82f6` replaced with `oklch(0.62 0.21 255)` in `@theme` |
| 8 | v4 `@theme` in CSS | Removed `tailwind.config.ts`; tokens defined in `app.css` `@theme {}` |
| 9 | v4 `@import "tailwindcss"` | Replaced `@tailwind base/components/utilities` directives |
| 10 | No content array / node_modules | Removed entirely; v4 auto-detects |
| 11 | `bg-black/50` slash syntax | `bg-opacity-50` replaced with `/50` opacity modifier |
| 12 | Focus ring on interactive elements | `focus:ring-2 focus:ring-offset-2` on all buttons |
| 13 | 44x44 min touch targets | `min-h-11 min-w-11` on all buttons |
| 14 | sr-only / aria consideration | Dialog has `role="dialog"`, `aria-modal="true"` |
| 15 | `motion-reduce:transition-none` | Added to all elements with transitions |
| 16 | GPU-only transitions | `transition-all` replaced with `transition-colors` / `transition-opacity` |
| 17 | React 19: no forwardRef | Card uses `ref` as regular prop |
| 18 | Compound component pattern | Dialog split into `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content` |
| 19 | Systematic z-index | `z-999` replaced with `z-50` (modal layer) |
| 20 | Dark mode tokens | `.dark { --color-*: value }` overrides in `app.css` |
| 21 | Mobile-first responsive | Fixed `w-[480px]` replaced with `w-full max-w-lg`; responsive padding/text |
