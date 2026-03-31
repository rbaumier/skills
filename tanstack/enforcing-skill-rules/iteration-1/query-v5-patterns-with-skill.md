# Query v5 Advanced Patterns — WITH SKILL

## Prompt
Write a React component with TanStack Query v5 that:
1. Has an infinite scroll list fetching pages from '/api/items'
2. Uses useSuspenseQuery for SSR-safe data fetching
3. Shows a background refetch indicator based on fetchStatus
4. After a mutation succeeds, refreshes the list
5. Uses enabled: false on the suspense query when user is logged out
6. Handles the case where refetchOnMount: false but query previously errored

## Response

There are several traps in this prompt. Let me address each correctly per TanStack Query v5 rules:

### 1. Infinite Scroll with `initialPageParam` (required in v5)

```tsx
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function InfiniteItemList() {
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['items'],
    queryFn: async ({ pageParam, signal }) => {
      const res = await fetch(`/api/items?cursor=${pageParam}`, { signal })
      if (!res.ok) throw new Error('Failed to fetch items')
      return res.json()
    },
    initialPageParam: 0, // REQUIRED in v5
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const addItem = useMutation({
    mutationFn: async (newItem: { name: string }) => {
      const res = await fetch('/api/items', {
        method: 'POST',
        body: JSON.stringify(newItem),
      })
      if (!res.ok) throw new Error('Failed to add item')
      return res.json()
    },
    onSuccess: () => {
      // Invalidate to refetch active queries with this key
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
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  )
}
```

### 2. useSuspenseQuery — NO `enabled`, NO conditional `fetchStatus` rendering

```tsx
import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense } from 'react'

// WRONG: useSuspenseQuery does NOT support `enabled`
// const { data } = useSuspenseQuery({ enabled: isLoggedIn, ... })

// CORRECT: Use conditional rendering to control when the query runs
function UserProfile() {
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', 'profile'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/user/profile', { signal })
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json()
    },
  })

  // DO NOT conditionally render based on fetchStatus with useSuspenseQuery + streaming
  // This causes hydration mismatches. Data is always available after Suspense resolves.

  return <div>{user.name}</div>
}

// Conditional rendering replaces `enabled`:
function App({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div>
      {isLoggedIn ? (
        <Suspense fallback={<div>Loading profile...</div>}>
          <UserProfile />
        </Suspense>
      ) : (
        <div>Please log in</div>
      )}
    </div>
  )
}
```

### 3. `refetchOnMount: false` + errored query

When using `refetchOnMount: false`, v5 will **still** refetch if the query previously errored. To truly prevent refetch on mount for errored queries, you must also set `retryOnMount: false`:

```tsx
const { data } = useQuery({
  queryKey: ['settings'],
  queryFn: fetchSettings,
  refetchOnMount: false,
  retryOnMount: false, // Required to prevent refetch of errored queries
})
```

### Key corrections:
- **`initialPageParam`** is required for `useInfiniteQuery` in v5
- **`enabled` is not supported** on `useSuspenseQuery` — use conditional rendering
- **Don't conditionally render on `fetchStatus`** with useSuspenseQuery + streaming
- **`invalidateQueries`** after mutation success to refresh the list
- **`retryOnMount: false`** needed alongside `refetchOnMount: false` for errored queries
- **`signal`** passed to fetch in queryFn for automatic cancellation
- **Throw errors** in queryFn when response is not ok
