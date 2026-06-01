# Grade — e1 iter1

| id | PASS/FAIL | evidence |
|----|-----------|----------|
| dependent-query-enabled | PASS | Lines 1-7: `useQuery({ queryKey: ["posts", userId], queryFn: () => fetchPosts(userId!), enabled: !!userId })` — `enabled: !!userId` present. |
| ssr-dehydrate-hydrate | FAIL | No `dehydrate` and no `HydrationBoundary` anywhere in the file. Loader uses `ensureQueryData` (l.79-81) but the server-prefetch + dehydrate / client-hydrate pattern is entirely absent. |
| query-key-factory | FAIL | Lines 27-29 still use flat inline arrays (`["todos"]`, `["todos", id]`, `["todos", "list", filter]`). No query key factory object (e.g. `todoKeys = { all, list, detail }`) defined; keys remain hand-written ad hoc. |
| optimistic-rollback | FAIL | Lines 31-36: `onMutate` calls `setQueryData` only — no `cancelQueries`, no `getQueryData` snapshot, no `onError` rollback, no `onSettled` invalidate. Trap unchanged. |
| default-staleTime | PASS | Lines 12-19: `new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60, ... } } })` — default staleTime set to 60s. |
| serializable-keys | PASS | Lines 47-50: `queryKey: ["events", new Date().toISOString()]` — date serialized to ISO string, JSON-serializable. |
| placeholderData-not-initialData | PASS | Lines 52-56: `useQuery({ queryKey: ["profile"], queryFn: fetchProfile, placeholderData: keepPreviousData })` — uses `placeholderData`, not `initialData`. |
| fresh-queryclient-tests | PASS | Lines 58-75: `createTestQueryClient()` returns a fresh `QueryClient` with `retry: false, gcTime: 0`, invoked per render inside the test. No shared global client. |
| refetchType-inactive | FAIL | Line 77: `queryClient.invalidateQueries({ queryKey: ["todos"] })` — no `refetchType: 'all'`. Trap unchanged; inactive queries still won't refetch. |
| loader-staleTime-coordination | FAIL | Lines 79-81: loader uses `ensureQueryData` (partial) but passes no `staleTime`, so there is no coordination with navigation time as the rule requires. Fix incomplete. |
