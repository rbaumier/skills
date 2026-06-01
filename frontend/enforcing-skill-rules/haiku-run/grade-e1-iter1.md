# Grade — frontend e1 iter1 (STRICT)

| # | id | verdict | evidence / reason |
|---|----|---------|-------------------|
| 1 | use-client-minimal | FAIL | Line 2 `'use client';` sits at the top of the file containing the whole `ProductPage`. The page is still a client component end-to-end. The only server piece (`ProductLoaderContainer`, L441) is dead/commented (`// Updated ProductPage signature...` L460-461 never wired in). Violation still present. |
| 2 | no-derived-state-effect | PASS | L114-117: `const filteredProducts = products.filter(...)` derived inline during render. No `useEffect` syncing filtered state anywhere. |
| 3 | stable-key | PASS | L168 `key={product.id}` on the dynamic list; comment confirms intent. No `key={index}` on dynamic lists. |
| 4 | composition-not-booleans | PASS | L199/L210 use `variant: 'primary' | 'default'` prop. No `isPrimary`/`isGhost`/`isCompact` boolean props anywhere. |
| 5 | no-barrel-import | PASS | L6 `import { fetchProducts } from '../api/products'` direct import; comment confirms. No `../index` barrel import present. |
| 6 | colocated-types | FAIL | L9 `import { Product } from '@/types/product';` — the type is still imported from a global `@/types/` dump, exactly the trap. Local types (StoreState, ProductContextType) exist but the feature `Product` type is not colocated. |
| 7 | no-forwardRef | PASS | L465-484 `FancyInput` takes `ref` as a regular prop (`ref?: React.Ref<HTMLInputElement>`) and spreads it onto the input. No `forwardRef` call in the file. |
| 8 | suspense-not-isLoading | FAIL | L99-103 uses `useQuery` (not `useSuspenseQuery`) and L120 `if (isLoading && !products.length) return <ProductListSkeleton />` — the `if (isLoading) return <Spinner/>` early-return pattern is exactly the trap and is still present. No `<Suspense>` boundary. |
| 9 | design-tokens | PASS | Inline `styles` use `var(--color-...)` (L20-22, L51-52). No hardcoded hex in the token CSS block (the comment notes #fff/#333 are avoided). Tailwind token classes used elsewhere. |
| 10 | zustand-selector | PASS | L112 `useStore(s => s.cartCount)` selector form; `useStore` signature L90 takes a selector. No full destructure of the store. |
| 11 | empty-state | PASS | L139-141 `if (products.length === 0) return <EmptyState .../>` plus dedicated `EmptyState` component (L418). |
| 12 | debounce-search | FAIL | L153 `onChange={e => setSearch(e.target.value)}` updates search state on every keystroke. No debounce (no `useDeferredValue`, `setTimeout`, `useDebounce`, etc.) anywhere. Trap unaddressed. |
| 13 | no-inline-fetch | FAIL | Partly: products use `fetchProducts` from api layer (good), BUT `AddProductForm` L294 still does inline `await fetch('/api/products', {...})` directly in the component instead of an isolated api/ layer. Inline fetch still present. |
| 14 | file-order | FAIL | Order is violated: a module-level mutable `let store` (L88) and `useStore` sit between context and the component; `const inputRef = React.useRef(...)` at top level outside any component (L487) is invalid/misplaced. Types/hooks/render are not in the prescribed types→hooks→useMemo→useCallback→render→export order within components. |
| 15 | accessibility | FAIL | Card root `<article ... onClick={onOpenDetail}>` (L216-223) is a clickable element with no `role="button"`, no `tabIndex`, and no `onKeyDown`/keyboard handler. Click-without-keyboard-nav trap still present on the card (the inner View button is fine, but the whole card is clickable and inaccessible). |
| 16 | fetch-cache-default | PASS | L442-444 server-side `fetch(..., { cache: 'no-store' })` in `ProductLoaderContainer`. (Note: loader is dead code, but the fetch itself has the cache directive as required.) |
| 17 | compound-components | PASS | Context+Provider used: `ProductContext`/`ProductProvider` (L63-78), `useSelectedProduct` consumed by `ProductSidebar` (L247) and `ProductDetailPanel` (L260). No `selectedId` prop-drilling between siblings. |
| 18 | children-over-renderX | PASS | No `renderHeader`/`renderX` prop on `ProductCard`; it renders its own markup (L224-225 comment + JSX). Trap removed. |
| 19 | error-boundary-retry | FAIL | No `ErrorBoundary` (no `componentDidCatch`, no `react-error-boundary`, no `<ErrorBoundary>` JSX). There is an inline `if (error)` render with a retry button (L124-136), but that is query-error UI, not an Error Boundary wrapping the tree. Trap "No ErrorBoundary wrapping the component tree" still present. |
| 20 | minimize-rsc-serialization | PASS | L448-455 maps to only specific fields (`id,name,description,price,featured,active`) before passing across the RSC boundary instead of whole objects. (Loader is dead code but the pattern is implemented as asserted.) |
| 21 | error-hierarchy | PASS | L333-337 inline field-level error `<p id="product-error" ...>{error}</p>` with `setError('Name is required')` (L287). No `alert()` for validation anywhere. |
| 22 | disable-button-loading | PASS | L341-348 submit button `disabled={isSubmitting}`, `aria-busy`, and text toggles to `'Adding...'`. |
| 23 | virtualize-long-list | FAIL | L165-173 maps over the entire `filteredProducts` with no virtualization. No `@tanstack/react-virtual`, no `useVirtualizer`. Trap unaddressed. |
| 24 | next-dynamic-heavy | PASS | L12-14 `const ProductChart = dynamic(() => import('./ProductChart'), { loading: ... })`. Heavy component lazy-loaded. |
| 25 | focus-trap-modal | FAIL | L355-372: modal focuses the first button on open and closes on Escape, but there is NO focus trap (Tab can leave the modal — no Tab cycling logic) and NO restore of focus to the trigger on close (no saved `previouslyFocused`/`.focus()` on cleanup). The `// Tab focus trap` claim (summary L510) is aspirational; code does not implement it. Trap unaddressed. |
| 26 | wcag-contrast | PASS | `.low-contrast-hint` (L49-53) no longer uses `#aaa on #fff`; replaced with `var(--color-text-secondary)` on `var(--color-bg-surface)` and a comment forbidding gray-on-background. The literal failing pair is removed. |
| 27 | prefers-reduced-motion | PASS | L33-47: animation gated under `@media (prefers-reduced-motion: no-preference)` and explicitly set to `animation: none` under `@media (prefers-reduced-motion: reduce)`. |

**Summary: PASS 17 / FAIL 10 — total 27.**
