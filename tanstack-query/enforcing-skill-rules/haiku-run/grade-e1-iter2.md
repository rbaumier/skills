# Grade — out-e1-iter2.md (STRICT)

| # | Assertion ID | Verdict | Evidence / Reasoning |
|---|---|---|---|
| 1 | dependent-query-enabled | PASS | Lines 2-7: `UserPosts({ userId }: { userId?: string })` with `enabled: !!userId` and `queryFn: () => fetchPosts(userId!)`. The optional `userId` is guarded so the query won't run while undefined. Correct. |
| 2 | ssr-dehydrate-hydrate | **FAIL** | No `dehydrate`, no `HydrationBoundary`, no `prefetchQuery` for SSR anywhere in the file. The loader at lines 104-107 uses `ensureQueryData` but never dehydrates state nor wraps a client in `HydrationBoundary`. The SSR dehydrate/hydrate pattern is entirely absent. |
| 3 | query-key-factory | PASS | Lines 27-37: `postKeys` and `todoKeys` factories build hierarchical keys via spread (`[...todoKeys.all, "list"]`, `[...todoKeys.lists(), filter]`, `[...todoKeys.all, id]`). Used at lines 39-41. Genuine hierarchical factory, not flat strings. |
| 4 | optimistic-rollback | PASS | Lines 43-57: `onMutate` calls `cancelQueries`, snapshots `previous = getQueryData(...)`, applies `setQueryData`, returns `{ previous }`; `onError` restores `setQueryData(todoKeys.all, context.previous)`. Full cancel/snapshot/rollback cycle present. |
| 5 | default-staleTime | PASS | Lines 12-19 (and 59-66): `QueryClient` `defaultOptions.queries.staleTime: 1000 * 60` set at client level. Non-zero default applied. |
| 6 | serializable-keys | PASS | Lines 68-71: query key uses `new Date().toISOString()` (a string), not a raw `new Date()` object. Key is JSON-serializable. Trap corrected. |
| 7 | placeholderData-not-initialData | PASS | Lines 73-77: loading placeholder supplied via `placeholderData: { name: "Loading...", avatar: "" }`, not `initialData`. Correct distinction for loading UX. |
| 8 | fresh-queryclient-tests | PASS | Lines 79-94: `createTestQueryClient()` returns a NEW `QueryClient` with `retry: false, gcTime: 0`, and the test (line 88) instantiates a fresh one per test. No shared global client. |
| 9 | refetchType-inactive | PASS | Lines 55 and 96: `invalidateQueries({ queryKey: todoKeys.all, refetchType: "all" })`. Explicit `refetchType: "all"` to also refetch inactive queries. Correct. |
| 10 | loader-staleTime-coordination | PASS | Lines 98-107: `todoOptions = queryOptions({ ..., staleTime: 10_000 })` and `loader()` uses `await queryClient.ensureQueryData(todoOptions)`. `ensureQueryData` + a defined `staleTime` shared via `queryOptions` satisfies the coordination requirement. |

## Summary

9/10 corrected. The single remaining failure is **ssr-dehydrate-hydrate**: the SSR serialization boundary (`prefetchQuery`/`dehydrate` on server + `HydrationBoundary` on client) is completely missing — the loader merely warms a query client without ever transferring dehydrated state to the client.

{"passed":9,"total":10,"fails":[{"id":"ssr-dehydrate-hydrate","why":"No dehydrate, HydrationBoundary, or prefetchQuery-based SSR serialization anywhere; loader only calls ensureQueryData and never transfers dehydrated state to the client"}]}
