# Full-Sweep Refactoring (with Tailwind Skill)

Below is the complete refactored code for the Tailwind v4 + React 19 project. Every file has been rewritten to comply with the skill rules.

---

## `app.css` — Global styles, design tokens, dark mode

```css
/* v4: @import replaces @tailwind directives */
@import "tailwindcss";

/* v4: @theme {} in CSS replaces tailwind.config.ts */
@theme {
  /* Clear default palette before defining custom tokens */
  --color-*: initial;

  /* OKLCH format for all color tokens */
  --color-primary: oklch(0.62 0.21 255);
  --color-primary-hover: oklch(0.55 0.23 255);
  --color-secondary: oklch(0.70 0.17 160);
  --color-secondary-hover: oklch(0.63 0.19 160);

  /* Semantic surface/text tokens */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.15 0.01 250);
  --color-muted: oklch(0.96 0.005 250);
  --color-muted-foreground: oklch(0.55 0.01 250);
  --color-border: oklch(0.90 0.005 250);

  /* Radius tokens */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Systematic z-index scale */
  --z-overlay: 40;
  --z-modal: 50;
}

/* v4: @custom-variant for dark mode */
@custom-variant dark (&:where(.dark, .dark *));

/* Dark mode token overrides */
.dark {
  --color-background: oklch(0.15 0.01 250);
  --color-foreground: oklch(0.95 0.005 250);
  --color-muted: oklch(0.22 0.01 250);
  --color-muted-foreground: oklch(0.65 0.01 250);
  --color-border: oklch(0.30 0.01 250);
}

/* Base layer — only place @apply is acceptable */
@layer base {
  body {
    @apply bg-background text-foreground;
  }

  * {
    @apply border-border;
  }
}
```

**Delete `tailwind.config.ts`** — v4 uses CSS-first config via `@theme`. No `content` array needed (auto content detection). Never include `node_modules` in content.

**Delete `styles/card.css`** — `@apply` in component styles defeats utility-first. Replaced by `cva()` variants below.

---

## `lib/utils.ts` — cn() helper (twMerge + clsx)

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## `components/card.tsx` — cva variants, cn(), no forwardRef

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card variant definitions using cva().
 * - Spacing uses scale increments of 4 (p-4, not p-5; mb-6, not mb-7)
 * - Semantic color tokens instead of raw hex
 * - Dark mode support via token overrides
 */
const cardVariants = cva(
  /* base: layout > sizing > spacing > typography > visual > interactive > dark */
  "rounded-lg p-4 mb-6 transition-colors duration-200 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white dark:bg-primary/90",
        ghost:
          "bg-muted/50 text-foreground dark:bg-muted/30",
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
 * cn() merges base + variant + caller overrides without conflicts.
 */
export function Card({ variant, className, children, ref, ...props }: CardProps) {
  return (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props}>
      {children}
    </div>
  );
}
```

---

## `components/dialog.tsx` — Compound component pattern, systematic z-index, responsive, a11y

```tsx
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

/**
 * Compound component pattern: Dialog.Root, Dialog.Trigger, Dialog.Content
 * Uses Radix-style API for accessibility.
 * Consider using @radix-ui/react-dialog for production.
 */

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("Dialog compound components must be used within Dialog.Root");
  return ctx;
}

