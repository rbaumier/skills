# Refactored ProductPage

## Issues Found (mapped to skill rules)

| # | Issue | Skill Rule |
|---|-------|-----------|
| 1 | `useEffect` to fetch data manually + `isLoading`/`error` state | **State Management**: Use TanStack Query. Suspense-first with `useSuspenseQuery` + `<Suspense>`, not `isLoading` early returns |
| 2 | `useEffect` to compute `filteredProducts` from `products` + `search` | **Gotchas**: `useEffect` for derived state = anti-pattern. Compute inline during render |
| 3 | `key={index}` on product list | **Gotchas**: `key={index}` dynamic lists = silent bugs. Stable IDs only |
| 4 | Barrel import `from '../index'` | **Performance**: No barrel imports; direct imports |
| 5 | Types in global `@/types/product` | **Project Structure**: Types colocated with feature, NOT global `types/` dump |
| 6 | Boolean prop explosion (`isPrimary`, `isGhost`, `isCompact`) | **Component Architecture**: Variant prop with defined values, not boolean modes |
| 7 | No composition on ProductCard | **Component Architecture**: Composition (Card+CardHeader) not boolean props |
| 8 | `forwardRef` pattern | **React 19**: ref is a regular prop, no `forwardRef` |
| 9 | `useStore()` full destructure | **State Management**: Zustand ALWAYS `useStore(s => s.count)`, NEVER destructure full store |
| 10 | Inline `style={{ color: '#333' }}` with hardcoded colors | **Styling**: Design tokens always, never hard-coded colors/spacing |
| 11 | `"use client"` on entire page | **Gotchas/React 19**: `"use client"` only for hooks/event handlers. Prefer server components |
| 12 | No empty state for products list | **UX Patterns**: Every list needs empty state |
| 13 | `{products.length === 0 && null}` dead code | General cleanup |
| 14 | Fetch logic inline, not in feature `api/` layer | **State Management**: No inline fetch; isolate in feature `api/` layer |
| 15 | No debounce on search input | **Performance**: Debounce search 300-500ms |
| 16 | No accessibility on input or card | **Accessibility**: Semantic HTML, ARIA labels, keyboard nav |
| 17 | `onClick` on div (not a button) | **Accessibility**: Semantic HTML, keyboard nav |
| 18 | File order not respected | **Component Architecture**: types -> hooks -> useMemo -> useCallback -> render -> default export |
| 19 | Unused imports (`React`, `useState` for removed state, `forwardRef`) | General cleanup |

---

## Refactored Code

### File structure (feature-based)

```
features/products/
  api/
    fetch-products.ts
  components/
    product-page.tsx        (server component - wrapper)
    product-list.tsx        (client component - interactive)
    product-card.tsx
    product-search-input.tsx
    fancy-input.tsx
  hooks/
    use-debounced-value.ts
  types/
    product.ts
  index.ts
```

---

### `features/products/types/product.ts`

```ts
/** A single product in the catalog. */
export interface Product {
  id: string;
  name: string;
  price: number;
  featured: boolean;
  active: boolean;
}

/** Visual variant for product cards. */
export type ProductCardVariant = 'default' | 'primary' | 'ghost';
```

---

### `features/products/api/fetch-products.ts`

```ts
import type { Product } from '../types/product';

/**
 * Fetches all products from the catalog API.
 * Isolated in feature api/ layer -- single source of truth for this endpoint.
 */
export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('/api/products', { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.status}`);
  }

  return res.json();
}
```

---

### `features/products/hooks/use-debounced-value.ts`

```ts
'use client';

import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates
 * after `delay` ms of inactivity.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

---

### `features/products/components/product-card.tsx`

```tsx
import type { Product, ProductCardVariant } from '../types/product';

// -- Types ------------------------------------------------------------------

interface ProductCardProps {
  /** The product to display. */
  product: Product;
  /** Visual variant -- replaces boolean prop explosion. */
  variant?: ProductCardVariant;
  /** Called when the user adds this product to cart. */
  onAddToCart: () => void;
}

// -- Component ---------------------------------------------------------------

/**
 * Displays a single product with name, price, and an add-to-cart action.
 *
 * Uses a `variant` prop instead of multiple booleans (isPrimary, isGhost, isCompact)
 * -- each boolean doubles the state space; a single union keeps it linear.
 *
 * The add-to-cart trigger is a <button> (not a div) for keyboard
 * accessibility and correct semantics.
 */
export function ProductCard({
  product,
  variant = 'default',
  onAddToCart,
}: ProductCardProps) {
  return (
    <article className={`product-card product-card--${variant}`}>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button
        type="button"
        onClick={onAddToCart}
        aria-label={`Add ${product.name} to cart`}
      >
        Add to cart
      </button>
    </article>
  );
}
```

