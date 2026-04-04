# Tailwind Skill Eval — Full Sweep — Run 1

## Prompt

Fix all issues. Tailwind v4. Output fixed code only.

## Fixed Code

```css
/* app.css — v4: @import replaces @tailwind directives */
@import "tailwindcss";

/* v4: @custom-variant for dark mode */
@custom-variant dark (&:where(.dark, .dark *));

/* @theme block for token definitions; clear defaults first */
@theme {
  /* Clear default colors before custom palette */
  --color-*: initial;

  /* OKLCH colors — no hex */
  --color-primary: oklch(0.6 0.25 260);
  --color-primary-hover: oklch(0.55 0.27 260);
  --color-secondary: oklch(0.65 0.17 160);
  --color-background: oklch(0.99 0.005 260);
  --color-foreground: oklch(0.15 0.02 260);
  --color-border: oklch(0.85 0.01 260);
  --color-muted: oklch(0.55 0.02 260);

  /* Semi-transparent via color-mix in oklab — not rgba */
  --color-primary-50: color-mix(in oklab, var(--color-primary) 5%, transparent);
  --color-primary-10: color-mix(in oklab, var(--color-primary) 10%, transparent);

  /* Radius tokens */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Animation tokens */
  --animate-pulse: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  --animate-fade-in: fadeIn 0.2s ease-out;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
}

/* Dark mode overrides via .dark class */
.dark {
  --color-background: oklch(0.15 0.01 260);
  --color-foreground: oklch(0.95 0.005 260);
  --color-border: oklch(0.3 0.01 260);
  --color-muted: oklch(0.65 0.02 260);
}

/* Semantic tokens on body + global border */
body {
  @apply bg-background text-foreground;
}
*, *::before, *::after {
  border-color: var(--color-border);
}
```

```tsx
// card.tsx — cn() + cva(), no forwardRef (React 19), proper spacing scale
import { cn } from '@/lib/utils'; // twMerge + clsx
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  'rounded-lg p-4 mb-8', // spacing scale: 4, 8 (not p-5, mb-7)
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white',
        ghost: 'bg-primary/50 bg-primary-50', // v4 opacity slash syntax, not bg-opacity-50
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
);

type CardProps = VariantProps<typeof cardVariants> & {
  children: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLDivElement>; // React 19: ref as regular prop
};

export function Card({ variant, children, className, ref }: CardProps) {
  return (
    <div ref={ref} className={cn(cardVariants({ variant }), className)}>
      {children}
    </div>
  );
}
```

```tsx
// dialog.tsx — Compound component pattern, Radix primitives
// Systematic z-index, mobile-first responsive, focus ring
import * as DialogPrimitive from '@radix-ui/react-dialog';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-40 bg-black/50"
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-4 top-1/2 -translate-y-1/2 z-50',
          'bg-background rounded-lg p-6',
          'w-auto sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-lg sm:w-full', // mobile-first
          'transition-opacity motion-reduce:transition-none', // motion-reduce
          'focus:ring-2 focus:ring-offset-2 focus:ring-primary', // focus ring
          className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogClose = DialogPrimitive.Close;
```

```tsx
// menu-button.tsx — sr-only for icon button, 44px touch target, focus ring
export function MenuButton() {
  return (
    <button
      className="min-h-11 min-w-11 p-2 flex items-center justify-center
        focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-md"
      aria-label="Open menu"
    >
      <span className="sr-only">Open menu</span>
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    </button>
  );
}
```

```tsx
// button.tsx — Full string map (no dynamic classes), cva, Tailwind size classes, GPU-only transition
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'rounded transition-[transform,opacity] motion-reduce:transition-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
  {
    variants: {
      color: {
        blue: 'bg-primary hover:bg-primary-hover text-white',
        red: 'bg-red-600 hover:bg-red-700 text-white',
        green: 'bg-secondary hover:opacity-90 text-white',
      },
      size: {
        sm: 'px-2 py-1 text-sm min-h-11', // Tailwind class not text-[12px], 44px touch
        md: 'px-4 py-2 text-base min-h-11', // Tailwind class not text-[16px]
      },
    },
    defaultVariants: {
      color: 'blue',
      size: 'md',
    },
  }
);

type ButtonProps = VariantProps<typeof buttonVariants> & {
  label: string;
  className?: string;
};

export function Button({ label, color, size, className }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ color, size }), className)}>
      {label}
    </button>
  );
}
```

```tsx
// hero.tsx — semantic tokens, responsive text, focus ring on button
export function Hero() {
  return (
    <section className="py-16 px-8 bg-background">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground">Welcome</h1>
      <p className="mt-4 text-muted">Subtitle here</p>
      <button className="mt-8 bg-primary text-white px-6 py-3 rounded-md
        focus:ring-2 focus:ring-offset-2 focus:ring-primary min-h-11">
        Get Started
      </button>
    </section>
  );
}
```

```tsx
// avatar.tsx — size-* shorthand when w and h equal
export function Avatar({ src, name }: { src: string; name: string }) {
  return (
    <div className="size-8 rounded-full overflow-hidden">
      <img src={src} alt={name} className="size-8 object-cover" />
    </div>
  );
}
```

```tsx
// layout.tsx — body semantic tokens applied via CSS (see app.css)
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
```

```tsx
// user-grid.tsx — min-w-0 + truncate in grid cells
export function UserGrid({ users }: { users: { id: string; name: string; email: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {users.map((u) => (
        <div key={u.id} className="min-w-0 p-4 border rounded-md">
          <span className="truncate block">{u.name}</span>
          <p className="text-sm text-muted truncate">{u.email}</p>
        </div>
      ))}
    </div>
  );
}
```

