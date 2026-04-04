# Refactored ProductPage

## Issues Found & Rules Applied

| # | Issue | Skill Rule |
|---|-------|------------|
| 1 | Manual `useEffect` fetch duplicates what TanStack Query does | **State Management**: server state = TanStack Query; `useSuspenseQuery` + `<Suspense>` |
| 2 | `useEffect` to derive `filteredProducts` from `products + search` | **Gotchas**: `useEffect` for derived state = anti-pattern. Compute inline |
| 3 | `if (isLoading) return <Spinner/>` early return | **State Management**: Suspense-first, NOT isLoading early returns |
| 4 | `key={index}` on dynamic list | **Gotchas**: `key={index}` dynamic lists = silent bugs. Stable IDs only |
| 5 | Boolean props `isPrimary`, `isGhost`, `isCompact` | **Component Architecture**: Variant prop with defined values, not boolean modes |
| 6 | `forwardRef` usage | **React 19**: ref is regular prop, no forwardRef |
| 7 | Inline `style={{ color: '#333' }}` hardcoded colors | **Styling**: Design tokens always, never hard-coded colors/spacing |
| 8 | `useStore()` without selector | **State Management**: Zustand ALWAYS `useStore(s => s.count)`, NEVER destructure full store |
| 9 | Import from `@/types/product` (global types dump) | **Project Structure**: Types colocated with feature, NOT global `types/` dump |
| 10 | Inline fetch in component | **State Management**: No inline fetch; isolate in feature `api/` layer |
| 11 | No empty state for product list | **UX Patterns**: Every list needs empty state |
| 12 | No debounce on search input | **Performance**: Debounce search 300-500ms |
| 13 | `FancyInput` missing `displayName` | **Component Architecture**: file order, clean exports |
| 14 | No error boundary / retry | **Component Architecture**: Error Boundaries with retry |
| 15 | `'use client'` on entire page | **Gotchas**: `"use client"` only for hooks/event handlers — over-marking kills SSR |
| 16 | No accessibility on interactive elements | **Accessibility**: Semantic HTML, ARIA labels, keyboard nav |

---

## Refactored Code

### `features/products/types/index.ts`

```ts
/** Product domain type — colocated with feature, not in global types/ */
export interface Product {
  id: string;
  name: string;
  price: number;
  featured: boolean;
  active: boolean;
}

export type ProductVariant = 'primary' | 'ghost' | 'default';
```

### `features/products/api/fetch-products.ts`

```ts
import type { Product } from '../types';

/**
 * Fetches all products from the API.
 * Isolated in feature api/ layer — never inline in components.
 */
export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch('/api/products', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }
  return response.json();
}
```

### `features/products/hooks/use-products.ts`

```ts
import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchProducts } from '../api/fetch-products';
import type { Product } from '../types';

/** Server-state hook — Suspense-first, no manual isLoading checks */
export function useProducts() {
  return useSuspenseQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
}
```

### `features/products/hooks/use-debounced-value.ts`

```ts
import { useState, useEffect } from 'react';

/**
 * Debounces a value by the given delay.
 * Used for search inputs to avoid filtering on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

### `features/products/components/product-card.tsx`

```tsx
import type { Product, ProductVariant } from '../types';

interface ProductCardProps {
  /** The product to display */
  product: Product;
  /** Visual variant — replaces boolean isPrimary/isGhost/isCompact props */
  variant?: ProductVariant;
  /** Callback when user adds product to cart */
  onAddToCart: (product: Product) => void;
  /** Optional className override for consumers */
  className?: string;
}

/**
 * Single product display card.
 * Uses variant prop instead of boolean modes (each boolean doubles state space).
 * Semantic button for add-to-cart instead of div onClick.
 */
export function ProductCard({
  product,
  variant = 'default',
  onAddToCart,
  className,
}: ProductCardProps) {
  return (
    <article
      className={`product-card product-card--${variant} ${className ?? ''}`}
      aria-label={`Product: ${product.name}`}
    >
      <h3>{product.name}</h3>
      <p className="product-card__price">${product.price}</p>
      <button
        type="button"
        onClick={() => onAddToCart(product)}
        aria-label={`Add ${product.name} to cart`}
      >
        Add to cart
      </button>
    </article>
  );
}
```

### `features/products/components/product-search-input.tsx`

```tsx
'use client';

/**
 * Search input for filtering products.
 * React 19: ref is a regular prop — no forwardRef needed.
 * Uses design tokens via CSS classes, not hardcoded inline styles.
 */
interface ProductSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  ref?: React.Ref<HTMLInputElement>;
}

export function ProductSearchInput({ value, onChange, ref }: ProductSearchInputProps) {
  return (
    <label className="product-search">
      <span className="sr-only">Search products</span>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search products..."
        className="product-search__input"
        aria-label="Search products"
      />
    </label>
  );
}
```

### `features/products/components/product-list.tsx`

```tsx
'use client';

import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ProductListContent } from './product-list-content';

/**
 * Product list with Suspense boundary and error handling.
 * Suspense-first pattern: no manual isLoading checks.
 * Error boundary with retry for resilience.
 */
export function ProductList() {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div role="alert" className="product-list__error">
          <p>Failed to load products: {error.message}</p>
          <button type="button" onClick={resetErrorBoundary}>
            Retry
          </button>
        </div>
      )}
    >
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductListContent />
      </Suspense>
    </ErrorBoundary>
  );
}

/** Skeleton placeholder shown while products load — avoids layout shift (CLS) */
function ProductListSkeleton() {
  return (
    <div className="product-list__skeleton" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="product-card--skeleton" />
      ))}
    </div>
  );
}
```

### `features/products/components/product-list-content.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useProducts } from '../hooks/use-products';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { ProductCard } from './product-card';
import { ProductSearchInput } from './product-search-input';
import { useStore } from '@/store';
import type { Product, ProductVariant } from '../types';

/**
 * Inner content rendered inside Suspense boundary.
 * useSuspenseQuery guarantees data is available — no loading checks needed.
 */
export function ProductListContent() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  // Zustand: always use selector — never destructure full store
  const addToCart = useStore((s) => s.addToCart);

  const { data: products } = useProducts();

  // Derived state computed inline during render — no useEffect sync
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
  );

  return (
    <div className="product-list">
      <ProductSearchInput value={search} onChange={setSearch} />

      {filteredProducts.length === 0 ? (
        <EmptyState search={debouncedSearch} />
      ) : (
        <div className="product-list__grid" role="list">
          {filteredProducts.map((product) => (
            <div key={product.id} role="listitem">
              <ProductCard
                product={product}
                variant={resolveVariant(product)}
                onAddToCart={addToCart}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Maps product state to visual variant — single source of truth */
function resolveVariant(product: Product): ProductVariant {
  if (product.featured) return 'primary';
  if (!product.active) return 'ghost';
  return 'default';
}

/** Empty state — every list needs one (UX Patterns rule) */
function EmptyState({ search }: { search: string }) {
  return (
    <div className="product-list__empty" role="status">
      {search ? (
        <p>No products matching "{search}"</p>
      ) : (
        <p>No products available</p>
      )}
    </div>
  );
}
```

### `features/products/page.tsx` (Server Component)

```tsx
import { ProductList } from './components/product-list';

/**
 * Product page — Server Component by default.
 * "use client" pushed down to leaf components that need interactivity.
 * No "use client" here — maximizes SSR.
 */
export default function ProductPage() {
  return (
    <main className="product-page">
      <h1>Products</h1>
      <ProductList />
    </main>
  );
}
```
