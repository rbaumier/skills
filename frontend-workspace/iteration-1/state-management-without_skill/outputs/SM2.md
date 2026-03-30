# SM2: How should I handle loading states for data fetching with TanStack Query?

TanStack Query provides `isLoading` and `isError` flags you can use:

```tsx
const { data, isLoading, isError } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});

if (isLoading) return <Spinner />;
if (isError) return <ErrorMessage />;

return <div>{data.name}</div>;
```

You can also use React Suspense with the `suspense` option, but the loading/error flag pattern is the most common approach.
