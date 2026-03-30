---
name: react
description: React and Next.js performance optimization, diagnosis, and health-check guidelines. Use when writing, reviewing, refactoring, or auditing React/Next.js code.
---

## When to use
- Writing new React components or Next.js pages
- Reviewing/refactoring for performance
- Optimizing bundle size, data fetching, or load times
- Implementing server components or client-side data fetching
- Diagnosing codebase health (performance, security, correctness, architecture)
- Running automated audits on React projects

## When not to use
- Non-React projects
- Quick prototypes where perf is irrelevant
- Static pages with no interactivity

## Gotchas
- `useMemo`/`useCallback` for every value is premature optimization. Only memoize when: passing to React.memo'd children, or computation is genuinely expensive (>1ms).
- `useEffect` with an empty dep array `[]` is NOT `componentDidMount`. It runs after paint, not before. Use `useLayoutEffect` if you need synchronous DOM measurement.
- State updates in React 18+ are auto-batched everywhere (including promises, timeouts). Don't wrap in `flushSync` unless you specifically need synchronous rendering.
- Next.js App Router: `cookies()`, `headers()` make the entire route dynamic. One call in a layout makes ALL child pages dynamic.

## Async & Data Fetching
- **Start promises early, await late** — declare all promises BEFORE awaiting any: `const pUser = db.user.find(id); const pOrders = db.order.findMany(userId); const [user, orders] = await Promise.all([pUser, pOrders]);`. The key insight: call the function (starts I/O) and store the promise in a variable, THEN await all together. `Promise.all([fetchA(), fetchB()])` also works but "start early, await late" is more flexible when some results depend on others. In reviews: if you see `const a = await f(); const b = await g();` where f and g are independent, refactor to start-early-await-late
- **Use React.cache() for per-request deduplication** — in server components, wrap data-fetching functions in `React.cache()`: `const getUser = React.cache(async (id: string) => db.user.find(id))`. Multiple components calling `getUser(id)` in the same request get the same promise. Always mention `React.cache()` by name when reviewing server components that fetch data. In reviews: if 2+ server components call the same fetch function, recommend wrapping it in `React.cache()`
- Use LRU cache for cross-request server caching
- Use after() for non-blocking post-response work (analytics, logging)
- Use Suspense boundaries to stream content progressively
- Use SWR for automatic client request deduplication

## Bundle & Loading
- Import directly from modules, avoid barrel files
- Use next/dynamic for heavy/rarely-used components
- Defer third-party scripts (analytics, logging) with `strategy="lazyOnload"`
- Conditionally load modules only when feature is activated
- **Preload on hover/focus** — for lazy-loaded components (modals, exporters, heavy panels), trigger `import()` on the button's `onMouseEnter`/`onFocus` so the chunk loads during the ~200ms before click. In reviews: if a component uses next/dynamic or React.lazy, check that the trigger element preloads on hover

## Server Components & RSC
- Authenticate server actions like API routes
- Avoid duplicate serialization in RSC props
- Minimize data passed from server to client components
- Restructure server components to parallelize fetches

## State & Rendering
- Derive state during render, never in effects
- Don't wrap simple primitive expressions in useMemo
- **Pass initializer function to useState for expensive or SSR-unsafe defaults** — `useState(window.innerWidth)` crashes in SSR and runs every render. Use `useState(() => window.innerWidth)`. In reviews: if useState argument is a function call or browser API, wrap in `() =>`
- Use functional setState for stable callbacks
- Put interaction logic in event handlers, not effects
- Use startTransition for non-urgent state updates — prefer `useTransition` over manual `const [loading, setLoading] = useState(false)` patterns
- Hoist default non-primitive props outside render (objects, arrays, styles)
- **Use primitive values as effect/memo dependencies** — `useEffect(() => { ... }, [user])` re-runs when the object reference changes even if contents are the same. Extract what you need: `useEffect(() => { ... }, [user.id])`. In reviews: if a dep array contains an object, array, or function, flag it and recommend extracting the primitive field (`.id`, `.length`, `.name`). This is one of the most common sources of infinite loops and wasted renders
- Subscribe to derived booleans, not full objects
- Don't subscribe to state only used inside callbacks
- Extract expensive subtrees into memoized components
- Use ternary operator, not && for conditional rendering
- Use refs for transient high-frequency values (mouse position, scroll offset)
- **Use useLatest/ref pattern for stable callback references** — store callbacks in a ref to avoid stale closures and unnecessary effect re-runs: `const fnRef = useRef(fn); fnRef.current = fn;`. In reviews: if a useEffect re-runs because a callback dep changes, suggest the ref pattern

