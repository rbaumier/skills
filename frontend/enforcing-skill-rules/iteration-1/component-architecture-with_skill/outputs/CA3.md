# CA3: My Button has isPrimary, isOutlined, isGhost, isDanger booleans. What should I do?

**Create explicit variant components instead of boolean modes.** Each boolean doubles possible states — 4 booleans = 16 combinations, most of which are invalid (isPrimary + isGhost?).

Use a discriminated `variant` prop or separate components:

```tsx
// GOOD - variant prop with CVA
const buttonVariants = cva("btn-base", {
  variants: {
    variant: { primary: "bg-blue-600", outlined: "border border-blue-600", ghost: "bg-transparent", danger: "bg-red-600" },
    size: { sm: "px-2 py-1", md: "px-4 py-2", lg: "px-6 py-3" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

<Button variant="primary" />
<Button variant="danger" />

// Also valid - explicit variant components
<PrimaryButton />, <DangerButton />, <GhostButton />
```

This eliminates invalid states by construction and makes the API self-documenting.
