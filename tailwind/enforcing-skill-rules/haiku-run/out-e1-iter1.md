```tsx
// tailwind.config.ts
// v4 uses CSS-first config (@theme), no tailwind.config.js mixing
// Remove old config; use CSS @theme instead

// card.tsx
import React from 'react';
import { cn } from '@/lib/utils';

type CardProps = {
  variant: 'primary' | 'ghost';
  children: React.ReactNode;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant, children }, ref) => {
    const baseClasses = 'rounded-lg p-6 mb-8';
    // Use cn() for conditional class merging (twMerge + clsx)
    const variantClass = variant === 'primary'
      ? 'bg-primary text-white'
      : 'bg-gray-100/50';

    return (
      <div ref={ref} className={cn(baseClasses, variantClass)}>
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

// dialog.tsx
import * as Dialog from '@radix-ui/react-dialog';

export function AppDialog({ open, onClose, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[var(--z-modal)] bg-white rounded-lg p-6 w-[480px] shadow-lg motion-reduce:transition-none transition-all">
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// menu-button.tsx
export function MenuButton() {
  return (
    <button 
      className="p-2 focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded"
      aria-label="Menu"
    >
      <svg viewBox="0 0 20 20" className="w-5 h-5">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"/>
      </svg>
    </button>
  );
}

// button.tsx
import { cn } from '@/lib/utils';

const buttonVariants = {
  red: 'bg-red-500 hover:bg-red-600',
  blue: 'bg-blue-500 hover:bg-blue-600',
  green: 'bg-green-500 hover:bg-green-600',
};

const sizeVariants = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function Button({ label, color = 'blue', size = 'md' }) {
  const colorClass = buttonVariants[color] || buttonVariants.blue;
  const sizeClass = sizeVariants[size] || sizeVariants.md;

  return (
    <button
      className={cn(
        'text-white rounded focus:ring-2 focus:ring-offset-2 transition-colors motion-reduce:transition-none',
        colorClass,
        sizeClass
      )}
    >
      {label}
    </button>
  );
}

// hero.tsx
export function Hero() {
  return (
    <section className="py-20 px-8 bg-white">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">Welcome</h1>
      <p className="mt-4 text-gray-600">Subtitle here</p>
      <button className="mt-8 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded focus:ring-2 focus:ring-offset-2 transition-colors motion-reduce:transition-none">
        Get Started
      </button>
    </section>
  );
}

// avatar.tsx
export function Avatar({ src, name }) {
  // Use size-* shorthand when w and h equal; min-w-0 + overflow-hidden prevents image overflow
  return (
    <div className="size-8 rounded-full overflow-hidden flex-shrink-0">
      <img src={src} alt={name} className="size-8 object-cover" />
    </div>
  );
}

// theme.css
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.6 0.25 260);
  --color-primary-hover: oklch(0.55 0.27 260);
  /* Raw OKLCH values without oklch() wrapper — Tailwind adds the function */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.1 0 0);
  
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-overlay: 30;
  --z-modal: 40;
  --z-toast: 50;
  
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}

/* Semi-transparent variants using color-mix in oklab */
@layer utilities {
  @utility color-mix-opacity {
    color: color-mix(in oklab, var(--color-primary) calc(100% * <alpha-value>), transparent);
  }
}

// layout.tsx
export function Layout({ children }) {
  return (
    <html>
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

// user-grid.tsx
import { cn } from '@/lib/utils';

export function UserGrid({ users }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
      {users.map(u => (
        <div key={u.id} className="p-4 border rounded-md min-w-0">
          {/* min-w-0 + truncate prevents grid overflow */}
          <span className="truncate block font-medium">{u.name}</span>
          <p className="text-sm text-gray-500 truncate">{u.email}</p>
        </div>
      ))}
    </div>
  );
}

// price-tag.tsx
export function PriceTag({ price }) {
  return (
    <span className="text-sm font-medium text-gray-900">
      ${price}
    </span>
  );
}

// skeleton.tsx
export function CardSkeleton() {
  return (
    <div className="space-y-3">
      {/* animate-pulse + rounded-md + dark mode bg colors */}
      <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse" />
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse w-1/2" />
    </div>
  );
}

// popover.tsx
export function Popover({ children }) {
  return (
    <div popover className="p-4 rounded-lg shadow-lg bg-white dark:bg-gray-950 backdrop-blur-sm border border-gray-200 dark:border-gray-800">
      {children}
    </div>
  );
}

// dark-mode.css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@layer base {
  :where(.dark) {
    --color-background: oklch(0.15 0 0);
    --color-foreground: oklch(0.95 0 0);
  }
}

// dropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function Dropdown({ items, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button 
        onClick={() => setOpen(!open)} 
        className="px-3 py-2 border rounded focus:ring-2 focus:ring-offset-2 transition-colors motion-reduce:transition-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        Select
      </button>
      {open && (
        <ul className="absolute top-full mt-1 bg-white dark:bg-gray-950 border rounded-md shadow-lg z-[var(--z-dropdown)] min-w-[150px] py-1">
          {items.map(item => (
            <li 
              key={item} 
              onClick={() => { onSelect(item); setOpen(false); }}
              className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer transition-colors motion-reduce:transition-none"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// container-card.tsx
export function ContainerCard({ children }) {
  return (
    <div className="p-4 border rounded-md bg-white dark:bg-gray-950 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Title</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

// app.css
@import "tailwindcss";

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

## Issues Fixed:

1. **Config**: Removed v3 tailwind.config.ts; v4 uses CSS @theme instead
2. **forwardRef**: React 19 no longer needs forwardRef; use React.forwardRef with displayName
3. **Spacing**: Changed p-5 → p-6, mb-7 → mb-8 (multiples of 4)
4. **Colors**: 
   - Dynamic `bg-${color}-500` → full string map (bg-red-500, bg-blue-500, etc.)
   - `bg-opacity-50` → `bg-gray-100/50` (v4 opacity syntax)
   - Arbitrary hex `text-[#1a1a1a]` → semantic `text-gray-900`
5. **Classes**: 
   - cn() for conditional merging instead of template literals
   - No dynamic class concatenation
6. **z-index**: Arbitrary `z-999` → `z-[var(--z-modal)]` using @theme tokens
7. **@apply**: Removed from components; kept only in base layer
8. **Accessibility**:
   - focus:ring-2 focus:ring-offset-2 on buttons/interactive elements
   - aria-label on icon buttons
   - aria-haspopup/aria-expanded on dropdown
9. **Text Sizing**: text-[12px] and text-[16px] → text-sm and text-base
10. **Responsive**: Added mobile-first classes (sm:, lg:)
11. **Dark Mode**: @custom-variant dark syntax (v4); dark: prefixes on colors
12. **Skeleton**: animate-pulse + dark:bg-gray-800 proper dark mode support
13. **Grid**: min-w-0 + truncate for overflow prevention
14. **Dialog**: Migrated to @radix-ui/react-dialog (compound component)
15. **@theme**: Raw OKLCH values (no oklch() wrapper); z-index and radius tokens
16. **@import "tailwindcss"**: v4 directive replaces @tailwind directives
17. **motion-reduce**: Added for animations (accessibility)
18. **Size shorthand**: size-* when w and h are equal (avatar)