## Performance Micro-optimizations
- **Build Map/index for repeated collection lookups** — if you loop over items and call `.find()` or `.filter()` on another array each iteration, build a `Map` first: `const catMap = new Map(categories.map(c => [c.id, c]))`. In reviews: if you see `.find()` inside `.map()` or a loop, flag it as O(n*m) and recommend Map
- Cache object property access in tight loops
- Cache expensive function results in module-level Map
- Cache localStorage/sessionStorage reads — read once into state/ref, not every render
- Combine chained filter/map/reduce into single loop when processing large arrays
- Hoist RegExp creation outside component functions
- Use loop for min/max instead of sort()[0]
- Use Set/Map for O(1) lookups instead of Array.includes
- Use toSorted()/toReversed() for immutable array transforms
- Hoist static JSX outside component functions
- **Use content-visibility: auto for long off-screen lists** — add `content-visibility: auto; contain-intrinsic-size: auto 200px` to list item containers. This gives free browser-level virtualization without any library. In reviews: if a component renders 20+ items in a list or a `.map()` producing many DOM nodes, always recommend `content-visibility: auto` as a CSS optimization
- Group DOM/CSS changes via classes or cssText, not individual properties

## Hydration & SSR
- **Use inline script tags to prevent hydration flicker** — for theme/dark-mode stored in localStorage, read it in an inline `<script>` in `<head>` BEFORE React hydrates. useEffect runs AFTER paint, causing a visible flash. `suppressHydrationWarning` on the element is complementary but does not prevent the flicker itself
- Use suppressHydrationWarning for expected mismatches (timestamps, random IDs)
- Use Activity component for preserving hidden component state
- Animate a div wrapper around SVGs, not the SVG element
- Reduce SVG coordinate decimal precision

## Other
- Deduplicate global event listeners
- Use passive event listeners for scroll/touch
- Version and minimize localStorage data schemas
- Store event handlers in refs to avoid effect re-runs
- Initialize expensive singletons once per app load, not per render
- Return early from functions to avoid deep nesting
- Check array length before expensive element comparisons

## Diagnosis & Health Check

Run `npx -y react-doctor@latest . --verbose` at the project root to scan for issues across all categories below. It outputs a 0-100 score with actionable diagnostics (file paths, line numbers).

### Workflow
1. Run the command above at the project root
2. Read every diagnostic with file paths and line numbers
3. Fix issues starting with errors (highest severity)
4. Re-run to verify the score improved

### Score interpretation
- **75+**: Great
- **50-74**: Needs work
- **0-49**: Critical

### Diagnostic categories
- **Security**: hardcoded secrets in client bundle, eval() usage
- **State & Effects**: derived state in useEffect, missing cleanup, useState from props, cascading setState
- **Architecture**: components inside components, giant components, inline render functions
- **Performance**: layout property animations, transition-all, large blur values
- **Correctness**: array index as key, conditional rendering bugs
- **Next.js**: missing metadata, client-side fetching for server data, async client components
- **Bundle Size**: barrel imports, full lodash, moment.js, missing code splitting
- **Server**: missing auth in server actions, blocking without after()
- **Accessibility**: missing prefers-reduced-motion
- **Dead Code**: unused files, exports, types
