# Query v5 Syntax & Renames — WITH SKILL

## Prompt
Write a React component that fetches a list of todos using TanStack Query. The component should:
1. Use useQuery to fetch todos from '/api/todos'
2. Show a loading spinner while data loads for the first time
3. Handle errors with useErrorBoundary
4. Set cacheTime to 5 minutes
5. When filter changes, use keepPreviousData: true to avoid flicker
6. On successful fetch, log the data with onSuccess callback

## Response

Several items in your prompt use **v4 API** that has been renamed or removed in TanStack Query v5. Here's the corrected implementation:

```tsx
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useEffect } from 'react'

interface Todo {
  id: number
  title: string
  completed: boolean
}

function TodoList({ filter }: { filter: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['todos', filter],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/todos?filter=${filter}`, { signal })
      if (!res.ok) throw new Error('Failed to fetch todos')
      return res.json() as Promise<Todo[]>
    },
    throwOnError: true, // v5: renamed from useErrorBoundary
    gcTime: 5 * 60 * 1000, // v5: renamed from cacheTime
    placeholderData: keepPreviousData, // v5: replaces keepPreviousData: true
  })

  // v5: onSuccess/onError/onSettled callbacks removed from useQuery
  // Use useEffect for side effects instead
  useEffect(() => {
    if (data) {
      console.log('Todos fetched:', data)
    }
  }, [data])

  if (isPending) {
    // v5: use isPending for initial load state, not isLoading
    return <div className="spinner">Loading...</div>
  }

  if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
```

### Key v5 corrections applied:
1. **Object syntax** — `useQuery({ queryKey, queryFn })` not positional args
2. **Array query keys** — `['todos', filter]` not a string
3. **`isPending`** not `isLoading` for first-time loading state
4. **`gcTime`** not `cacheTime` (renamed in v5)
5. **`throwOnError`** not `useErrorBoundary` (renamed in v5)
6. **`placeholderData: keepPreviousData`** not `keepPreviousData: true`
7. **No `onSuccess`** — query callbacks removed in v5; use `useEffect` instead
8. **`signal`** passed to fetch for automatic cancellation on queryKey change
