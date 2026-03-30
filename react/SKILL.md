---
name: react
description: React and Next.js performance optimization, diagnosis, and health-check guidelines. Use when writing, reviewing, refactoring, or auditing React/Next.js code.
---

## Gotchas
- `useMemo`/`useCallback` for every value is premature optimization. Only memoize when: passing to React.memo'd children, or computation is genuinely expensive (>1ms).
- `useEffect` with empty dep array `[]` is NOT `componentDidMount`. It runs after paint, not before. Use `useLayoutEffect` for synchronous DOM measurement. In reviews: if you see a comment like "runs like componentDidMount", flag it as incorrect.
- State updates in React 18+ are auto-batched everywhere (promises, timeouts). Don't wrap in `flushSync` unless you specifically need synchronous rendering.
- Next.js App Router: `cookies()`, `headers()` make the entire route dynamic. One call in a layout makes ALL child pages dynamic. In reviews: always flag `cookies()`/`headers()` in layouts and explain the blast radius.

## Async & Data Fetching
- Parallelize independent fetches via Promise.all
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
- Authenticate server actions like API routes
- Avoid duplicate serialization in RSC props. In reviews: if the same data is passed to multiple client components, flag it as duplicate serialization
- Minimize data passed from server to client components
- Restructure server components to parallelize fetches

## State & Rendering
- Derive state during render, never in effects
- Don't wrap simple primitive expressions in useMemo
- **Pass initializer function to useState for expensive or SSR-unsafe defaults** -- `useState(window.innerWidth)` crashes in SSR and runs every render. Use `useState(() => window.innerWidth)`. In reviews: if useState argument is a function call or browser API, wrap in `() =>`
- Use functional setState for stable callbacks
- Put interaction logic in event handlers, not effects
- **Use startTransition for non-urgent state updates** -- prefer `useTransition` over manual `const [loading, setLoading] = useState(false)` patterns. In reviews: if you see manual loading booleans around async operations, suggest useTransition instead
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
