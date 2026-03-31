# Class Management - Without Skill

## Prompt
I have a React Button component. I want to conditionally add classes based on props. Here's my current code using template literals. Also, should I use @apply for reusable variants? How should I organize class order?

## Response

Your current approach of using template literals for conditional classes is fragile and can lead to conflicting classes. Here's a better approach:

### Use `clsx` or `classnames` for conditional classes

```tsx
import clsx from 'clsx';

const Button = ({ variant, disabled, className, children }) => {
  const classes = clsx(
    'btn',
    variant === 'primary' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black',
    disabled && 'opacity-50 cursor-not-allowed',
    className
  );
  return <button className={classes}>{children}</button>;
};
```

### For reusable variants, use `@apply`

You can use `@apply` in your CSS to create reusable component classes:

```css
.btn-primary {
  @apply bg-blue-500 text-white px-4 py-2 rounded;
}
.btn-secondary {
  @apply bg-gray-200 text-black px-4 py-2 rounded;
}
```

This keeps your JSX clean and variants reusable.

### Class ordering

There's no strict rule, but I generally recommend grouping related utilities together: positioning, display, sizing, spacing, borders, colors, typography, and effects. Keep it consistent within your project.
