# Query v5 Syntax & Renames — WITHOUT SKILL

## Prompt
Write a React component that fetches a list of todos using TanStack Query. The component should:
1. Use useQuery to fetch todos from '/api/todos'
2. Show a loading spinner while data loads for the first time
3. Handle errors with useErrorBoundary
4. Set cacheTime to 5 minutes
5. When filter changes, use keepPreviousData: true to avoid flicker
6. On successful fetch, log the data with onSuccess callback

## Response

```tsx
import { useQuery } from '@tanstack/react-query'

interface Todo {
  id: number
  title: string
  completed: boolean
}

function TodoList({ filter }: { filter: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['todos', filter],
    queryFn: async () => {
      const res = await fetch(`/api/todos?filter=${filter}`)
      if (!res.ok) throw new Error('Failed to fetch todos')
      return res.json() as Promise<Todo[]>
    },
    useErrorBoundary: true,
    cacheTime: 5 * 60 * 1000,
    keepPreviousData: true,
    onSuccess: (data) => {
      console.log('Todos fetched:', data)
    },
  })

  if (isLoading) {
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

This component uses `useQuery` with an object config to fetch todos. The `isLoading` state shows a spinner during the initial fetch, `useErrorBoundary` propagates errors to the nearest error boundary, and `keepPreviousData` prevents flickering when the filter changes. The `onSuccess` callback logs the data after each successful fetch.
