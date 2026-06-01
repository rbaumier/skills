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

const { data: todos } = useQuery({ queryKey: ["todos"], queryFn: fetchTodos });
const { data: todo } = useQuery({ queryKey: ["todos", id], queryFn: () => fetchTodo(id) });
const { data: filtered } = useQuery({ queryKey: ["todos", "list", filter], queryFn: () => fetchFiltered(filter) });

const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    queryClient.setQueryData(["todos"], (old) => [...old, newTodo]);
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
  placeholderData: keepPreviousData,
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
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

queryClient.invalidateQueries({ queryKey: ["todos"] });

export async function loader() {
  await queryClient.ensureQueryData({ queryKey: ["posts"], queryFn: fetchPosts });
}
```
