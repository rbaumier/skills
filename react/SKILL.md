---
name: react
description: React and Next.js performance optimization, diagnosis, and health-check guidelines. Use when writing, reviewing, refactoring, or auditing React/Next.js code.
---

## Issue Priorities

> When reviewing or optimizing, fix issues in this order. Higher priority = bigger user impact.
> Don't chase medium-priority micro-optimizations while critical waterfalls exist.

| Priority | Category | Impact | Examples |
|----------|----------|--------|----------|
| **CRITICAL** | Request waterfalls | Blocks rendering, adds seconds | Sequential `await` on independent fetches, client-side fetch chains |
| **CRITICAL** | Bundle size | Blocks First Paint | Missing code splitting, barrel file imports, unused heavy deps |
| **HIGH** | Server performance | Slows TTFB | Unparallelized server fetches, missing `React.cache()`, no streaming |
| **HIGH** | Data serialization | Wastes bandwidth | Overfetching in RSC props, duplicate data across client components |
| **MEDIUM** | Unnecessary rerenders | Janky interactions | Missing memo on expensive subtrees, object refs in dep arrays |
| **MEDIUM** | Hydration issues | Flicker/mismatch | Missing `suppressHydrationWarning`, SSR-unsafe `useState` defaults |
| **LOW** | Micro-optimizations | Minor CPU savings | RegExp in render, chained array methods on small arrays |

## Gotchas
- `useMemo`/`useCallback` for every value is premature optimization. Only memoize when: passing to React.memo'd children, or computation is genuinely expensive (>1ms).
- `useEffect` with empty dep array `[]` is NOT `componentDidMount`. It runs after paint, not before. Use `useLayoutEffect` for synchronous DOM measurement. In reviews: if you see a comment like "runs like componentDidMount", flag it as incorrect.
- State updates in React 18+ are auto-batched everywhere (promises, timeouts). Don't wrap in `flushSync` unless you specifically need synchronous rendering.
- Next.js App Router: `cookies()`, `headers()` make the entire route dynamic. One call in a layout makes ALL child pages dynamic. In reviews: always flag `cookies()`/`headers()` in layouts and explain the blast radius.
- **`useSearchParams` requires Suspense boundary in static routes** — without a `<Suspense>` wrapper, `useSearchParams()` forces the entire page to client-side render. In reviews: if you see `useSearchParams()` without a Suspense boundary in a statically-rendered route, flag it as a CSR bailout.

## Async & Data Fetching
- Parallelize independent fetches via Promise.all
- **Handle partial dependencies with a "better-all" pattern** -- when some fetches depend on others but not all are sequential, start independent ones immediately and group dependent ones: `const pUser = getUser(id); const pConfig = getConfig(); const user = await pUser; const pOrders = getOrders(user.accountId); const [config, orders] = await Promise.all([pConfig, pOrders]);`. The key: `pConfig` started in parallel with `pUser`, so it runs during the `await pUser`. In reviews: if you see a chain like `await A; await B(A.id); await C` where C is independent of A/B, refactor so C starts before the first await
- **Start promises early, await late** -- declare all promises BEFORE awaiting any: `const pUser = db.user.find(id); const pOrders = db.order.findMany(userId); const [user, orders] = await Promise.all([pUser, pOrders]);`. The key insight: call the function (starts I/O) and store the promise in a variable, THEN await all together. `Promise.all([fetchA(), fetchB()])` also works but "start early, await late" is more flexible when some results depend on others. In reviews: if you see `const a = await f(); const b = await g();` where f and g are independent, refactor to start-early-await-late
- **Use React.cache() for per-request deduplication** -- in server components, wrap data-fetching functions in `React.cache()`: `const getUser = React.cache(async (id: string) => db.user.find(id))`. Multiple components calling `getUser(id)` in the same request get the same promise. Always mention `React.cache()` by name when reviewing server components that fetch data. In reviews: if 2+ server components call the same fetch function, recommend wrapping it in `React.cache()`
- Use LRU cache for cross-request server caching
- Use after() for non-blocking post-response work
- Use Suspense boundaries to stream progressively
- Use SWR for client request deduplication

## Bundle & Loading
- Import directly from modules, avoid barrel files
- Use next/dynamic for heavy/rarely-used components
- Defer third-party scripts with `strategy="lazyOnload"`
- Conditionally load modules only when feature is activated
- **Preload on hover/focus** -- for lazy-loaded components (modals, exporters, heavy panels), trigger `import()` on the button's `onMouseEnter`/`onFocus` so the chunk loads during the ~200ms before click. In reviews: if a component uses next/dynamic or React.lazy, check that the trigger element preloads on hover

## Server Components & RSC
- **Validate server action inputs like API routes** — server actions are public HTTP endpoints. Always validate with Zod at the top: `const parsed = schema.safeParse(input); if (!parsed.success) return { error: 'Invalid input' }`. Check authentication/authorization. Return structured results, never throw (errors cross server/client boundary). In reviews: if a server action uses arguments without validation, flag it as an unvalidated public endpoint
- **Error boundaries are required, not optional** — every route should have `error.tsx` (App Router) or `ErrorBoundary`. Without one, errors bubble to root and crash the entire app. Include a retry button (`reset()` function). In reviews: if a route segment has no error boundary, flag it
- **Partial Prerendering (PPR)** — Next.js PPR sends a static shell immediately and streams dynamic content into Suspense boundaries. Enable with `experimental.ppr = true`. Design pages as static-by-default with minimal dynamic islands. In reviews: if an entire page is dynamic because of one small dynamic section, suggest PPR with a Suspense boundary around just that section
- Avoid duplicate serialization in RSC props. In reviews: if the same data is passed to multiple client components, flag it as duplicate serialization
- Minimize data passed from server to client components
- Restructure server components to parallelize fetches

