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

### Server Functions — createServerFn vs createServerOnlyFn
- `createServerFn()` — type-safe RPC. Build process replaces server code with RPC stubs in client bundle. Use for all data fetching and mutations
- `createServerOnlyFn()` — for utilities that must NEVER reach the client bundle. Calling from client THROWS intentionally. Use for raw DB URLs, encryption keys, internal-only helpers
- Why this matters: route loaders are ISOMORPHIC (run on both server AND client). If you access `process.env.SECRET` directly in a loader, it gets exposed to the client. Always wrap server-only logic in a server function
- Always validate inputs with schema (.validator(zodSchema))
- POST for mutations (default GET); `.method('POST')`
- HTTP-only cookies for sessions, never localStorage

### File-Based Routing Conventions
- `$param` — dynamic segment (e.g. `$postId.tsx` matches `/posts/:postId`)
- `_prefix` — pathless layout route. Groups routes under a shared layout WITHOUT adding URL segments (e.g. `_authed/dashboard.tsx` renders at `/dashboard`, not `/_authed/dashboard`)
- `__root.tsx` — root layout, wraps everything. There's exactly one
- Route files export a `Route` via `createFileRoute('/path')({ loader, component, errorComponent, pendingComponent })`

### Server Routes (API Endpoints)
- For when you need raw HTTP endpoints (webhooks, health checks, third-party callbacks) — NOT for internal data access (use server functions instead)
- Define via `server.handlers` in a route file:
```ts
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: ({ createHandlers }) => createHandlers({
      GET: async ({ request }) => {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    }),
  },
})
```

### SSR & Errors
- Pass dynamic data from loaders (Date.now() etc); never inline in JSX (hydration mismatch)
- `notFound()` for 404s, `redirect({ to: '/login' })` for auth
- `beforeLoad` for route protection, not inside loader
- Critical data: await in loader; non-critical: prefetch without await

### File Organization
- `.server.ts` for server-only (db, secrets) — NEVER import from client code
- `.functions.ts` for server function wrappers — safe to import anywhere. This is where you put your `createServerFn` calls so components can import them without accidentally pulling in server-only code
- `.ts` for shared schemas (client + server)
- Validate env vars with Zod at startup
- VITE_ prefix for client env vars
- Keep secrets out of error messages

### Link Preload Strategies
- `<Link preload="intent">` (default) preloads on hover/focus — good for most links
- `<Link preload="render">` preloads immediately when link renders — use for above-the-fold critical navigation
- `<Link preload={false}>` disables preloading for rarely-visited links
- Set `defaultPreloadStaleTime` in router config to control how long preloaded data stays fresh

### Search Params Validation
- Define typed search params per route: `createFileRoute('/posts')({ validateSearch: z.object({ page: z.number().default(1), filter: z.string().optional() }) })`
- Access via `Route.useSearch()`. Navigate: `<Link search={{ page: 2 }}>`
- Replaces manual `useSearchParams` parsing. Eliminates NaN/undefined bugs from untyped URL state

### Route Linting
- Add `@tanstack/eslint-plugin-router` to catch file-based routing mistakes at lint time: missing `createFileRoute`, wrong path strings, unused route exports. Prevents runtime 404s from typos

### General Start (non-discriminating)
- createServerFn() for server-side logic
- Middleware context via next({ context: {...} })
- Suspense boundaries for streaming
- Shared schemas between client forms and server functions
- Devtools: import `RouterDevtools` from `@tanstack/router-devtools` and `ReactQueryDevtoolsPanel` from `@tanstack/react-query-devtools`. Use lazy imports (`React.lazy(() => import(...))`) to tree-shake in production

---

## Table v8

- `accessor` renamed to `accessorKey` (string) or `accessorFn` (function)
- Use `getCoreRowModel()`, `getSortedRowModel()`, `getFilteredRowModel()`, `getPaginationRowModel()` from `@tanstack/react-table`
- Column definitions use `columnHelper.accessor()` or plain objects with `accessorKey`

## Form

- Use `@tanstack/react-form` with `@tanstack/zod-form-adapter` for Zod validation
- Configure: `useForm({ defaultValues, validatorAdapter: zodValidator(), onSubmit })`
- Field-level validation: `form.Field({ name, validators: { onChange: z.string().min(1) } })`
- Server-side validation: `createServerValidate()` for isomorphic validation in Start apps

## Virtual

- `useVirtualizer({ count, getScrollElement, estimateSize })` from `@tanstack/react-virtual`
- Only renders visible items + overscan buffer. Required for lists >100 items for smooth scroll
- Set `overscan: 5` minimum. For dynamic heights: provide `measureElement` callback

## Store

- `import { Store } from '@tanstack/store'`. Create: `new Store(initialState)`
- Subscribe: `store.subscribe(listener)`. Update: `store.setState((prev) => ({ ...prev, count: prev.count + 1 }))`
- Use `batch()` to group multiple updates so subscribers fire once
- Framework bindings: `useStore(store, selector)` from `@tanstack/react-store`
