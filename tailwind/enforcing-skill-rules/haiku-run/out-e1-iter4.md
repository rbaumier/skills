```tsx
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
};
export default config;

// theme.css
@import 'tailwindcss';

@theme {
  --color-*: initial;
  --color-primary: oklch(0.6 0.25 260);
  --color-secondary: oklch(0.5 0.15 150);
  --color-primary-50: color-mix(in oklab, var(--color-primary) 5%, white);
  --color-primary-10: color-mix(in oklab, var(--color-primary) 10%, white);
  --animate-pulse: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-overlay: 30;
  --z-modal: 40;
  --z-toast: 50;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// card.tsx
import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

type CardProps = {
  variant: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
};

const cardStyles = cva('rounded-lg p-4', {
  variants: {
    variant: {
      primary: 'bg-primary text-white',
      secondary: 'bg-secondary text-gray-900',
      ghost: 'bg-transparent border border-gray-200',
    },
  },
});

export function Card({ variant, children, ref }: CardProps) {
  return (
    <div ref={ref} className={cn(cardStyles({ variant }))}>
      {children}
    </div>
  );
}

// dialog.tsx
import { useRef, useEffect } from 'react';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function AppDialog({ open, onClose, children }: DialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleBackdropClick(e: MouseEvent) {
      if (e.target === contentRef.current?.parentElement) {
        onClose();
      }
    }

    document.addEventListener('click', handleBackdropClick);
    return () => document.removeEventListener('click', handleBackdropClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={contentRef}
        className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto transition-[transform,opacity] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// menu-button.tsx
type MenuButtonProps = {
  onClick?: () => void;
  ariaLabel?: string;
};

export function MenuButton({ onClick, ariaLabel = 'Menu' }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="size-11 flex items-center justify-center rounded-lg hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
    >
      <svg
        viewBox="0 0 20 20"
        className="size-5"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    </button>
  );
}

// button.tsx
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

type ButtonProps = {
  label: string;
  color: 'primary' | 'secondary';
  size: 'sm' | 'md';
  onClick?: () => void;
};

const buttonStyles = cva(
  'font-medium rounded focus-visible:ring-2 focus-visible:ring-offset-2 transition-[transform,opacity]',
  {
    variants: {
      color: {
        primary: 'bg-primary hover:bg-primary text-white',
        secondary: 'bg-secondary hover:bg-secondary text-gray-900',
      },
      size: {
        sm: 'px-3 py-1 text-sm',
        md: 'px-4 py-2 text-base',
      },
    },
  }
);

export function Button({ label, color, size, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(buttonStyles({ color, size }), 'focus-visible:ring-primary')}
    >
      {label}
    </button>
  );
}

// hero.tsx
export function Hero() {
  return (
    <section className="py-20 px-6 sm:px-8 lg:px-12 bg-white">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
        Welcome
      </h1>
      <p className="mt-4 text-gray-600 contrast-more:text-gray-900">Subtitle here</p>
      <button className="mt-8 bg-primary hover:bg-primary text-white px-6 py-3 rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-[transform,opacity]">
        Get Started
      </button>
    </section>
  );
}

// avatar.tsx
type AvatarProps = {
  src: string;
  name: string;
};

export function Avatar({ src, name }: AvatarProps) {
  return (
    <div className="size-8 rounded-full overflow-hidden flex-shrink-0">
      <img src={src} alt={name} className="size-8 object-cover" />
    </div>
  );
}

// layout.tsx
type LayoutProps = {
  children: React.ReactNode;
};

export function Layout({ children }: LayoutProps) {
  return (
    <html>
      <body className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-50">
        {children}
      </body>
    </html>
  );
}

// user-grid.tsx
type User = {
  id: string;
  name: string;
  email: string;
};

type UserGridProps = {
  users: User[];
};

export function UserGrid({ users }: UserGridProps) {
  return (
    <div className="@container p-4">
      <div className="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <div key={u.id} className="p-4 border border-gray-200 rounded-lg min-w-0">
            <span className="truncate font-medium">{u.name}</span>
            <p className="text-sm text-gray-600 contrast-more:text-gray-900 truncate">{u.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// price-tag.tsx
type PriceTagProps = {
  price: number;
};

export function PriceTag({ price }: PriceTagProps) {
  return (
    <span className="text-sm font-medium text-gray-900 contrast-more:font-semibold">
      ${price}
    </span>
  );
}

// skeleton.tsx
export function CardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-lg w-3/4 animate-pulse" />
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-lg w-1/2 animate-pulse" />
    </div>
  );
}

// popover.tsx
import { useEffect, useRef } from 'react';

type PopoverProps = {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Popover({ children, open = false, onOpenChange }: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onOpenChange?.(false);
      }
    }

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [open, onOpenChange]);

  return (
    <div
      ref={popoverRef}
      popover={open ? 'auto' : 'manual'}
      className="p-4 rounded-lg shadow-lg bg-white border border-gray-200 transition-[opacity] motion-reduce:transition-none"
      style={{
        opacity: open ? 1 : 0,
      } as React.CSSProperties}
    >
      @starting-style {
        opacity: 0;
      }
      {children}
    </div>
  );
}

// dropdown.tsx
import { useState, useRef, useEffect } from 'react';

type DropdownProps = {
  items: string[];
  onSelect: (item: string) => void;
};

export function Dropdown({ items, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-[transform,opacity]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        Select
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-dropdown"
        >
          {items.map((item) => (
            <li
              key={item}
              role="option"
              tabIndex={0}
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelect(item);
                  setOpen(false);
                }
              }}
              className="px-3 py-2 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary cursor-pointer"
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
type ContainerCardProps = {
  children: React.ReactNode;
  title?: string;
};

export function ContainerCard({ children, title }: ContainerCardProps) {
  return (
    <div className="@container p-4 border border-gray-200 rounded-lg bg-white">
      {title && (
        <h3 className="text-base @lg:text-lg font-semibold text-gray-900">
          {title}
        </h3>
      )}
      <div className={title ? 'mt-4' : ''}>{children}</div>
    </div>
  );
}
```
