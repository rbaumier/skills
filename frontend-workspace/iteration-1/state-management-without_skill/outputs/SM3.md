# SM3: Is `if (isLoading) return <Spinner />` the right pattern?

Yes, this is a common and straightforward pattern for handling loading states:

```tsx
if (isLoading) return <Spinner />;
if (isError) return <ErrorMessage />;
return <div>{data.name}</div>;
```

It's simple and works well. You might want to add a minimum delay to prevent flash of loading states for fast requests, but this is the standard approach.
