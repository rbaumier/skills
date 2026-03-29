---
name: tanstack-query
description: TanStack Query v5 for React server state management
---

## When to use
- Setting up data fetching/caching in React
- Fixing v4 to v5 migration errors
- Debugging SSR/hydration issues with streaming
- Implementing optimistic updates, infinite scroll, prefetching

## When not to use
- Client-only state (use useState/Zustand/Jotai)
- Simple one-off fetches without caching needs
- Non-React projects

## Rules
- Always object syntax: `useQuery({ queryKey, queryFn })`
- Always array query keys: `['todos', id, { filter }]`
- Use `isPending` for initial load, not `isLoading`
- Use `gcTime` not `cacheTime` (renamed in v5)
- Use `throwOnError` not `useErrorBoundary` (renamed in v5)
- Use `placeholderData: keepPreviousData` not `keepPreviousData: true`
- Query callbacks removed: no onSuccess/onError/onSettled on useQuery
- Use useEffect for query side effects instead of callbacks
- Mutation callbacks (onSuccess etc.) still supported
- v5.89+ mutation callbacks have 4 params: add onMutateResult before context
- Always `initialPageParam` for infinite queries (required in v5)
- `maxPages` requires both getNextPageParam and getPreviousPageParam
- Use `queryOptions()` / `infiniteQueryOptions()` factories for reuse
- Set `staleTime` appropriately to prevent excessive refetches
- Throw errors in queryFn: `if (!res.ok) throw new Error(...)`
- Invalidate queries after mutations via `queryClient.invalidateQueries()`
- `invalidateQueries` only refetches active queries; use `refetchType: 'all'` for inactive
- No `enabled` on useSuspenseQuery; use conditional rendering instead
- refetch() is for same params only; change queryKey for new params
- Include changing params (page, filter, search) in queryKey
- Use `select` for data transformation
- Pass `signal` to fetch for auto-cancellation on queryKey change
- Prefer useSuspenseQuery over useQuery for SSR to avoid hydration errors
- Don't conditionally render on fetchStatus with useSuspenseQuery + streaming
- `refetchOnMount: false` ignored for errored queries; add `retryOnMount: false`
- v5 error type defaults to Error; specify generic if throwing non-Error
- v5.90.8 broke readonly query keys; upgrade to v5.90.9+
- useMutationState variables typed as unknown; cast explicitly
- fetchQuery CancelledError in StrictMode is dev-only, not a bug
- Use useMutationState for cross-component mutation tracking
- Optimistic updates: useMutationState + pending filter, no cache manipulation needed
- networkMode: 'online' (default), 'always', or 'offlineFirst' for PWA
- useQueries combine option merges parallel query results
- Multiple listeners on same queryKey: last write wins for options
- Wrap with QueryClientProvider + ReactQueryDevtools in app root
