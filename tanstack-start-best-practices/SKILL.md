---
name: tanstack-start-best-practices
description: TanStack Start best practices for full-stack React applications. Server functions, middleware, SSR, authentication, and deployment patterns. Activate when building full-stack apps with TanStack Start.
---

# TanStack Start Best Practices

Comprehensive guidelines for implementing TanStack Start patterns in full-stack React applications. These rules cover server functions, middleware, SSR, authentication, and deployment.

## When to Apply

- Creating server functions for data mutations
- Setting up middleware for auth/logging
- Configuring SSR and hydration
- Implementing authentication flows
- Handling errors across client/server boundary
- Organizing full-stack code
- Deploying to various platforms

## Architecture Choice: Server Functions vs Dedicated API

TanStack Start supports two valid architectures. Choose based on your needs:

**Option A — `createServerFn` (default, covered by rules below)**
- Best for: frontend-first apps, prototypes, no external API consumers
- Server functions are type-safe RPC under the hood, tightly coupled to frontend

**Option B — Dedicated API framework (e.g. Hono) via catch-all route**
- Best for: apps needing an API consumable by external clients (mobile, CLI, webhooks), OpenAPI spec auto-generation, independent backend testing
- Pattern: TanStack Start handles SSR/routing only, a catch-all route (`/api/$`) delegates to `app.fetch()`
- Frontend consumes the API via `openapi-fetch` with types generated from the OpenAPI spec (`openapi-typescript`)
- SSR cookie forwarding: loaders calling the internal API must forward browser cookies via middleware on the API client — use `getRequestHeaders()` from TanStack Start to get incoming cookies during SSR, then inject them as `Cookie` header on outgoing API requests. Without this, all authenticated SSR queries fail with 401
- SSR error serialization: TanStack Start only serializes `Error.message` across the server→client boundary. Rich error objects (ProblemDetail, custom fields) must be JSON-encoded in the message string and reconstructed client-side with a static `fromError()` method

Both approaches can coexist — use server functions for simple mutations while routing complex API logic through the dedicated framework.

## Rule Categories by Priority

| Priority | Category | Rules | Impact |
|----------|----------|-------|--------|
| CRITICAL | Server Functions | 5 rules | Core data mutation patterns |
| CRITICAL | Security | 4 rules | Prevents vulnerabilities |
| HIGH | Middleware | 4 rules | Request/response handling |
| HIGH | Authentication | 4 rules | Secure user sessions |
| MEDIUM | API Routes | 1 rule | External endpoint patterns |
| MEDIUM | SSR | 6 rules | Server rendering patterns |
| MEDIUM | Error Handling | 3 rules | Graceful failure handling |
| MEDIUM | Environment | 1 rule | Configuration management |
| LOW | File Organization | 3 rules | Maintainable code structure |
| LOW | Deployment | 2 rules | Production readiness |

## Quick Reference

### Server Functions (Prefix: `sf-`)

- `sf-create-server-fn` — Use createServerFn for server-side logic
- `sf-input-validation` — Always validate server function inputs
- `sf-method-selection` — Choose appropriate HTTP method
- `sf-error-handling` — Handle errors in server functions
- `sf-response-headers` — Customize response headers when needed
- `sf-form-validation` — Use `@tanstack/react-form` with `createServerValidate()` from `@tanstack/start`. Server validation runs in the server function, client validation runs in the browser — same schema, both sides. `.functions.ts` exports server validate, component imports and passes to `useForm({ serverValidate })`

### Security (Prefix: `sec-`)

- `sec-validate-inputs` — Validate all user inputs with schemas
- `sec-auth-middleware` — Protect routes with auth middleware
- `sec-sensitive-data` — Keep secrets server-side only
- `sec-csrf-protection` — Implement CSRF protection for mutations

### Middleware (Prefix: `mw-`)

- `mw-request-middleware` — Use request middleware for cross-cutting concerns
- `mw-function-middleware` — Use function middleware for server functions
- `mw-context-flow` — Properly pass context through middleware
- `mw-composability` — Compose middleware effectively

### Authentication (Prefix: `auth-`)

- `auth-session-management` — Implement secure session handling
- `auth-route-protection` — Protect routes with beforeLoad
- `auth-server-functions` — Verify auth in server functions
- `auth-cookie-security` — Configure secure cookie settings

### API Routes (Prefix: `api-`)

- `api-routes` — Create API routes for external consumers. Use `createAPIFileRoute('/api/health')({ GET: async ({ request }) => Response.json({ ok: true }) })` for cleaner typed API route definitions. Each HTTP method is a separate export

### SSR (Prefix: `ssr-`)

- `ssr-data-loading` — Load data appropriately for SSR. Coordinate `staleTime` between loader and query: if `staleTime` is too low, the component refetches immediately after the loader already fetched. Set `staleTime >= navigation time` (~5-30s) for prefetched queries, or use `defaultPreloadStaleTime` at router level
- `ssr-hydration-safety` — Prevent hydration mismatches
- `ssr-streaming` — Implement streaming SSR for faster TTFB. Use `pendingComponent` for route-level loading states (co-located with route, participates in preloading). Use Suspense only for sub-route streaming
- `ssr-selective` — Apply selective SSR when beneficial
- `ssr-prerender` — Configure static prerendering and ISR
- `ssr-search-params` — Define typed search params per route: `createFileRoute('/posts')({ validateSearch: z.object({ page: z.number().default(1), sort: z.enum(['asc', 'desc']).default('desc') }) })`. Access via `Route.useSearch()`. Navigate: `<Link search={{ page: 2 }}>`. Eliminates manual URLSearchParams parsing
- `ssr-preloading` — Link preload strategies: `<Link preload="intent">` (default, on hover/focus), `<Link preload="render">` (immediate, for above-the-fold), `<Link preload={false}>` (disabled, for rare links). Configure `defaultPreloadStaleTime` in router options
- `ssr-scroll-restoration` — TanStack Start handles scroll restoration automatically. For custom behavior: `createRouter({ scrollRestoration: { getKey: (location) => location.pathname } })`. Without custom key, back/forward may scroll to wrong position on routes with search params

### Environment (Prefix: `env-`)

- `env-functions` — Use environment functions for configuration

### Error Handling (Prefix: `err-`)

- `err-server-errors` — Handle server function errors
- `err-redirects` — Use redirects appropriately
- `err-not-found` — Handle not-found scenarios

### File Organization (Prefix: `file-`)

- `file-separation` — Separate server and client code
- `file-functions-file` — Use .functions.ts pattern
- `file-shared-validation` — Share validation schemas

### Deployment (Prefix: `deploy-`)

- `deploy-env-config` — Configure environment variables
- `deploy-adapters` — Choose appropriate deployment adapter

## How to Use

Each rule file in the `rules/` directory contains:
1. **Explanation** — Why this pattern matters
2. **Bad Example** — Anti-pattern to avoid
3. **Good Example** — Recommended implementation
4. **Context** — When to apply or skip this rule

## Full Reference

See individual rule files in `rules/` directory for detailed guidance and code examples.
