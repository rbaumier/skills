# TanStack Query v5 Corrections

## Issues Fixed

### 1. Missing `enabled` on dependent query (L4-8)
**Rule**: Dependent queries with `enabled` — query won't execute until userId is truthy.

**Before:**
```tsx
const { data } = useQuery({
  queryKey: ["posts", userId],
  queryFn: () => fetchPosts(userId!),
});
```

**After:**
```tsx
const { data } = useQuery({
  queryKey: ["posts", userId],
  queryFn: () => fetchPosts(userId!),
  enabled: !!userId, // <-- added: don't fetch when userId is undefined
});
```

---

### 2. Query keys lack factory pattern (L21-23)
**Rule**: Hand-written inline keys repeated across components are NOT acceptable. Define a factory object so every key derives from one source of truth.

**Before:**
```tsx
const { data: todos } = useQuery({ queryKey: ["todos"], queryFn: fetchTodos });
const { data: todo } = useQuery({ queryKey: ["todos", id], queryFn: () => fetchTodo(id) });
const { data: filtered } = useQuery({ queryKey: ["todos", "list", filter], queryFn: () => fetchFiltered(filter) });
```

**After:**
```tsx
const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filter) => [...todoKeys.lists(), filter] as const,
  detail: (id) => [...todoKeys.all, "detail", id] as const,
};

const { data: todos } = useQuery({ queryKey: todoKeys.all, queryFn: fetchTodos });
const { data: todo } = useQuery({ queryKey: todoKeys.detail(id), queryFn: () => fetchTodo(id) });
const { data: filtered } = useQuery({ queryKey: todoKeys.list(filter), queryFn: () => fetchFiltered(filter) });
```

---

### 3. Incomplete optimistic update (L25-30)
**Rule**: `setQueryData` alone is broken — it has no rollback. A real optimistic update requires: `cancelQueries`, snapshot, optimistic write, and `onError` rollback.

**Before:**
```tsx
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    queryClient.setQueryData(["todos"], (old) => [...old, newTodo]);
  },
});
```

**After:**
```tsx
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: todoKeys.all }); // <-- 1. stop races
    const previous = queryClient.getQueryData(todoKeys.all);      // <-- 2. snapshot
    queryClient.setQueryData(todoKeys.all, (old) => [...old, newTodo]); // <-- 3. optimistic write
    return { previous };                                           // <-- 4. hand snapshot to onError
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(todoKeys.all, context.previous);     // <-- rollback
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: todoKeys.all });    // <-- reconcile
  },
});
```

---

### 4. Non-serializable Date in queryKey (L35-37)
**Rule**: Keys must be JSON-serializable — no functions, class instances, Dates, or Symbols. Use `date.toISOString()` instead of `new Date()`.

**Before:**
```tsx
const { data } = useQuery({
  queryKey: ["events", new Date()],
  queryFn: fetchEvents,
});
```

**After:**
```tsx
const { data } = useQuery({
  queryKey: ["events", new Date().toISOString()], // <-- convert to ISO string
  queryFn: fetchEvents,
});
```

---

### 5. Using `initialData` for loading state (L40-43)
**Rule**: `placeholderData` is NOT persisted to cache — shown while fetching, then replaced. `initialData` IS persisted — treated as if query already fetched. Use `placeholderData` for loading UX, `initialData` for server-provided data (SSR).

**Before:**
```tsx
const { data } = useQuery({
  queryKey: ["profile"],
  queryFn: fetchProfile,
  initialData: { name: "Loading...", avatar: "" },
});
```

**After:**
```tsx
const { data } = useQuery({
  queryKey: ["profile"],
  queryFn: fetchProfile,
  placeholderData: { name: "Loading...", avatar: "" }, // <-- show while fetching, then discard
});
```

---

### 6. Global QueryClient in tests (L45-50)
**Rule**: Create a test utility that returns a fresh QueryClient per test. Always `retry: false` in tests. Avoid global clients — they leak cache between tests.

**Before:**
```tsx
test("renders todos", () => {
  render(
    <QueryClientProvider client={globalQueryClient}>
      <TodoList />
    </QueryClientProvider>
  );
});
```

**After:**
```tsx
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

test("renders todos", () => {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TodoList />
    </QueryClientProvider>
  );
});
```

---

### 7. Missing `refetchType` justification (L53)
**Rule**: `invalidateQueries` only refetches ACTIVE queries by default. When in doubt, pass `refetchType: 'all'` so inactive cache entries also refetch. Every call must justify its `refetchType`.

**Before:**
```tsx
queryClient.invalidateQueries({ queryKey: ["todos"] });
```

**After:**
```tsx
// Refetch all todos (active and inactive) after a mutation that may affect the list
queryClient.invalidateQueries({ queryKey: todoKeys.all, refetchType: "all" });
```

---

### 8. `prefetchQuery` without coordinated `staleTime` (L55-57)
**Rule**: `ensureQueryData` WITHOUT a coordinated `staleTime` is the trap. If `staleTime` is 0, the loader fetches then the component mounts and immediately fetches again — guaranteed double-fetch. Use `queryOptions()` to share `staleTime` between loader and component.

**Before:**
```tsx
export async function loader() {
  await queryClient.prefetchQuery({ queryKey: ["posts"], queryFn: fetchPosts });
}
```

**After:**
```tsx
const postsOptions = queryOptions({
  queryKey: ["posts"],
  queryFn: fetchPosts,
  staleTime: 10_000, // <-- REQUIRED: bridges loader → mount
});

export async function loader() {
  await queryClient.ensureQueryData(postsOptions); // <-- use ensureQueryData, not prefetchQuery
}

// In component, reference the same postsOptions:
const { data } = useQuery(postsOptions); // reuses staleTime, no double-fetch
```

---

## Summary

| Issue | Rule | Fix |
|-------|------|-----|
| Missing `enabled` | Dependent queries | Add `enabled: !!userId` |
| Inline query keys | Factory pattern | Create `todoKeys` object |
| Broken optimistic update | Four-part contract | Add `cancelQueries`, snapshot, `onError`, `onSettled` |
| `new Date()` in key | JSON-serializable only | Use `toISOString()` |
| `initialData` for UX | Wrong tool | Use `placeholderData` |
| Global QueryClient in tests | Fresh per test | Create `createTestQueryClient()` |
| Missing `refetchType` | Justify every call | Use `refetchType: 'all'` with comment |
| Double-fetch trap | Coordinated `staleTime` | Use `queryOptions()`, `ensureQueryData`, shared `staleTime` |
