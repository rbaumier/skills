# TanStack Start SSR & Error Handling — WITHOUT SKILL

## Prompt
I'm using TanStack Start. Help me:
1. Set up a route that loads user profile data for SSR
2. Handle the case where the user is not found (404)
3. Handle authentication failures in route loading
4. I have some heavy analytics data - how should I load it without blocking the page?
5. I need to use Date.now() to show 'page generated at' timestamp

## Response

```tsx
// app/routes/profile/$userId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

export const Route = createFileRoute('/profile/$userId')({
  loader: async ({ params, context }) => {
    // Check authentication
    if (!context.auth?.isAuthenticated) {
      throw new Error('Not authenticated')
    }

    const user = await fetchUserProfile(params.userId)

    if (!user) {
      throw new Error('User not found')
    }

    // Prefetch analytics data
    context.queryClient.prefetchQuery({
      queryKey: ['analytics', params.userId],
      queryFn: () => fetchAnalytics(params.userId),
    })

    return { user }
  },

  component: ProfilePage,
})

function ProfilePage() {
  const { user } = Route.useLoaderData()

  return (
    <div>
      <h1>{user.name}</h1>
      <p>Page generated at: {new Date(Date.now()).toISOString()}</p>

      <Suspense fallback={<div>Loading analytics...</div>}>
        <AnalyticsDashboard userId={user.id} />
      </Suspense>
    </div>
  )
}

function AnalyticsDashboard({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['analytics', userId],
    queryFn: () => fetchAnalytics(userId),
  })

  return <div>{/* render analytics */}</div>
}
```

The loader fetches the user data server-side for SSR. If the user isn't found, we throw an error. Authentication is checked at the beginning of the loader. Analytics data is prefetched but loaded lazily via Suspense to avoid blocking the page render. The timestamp shows when the page was generated.
