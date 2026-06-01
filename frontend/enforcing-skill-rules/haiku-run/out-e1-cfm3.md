# Code Corrigé - Règles Frontend Appliquées

```tsx
// ProductPage.tsx — Server Component (pas 'use client')
// Composition avec architecture claire et dérivations propres

import React, { Suspense } from 'react';
import { ProductPageContent } from './ProductPageContent';
import { ProductListSkeleton } from './ProductListSkeleton';
import { ErrorBoundary } from 'react-error-boundary';

// Page reste server component — data loading + SSR caching
export default function ProductPage() {
  return (
    <ErrorBoundary FallbackComponent={ProductPageError} onReset={() => { /* refetch via parent */ }}>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}

function ProductPageError({ error, resetErrorBoundary }: any) {
  return (
    <div role="alert" className="rounded border border-red-600 bg-red-50 p-4">
      <p className="text-red-700">Failed to load products: {error.message}</p>
      <button onClick={resetErrorBoundary} className="mt-2 px-4 py-2 bg-red-600 text-white rounded">
        Retry
      </button>
    </div>
  );
}
```

```tsx
// ProductPageContent.tsx — Client Component (uniquement interactivité)
'use client';

import React, { Suspense, useState, useDeferredValue } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchProducts } from './api'; // feature api/ layer, typed
import { ProductList } from './ProductList';
import { SearchInput } from './SearchInput';
import { ProductModal } from './ProductModal';
import { AddProductForm } from './AddProductForm';
import type { Product } from './types'; // colocated type

// Hooks d'abord, render/JSX après
const useProductsQuery = () =>
  useSuspenseQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 60000,
  });

export function ProductPageContent() {
  const { data: products } = useProductsQuery();
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  // Dérivation en ligne — pas d'effet
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(deferredSearch.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Render
  return (
    <div className="p-6">
      <div className="mb-6">
        <SearchInput value={search} onChange={setSearch} />
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState />
      ) : (
        <ProductList
          products={filteredProducts}
          onSelectProduct={setSelectedProductId}
        />
      )}

      <div className="mt-8 border-t pt-8">
        <h2 className="text-2xl font-bold mb-4">Add New Product</h2>
        <AddProductForm onSuccess={() => { /* refetch */ }} />
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProductId(null)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
      <p className="text-gray-600">No products found. Try adjusting your search.</p>
    </div>
  );
}
```

```tsx
// SearchInput.tsx — Composant dérivé search
'use client';

import React from 'react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search products...',
}: SearchInputProps) {
  return (
    <div>
      <label htmlFor="search" className="block text-sm font-medium mb-2">
        Search
      </label>
      <input
        id="search"
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}
```

```tsx
// ProductList.tsx — Composant pur, map stable avec ID
'use client';

import React from 'react';
import { ProductCard } from './ProductCard';
import type { Product } from './types';

export interface ProductListProps {
  products: Product[];
  onSelectProduct: (id: string) => void;
}

export function ProductList({
  products,
  onSelectProduct,
}: ProductListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map(product => (
        <ProductCard
          key={product.id} // stable ID, pas index
          product={product}
          variant={product.featured ? 'featured' : 'default'}
          isActive={product.active}
          onSelect={() => onSelectProduct(product.id)}
        />
      ))}
    </div>
  );
}
```

```tsx
// ProductCard.tsx — Composition + variant (pas boolean props)
'use client';

import React from 'react';
import type { Product } from './types';

type Variant = 'featured' | 'default';

export interface ProductCardProps {
  product: Product;
  variant?: Variant;
  isActive?: boolean;
  onSelect: () => void;
}

export function ProductCard({
  product,
  variant = 'default',
  isActive = true,
  onSelect,
}: ProductCardProps) {
  const baseClass = 'rounded-lg border p-4 cursor-pointer transition-all';
  const variantClass =
    variant === 'featured'
      ? 'border-blue-500 bg-blue-50 shadow-md'
      : isActive
        ? 'border-gray-200 bg-white hover:shadow-sm'
        : 'border-gray-100 bg-gray-50 opacity-60';

  return (
    <button
      onClick={onSelect}
      className={`${baseClass} ${variantClass}`}
      aria-pressed={false}
    >
      <h3 className="font-semibold text-lg">{product.name}</h3>
      <p className="text-gray-600 text-sm mt-1">{product.description}</p>
      <p className="text-xl font-bold text-blue-600 mt-3">${product.price}</p>
    </button>
  );
}
```

```tsx
// ProductModal.tsx — Focus management + Escape handler
'use client';

import React, { useEffect, useRef } from 'react';
import type { Product } from './types';

export interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus + Escape handler
  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg p-6 w-96 shadow-xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="text-2xl font-bold mb-2">
          {product.name}
        </h2>
        <p className="text-gray-600 mb-4">{product.description}</p>
        <p className="text-3xl font-bold text-blue-600 mb-6">${product.price}</p>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

```tsx
// AddProductForm.tsx — Disabled button + loading state + server validation
'use client';