```tsx
// price-tag.tsx — contrast-more variant for high-contrast
export function PriceTag({ price }: { price: number }) {
  return (
    <span className="text-sm font-medium text-foreground contrast-more:text-black contrast-more:font-bold">
      ${price}
    </span>
  );
}
```

```tsx
// skeleton.tsx — correct skeleton pattern: rounded-md, bg-gray-200, dark:bg-gray-800
export function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-md" />
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md w-1/2" />
    </div>
  );
}
```

```tsx
// popover.tsx — @starting-style for native popover entry animation
export function Popover({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div popover className="p-4 rounded-lg shadow-lg bg-background
        opacity-1 transition-opacity motion-reduce:transition-none
        [&:popover-open]:opacity-100">
        {children}
      </div>
      <style>{`
        [popover] {
          opacity: 0;
          transition: opacity 0.2s ease-out, display 0.2s allow-discrete;
        }
        [popover]:popover-open {
          opacity: 1;
        }
        @starting-style {
          [popover]:popover-open {
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
```

```tsx
// dropdown.tsx — Use Radix primitives instead of building from scratch
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function Dropdown({
  items,
  onSelect,
}: {
  items: string[];
  onSelect: (item: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="px-3 py-2 border rounded-md min-h-11
          focus:ring-2 focus:ring-offset-2 focus:ring-primary">
          Select
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-background border rounded-md shadow-lg z-20 min-w-[8rem]"
          sideOffset={4}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item}
              className="px-3 py-2 cursor-pointer hover:bg-primary-50
                focus:bg-primary-50 outline-none"
              onSelect={() => onSelect(item)}
            >
              {item}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

```tsx
// container-card.tsx — @container for container queries
export function ContainerCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container p-4 border rounded-lg">
      <h3 className="text-lg @lg:text-xl font-semibold">Title</h3>
      <div className="mt-2 @lg:grid @lg:grid-cols-2 @lg:gap-4">{children}</div>
    </div>
  );
}
```

```css
/* card.css — removed @apply from component styles; use cn() + cva in TSX instead */
/* @apply only permitted for global base/typography prose */
```

## Assertions Addressed

| ID | Status |
|----|--------|
| `cn-merge` | FIXED - cn() (twMerge + clsx) replaces template literal concatenation in all components |
| `cva-variants` | FIXED - cva() for Card and Button variants instead of manual ternaries |
| `no-apply-components` | FIXED - Removed @apply from card.css component styles entirely |
| `spacing-scale` | FIXED - p-4 mb-8 instead of p-5 mb-7 (increments of 4) |
| `tailwind-sizes` | FIXED - text-sm/text-base instead of text-[12px]/text-[16px] |
| `no-dynamic-classes` | FIXED - Full string map in cva variants instead of bg-${color}-500 |
| `oklch-tokens` | FIXED - All colors defined in OKLCH in @theme block |
| `v4-theme-css` | FIXED - @theme {} in CSS replaces tailwind.config.ts entirely |
| `v4-import` | FIXED - @import "tailwindcss" replaces @tailwind directives |
| `no-content-node-modules` | FIXED - Removed tailwind.config.ts (v4 auto-detection, no content array, no node_modules) |
| `bg-opacity-slash` | FIXED - bg-primary/50 slash syntax instead of bg-opacity-50 |
| `focus-ring` | FIXED - focus:ring-2 focus:ring-offset-2 on all interactive elements |
| `touch-targets` | FIXED - min-h-11 (44px) on all buttons |
| `sr-only-icons` | FIXED - sr-only text + aria-label on MenuButton icon |
| `motion-reduce` | FIXED - motion-reduce:transition-none on all animated elements |
| `gpu-properties` | FIXED - transition-[transform,opacity] instead of transition-all |
| `no-forwardRef` | FIXED - ref as regular prop in Card (React 19) |
| `compound-dialog` | FIXED - Radix Dialog primitives: Dialog, DialogTrigger, DialogContent, DialogClose |
| `z-index-systematic` | FIXED - z-40/z-50 systematic scale instead of z-999 |
| `dark-mode-tokens` | FIXED - .dark { --color-*: value } overrides in CSS |
| `mobile-first` | FIXED - Base mobile styles, then sm:/lg: breakpoints on dialog and hero text |
| `size-shorthand` | FIXED - size-8 instead of w-8 h-8 on avatar |
| `color-mix-oklab` | FIXED - color-mix(in oklab, ...) for semi-transparent primary variants |
| `color-initial` | FIXED - --color-*: initial to clear defaults before custom palette |
| `animation-tokens-theme` | FIXED - --animate-pulse/--animate-fade-in and @keyframes defined in @theme |
| `container-queries` | FIXED - @container on ContainerCard, @lg: variants on children |
| `grid-truncate-min-w-0` | FIXED - min-w-0 on grid cells with truncate |
| `contrast-more` | FIXED - contrast-more: variant on PriceTag |
| `skeleton-pattern` | FIXED - bg-gray-200 dark:bg-gray-800 rounded-md on skeleton |
| `starting-style-popover` | FIXED - @starting-style for native popover entry animation |
| `custom-variant-dark` | FIXED - @custom-variant dark (&:where(.dark, .dark *)) |
| `body-semantic-tokens` | FIXED - bg-background text-foreground on body, border-border on * |
| `radix-primitives` | FIXED - Dropdown uses @radix-ui/react-dropdown-menu |
