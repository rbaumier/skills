```tsx
function UserPosts({ userId }: { userId?: string }) {
  const { data } = useQuery({
    queryKey: ["posts", userId],
    queryFn: () => fetchPosts(userId!),
    enabled: !!userId,
  });
  return <div>{data?.length} posts</div>;
}

export function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
      },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

const postKeys = {
  all: ["posts"] as const,
  detail: (id: string) => [...postKeys.all, id] as const,
};

const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filter: string) => [...todoKeys.lists(), filter] as const,
  detail: (id: string) => [...todoKeys.all, id] as const,
};

const { data: todos } = useQuery({ queryKey: todoKeys.all, queryFn: fetchTodos });
const { data: todo } = useQuery({ queryKey: todoKeys.detail(id), queryFn: () => fetchTodo(id) });
const { data: filtered } = useQuery({ queryKey: todoKeys.list(filter), queryFn: () => fetchFiltered(filter) });

const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: todoKeys.all });
    const previous = queryClient.getQueryData(todoKeys.all);
    queryClient.setQueryData(todoKeys.all, (old) => [...old, newTodo]);
    return { previous };
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(todoKeys.all, context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: todoKeys.all, refetchType: "all" });
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
    },
  },
});

const { data } = useQuery({
  queryKey: ["events", new Date().toISOString()],
  queryFn: fetchEvents,
});

const { data } = useQuery({
  queryKey: ["profile"],
  queryFn: fetchProfile,
  placeholderData: { name: "Loading...", avatar: "" },
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

test("renders todos", () => {
  const testQueryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={testQueryClient}>
      <TodoList />
    </QueryClientProvider>
  );
});

queryClient.invalidateQueries({ queryKey: todoKeys.all, refetchType: "all" });

const todoOptions = queryOptions({
  queryKey: todoKeys.all,
  queryFn: fetchPosts,
  staleTime: 10_000,
});

export async function loader() {
  const queryClient = new QueryClient();
  await queryClient.ensureQueryData(todoOptions);
}
```