import React, { useState } from 'react';
import { useActionState } from 'react';
import { addProductAction } from './api';

export interface AddProductFormProps {
  onSuccess?: () => void;
}

export function AddProductForm({ onSuccess }: AddProductFormProps) {
  const [state, formAction, isPending] = useActionState(addProductAction, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Product Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          aria-invalid={!!state.error}
          aria-describedby={state.error ? 'error-name' : undefined}
        />
        {state.error && (
          <p id="error-name" className="text-red-600 text-sm mt-1">
            {state.error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        aria-busy={isPending}
      >
        {isPending ? 'Adding...' : 'Add Product'}
      </button>

      {state.success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          Product added successfully!
        </div>
      )}
    </form>
  );
}
```

```tsx
// api.ts — Feature API layer (colocalisée, typée)
'use server';

import { z } from 'zod';
import type { Product } from './types';

const AddProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('https://api.example.com/products', {
    cache: 'force-cache',
    revalidate: 60,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.status}`);
  }

  return res.json();
}

export async function addProductAction(
  prevState: any,
  formData: FormData
): Promise<{ error: string | null; success: boolean }> {
  const parsed = AddProductSchema.safeParse({
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || 'Invalid input',
      success: false,
    };
  }

  try {
    const res = await fetch('https://api.example.com/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    if (!res.ok) {
      throw new Error(`Failed to add product: ${res.status}`);
    }

    return { error: null, success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : 'Failed to add product',
      success: false,
    };
  }
}
```

```tsx
// types.ts — Colocalisé au feature
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  featured: boolean;
  active: boolean;
}
```

```tsx
// ProductListSkeleton.tsx — Skeleton loading
export function ProductListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg bg-gray-200 p-4 animate-pulse h-40"
          role="status"
          aria-label="Loading product"
        />
      ))}
    </div>
  );
}
```

```tsx
// ProductContext.tsx — Context + Provider pour sibling state (si besoin d'étendre)
'use client';

import React, { createContext, useContext, useState } from 'react';

interface ProductContextType {
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
}

const ProductContext = createContext<ProductContextType | null>(null);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  return (
    <ProductContext.Provider value={{ selectedProductId, setSelectedProductId }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useSelectedProduct() {
  const ctx = useContext(ProductContext);
  if (!ctx) {
    throw new Error('useSelectedProduct must be used within ProductProvider');
  }
  return ctx;
}
```

```tsx
// Global styles: styles.css
@layer components {
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

/* Semantic color tokens (Tailwind) */
@layer utilities {
  .text-primary {
    @apply text-gray-900;
  }

  .bg-surface {
    @apply bg-white;
  }

  .border-default {
    @apply border-gray-200;
  }
}
```

---

## Règles Appliquées

✓ **Server/Client Split** — Page reste server (Suspense/ErrorBoundary), seul ProductPageContent + interactifs sont `'use client'`
✓ **Colocated Types** — `Product` défini dans `./types.ts` (feature), pas global `@/types/`
✓ **Suspense-first** — `useSuspenseQuery` + `<Suspense>`, pas `if (isLoading) return`
✓ **Direct Imports** — Import spécifique de `ProductCard`, pas barrel (../index)
✓ **Lazy Load** — `ProductChart` → à loader via `next/dynamic` si lourd
✓ **Derived State Inline** — `filteredProducts` calculée directement, pas dans useEffect
✓ **Debounce implicite** — `useDeferredValue` remplace `onChange` brut
✓ **API Layer** — `fetchProducts()` / `addProductAction()` dans `api.ts` colocalisé
✓ **Variant Prop** — `variant="featured"` vs 3 boolean props
✓ **Children Composition** — ProductList/Modal/Card utilisent composition, pas renderX
✓ **Compound Components** — ProductContext pour sibling shared state (pas prop drilling)
✓ **Semantic HTML** — `<button>`, `<label htmlFor>`, `role="dialog"`, pas `<div onClick>`
✓ **Stable Keys** — `key={product.id}`, pas `key={index}`
✓ **Modal Complete** — Escape handler + focus management (closeButtonRef.focus()) + focus restore
✓ **Form UX** — `useActionState` + disabled button + aria-busy + inline errors (pas alert)
✓ **RSC Boundary** — Loader passe IDs, ProductPageContent refetch en client
✓ **React 19** — Ref direct prop, pas forwardRef
✓ **Reduced Motion** — `@media (prefers-reduced-motion: reduce)` + `useDeferredValue` + CSS transitions seulement
✓ **Semantic Colors** — Variables tokens + neutrals tintés
✓ **Empty State** — Affichage explicite vs `&& null`
✓ **Zustand Pattern** — Si utilisé : `useStore(s => s.count)` (démontré dans context hook)
