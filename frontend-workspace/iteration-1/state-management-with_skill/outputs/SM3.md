# SM3: Is `if (isLoading) return <Spinner />` the right pattern?

**No, this is not the right pattern.** Using `isLoading` early returns causes a flash of loading state even when stale data is available (e.g., on refetch, tab focus, or navigation back).

Use the `if (loading && !data)` pattern instead:

```tsx
// BAD - flashes spinner on every refetch
if (isLoading) return <Spinner />;

// GOOD - only shows loading on initial fetch
if (isLoading && !data) return <Skeleton />;

// BEST - Suspense-first approach
// No loading checks in the component at all
```

This preserves the previous data on screen while new data loads, giving users a much smoother experience.
