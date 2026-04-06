---
name: tanstack-query
description: TanStack Query v5 for React server state management + Table v8, Form, Virtual, Store
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
- Always array query keys: `['todos', id, { filter }]`. Keys must be JSON-serializable — no functions, class instances, Dates, or Symbols. Use `date.toISOString()` instead of `new Date()`. Non-serializable keys silently break cache matching
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
- Set default `staleTime` and `gcTime` at QueryClient level: `new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60, gcTime: 1000 * 60 * 5 } } })`. Default staleTime is 0 (always stale = always refetches). For most apps, 60s prevents unnecessary refetches. Override per-query only when needed
- Throw errors in queryFn: `if (!res.ok) throw new Error(...)`
- Invalidate queries after mutations via `queryClient.invalidateQueries()`
- **Dependent queries with `enabled`**: `useQuery({ queryKey: ['posts', userId], queryFn: () => fetchPosts(userId), enabled: !!userId })`. Query won't execute until `userId` is truthy. Forgetting `enabled` causes fetch with `undefined` param
- `invalidateQueries` only refetches active queries; use `refetchType: 'all'` for inactive. Use `refetchType: 'none'` to only mark as stale without any refetch (useful for expensive queries that should only refetch on next mount)
- **`placeholderData` vs `initialData`**: `placeholderData` is NOT persisted to cache — shown while fetching, then replaced. `initialData` IS persisted — treated as if query already fetched. Use `placeholderData` for loading UX, `initialData` for server-provided data (SSR). Wrong choice: `initialData` with stale data = no refetch until staleTime expires
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

## Advanced Patterns

### Cache Class Pattern
Encapsulate all cache operations for a domain in a class with a static `Key` property. This keeps query keys, setQueryData calls, and invalidation logic in one place instead of scattered across components.

```ts
// Why a class? Because raw queryClient.setQueryData scattered everywhere = unmaintainable.
// The class gives you one place to look for "how do we read/write accounts in cache?"
class AccountsCache {
  public static Key = 'accounts'
  constructor(private readonly queryClient: QueryClient) {}
  upsert(account: Account) { /* version-checked setQueryData */ }
  getAll() { return this.queryClient.getQueryData<Account[]>([AccountsCache.Key]) }
  invalidate() { this.queryClient.invalidateQueries({ queryKey: [AccountsCache.Key] }) }
}

// Stable instance — useMemo prevents re-creating the class every render
export function useAccountsCache() {
  const queryClient = useQueryClient()
  return useMemo(() => new AccountsCache(queryClient), [queryClient])
}
```

### Event-Driven Updates (SSE/WebSocket) Instead of Polling
When your backend supports realtime (Supabase Realtime, SSE, WebSocket), prefer direct cache updates over polling:
- Set `staleTime: Infinity` — the cache is always fresh because YOU control when it updates
- Listen to realtime events and call `cache.upsert(newData)` directly
- Use `invalidateQueries` only as a safety net on reconnection (to catch events you missed while offline)
- Polling (`refetchInterval`) is only for data you don't control (e.g. third-party exchange rates)

### Decision Matrix: Invalidation vs Direct Update

| Situation | Use | Why |
|-----------|-----|-----|
| You have the new data already (from mutation response, realtime event) | `setQueryData` via cache class | Avoids a network round-trip. Instant UI update |
| Server computes the result (aggregations, derived data) | `invalidateQueries` | You don't have the data — let the server recalculate |
| Mutation affects multiple query keys | `invalidateQueries` with fuzzy key | Easier than updating N caches manually |
| Realtime events can arrive out of order | Version-checked `setQueryData` | Compare a `version` field before writing — stale events lose |

### SSR with Dehydrate/Hydrate
Server: `const queryClient = new QueryClient()` -> `await queryClient.prefetchQuery(...)` -> `dehydrate(queryClient)`. Client: wrap app in `<HydrationBoundary state={dehydratedState}>`. This pre-populates the cache on the server so the client renders instantly without refetching. Without HydrationBoundary, SSR data is thrown away and re-fetched.

### Query Key Factory Pattern
Organize keys hierarchically: `const todoKeys = { all: ['todos'] as const, lists: () => [...todoKeys.all, 'list'] as const, list: (filters) => [...todoKeys.lists(), filters] as const, detail: (id) => [...todoKeys.all, 'detail', id] as const }`. Invalidate at any level: `invalidateQueries({ queryKey: todoKeys.lists() })` clears all filtered lists.

### Optimistic Update with Rollback Context
For complex list updates where `useMutationState` doesn't fit: in `onMutate`, cancel queries, snapshot previous data, set optimistic data, return `{ previous }` as context. In `onError`, restore from `context.previous`. In `onSettled`, invalidate to refetch. Use `useMutationState` (simpler) when only displaying pending state.

### Prefetching in Route Loaders
In loader: `await queryClient.ensureQueryData(queryOptions(...))`. Use `ensureQueryData` (not `prefetchQuery`) to also return data for the loader. Coordinate `staleTime` between loader and component: set `staleTime >= navigation time` (~5-30s) to avoid double-fetch.

### Mutation Callbacks — Two Levels
- `useMutation({ onSuccess })` — always runs, survives component unmount. Put cache updates here
- `mutate(vars, { onSuccess })` — only runs if component is still mounted. Put navigation/toasts here

### Testing
Create a test utility: `function createTestQueryClient() { return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }) }`. Wrap components: `render(<QueryClientProvider client={createTestQueryClient()}><Component /></QueryClientProvider>)`. Always `retry: false` in tests. Create fresh QueryClient per test to avoid cache leaks.

## Other TanStack Libraries

### Table v8
- `accessor` renamed to `accessorKey` (string) or `accessorFn` (function)
- Use `getCoreRowModel()`, `getSortedRowModel()`, `getFilteredRowModel()`, `getPaginationRowModel()` from `@tanstack/react-table`
- Column definitions use `columnHelper.accessor()` or plain objects with `accessorKey`

### Form
- Use `@tanstack/react-form` with `@tanstack/zod-form-adapter` for Zod validation
- Configure: `useForm({ defaultValues, validatorAdapter: zodValidator(), onSubmit })`
- Field-level validation: `form.Field({ name, validators: { onChange: z.string().min(1) } })`
- Server-side validation: `createServerValidate()` for isomorphic validation in Start apps

### Virtual
- `useVirtualizer({ count, getScrollElement, estimateSize })` from `@tanstack/react-virtual`
- Only renders visible items + overscan buffer. Required for lists >100 items for smooth scroll
- Set `overscan: 5` minimum. For dynamic heights: provide `measureElement` callback

### Store
- `import { Store } from '@tanstack/store'`. Create: `new Store(initialState)`
- Subscribe: `store.subscribe(listener)`. Update: `store.setState((prev) => ({ ...prev, count: prev.count + 1 }))`
- Use `batch()` to group multiple updates so subscribers fire once
- Framework bindings: `useStore(store, selector)` from `@tanstack/react-store`
