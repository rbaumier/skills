```tsx
function UserPosts({ userId }: { userId?: string }) {
  const { data } = useQuery({
    queryKey: ["posts", userId],
    queryFn: () => fetchPosts(userId!),
    enabled: !!userId,  // RULE: dependent queries must use enabled to prevent fetch with undefined
  });
  return <div>{data?.length} posts</div>;
}

export function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,        // RULE: set default staleTime at QueryClient level (prevent unnecessary refetches)
        gcTime: 1000 * 60 * 5,       // RULE: use gcTime not cacheTime (renamed in v5)
      },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

// RULE: use Query Key Factory Pattern to avoid inline key duplication and silent cache mismatches
const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filter: string) => [...todoKeys.lists(), filter] as const,
  detail: (id: string) => [...todoKeys.all, id] as const,
};

const { data: todos } = useQuery({ queryKey: todoKeys.all, queryFn: fetchTodos });
const { data: todo } = useQuery({ queryKey: todoKeys.detail(id), queryFn: () => fetchTodo(id) });
const { data: filtered } = useQuery({ queryKey: todoKeys.list(filter), queryFn: () => fetchFiltered(filter) });

// RULE: optimistic update requires all four parts: onMutate (cancel + snapshot), onError (rollback), onSettled (reconcile)
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: todoKeys.all });  // stop in-flight refetches
    const previous = queryClient.getQueryData(todoKeys.all);      // snapshot before change
    queryClient.setQueryData(todoKeys.all, (old) => [...old, newTodo]);  // optimistic write
    return { previous };  // hand snapshot to onError for rollback
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(todoKeys.all, context.previous);  // rollback on failure
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: todoKeys.all, refetchType: "all" });  // reconcile; refetchType: "all" refetches inactive queries too
  },
});

// RULE: query keys must be JSON-serializable — no Dates, functions, class instances, or Symbols
const { data } = useQuery({
  queryKey: ["events", new Date().toISOString()],  // use .toISOString() instead of new Date()
  queryFn: fetchEvents,
});

// RULE: placeholderData is shown while fetching then discarded; initialData is persisted to cache
// For SSR: use initialData (server-provided). For loading UX: use placeholderData.
// Wrong choice: initialData with stale data = no refetch until staleTime expires.
const { data } = useQuery({
  queryKey: ["profile"],
  queryFn: fetchProfile,
  placeholderData: { name: "Loading...", avatar: "" },  // shown while fetching, then replaced
});

// RULE: tests must use retry: false and fresh QueryClient per test to avoid cache leaks
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

// RULE: invalidateQueries by default only refetches ACTIVE (mounted) queries
// After mutation: pass refetchType: "all" to also refetch inactive cache entries
// Otherwise: navigating back to a detail page shows stale data
queryClient.invalidateQueries({
  queryKey: todoKeys.all,
  refetchType: "all",  // refetch inactive queries too; omitting this is a silent bug
});

// RULE: ensureQueryData WITHOUT coordinated staleTime causes double-fetch
// loader fetches, then component mounts and refetches same data (because default staleTime = 0)
// FIX: loader and component must reference same queryOptions with staleTime >= navigation time
const todoOptions = {
  queryKey: todoKeys.all,
  queryFn: fetchTodos,
  staleTime: 10_000,  // bridges loader → mount so component reuses loader's fetch
};

export async function loader() {
  await queryClient.ensureQueryData(todoOptions);  // prefetch + return data
}

// Component reuses same todoOptions so staleTime is identical on both sides
```
