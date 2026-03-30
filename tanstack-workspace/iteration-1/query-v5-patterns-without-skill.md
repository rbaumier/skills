# Query v5 Advanced Patterns — WITHOUT SKILL

## Prompt
Write a React component with TanStack Query v5 that:
1. Has an infinite scroll list fetching pages from '/api/items'
2. Uses useSuspenseQuery for SSR-safe data fetching
3. Shows a background refetch indicator based on fetchStatus
4. After a mutation succeeds, refreshes the list
5. Uses enabled: false on the suspense query when user is logged out
6. Handles the case where refetchOnMount: false but query previously errored

## Response

```tsx
import {
  useInfiniteQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { Suspense } from 'react'

function InfiniteItemList() {
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['items'],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/items?cursor=${pageParam}`)
      return res.json()
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const addItem = useMutation({
    mutationFn: async (newItem: { name: string }) => {
      const res = await fetch('/api/items', {
        method: 'POST',
        body: JSON.stringify(newItem),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  return (
    <div>
      {data?.pages.flatMap((page) =>
        page.items.map((item: any) => <div key={item.id}>{item.name}</div>)
      )}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          Load More
        </button>
      )}
    </div>
  )
}

function UserProfile({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { data: user, fetchStatus } = useSuspenseQuery({
    queryKey: ['user', 'profile'],
    queryFn: async () => {
      const res = await fetch('/api/user/profile')
      return res.json()
    },
    enabled: isLoggedIn,
  })

  return (
    <div>
      {fetchStatus === 'fetching' && <div className="refetch-indicator">Updating...</div>}
      <div>{user.name}</div>
    </div>
  )
}

function SettingsPanel() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    refetchOnMount: false,
  })

  return <div>{JSON.stringify(data)}</div>
}

export function App({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <UserProfile isLoggedIn={isLoggedIn} />
      </Suspense>
      <InfiniteItemList />
      <SettingsPanel />
    </div>
  )
}
```

This sets up infinite scrolling with `useInfiniteQuery`, uses `useSuspenseQuery` for SSR-safe loading with a Suspense boundary, and invalidates queries after mutations. The `enabled: false` prevents the suspense query from running when the user is logged out, and `refetchOnMount: false` prevents unnecessary refetches.
