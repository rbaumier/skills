# Grade: tanstack-query e1 iter2 (run b)

STRICT grading. Judged against code in `out-e1-iter2.md` only.

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | dependent-query-enabled | PASS | L3-7: `useQuery({ queryKey: ["posts", userId], queryFn: () => fetchPosts(userId!), enabled: !!userId })` — query gated on `!!userId`, no fetch with undefined. |
| 2 | ssr-prefetch-shared-options | PASS | L98-102 define shared `const todoOptions = queryOptions({ queryKey: todoKeys.all, queryFn: fetchPosts, staleTime: 10_000 })`; L104-107 loader calls `queryClient.ensureQueryData(todoOptions)`. Loader prefetch derives from the SAME shared `queryOptions` object (the rehydration bridge), not an inline ad-hoc key. |
| 3 | query-key-factory | PASS | L27-37: `postKeys`/`todoKeys` factories with hierarchy via `[...todoKeys.all, "list"]`, `[...todoKeys.lists(), filter]`, `[...todoKeys.all, id]`. Used at L39-41. |
| 4 | optimistic-rollback | PASS | L45-53: `onMutate` does `await queryClient.cancelQueries(...)`, snapshots `const previous = queryClient.getQueryData(...)`, optimistic `setQueryData`, returns `{ previous }`; `onError` restores `context.previous`. Full cancel/snapshot/rollback. |
| 5 | default-staleTime | PASS | L12-19 (and L59-66): `new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60, ... } } })` — default staleTime 60s, not 0. |
| 6 | serializable-keys | PASS | L69: `queryKey: ["events", new Date().toISOString()]` — Date serialized to ISO string, not a raw `new Date()` object in the key. |
| 7 | placeholderData-not-initialData | PASS | L73-77: `useQuery({ queryKey: ["profile"], queryFn: fetchProfile, placeholderData: {...} })` — loading UX via `placeholderData`, not `initialData`. |
| 8 | fresh-queryclient-tests | PASS | L79-85: `createTestQueryClient()` returns a `new QueryClient` with `retry: false, gcTime: 0`; L88 calls it per test (`const testQueryClient = createTestQueryClient()`), no global sharing. |
| 9 | refetchType-inactive | PASS | L55 & L96: `invalidateQueries({ queryKey: todoKeys.all, refetchType: "all" })` — explicit `refetchType: "all"` to also refetch inactive. |
| 10 | loader-staleTime-coordination | PASS | L98-102: shared `todoOptions` carries `staleTime: 10_000`; L106 loader uses `await queryClient.ensureQueryData(todoOptions)` (not `prefetchQuery`) — ensureQueryData + coordinated staleTime. |

**Total: 10/10 PASS.**
