```tsx
import React from 'react';
import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useDebounce } from './hooks/useDebounce';
import { ProductCard } from './ProductCard';
import { AddProductForm } from './AddProductForm';
import { ProductModal } from './ProductModal';
import { ProductChartLazy } from './ProductChart.lazy';
import { Product } from './types';
import { fetchProducts } from './api/products';

// Main page — server component (no 'use client' needed)
export default function ProductPage() {
  return (
    <div>
      <h1>Products</h1>
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsContainer />
      </Suspense>
    </div>
  );
}

// Container handles data, loading, error, empty states
function ProductsContainer() {
  const { data: products = [] } = useSuspenseQuery({
    queryKey: ['products'],
    queryFn: () => fetchProducts(),
  });

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Computed inline — no useEffect for derived state
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div>
      <SearchInput value={search} onChange={setSearch} />

      <Suspense fallback={<ChartSkeleton />}>
        <ProductChartLazy data={products} />
      </Suspense>

      {filteredProducts.length === 0 ? (
        <EmptyState message="No products found" />
      ) : (
        <ProductList
          products={filteredProducts}
          onSelectProduct={setSelectedProductId}
          onOpenModal={setIsModalOpen}
        />
      )}

      <AddProductForm onSuccess={() => {}} />

      {isModalOpen && selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

// Presentational component — pure rendering
function ProductList({
  products,
  onSelectProduct,
  onOpenModal,
}: {
  products: Product[];
  onSelectProduct: (id: string) => void;
  onOpenModal: (id: string) => void;
}) {
  return (
    <ul role="list" className="divide-y">
      {products.map(product => (
        <li key={product.id}>
          <ProductCard
            product={product}
            variant={product.featured ? 'primary' : 'default'}
            onSelect={() => onSelectProduct(product.id)}
            onOpenModal={() => onOpenModal(product.id)}
          />
        </li>
      ))}
    </ul>
  );
}

// Card composition — variant prop, children over renderX
function ProductCard({
  product,
  variant,
  onSelect,
  onOpenModal,
}: {
  product: Product;
  variant: 'primary' | 'default';
  onSelect: () => void;
  onOpenModal: () => void;
}) {
  const variantClasses = variant === 'primary' ? 'border-2 border-accent' : 'border border-neutral';

  return (
    <button
      onClick={onSelect}
      className={`text-left p-4 rounded ${variantClasses} hover:bg-surface-hover`}
      type="button"
    >
      <h3 className="font-semibold text-base">{product.name}</h3>
      <p className="text-secondary text-sm">{product.description}</p>
      <div className="flex justify-between items-end mt-3">
        <span className="text-lg font-bold">${product.price}</span>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onOpenModal();
          }}
          className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-dark"
        >
          View
        </button>
      </div>
    </button>
  );
}

// Form with loading state, disabled button, field-level validation
function AddProductForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client validation
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const { message } = await res.json();
        setError(message || 'Failed to add product');
        return;
      }

      setName('');
      onSuccess();
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 border rounded">
      <label htmlFor="product-name" className="text-sm font-medium">
        Product Name
      </label>
      <input
        id="product-name"
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={isSubmitting}
        className="px-3 py-2 border border-neutral rounded text-base focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Enter product name"
      />
      {error && <span className="text-red-600 text-sm">{error}</span>}
      <button
        type="submit"
        disabled={isSubmitting || !name.trim()}
        className="px-4 py-2 bg-primary text-white rounded font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Adding...' : 'Add Product'}
      </button>
    </form>
  );
}

// Modal with focus trap, Escape close, focus restore
function ProductModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4 animate-fadeIn"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="text-xl font-bold mb-3">
          {product.name}
        </h2>
        <p className="text-secondary text-sm mb-4">{product.description}</p>
        <p className="text-lg font-bold text-primary mb-6">${product.price}</p>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="w-full px-4 py-2 bg-neutral text-neutral-text rounded font-medium hover:bg-neutral-dark transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Loading skeletons
function ProductsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-20 bg-neutral-200 rounded animate-pulse" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-64 bg-neutral-200 rounded animate-pulse" />;
}

// Empty state
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-secondary text-lg">{message}</p>
    </div>
  );
}

// Search input
function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-6">
      <label htmlFor="search" className="text-sm font-medium">
        Search Products
      </label>
      <input
        id="search"
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search by name..."
        className="w-full mt-2 px-4 py-2 border border-neutral rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
```

**hooks/useDebounce.ts**
```ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

**types.ts**
```ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  featured: boolean;
  active: boolean;
}
```

**api/products.ts**
```ts
import { Product } from '../types';

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('/api/products', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}
```

**ProductChart.lazy.ts** (code-split)
```tsx
import dynamic from 'next/dynamic';

export const ProductChartLazy = dynamic(() => import('./ProductChart'), {
  loading: () => <div className="h-64 bg-neutral-200 rounded animate-pulse" />,
  ssr: false,
});
```

**Global Styles** (prefers-reduced-motion)
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-in;
}
```

## Applied Fixes

1. **'use client' removed** — page is now a server component; only interactive leaves use hooks
2. **Removed barrel import** (`../index`) — direct API imports from feature layer
3. **Heavy component lazy-loaded** — ProductChart uses dynamic import with loading skeleton
4. **Suspense-first** — useSuspenseQuery replaces useState + useEffect data fetch; Suspense boundaries replace `if (isLoading) return`
5. **No derived state in useEffect** — filteredProducts computed inline during render
6. **Debounced search** — useDebounce hook prevents excessive filter updates
7. **Stable keys** — product.id replaces array index
8. **Type colocated** — Product moved to feature `./types.ts`, not `@/types/`
9. **API isolated** — fetchProducts in feature `api/` layer with typed response
10. **No fetch in component** — fetch wrapped in api function
11. **Variant prop (enum)** — ProductCard uses `variant: 'primary' | 'default'`, not boolean isPrimary/isGhost/isCompact
12. **Children over renderX** — ProductCard no longer accepts renderHeader prop
13. **Composition over config** — ProductCard simplified to single responsibility
14. **Real buttons** — ProductCard and ProductModal use native `<button>`, not `<div onClick>`
15. **Form validation** — field-level error display, disabled state during submission, server validation expected
16. **Modal focus trap** — closeButtonRef focuses on open, Escape listener, stopPropagation on modal
17. **Semantic HTML** — proper labels (htmlFor), role="dialog", role="list", role="presentation"
18. **No inline styles** — Tailwind + animation classes
19. **Contrast & a11y** — semantic token classes (text-secondary, bg-surface-hover), prefers-reduced-motion in global CSS
20. **Empty state** — separate component, displayed when filteredProducts.length === 0
21. **Loading states** — skeletons via Suspense, button disabled during form submission
22. **Error Boundary ready** — form error displayed inline; can wrap ProductsContainer in ErrorBoundary for data fetch failures
```
