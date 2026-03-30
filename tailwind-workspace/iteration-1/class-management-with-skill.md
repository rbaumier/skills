# Class Management - With Skill

## Prompt
I have a React Button component. I want to conditionally add classes based on props. Here's my current code using template literals. Also, should I use @apply for reusable variants? How should I organize class order?

## Response

Your template literal approach has several issues: it doesn't handle class conflicts, produces extra whitespace, and makes variants hard to maintain. Here's the proper approach:

### 1. Use `cn()` helper (twMerge + clsx) for conditional/merged classes

Always use a `cn()` utility that combines `clsx` and `tailwind-merge`. This handles conditionals AND resolves conflicting Tailwind classes (e.g., if `className` overrides `bg-blue-500`):

```tsx
import { cn } from '@/lib/utils';

// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 2. Use `cva()` for reusable component variants, NOT @apply

**Do not use `@apply` for component variants.** It defeats the purpose of utility-first CSS. Reserve `@apply` only for global base/typography prose styles. Instead, use `cva()` (class-variance-authority):

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-11 px-8 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    disabled?: boolean;
  };

const Button = ({ variant, size, disabled, className, children, ...props }: ButtonProps) => {
  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
```

### 3. Class order convention

Follow this ordering for utility classes:

**layout > sizing > spacing > typography > visual > interactive > dark > responsive**

Example:
```tsx
<div className="flex items-center w-full max-w-md p-4 gap-4 text-sm font-medium bg-card text-foreground border rounded-lg shadow-sm hover:shadow-md dark:bg-card dark:border-border sm:p-6 lg:max-w-lg">
```

### 4. tailwind-merge resolves conflicts

The `cn()` helper uses `tailwind-merge` under the hood, so when a consumer passes `className="bg-red-500"` to your `Button` with `bg-primary`, the last one wins correctly instead of both classes being present.
