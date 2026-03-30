# TanStack Start SSR & Error Handling — WITH SKILL

## Prompt
I'm using TanStack Start. Help me:
1. Set up a route that loads user profile data for SSR
2. Handle the case where the user is not found (404)
3. Handle authentication failures in route loading
4. I have some heavy analytics data - how should I load it without blocking the page?
5. I need to use Date.now() to show 'page generated at' timestamp

## Response

### Route with SSR, Auth Protection, and Streaming

```tsx
// app/routes/profile/$userId.tsx
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { Suspense } from 'react'

export const Route = createFileRoute('/profile/$userId')({
  // Protect the route with beforeLoad — runs before any data loading
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      // Use redirect() for authentication failures
      throw redirect({ to: '/login' })
    }
  },

  loader: async ({ params, context }) => {
    // CRITICAL: Pass dynamic data (like timestamps) through the loader
    // to prevent hydration mismatches. Never call Date.now() directly in JSX.
    const generatedAt = Date.now()

    // Critical path data: AWAIT in loader (blocks render until ready)
    const user = await fetchUserProfile(params.userId)

    if (!user) {
      // Use notFound() for 404 cases
      throw notFound()
    }

    // Non-critical data: PREFETCH WITHOUT AWAIT (streams via Suspense)
    const analyticsPromise = context.queryClient.prefetchQuery({
      queryKey: ['analytics', params.userId],
      queryFn: () => fetchAnalytics(params.userId),
    })
    // DO NOT await analyticsPromise — let it stream

    return {
      user,
      generatedAt,
    }
  },

  component: ProfilePage,
  notFoundComponent: () => <div>User not found</div>,
})

function ProfilePage() {
  const { user, generatedAt } = Route.useLoaderData()

  return (
    <div>
      <h1>{user.name}</h1>
      <p>Page generated at: {new Date(generatedAt).toISOString()}</p>

      {/* Non-critical content streamed with Suspense boundary */}
      <Suspense fallback={<div>Loading analytics...</div>}>
        <AnalyticsDashboard userId={user.id} />
      </Suspense>
    </div>
  )
}

function AnalyticsDashboard({ userId }: { userId: string }) {
  // This data was prefetched (without await) in the loader
  // It streams in when ready, without blocking the page
  const { data } = useSuspenseQuery({
    queryKey: ['analytics', userId],
    queryFn: () => fetchAnalytics(userId),
  })

  return <div>{/* render analytics */}</div>
}
```

### Key patterns applied:
1. **`beforeLoad`** — protects the route; runs before loader
2. **`redirect()`** — for authentication failures, redirects to login
3. **`notFound()`** — for 404 cases when user doesn't exist
4. **Critical data awaited** in loader (`user`), **non-critical prefetched without await** (`analytics`) — streams via Suspense
5. **`Date.now()` passed through loader** — prevents hydration mismatch (server and client would produce different timestamps if called inline)
6. **Suspense boundary** wraps the analytics dashboard for streaming non-critical content