/** Root provider — manages open/close state */
function Root({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

/** Trigger — the element that opens the dialog */
function Trigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const { onOpenChange } = useDialogContext();
  return (
    <button
      type="button"
      onClick={() => onOpenChange(true)}
      className={cn(
        /* min 44px touch target, focus ring for a11y */
        "min-h-11 min-w-11 focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:outline-none",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Content — the modal panel itself */
function Content({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, onOpenChange } = useDialogContext();

  if (!open) return null;

  return (
    /* Overlay: systematic z-50 (modal layer), not arbitrary z-999 */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 dark:bg-background/70"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
    >
      {/* 
        Mobile-first responsive: full-width on mobile, max-w on md+
        GPU-safe transitions: only transform + opacity, NOT transition-all
        motion-reduce: disable transitions for a11y
      */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-lg mx-4 rounded-xl bg-background p-6",
          "shadow-lg transition-[transform,opacity] duration-200",
          "motion-reduce:transition-none",
          "md:mx-0",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Assembled compound component */
export const Dialog = Object.assign(Root, {
  Root,
  Trigger,
  Content,
});
```

---

## `components/button.tsx` — Full string maps, cva, focus ring, touch targets, no arbitrary px

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button with cva() variants.
 * - NO dynamic class concatenation (bg-${color}-500 is purged in production)
 * - Full string maps for color variants
 * - Tailwind size classes (text-sm, text-base) not arbitrary px (text-[12px])
 * - Spacing increments of 4 (px-2 py-1, px-4 py-2)
 * - 44x44 min touch target for mobile a11y
 * - focus:ring for keyboard navigation
 * - motion-reduce for animation a11y
 * - GPU-safe transitions (transform, opacity, colors) — no transition-all
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center rounded-md font-medium",
    "min-h-11 min-w-11",
    "transition-colors duration-150",
    "motion-reduce:transition-none",
    "focus:ring-2 focus:ring-offset-2 focus:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      color: {
        primary:
          "bg-primary text-white hover:bg-primary-hover focus:ring-primary",
        secondary:
          "bg-secondary text-white hover:bg-secondary-hover focus:ring-secondary",
        muted:
          "bg-muted text-muted-foreground hover:bg-muted/80 focus:ring-muted-foreground",
      },
      size: {
        sm: "px-2 py-1 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
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
    /** Visible label text */
    label: string;
  };

export function Button({ label, color, size, className, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ color, size }), className)} {...props}>
      {label}
    </button>
  );
}
```

---

## `components/hero.tsx` — Semantic tokens, responsive text, dark mode, mobile-first

```tsx
import { cn } from "@/lib/utils";

/**
 * Hero section.
 * - Semantic tokens (bg-background, text-foreground) instead of raw hex (#1a1a1a)
 * - Mobile-first responsive: base=mobile, add sm:/md:/lg:
 * - Responsive text scaling: text-4xl sm:text-5xl lg:text-6xl
 * - Spacing increments of 4 (py-16 or py-24, px-4 base scaling up)
 * - Button has focus ring + min touch target
 * - Dark mode inherited through semantic tokens
 * - motion-reduce on transitions
 */
export function Hero() {
  return (
    <section className="bg-background px-4 py-16 sm:px-8 md:py-24">
      <h1 className="text-4xl font-bold text-foreground sm:text-5xl lg:text-6xl">
        Welcome
      </h1>
      <p className="mt-4 text-muted-foreground">
        Subtitle here
      </p>
      <button
        className={cn(
          "mt-8 min-h-11 rounded-md bg-primary px-6 py-3 text-white",
          "transition-colors duration-150 motion-reduce:transition-none",
          "hover:bg-primary-hover",
          "focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:outline-none"
        )}
      >
        Get Started
      </button>
    </section>
  );
}
```

---

## Summary of changes

| # | Issue | Rule applied |
|---|-------|-------------|
| 1 | Template literal class concatenation | **cn()** (twMerge + clsx) for all conditional/merged classes |
| 2 | Manual ternary for variant classes | **cva()** for component variants |
| 3 | `@apply` in card.css component styles | Deleted file; `@apply` only in base layer |
| 4 | `p-5`, `mb-7` odd spacing | Fixed to `p-4`, `mb-6` (increments of 4) |
| 5 | `text-[12px]`, `text-[16px]` arbitrary px | Replaced with `text-sm`, `text-base` |
| 6 | `bg-${color}-500` dynamic class | Full string maps in cva `color` variant |
| 7 | Hex `#3b82f6` in config and components | OKLCH tokens in `@theme` |
| 8 | `tailwind.config.ts` | Deleted; v4 uses `@theme {}` in CSS |
| 9 | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| 10 | `node_modules` in content array | Removed; v4 auto-detects content |
| 11 | `bg-opacity-50` | `bg-muted/50` (slash syntax) |
| 12 | No focus styles on buttons | `focus:ring-2 focus:ring-offset-2` on all interactive elements |
| 13 | Small touch targets | `min-h-11 min-w-11` (44px) on all buttons |
| 14 | No screen-reader consideration | Semantic `label` prop; icon buttons would get `aria-label` + `sr-only` |
| 15 | `transition-all` without motion-reduce | `motion-reduce:transition-none` on all animated elements |
| 16 | `transition-all` animates width/height | GPU-safe `transition-colors` / `transition-[transform,opacity]` |
| 17 | `forwardRef` in Card | React 19: `ref` as regular prop |
| 18 | Dialog as single component | Compound pattern: `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content` |
| 19 | `z-999` arbitrary z-index | Systematic `z-50` (modal layer) |
| 20 | No dark mode support | `.dark { --color-*: value }` overrides + semantic tokens throughout |
| 21 | No responsive variants, `w-[480px]` | Mobile-first: `w-full max-w-lg`, responsive padding/text with `sm:/md:/lg:` |