## State & Rendering
- Derive state during render, never in effects
- Don't wrap simple primitive expressions in useMemo
- **Pass initializer function to useState for expensive or SSR-unsafe defaults** -- `useState(window.innerWidth)` crashes in SSR and runs every render. Use `useState(() => window.innerWidth)`. In reviews: if useState argument is a function call or browser API, wrap in `() =>`
- Use functional setState for stable callbacks
- Put interaction logic in event handlers, not effects
- **`useActionState` (React 19) replaces manual form loading patterns** -- `useActionState(action, initialState)` returns `[state, formAction, isPending]`. Works with progressive enhancement. In reviews: if you see manual loading/error state around form submission, recommend `useActionState` + `useFormStatus()` in submit buttons
- **Use startTransition for non-urgent state updates** -- prefer `useTransition` over manual `const [loading, setLoading] = useState(false)` patterns. In reviews: if you see manual loading booleans around async operations, suggest useTransition instead
- **`useDeferredValue` for expensive re-renders during typing** -- wrap a derived value in `useDeferredValue()` to render the stale value first (keeping input responsive) and update the expensive view in the background. Use for search results, filtered lists. In reviews: if a search input causes jank when filtering a large list, suggest `useDeferredValue`
- **Key prop for state reset** -- change a component's `key` to force unmount/remount, resetting all internal state: `<UserForm key={userId} />`. Never use array index as key for dynamic lists that can reorder/filter. In reviews: if you see useEffect to reset state when a prop changes, suggest key-based remounting. If you see `.map((item, i) => <C key={i} />)` on a reorderable list, flag it
- Hoist default non-primitive props outside render
- **Use primitive values as effect/memo dependencies** -- `useEffect(() => { ... }, [user])` re-runs when the object reference changes even if contents are the same. Extract what you need: `useEffect(() => { ... }, [user.id])`. In reviews: if a dep array contains an object, array, or function, flag it and recommend extracting the primitive field (`.id`, `.length`, `.name`). This is one of the most common sources of infinite loops and wasted renders
- Subscribe to derived booleans, not full objects
- Don't subscribe to state only used inside callbacks
- Extract expensive subtrees into memoized components
- **Use ternary operator, not && for conditional rendering** -- `{isAdmin && <Panel />}` can render `0` or `""` when the condition is falsy. Use `{isAdmin ? <Panel /> : null}`. In reviews: if you see `&&` for conditional JSX rendering, flag it and recommend ternary
- Use refs for transient high-frequency values (mouse position, scroll offset). In reviews: if useState tracks mouse/scroll/resize at high frequency, recommend useRef + direct DOM mutation instead
- Use useLatest/ref pattern for stable callback references
- Store callbacks in refs to avoid effect re-runs

## Performance Micro-optimizations
- **Build Map/index for repeated collection lookups** -- if you loop over items and call `.find()` or `.filter()` on another array each iteration, build a `Map` first: `const catMap = new Map(categories.map(c => [c.id, c]))`. In reviews: if you see `.find()` inside `.map()` or a loop, flag it as O(n*m) and recommend Map
- Cache object property access in tight loops
- Cache expensive function results in module-level Map
- Cache localStorage/sessionStorage reads -- read once into state/ref
- **Combine chained filter/map/reduce into single loop** when processing large arrays. In reviews: if you see `.filter().map().filter()` or similar chains on large data, recommend a single `for` loop
- **Hoist RegExp creation outside component functions**. In reviews: if regex is created inside a component or loop, flag it and recommend module-level constant
- Use loop for min/max instead of sort()[0]
- **Use Set/Map for O(1) lookups** instead of Array.includes or filter+indexOf. In reviews: if deduplication uses `.filter((v,i,a) => a.indexOf(v) === i)`, recommend `[...new Set(arr)]`
- Use toSorted()/toReversed() for immutable array transforms
- Hoist static JSX outside component functions
- **Use content-visibility: auto for long off-screen lists** -- add `content-visibility: auto; contain-intrinsic-size: auto 200px` to list item containers. Free browser-level virtualization without any library. In reviews: if a component renders 20+ items in a list or a `.map()` producing many DOM nodes, always recommend `content-visibility: auto` as a CSS optimization
- Group DOM/CSS changes via classes or cssText

## Hydration & SSR
- Use inline script tags in `<head>` to prevent hydration flicker for theme/dark-mode
- Use suppressHydrationWarning for expected mismatches
- Use Activity component for preserving hidden state
- Reduce SVG coordinate decimal precision; animate div wrapper around SVGs

## Diagnosis & Health Check

Run `npx -y react-doctor@latest . --verbose` at project root for 0-100 score with actionable diagnostics.

### Workflow
1. Run command at project root
2. Read diagnostics with file paths and line numbers
3. Fix errors first (highest severity)
4. Re-run to verify improvement

### Score: 75+ Great | 50-74 Needs work | 0-49 Critical

### Categories
Security, State & Effects, Architecture, Performance, Correctness, Next.js, Bundle Size, Server, Accessibility, Dead Code
