---
name: tanstack
description: TanStack Query v5 + TanStack Start for full-stack React (server functions, middleware, SSR, auth)
---

## Query v5 Rules

### v5 Renames
- `isPending` not isLoading (initial load)
- `gcTime` not cacheTime
- `throwOnError` not useErrorBoundary
- `placeholderData: keepPreviousData` not `keepPreviousData: true`
- Query callbacks removed: no onSuccess/onError/onSettled on useQuery; use useEffect
- `initialPageParam` required for infinite queries

### v5 Patterns
- No `enabled` on useSuspenseQuery; conditional rendering instead
- Don't conditionally render on fetchStatus with useSuspenseQuery + streaming
- `refetchOnMount: false` needs `retryOnMount: false` for errored queries
- Pass `signal` to fetch for auto-cancellation
- Throw in queryFn: `if (!res.ok) throw new Error(...)`
- Invalidate after mutations via queryClient.invalidateQueries()

### General Query (non-discriminating)
- Object syntax: `useQuery({ queryKey, queryFn })`; array keys
- queryOptions()/infiniteQueryOptions() factories for reuse
- `select` for transformation; `staleTime` to prevent refetches
- QueryClientProvider + ReactQueryDevtools in app root

---

## Start Rules

### Server Functions
- Always validate inputs with schema (.validator(zodSchema))
- POST for mutations (default GET); `.method('POST')`
- HTTP-only cookies for sessions, never localStorage

### SSR & Errors
- Pass dynamic data from loaders (Date.now() etc); never inline in JSX (hydration mismatch)
- `notFound()` for 404s, `redirect({ to: '/login' })` for auth
- `beforeLoad` for route protection, not inside loader
- Critical data: await in loader; non-critical: prefetch without await

### File Organization
- `.server.ts` for server-only (db, secrets)
- `.functions.ts` for server function wrappers
- `.ts` for shared schemas (client + server)
- Validate env vars with Zod at startup
- VITE_ prefix for client env vars
- Keep secrets out of error messages

### General Start (non-discriminating)
- createServerFn() for server-side logic
- Middleware context via next({ context: {...} })
- Suspense boundaries for streaming
- Shared schemas between client forms and server functions
