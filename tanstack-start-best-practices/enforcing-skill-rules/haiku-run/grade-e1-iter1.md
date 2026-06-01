# Grade — tanstack-start-best-practices — eval 1, iter 1

STRICT grading. Code judged vs assertion descriptions only. PASS only if the violation is clearly corrected in the real code.

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | validateSearch-typed | PASS | Lines 7-9 `validateSearch: z.object({ page: z.number().default(1) })`; line 15 `const { page } = Route.useSearch();` with comment "Use Route.useSearch() instead of URLSearchParams". Typed search params, no manual URLSearchParams. |
| 2 | link-preload-strategies | PASS | Lines 27-35 cover all three strategies: `preload="render"` (above-fold), `preload="intent"` (default), `preload={false}` (rare). Matches assertion exactly. |
| 3 | scroll-restoration | FAIL | No `scrollRestoration` config and no `createRouter`/`getKey` anywhere in the file. Assertion requires `scrollRestoration` with `getKey` for search-param routes. Trap "No scroll restoration config" not addressed. |
| 4 | server-form-validation | FAIL | Lines 58-64 define a hand-rolled `serverValidate` using `createPostSchema.parseAsync(data)` — NOT `createServerValidate()` from `@tanstack/start` as the assertion requires. Form (line 68) does not pass `serverValidate` to `useForm`. The required API is absent. |
| 5 | staleTime-loader-coordination | PASS | Lines 85-90 `ensureQueryData({ ..., staleTime: 30 * 1000 })` with comment "Set staleTime >= navigation time (~5-30s) for prefetched queries". staleTime coordinated to navigation time. |
| 6 | pendingComponent-not-suspense | PASS | Line 93 `pendingComponent: () => <div>Loading posts...</div>` at route level; Suspense (line 106) used only for sub-route `PostContent` streaming. Matches "pendingComponent for route-level, Suspense for sub-route streaming". |
| 7 | createAPIFileRoute | FAIL | Lines 130-138 use `createFileRoute("/api/health")({ server: { handlers: { GET: ... } } })`. The assertion explicitly requires `createAPIFileRoute` with HTTP method exports (each method a separate export). Neither is present — uses nested `server.handlers` object instead. |

PASS: 4 / 7