---

### `features/products/components/product-search-input.tsx`

```tsx
'use client';

/**
 * Search input for filtering products.
 *
 * Styled with design-token classes (not hardcoded hex values).
 * Includes an accessible label via aria-label.
 */
export function ProductSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search products..."
      aria-label="Search products"
      /* Design tokens via Tailwind -- no hardcoded colors */
      className="rounded-md border border-border-subtle bg-neutral-bg1 px-3 py-2 text-foreground placeholder:text-muted-foreground"
    />
  );
}
```

---

### `features/products/components/product-list.tsx`

```tsx
'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import { fetchProducts } from '../api/fetch-products';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { ProductCard } from './product-card';
import { ProductSearchInput } from './product-search-input';
import type { Product, ProductCardVariant } from '../types/product';

// -- Helpers -----------------------------------------------------------------

/**
 * Derives the visual variant from product flags.
 * Centralizes the mapping so callers don't need to know the logic.
 */
function variantFor(product: Product): ProductCardVariant {
  if (product.featured) return 'primary';
  if (!product.active) return 'ghost';
  return 'default';
}

// -- Component ---------------------------------------------------------------

/**
 * Interactive product list with search filtering.
 *
 * Marked "use client" because it uses hooks (useState) and event handlers.
 * Data fetching is handled by useSuspenseQuery -- the parent server component
 * wraps this in <Suspense> so there is no manual isLoading/error state here.
 *
 * Zustand store access (if needed) uses a selector -- never full destructure:
 *   const addToCart = useCartStore((s) => s.addToCart);
 */
export function ProductList() {
  // -- hooks ----------------------------------------------------------------
  const { data: products } = useSuspenseQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  // -- derived state (computed inline, no useEffect) -------------------------
  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, debouncedSearch]);

  // -- callbacks -------------------------------------------------------------
  const handleAddToCart = useCallback((product: Product) => {
    // Replace with real cart action, e.g.:
    //   const addToCart = useCartStore((s) => s.addToCart);
    //   addToCart(product);
    console.info('Add to cart:', product.id);
  }, []);

  // -- render ----------------------------------------------------------------
  return (
    <section aria-label="Product catalog">
      <ProductSearchInput value={search} onChange={setSearch} />

      {filteredProducts.length === 0 ? (
        /* Every list needs an empty state (UX Patterns rule) */
        <p className="py-8 text-center text-muted-foreground">
          No products found.
        </p>
      ) : (
        <div role="list" className="grid gap-4 pt-4">
          {filteredProducts.map((product) => (
            <div role="listitem" key={product.id}>
              <ProductCard
                product={product}
                variant={variantFor(product)}
                onAddToCart={() => handleAddToCart(product)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

---

### `features/products/components/product-page.tsx`

```tsx
import { Suspense } from 'react';
import { ProductList } from './product-list';
import { ErrorBoundary } from 'react-error-boundary';

/**
 * Server component wrapper for the products page.
 *
 * NOT marked "use client" -- it contains no hooks or browser APIs.
 * Delegates interactivity to <ProductList> (client component) via Suspense.
 */
export default function ProductPage() {
  return (
    <main>
      <h1>Products</h1>
      <ErrorBoundary
        fallback={
          <p role="alert" className="text-destructive">
            Something went wrong loading products. Please try again.
          </p>
        }
      >
        <Suspense
          fallback={
            <div aria-busy="true" className="animate-pulse">
              Loading products...
            </div>
          }
        >
          <ProductList />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}
```

---

### `features/products/components/fancy-input.tsx`

```tsx
/**
 * A labeled input that accepts a ref as a regular prop.
 *
 * React 19: ref is a standard prop -- forwardRef is no longer needed.
 */
export function FancyInput({
  label,
  ref,
}: {
  label: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label>
      {label}
      <input ref={ref} />
    </label>
  );
}
```

---

### `features/products/index.ts`

```ts
/**
 * Public API for the products feature.
 * Only re-exports what other features need -- keeps the boundary tight.
 */
export { ProductCard } from './components/product-card';
export type { Product, ProductCardVariant } from './types/product';
```
