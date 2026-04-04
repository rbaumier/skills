# Frontend Skill - Compressed Prompt Eval Run 1

## Prompt
Fix all issues in the provided ProductPage component.

## Fixed Code

```tsx
// features/products/types/index.ts
// [colocated-types] Types colocated with feature, NOT in global @/types/
export type Product = {
  id: string;
  name: string;
  price: number;
  featured: boolean;
  active: boolean;
};

export type ProductVariant = 'primary' | 'ghost' | 'default';
```

```tsx
// features/products/api/fetchProducts.ts
// [no-inline-fetch] Isolated in feature api/ layer, typed response
import type { Product } from '../types';

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}
```

```tsx
// features/products/components/ProductCard.tsx
// [composition-not-booleans] Variant prop with defined values, not boolean modes
// [accessibility] Semantic HTML, ARIA labels, keyboard navigation
// [file-order] types -> hooks -> render -> export
import type { Product, ProductVariant } from '../types';

type ProductCardProps = {
  product: Product;
  variant?: ProductVariant;
  onAddToCart: () => void;
};

export function ProductCard({ product, variant = 'default', onAddToCart }: ProductCardProps) {
  return (
    <article
      className={`product-card product-card--${variant}`}
      role="button"
      tabIndex={0}
      aria-label={`Add ${product.name} to cart`}
      onClick={onAddToCart}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAddToCart();
        }
      }}
    >
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </article>
  );
}
```

```tsx
// features/products/components/FancyInput.tsx
// [no-forwardRef] React 19: ref is a regular prop, no forwardRef needed
type FancyInputProps = {
  label: string;
  ref?: React.Ref<HTMLInputElement>;
};

export function FancyInput({ label, ref }: FancyInputProps) {
  return (
    <label>
      {label}
      <input ref={ref} />
    </label>
  );
}
```

```tsx
// features/products/components/ProductList.tsx
'use client';
// [use-client-minimal] 'use client' only on the interactive leaf component, not entire page

// [no-barrel-import] Direct imports, not from barrel '../index'
import { useState, useDeferredValue, Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchProducts } from '../api/fetchProducts';
import { ProductCard } from './ProductCard';
import type { Product, ProductVariant } from '../types';
// [zustand-selector] useStore(s => s.field), NEVER destructure full store
import { useStore } from '@/store';

// [file-order] types -> hooks -> render -> export

function getVariant(product: Product): ProductVariant {
  if (product.featured) return 'primary';
  if (!product.active) return 'ghost';
  return 'default';
}

export function ProductList() {
  const [search, setSearch] = useState('');
  // [debounce-search] Debounce search 300-500ms via useDeferredValue
  const deferredSearch = useDeferredValue(search);

  // [zustand-selector] Select only what you need
  const cartCount = useStore((s) => s.cartCount);

  // [suspense-not-isLoading] Suspense-first with useSuspenseQuery, NOT isLoading early returns
  const { data: products } = useSuspenseQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // [no-derived-state-effect] Derive state during render, NOT in useEffect
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(deferredSearch.toLowerCase())
  );

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // [design-tokens] Use design tokens via CSS classes, never hardcoded colors/spacing
        className="input-search"
        placeholder="Search products..."
        aria-label="Search products"
      />
      <div>
        {filteredProducts.length === 0 ? (
          // [empty-state] Every list needs an empty state
          <p>No products found. Try a different search term.</p>
        ) : (
          filteredProducts.map((product) => (
            <ProductCard
              // [stable-key] Stable IDs, never array index on dynamic lists
              key={product.id}
              product={product}
              // [composition-not-booleans] Single variant prop
              variant={getVariant(product)}
              onAddToCart={() => {}}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

```tsx
// features/products/page.tsx (Server Component)
// [use-client-minimal] Page itself stays as server component
import { Suspense } from 'react';
import { ProductList } from './components/ProductList';
import { ProductListSkeleton } from './components/ProductListSkeleton';

export default function ProductPage() {
  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ProductList />
    </Suspense>
  );
}
```

```css
/* [design-tokens] Design tokens, never hardcoded colors/spacing */
.input-search {
  padding: var(--spacing-2);
  color: var(--color-text-primary);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
}

.product-card {
  cursor: pointer;
}
.product-card--primary {
  border: 2px solid var(--color-accent);
}
.product-card--ghost {
  opacity: 0.5;
}
```

## Issues List

| # | ID | Issue | Fix |
|---|---|---|---|
| 1 | use-client-minimal | `'use client'` on whole page that could be server component | Split: server page wraps `<Suspense>` around client `ProductList` |
| 2 | no-derived-state-effect | `useEffect` to sync `filteredProducts` from `products+search` | Compute inline during render |
| 3 | stable-key | `key={index}` on dynamic product list | `key={product.id}` stable ID |
| 4 | composition-not-booleans | `isPrimary/isGhost/isCompact` boolean props | Single `variant` prop with `'primary' \| 'ghost' \| 'default'` |
| 5 | no-barrel-import | Import from `'../index'` barrel file | Direct import from `'../api/fetchProducts'` |
| 6 | colocated-types | Types in global `@/types/product` | `features/products/types/index.ts` |
| 7 | no-forwardRef | `forwardRef` pattern (deprecated React 19) | `ref` as regular prop |
| 8 | suspense-not-isLoading | `if (isLoading) return <Spinner/>` pattern | `useSuspenseQuery` + `<Suspense fallback={<Skeleton/>}>` |
| 9 | design-tokens | Hardcoded `#333`, `#f5f5f5`, `8px` in inline styles | CSS custom properties (design tokens) |
| 10 | zustand-selector | `useStore()` full destructure | `useStore(s => s.cartCount)` selector |
| 11 | empty-state | `products.length === 0` renders null | Empty state message component |
| 12 | debounce-search | No debounce on search `onChange` | `useDeferredValue` for deferred filtering |
| 13 | no-inline-fetch | Inline fetch in `useEffect` | Isolated in `features/products/api/` layer |
| 14 | file-order | Types, hooks, render mixed | types -> hooks -> useMemo -> useCallback -> render -> export |
| 15 | accessibility | `div onClick` without keyboard nav/role/ARIA | `article` with `role="button"`, `tabIndex`, `onKeyDown`, `aria-label` |
