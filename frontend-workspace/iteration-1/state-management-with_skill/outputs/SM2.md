# SM2: How should I handle loading states for data fetching with TanStack Query?

Use **Suspense-first data fetching**: `useSuspenseQuery` + `Suspense` boundary with a `Skeleton` fallback.

```tsx
// Data component - no loading checks needed
function UserProfile({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
  return <div>{data.name}</div>;
}

// Parent with Suspense boundary
function UserPage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<UserProfileSkeleton />}>
      <UserProfile userId={userId} />
    </Suspense>
  );
}
```

Do NOT use `isLoading` early returns as the primary pattern. They fragment your component logic and cause flash-of-loading-state issues when data already exists.
