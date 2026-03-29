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

## Rules
- Move await into branches where actually needed, don't block early
- Use Promise.all() for independent async operations
- Use partial-dependency helpers (better-all) when promises depend on each other
- Start promises early, await late in API routes
- Use Suspense boundaries to stream content progressively
- Import directly from modules, avoid barrel files
- Use next/dynamic for heavy/rarely-used components
- Defer third-party scripts (analytics, logging) until after hydration
- Conditionally load modules only when feature is activated
- Preload resources on hover/focus for perceived speed
- Authenticate server actions like API routes
- Use React.cache() for per-request deduplication
- Use LRU cache for cross-request server caching
- Avoid duplicate serialization in RSC props
- Minimize data passed from server to client components
- Restructure server components to parallelize fetches
- Use after() for non-blocking post-response work
- Use SWR for automatic client request deduplication
- Deduplicate global event listeners
- Use passive event listeners for scroll/touch
- Version and minimize localStorage data schemas
- Don't subscribe to state only used inside callbacks
- Extract expensive subtrees into memoized components
- Hoist default non-primitive props outside render
- Use primitive values as effect/memo dependencies
- Subscribe to derived booleans, not full objects
- Derive state during render, never in effects
- Use functional setState for stable callbacks
- Pass initializer function to useState for expensive defaults
- Don't wrap simple primitive expressions in useMemo
- Put interaction logic in event handlers, not effects
- Use startTransition for non-urgent state updates
- Use refs for transient high-frequency values
- Animate a div wrapper around SVGs, not the SVG element
- Use content-visibility: auto for long off-screen lists
- Hoist static JSX outside component functions
- Reduce SVG coordinate decimal precision
- Use inline script tags to prevent hydration flicker for client-only data
- Use suppressHydrationWarning for expected mismatches
- Use Activity component for preserving hidden component state
- Use ternary operator, not && for conditional rendering
- Prefer useTransition over manual loading state booleans
- Group DOM/CSS changes via classes or cssText, not individual properties
- Build Map/index for repeated collection lookups
- Cache object property access in tight loops
- Cache expensive function results in module-level Map
- Cache localStorage/sessionStorage reads, don't read repeatedly
- Combine chained filter/map/reduce into single loop
- Check array length before expensive element comparisons
- Return early from functions to avoid deep nesting
- Hoist RegExp creation outside loops
- Use loop for min/max instead of sort()[0]
- Use Set/Map for O(1) lookups instead of Array.includes
- Use toSorted()/toReversed() for immutable array transforms
- Store event handlers in refs to avoid effect re-runs
- Initialize expensive singletons once per app load, not per render
- Use useLatest pattern for stable callback references

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
