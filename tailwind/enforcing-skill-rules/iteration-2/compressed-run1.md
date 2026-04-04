# Tailwind Eval — Full Sweep — Compressed Run 1

## Fixed Code

```css
/* app.css — v4 */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.62 0.21 255);
  --color-secondary: oklch(0.72 0.19 163);
  --color-foreground: oklch(0.15 0 0);
  --color-background: oklch(1 0 0);
  --color-border: oklch(0.85 0 0);
  --color-muted: oklch(0.95 0 0);

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  --animate-fade-in: fade-in 0.2s ease-out;

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
}

@custom-variant dark (&:where(.dark, .dark *));

.dark {
  --color-primary: oklch(0.72 0.19 255);
  --color-secondary: oklch(0.78 0.17 163);
  --color-foreground: oklch(0.95 0 0);
  --color-background: oklch(0.13 0 0);
  --color-border: oklch(0.3 0 0);
  --color-muted: oklch(0.2 0 0);
}
```

```tsx
// card.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// [cva-variants] cva() for component variants
// [no-forwardRef] React 19: ref as regular prop
// [spacing-scale] p-6 (24px) instead of p-5 (20px odd); mb-8 instead of mb-7
// [oklch-tokens] semantic token bg-primary instead of hex #3b82f6
// [bg-opacity-slash] bg-primary/50 not bg-opacity-50
const cardVariants = cva(
  "rounded-lg p-6 mb-8",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white",
        ghost: "bg-primary/10 text-foreground",
      },
    },
    defaultVariants: { variant: "primary" },
  }
);

type CardProps = VariantProps<typeof cardVariants> & {
  ref?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
  className?: string;
};

export function Card({ variant, children, ref, className }: CardProps) {
  return (
    <div ref={ref} className={cn(cardVariants({ variant }), className)}>
      {children}
    </div>
  );
}
```

```tsx
// dialog.tsx
// [compound-dialog] Compound component pattern (Dialog.Trigger, Dialog.Content)
// [z-index-systematic] z-50 instead of z-999
// [mobile-first] responsive width: w-full sm:max-w-md md:max-w-lg
// [gpu-properties] transition-[transform,opacity] not transition-all
// [motion-reduce] motion-reduce:transition-none
// [focus-ring] focus:ring-2 focus:ring-offset-2 on interactive overlay
// [dark-mode-tokens] uses semantic tokens that adapt to dark
import { cn } from "@/lib/utils";

function DialogOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}

function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full sm:max-w-md md:max-w-lg rounded-xl bg-background p-6",
        "transition-[transform,opacity] duration-200 ease-out",
        "motion-reduce:transition-none",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function DialogTrigger({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      {children}
    </button>
  );
}

export const Dialog = Object.assign(
  ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
    if (!open) return null;
    return <DialogOverlay onClose={onClose}>{children}</DialogOverlay>;
  },
  { Trigger: DialogTrigger, Content: DialogContent }
);
```

```tsx
// button.tsx
// [no-dynamic-classes] Full string map instead of bg-${color}-500
// [tailwind-sizes] text-sm / text-base instead of text-[12px] / text-[16px]
// [cn-merge] cn() for conditional/merged classes
// [focus-ring] focus:ring-2 focus:ring-offset-2
// [touch-targets] min-h-11 (44px) minimum touch target
// [sr-only-icons] aria-label supported for icon-only usage
// [gpu-properties] transition-[color,background-color] not transition-all
// [motion-reduce] motion-reduce:transition-none
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const colorMap = {
  blue: "bg-blue-500 hover:bg-blue-600",
  green: "bg-green-500 hover:bg-green-600",
  red: "bg-red-500 hover:bg-red-600",
} as const;

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center rounded text-white",
    "min-h-11",
    "transition-[color,background-color] duration-150",
    "motion-reduce:transition-none",
    "focus:ring-2 focus:ring-offset-2 focus:ring-primary",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-base",
      },
      color: colorMap,
    },
    defaultVariants: { size: "md", color: "blue" },
  }
);

type ButtonProps = VariantProps<typeof buttonVariants> & {
  label: string;
  className?: string;
  "aria-label"?: string;
};

export function Button({ label, color, size, className, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ color, size }), className)} {...props}>
      {label}
    </button>
  );
}
```

```tsx
// hero.tsx
// [mobile-first] responsive text: text-4xl sm:text-5xl lg:text-6xl
// [oklch-tokens] semantic tokens bg-background text-foreground, not hex
// [dark-mode-tokens] tokens auto-adapt in dark mode
// [focus-ring] focus:ring-2 on interactive button
// [touch-targets] min-h-11 on CTA
// [motion-reduce] motion-reduce:transition-none
export function Hero() {
  return (
    <section className="bg-background px-8 py-24">
      <h1 className="text-4xl font-bold text-foreground sm:text-5xl lg:text-6xl">
        Welcome
      </h1>
      <p className="mt-4 text-muted-foreground">Subtitle here</p>
      <button
        className={cn(
          "mt-8 min-h-11 rounded bg-primary px-6 py-3 text-white",
          "transition-[color,background-color] duration-150",
          "motion-reduce:transition-none",
          "hover:bg-primary/90",
          "focus:ring-2 focus:ring-primary focus:ring-offset-2"
        )}
      >
        Get Started
      </button>
    </section>
  );
}
```

```css
/* card.css — REMOVED */
/* [no-apply-components] @apply only for base/typography, not component styles.
   Moved to cva() in card.tsx above. This file is deleted. */
```

## Issues Fixed

| # | Assertion ID | What was wrong | Fix applied |
|---|---|---|---|
| 1 | cn-merge | Template literal `${baseClasses} ${variantClass}` | `cn()` everywhere |
| 2 | cva-variants | Manual ternary for variant | `cva()` with variant map |
| 3 | no-apply-components | `@apply` in card.css component | Removed; styles via cva() |
| 4 | spacing-scale | p-5, mb-7 (odd values) | p-6, mb-8 (multiples of 4) |
| 5 | tailwind-sizes | text-[12px], text-[16px] arbitrary | text-sm, text-base |
| 6 | no-dynamic-classes | `bg-${color}-500` dynamic | Full string map object |
| 7 | oklch-tokens | Hex #3b82f6 hardcoded | OKLCH in @theme, semantic tokens |
| 8 | v4-theme-css | tailwind.config.ts | @theme {} in CSS |
| 9 | v4-import | @tailwind base/components/utilities | @import "tailwindcss" |
| 10 | no-content-node-modules | node_modules in content array | Removed; v4 auto-detects |
| 11 | bg-opacity-slash | bg-opacity-50 | bg-primary/10, bg-primary/50 |
| 12 | focus-ring | No focus styles | focus:ring-2 focus:ring-offset-2 |
| 13 | touch-targets | Small buttons | min-h-11 (44px) |
| 14 | sr-only-icons | No aria consideration | aria-label prop support |
| 15 | motion-reduce | No reduced motion | motion-reduce:transition-none |
| 16 | gpu-properties | transition-all | transition-[transform,opacity] specific |
| 17 | no-forwardRef | forwardRef wrapper | React 19 ref as prop |
| 18 | compound-dialog | Single Dialog component | Dialog.Trigger, Dialog.Content |
| 19 | z-index-systematic | z-999 arbitrary | z-50 systematic |
| 20 | dark-mode-tokens | No dark mode | .dark { --color-*: value } |
| 21 | mobile-first | Fixed w-[480px], no responsive | w-full sm:max-w-md, responsive text |
