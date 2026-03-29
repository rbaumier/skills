---
name: tanstack
description: TanStack Query v5 for React server state management + TanStack Start for full-stack React applications (server functions, middleware, SSR, auth, deployment)
---

## When to use
- Setting up data fetching/caching in React
- Fixing v4 to v5 migration errors
- Debugging SSR/hydration issues with streaming
- Implementing optimistic updates, infinite scroll, prefetching
- Creating server functions for data mutations
- Setting up middleware for auth/logging
- Configuring SSR and hydration
- Implementing authentication flows
- Handling errors across client/server boundary
- Organizing full-stack code
- Deploying to various platforms

## When not to use
- Client-only state (use useState/Zustand/Jotai)
- Simple one-off fetches without caching needs
- Non-React projects

---

## TanStack Query v5 Rules

- Always object syntax: `useQuery({ queryKey, queryFn })`
- Always array query keys: `['todos', id, { filter }]`
- Use `isPending` for initial load, not `isLoading`
- Use `gcTime` not `cacheTime` (renamed in v5)
- Use `throwOnError` not `useErrorBoundary` (renamed in v5)
- Use `placeholderData: keepPreviousData` not `keepPreviousData: true`
- Query callbacks removed: no onSuccess/onError/onSettled on useQuery
- Use useEffect for query side effects instead of callbacks
- Mutation callbacks (onSuccess etc.) still supported
- v5.89+ mutation callbacks have 4 params: add onMutateResult before context
- Always `initialPageParam` for infinite queries (required in v5)
- `maxPages` requires both getNextPageParam and getPreviousPageParam
- Use `queryOptions()` / `infiniteQueryOptions()` factories for reuse
- Set `staleTime` appropriately to prevent excessive refetches
- Throw errors in queryFn: `if (!res.ok) throw new Error(...)`
- Invalidate queries after mutations via `queryClient.invalidateQueries()`
- `invalidateQueries` only refetches active queries; use `refetchType: 'all'` for inactive
- No `enabled` on useSuspenseQuery; use conditional rendering instead
- refetch() is for same params only; change queryKey for new params
- Include changing params (page, filter, search) in queryKey
- Use `select` for data transformation
- Pass `signal` to fetch for auto-cancellation on queryKey change
- Prefer useSuspenseQuery over useQuery for SSR to avoid hydration errors
- Don't conditionally render on fetchStatus with useSuspenseQuery + streaming
- `refetchOnMount: false` ignored for errored queries; add `retryOnMount: false`
- v5 error type defaults to Error; specify generic if throwing non-Error
- v5.90.8 broke readonly query keys; upgrade to v5.90.9+
- useMutationState variables typed as unknown; cast explicitly
- fetchQuery CancelledError in StrictMode is dev-only, not a bug
- Use useMutationState for cross-component mutation tracking
- Optimistic updates: useMutationState + pending filter, no cache manipulation needed
- networkMode: 'online' (default), 'always', or 'offlineFirst' for PWA
- useQueries combine option merges parallel query results
- Multiple listeners on same queryKey: last write wins for options
- Wrap with QueryClientProvider + ReactQueryDevtools in app root

---

## TanStack Start Rules

### Architecture Choice: Server Functions vs Dedicated API

**Option A -- `createServerFn` (default)**
- Best for: frontend-first apps, prototypes, no external API consumers
- Server functions are type-safe RPC under the hood, tightly coupled to frontend

**Option B -- Dedicated API framework (e.g. Hono) via catch-all route**
- Best for: apps needing an API consumable by external clients (mobile, CLI, webhooks), OpenAPI spec auto-generation, independent backend testing
- Pattern: TanStack Start handles SSR/routing only, a catch-all route (`/api/$`) delegates to `app.fetch()`
- Frontend consumes the API via `openapi-fetch` with types generated from the OpenAPI spec (`openapi-typescript`)
- SSR cookie forwarding: loaders calling the internal API must forward browser cookies via middleware on the API client -- use `getRequestHeaders()` from TanStack Start to get incoming cookies during SSR, then inject them as `Cookie` header on outgoing API requests. Without this, all authenticated SSR queries fail with 401
- SSR error serialization: TanStack Start only serializes `Error.message` across the server-to-client boundary. Rich error objects (ProblemDetail, custom fields) must be JSON-encoded in the message string and reconstructed client-side with a static `fromError()` method

