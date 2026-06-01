```tsx
// 1. Dependent query: must add 'enabled' to prevent fetch with undefined userId
function UserPosts({ userId }: { userId?: string }) {
  const { data } = useQuery({
    queryKey: ["posts", userId],
    queryFn: () => fetchPosts(userId!),
    enabled: !!userId, // <-- REQUIRED: query won't execute until userId is truthy
  });
  return <div>{data?.length} posts</div>;
}

export function App() {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

// 2. Query key factory pattern: hand-written inline keys are bugs (typos break cache)
// Define ONE source of truth for all todo-related keys
const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filter: string) => [...todoKeys.lists(), filter] as const,
  detail: (id: string) => [...todoKeys.all, "detail", id] as const,
};

const { data: todos } = useQuery({
  queryKey: todoKeys.all,
  queryFn: fetchTodos,
});
const { data: todo } = useQuery({
  queryKey: todoKeys.detail(id),
  queryFn: () => fetchTodo(id),
});
const { data: filtered } = useQuery({
  queryKey: todoKeys.list(filter),
  queryFn: () => fetchFiltered(filter),
});

// 3. Optimistic update: setQueryData alone is broken — needs full rollback contract
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    // 1. Cancel in-flight refetches so they don't overwrite the optimistic write
    await queryClient.cancelQueries({ queryKey: todoKeys.all });
    // 2. Snapshot current cache state
    const previous = queryClient.getQueryData(todoKeys.all);
    // 3. Apply optimistic update
    queryClient.setQueryData(todoKeys.all, (old: typeof newTodo[] | undefined) => [
      ...(old ?? []),
      newTodo,
    ]);
    // 4. Return context so onError can rollback
    return { previous };
  },
  onError: (_err, _vars, context) => {
    // Restore snapshot on failure
    queryClient.setQueryData(todoKeys.all, context.previous);
  },
  onSettled: () => {
    // Reconcile with server
    queryClient.invalidateQueries({
      queryKey: todoKeys.all,
      refetchType: "all", // <-- Justified: mutations often affect list, so refetch inactive caches
    });
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 60s default prevents unnecessary refetches
      gcTime: 1000 * 60 * 5, // 5m garbage collection
    },
  },
});

// 4. Query key: new Date() is NOT JSON-serializable — breaks cache matching
// Use .toISOString() string instead
const { data } = useQuery({
  queryKey: ["events", new Date().toISOString()],
  queryFn: fetchEvents,
});

// 5. placeholderData vs initialData:
// - placeholderData: shown while fetching, then replaced (correct for loading UX)
// - initialData: persisted to cache, treated as already-fetched (only for SSR server data)
// Using initialData with stale data prevents refetch until staleTime expires
const { data } = useQuery({
  queryKey: ["profile"],
  queryFn: fetchProfile,
  placeholderData: keepPreviousData, // <-- Correct: temporary UX, not persisted
});

// 6. Test utility: create fresh QueryClient per test to avoid cache leaks
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // <-- REQUIRED in tests: no retries mask race conditions
        gcTime: 0, // Immediate cleanup prevents test pollution
      },
    },
  });
}

test("renders todos", () => {
  const testClient = createTestQueryClient(); // Fresh per test
  render(
    <QueryClientProvider client={testClient}>
      <TodoList />
    </QueryClientProvider>
  );
});

// 7. invalidateQueries: default refetchType='active' only refetches mounted queries
// Inactive queries (detail page navigated away from) mark stale but don't refetch
// Decision: must be explicit — justify each call
queryClient.invalidateQueries({
  queryKey: todoKeys.all,
  refetchType: "all", // Justified: after mutation, both active AND inactive todo lists must refetch
});

// 8. SSR loader: ensureQueryData without staleTime causes double-fetch
// The loader fetches, then component mounts and fetches AGAIN if staleTime=0
// Solution: use shared queryOptions with staleTime >= navigation time (~5-30s)
const todoOptions = {
  queryKey: todoKeys.all,
  queryFn: fetchTodos,
  staleTime: 10_000, // <-- REQUIRED: bridges loader → mount, component reuses fetch
};

export async function loader() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 10_000, gcTime: 1000 * 60 * 5 },
    },
  });
  await queryClient.ensureQueryData(todoOptions);
  const dehydratedState = dehydrate(queryClient); // <-- REQUIRED: serialize cache for client
  return { dehydratedState };
}

// Client wrapper: HydrationBoundary rehydrates server-fetched cache
// Without this boundary, the dehydrated state is discarded and client refetches
export function TodoPage({ dehydratedState }: { dehydratedState: DehydratedState }) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <TodoList />
    </HydrationBoundary>
  );
}
```
