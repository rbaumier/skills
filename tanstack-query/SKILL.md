---
name: tanstack-query
description: Use when managing server state with TanStack Query v5, building tables with TanStack Table v8, or using TanStack Form, Virtual, Store
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
- **`invalidateQueries` only refetches ACTIVE (currently-mounted) queries by default.** A bare `invalidateQueries({ queryKey })` marks inactive queries stale but does NOT refetch them — so a detail page you navigate back to shows stale data. **When in doubt after a mutation, pass `refetchType: 'all'`** so inactive cache entries also refetch: `invalidateQueries({ queryKey: ['todos'], refetchType: 'all' })`. Review check: every `invalidateQueries` call must justify its `refetchType` — omitting it is a silent default, not a decision. Use `refetchType: 'none'` only to deliberately mark-stale-without-refetch (expensive queries that should refetch on next mount)
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
**Prefetching on the server is only HALF the pattern. `ensureQueryData`/`prefetchQuery` in a loader alone does NOT make SSR work** — without dehydrate + HydrationBoundary the server-fetched cache is discarded and the client refetches everything, defeating the point. Both halves are mandatory:

1. **Server**: `const queryClient = new QueryClient()` → `await queryClient.prefetchQuery(...)` → pass `dehydrate(queryClient)` to the client.
2. **Client**: wrap the tree in `<HydrationBoundary state={dehydratedState}>`.

Review check: if you see a server prefetch with no matching `dehydrate(...)` call AND no `<HydrationBoundary>` wrapping the consuming component, the SSR is broken — the data is fetched twice. A loader that only calls `ensureQueryData` is incomplete SSR, not complete SSR.

```tsx
// Server
const queryClient = new QueryClient()
await queryClient.prefetchQuery(todoOptions)
const dehydratedState = dehydrate(queryClient)   // <-- required, do not skip

// Client
<HydrationBoundary state={dehydratedState}>       {/* <-- required, do not skip */}
  <Todos />
</HydrationBoundary>
```

Rationale: the cache lives in memory on a fresh server-side QueryClient. Serializing it (`dehydrate`) and rehydrating it client-side (`HydrationBoundary`) is the only bridge between the two — there is no other way to carry that fetched data across the network.

### Query Key Factory Pattern
**Hand-written inline keys like `['todos']`, `['todos', id]`, `['todos', 'list', filter]` repeated across components are NOT acceptable — define a factory object instead.** Inline arrays are not "simpler"; they are the bug. A typo in one (`'todo'` vs `'todos'`) silently breaks cache matching, and you cannot invalidate a whole family at once.

When two or more queries share a key prefix, build a single factory object so every key derives from one source of truth:

```ts
const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters) => [...todoKeys.lists(), filters] as const,
  detail: (id) => [...todoKeys.all, 'detail', id] as const,
}
// before:  useQuery({ queryKey: ['todos', 'list', filter], ... })
// after:   useQuery({ queryKey: todoKeys.list(filter), ... })
```

Invalidate at any level of the hierarchy: `invalidateQueries({ queryKey: todoKeys.lists() })` clears all filtered lists in one call. Review check: any second occurrence of the same flat string literal in a query key means the factory is missing — refactor it.

### Optimistic Update with Rollback Context
**`setQueryData` inside `onMutate` ALONE is a broken optimistic update — it has no rollback, so a failed mutation leaves the user staring at data that was never saved.** A real optimistic update is a four-part contract; all four are mandatory, none is optional:

1. **`onMutate`** — `await queryClient.cancelQueries({ queryKey })` first (so an in-flight refetch can't overwrite your optimistic write), THEN snapshot `const previous = queryClient.getQueryData(queryKey)`, THEN apply the optimistic `setQueryData`, THEN `return { previous }`.
2. **`onError(err, vars, context)`** — restore: `queryClient.setQueryData(queryKey, context.previous)`.
3. **`onSettled`** — `queryClient.invalidateQueries({ queryKey })` to reconcile with the server.

```ts
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] })          // 1. stop races
    const previous = queryClient.getQueryData(['todos'])              // 2. snapshot
    queryClient.setQueryData(['todos'], (old) => [...old, newTodo])   // 3. optimistic write
    return { previous }                                               // 4. hand snapshot to onError
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['todos'], context.previous)             // rollback
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })           // reconcile
  },
})
```

Review check: if `onMutate` writes the cache but there is no `cancelQueries`, no snapshot returned as context, and no `onError` rollback, the update is NOT done — it's a UI that lies on failure. Use `useMutationState` (simpler) when you only need to DISPLAY pending state and don't manipulate the cache.

### Prefetching in Route Loaders
In loader: `await queryClient.ensureQueryData(queryOptions(...))`. Use `ensureQueryData` (not `prefetchQuery`) so the loader both warms the cache and returns the data.

**`ensureQueryData` WITHOUT a coordinated `staleTime` is the trap, not the fix.** If `staleTime` is left at the default (0 = always stale), the loader fetches, then the component mounts and immediately fetches the SAME data again — a guaranteed double-fetch on every navigation. You must set `staleTime >= navigation time` (~5-30s) so the loader-fetched data is still considered fresh when the component mounts:

```ts
const todoOptions = queryOptions({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  staleTime: 10_000,   // <-- REQUIRED: bridges loader → mount so the component reuses the loader's fetch
})
// loader:
await queryClient.ensureQueryData(todoOptions)
// component reads the same staleTime via the shared queryOptions — no second fetch
```

Review check: an `ensureQueryData`/loader prefetch with `staleTime` of 0 or unset means the prefetch buys nothing — flag it. The loader and the component must reference the SAME `queryOptions` so the `staleTime` is identical on both sides.

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