Both approaches can coexist -- use server functions for simple mutations while routing complex API logic through the dedicated framework.

### Server Functions
- Use `createServerFn()` for server-side logic (see `start-server-functions.md`)
- Always validate server function inputs with schema (see `start-input-validation.md`)
- Default method is GET (idempotent, cacheable); use POST for mutations
- Server functions are composable: call from loaders, components, or other server functions

### Middleware
- Use request middleware for cross-cutting concerns: auth, logging, rate limiting (see `start-middleware.md`)
- Middleware adds context via `next({ context: {...} })`
- Order matters: first middleware wraps the entire chain
- Global middleware defined in `app/start.ts`

### Authentication
- Use HTTP-only cookies for sessions, never localStorage (see `start-auth-session.md`)
- Protect routes with `beforeLoad` in route definitions (see `start-auth-routes.md`)
- Use pathless layout routes (`_authenticated.tsx`) for grouped protection
- Store minimal data in session; fetch user details on demand

### SSR
- Prevent hydration mismatches: pass dynamic data from loaders (see `start-ssr-hydration.md`)
- Stream non-critical content with Suspense boundaries (see `start-ssr-streaming.md`)
- Use static prerendering for static pages, ISR for semi-static (see `start-ssr-prerender.md`)
- Critical path data should be awaited in loader; non-critical prefetched without await

### Error Handling
- Use structured error classes (AppError, NotFoundError, etc.) (see `start-error-handling.md`)
- Use `notFound()` for 404s, `redirect()` for auth errors
- Log full errors server-side, sanitize for client
- Validation errors from `.validator()` are automatic

### File Organization
- `.server.ts` for server-only logic (db, secrets) -- never import on client
- `.functions.ts` for server function wrappers -- safe to import anywhere
- `.ts` for shared utilities and types
- Share validation schemas between client forms and server functions (see `start-file-separation.md`)

### Environment
- Validate env vars at startup with Zod (see `start-env-functions.md`)
- Use `VITE_` prefix for client-accessible variables
- Keep secrets out of error messages and logs

### API Routes
- Use server routes (`createFileRoute` with `server.handlers`) for webhooks, public APIs, external consumers (see `start-api-routes.md`)
- Server functions for internal RPC; server routes for external HTTP endpoints

### Deployment
- Configure deployment adapter matching your platform (see `start-deploy-adapters.md`)
- Adapters: vercel, cloudflare-pages, cloudflare, netlify, node-server, static, aws-lambda, bun

---

## Reference Files Index

### TanStack Query
| File | Content |
|------|---------|
| `query-rules.md` | v5 corrections: object syntax, removed callbacks, renames |
| `best-practices.md` | Performance, caching strategies, common patterns |
| `common-patterns.md` | Reusable patterns: dependent queries, pagination, infinite scroll |
| `testing.md` | Testing queries, mutations, components with MSW |
| `top-errors.md` | Complete error reference with fixes |
| `typescript-patterns.md` | Type-safe query/mutation patterns |
| `v4-to-v5-migration.md` | Migration checklist and codemods |

### TanStack Start
| File | Content |
|------|---------|
| `start-server-functions.md` | createServerFn usage, GET/POST, composition |
| `start-input-validation.md` | Zod validation, shared schemas, transforms |
| `start-middleware.md` | Auth/logging/rate-limit middleware patterns |
| `start-auth-session.md` | Secure session cookies, login/logout flows |
| `start-auth-routes.md` | Route protection with beforeLoad, role-based access |
| `start-ssr-hydration.md` | Preventing hydration mismatches |
| `start-ssr-streaming.md` | Streaming SSR with Suspense boundaries |
| `start-ssr-prerender.md` | Static prerendering and ISR |
| `start-error-handling.md` | Server function error handling, structured errors |
| `start-env-functions.md` | Environment variable validation and management |
| `start-file-separation.md` | Server/client code separation conventions |
| `start-deploy-adapters.md` | Deployment adapter configuration |
| `start-api-routes.md` | Server routes for external consumers and webhooks |
