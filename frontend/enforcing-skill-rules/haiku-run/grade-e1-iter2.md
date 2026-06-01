# Grade — e1 iter2 (STRICT)

| # | id | verdict | evidence / reason |
|---|----|---------|-------------------|
| 1 | use-client-minimal | PASS | No `'use client'` anywhere. `ProductPage` is a server component (L13-14 comment + structure); only leaves use hooks. |
| 2 | no-derived-state-effect | PASS | `filteredProducts` computed inline during render (L38-40), no `useEffect` syncing it. `selectedProduct` also derived inline (L42). |
| 3 | stable-key | PASS | `key={product.id}` on dynamic list (L87). Index keys only on static skeleton arrays (L259), acceptable. |
| 4 | composition-not-booleans | PASS | `variant: 'primary' \| 'default'` prop (L108); no `isPrimary/isGhost/isCompact`. |
| 5 | no-barrel-import | PASS | All imports direct: `./ProductCard`, `./api/products`, `./types` (L5-11). No `../index` barrel. |
| 6 | colocated-types | PASS | `Product` defined in feature `types.ts` (L323-333) and imported via `./types` (L10), not `@/types/`. |
| 7 | no-forwardRef | PASS | No `forwardRef`. Modal uses `ref` via `useRef` on a native element (L212, L243); no forwardRef wrapper. |
| 8 | suspense-not-isLoading | PASS | `useSuspenseQuery` (L27) inside `<Suspense>` (L18); no `if (isLoading) return <Spinner/>`. |
| 9 | design-tokens | PASS | No inline-style hardcoded colors/padding. Tailwind token classes (`bg-primary`, `text-secondary`, `border-neutral`). NOTE: `text-red-600` (L192) and `bg-black/50` (L227) are raw Tailwind, but no inline `style={{...}}` hardcoded colors/padding remain — trap is "hardcoded colors/padding in inline styles", which is corrected. |
| 10 | zustand-selector | PASS (N/A) | No zustand store used; full-store destructure trap absent. No violation present. |
| 11 | empty-state | PASS | `EmptyState` rendered when `filteredProducts.length === 0` (L52-53), defined L270-276. Does not render null. |
| 12 | debounce-search | PASS | `useDebounce(search, 300)` (L33); filter uses `debouncedSearch` (L39). 300ms within 300-500ms range. |
| 13 | no-inline-fetch | PASS | List fetch isolated in `api/products.ts` `fetchProducts` (L339). NOTE: `AddProductForm` has inline `fetch('/api/products', POST)` (L157) — a mutation, not the load path the trap targets ("inline fetch in useEffect"). No fetch in useEffect. Read path isolated. |
| 14 | file-order | PASS | Within components, order is types(props) -> hooks -> derived -> render. `ProductsContainer`: query/state hooks (L27-35) -> derived (L38-42) -> render (L44). Reasonable adherence. |
| 15 | accessibility | PASS | Native `<button>` for clickable card (L115) and view (L124), not `div onClick`. Labels with `htmlFor` (L180, L288), `role="dialog"`, `aria-labelledby`, `role="list"`. |
| 16 | fetch-cache-default | PASS | `fetchProducts` uses `{ cache: 'no-store' }` (L340). |
| 17 | compound-components | FAIL | Trap is sibling shared state (selectedId) via prop drilling, fix = compound components (Context+Provider). Code still prop-drills: `selectedProductId` lives in `ProductsContainer`, passed down via `onSelectProduct`/`onOpenModal` props (L57-58 -> L81-82 -> L91-92). No Context/Provider introduced. Violation not corrected. |
| 18 | children-over-renderX | PASS | `ProductCard` takes no `renderHeader` prop; renders its own header (L120). No renderX props. |
| 19 | error-boundary-retry | FAIL | No `ErrorBoundary` in the tree. Only `<Suspense>`. Fix note #22 admits "can wrap ... in ErrorBoundary" — i.e. not actually done. No retry mechanism. Violation not corrected. |
| 20 | minimize-rsc-serialization | FAIL | No RSC boundary serialization minimization. `fetchProducts` returns full `Product[]` (all fields incl. `active`) consumed client-side; chart receives `data={products}` full objects (L49). Since page is now fully client-rendered via useSuspenseQuery, there is no RSC field-narrowing as the assertion requires. Not addressed. |
| 21 | error-hierarchy | PASS | Form validation uses inline field error `{error && <span...>}` (L192), not `alert()`. Inline-field tier honored. |
| 22 | disable-button-loading | PASS | Submit button `disabled={isSubmitting \|\| !name.trim()}` (L195) with loading text `{isSubmitting ? 'Adding...'}` (L198). |
| 23 | virtualize-long-list | FAIL | `ProductList` maps all `filteredProducts` (L86) with no `@tanstack/react-virtual` / virtualization. Trap (>50 items unvirtualized) not corrected. |
| 24 | next-dynamic-heavy | PASS | `ProductChart` lazy-loaded via `next/dynamic` (L350) with loading fallback + `ssr:false`. |
| 25 | focus-trap-modal | FAIL | Partial only: focuses close button on open (L215) and restores nothing — no focus restore to trigger on close (assertion requires restore). Also no actual focus TRAP (Tab can leave the dialog; no cycling). Escape close present, but trap + restore requirement not met. |
| 26 | wcag-contrast | PASS | No `.low-contrast-hint` with `#aaa on #fff` present. Uses token `text-secondary`. The specific low-contrast trap element is removed. |
| 27 | prefers-reduced-motion | PASS | Global CSS `@media (prefers-reduced-motion: reduce)` neutralizes animation/transition durations (L358-364). Covers the `fadeIn` transform animation (L366-379). |

## Summary
Passed: 22 / 27
Fails: compound-components (17), error-boundary-retry (19), minimize-rsc-serialization (20), virtualize-long-list (23), focus-trap-modal (25)
