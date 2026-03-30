# React Skill Review: Next.js App Router RSC Code

## Issues Found

### 1. Sequential fetches block each other (PERF - Critical)

**Rule violated**: "Use Promise.all() for independent async operations" / "Restructure server components to parallelize fetches"

```typescript
// PROBLEM: 3 sequential awaits = total time is sum of all three
const products = await fetch('https://api.example.com/products').then(r => r.json());
const categories = await fetch('https://api.example.com/categories').then(r => r.json());
const userPrefs = await fetch('https://api.example.com/preferences').then(r => r.json());
```

All three fetches are independent. Running them sequentially adds unnecessary latency. If each takes 200ms, this is 600ms instead of ~200ms.

---

### 2. Unused `headers` import (CORRECTNESS)

**Rule violated**: "No Orphans: Remove unused imports/vars"

`headers` is imported but never used. Worse, per the skill: "`cookies()`, `headers()` make the entire route dynamic. One call in a layout makes ALL child pages dynamic." The `cookies()` call already makes this dynamic, but the unused import is dead code that should be removed.

---

### 3. Oversized serialization boundary -- too much data passed to client component (PERF)

**Rule violated**: "Minimize data passed from server to client components" / "Avoid duplicate serialization in RSC props"

`ProductList` is a `'use client'` component receiving `categories` and `userPrefs` as props. These are serialized from server to client across the RSC boundary. Problems:

- `categories` is passed to both `Sidebar` and `ProductList` (duplicate serialization).
- `userPrefs` is passed to both as well.
- `ProductList` only uses `categories` to find a single category per product -- this join should happen server-side.

---

### 4. O(n*m) lookup inside render loop (PERF)

**Rule violated**: "Build Map/index for repeated collection lookups" / "Use Set/Map for O(1) lookups instead of Array.includes"

```typescript
categories.find(c => c.id === p.categoryId)  // O(m) per product
```

Inside `filtered.map(...)`, this is O(n*m). Should build a `Map<id, Category>` once.

---

### 5. No Suspense boundaries (PERF)

**Rule violated**: "Use Suspense boundaries to stream content progressively"

The page fetches everything before rendering anything. Sidebar and ProductList are independent -- they should stream independently via Suspense.

---

### 6. Missing `'use client'` imports (CORRECTNESS)

`ProductList` uses `useState` but doesn't import it. Minor but would cause a runtime error.

---

### 7. Server Action in API route file with wrong directive (CORRECTNESS / SECURITY)

**Rule violated**: "Authenticate server actions like API routes"

```typescript
// app/api/checkout/route.ts
'use server';
```

Problems:
- `'use server'` is for Server Actions, not API route files. Route handlers use `export async function POST()` etc. This is a confused pattern.
- No authentication or authorization check before creating the order.
- No input validation -- `JSON.parse` on raw user input can throw, and `items` shape is not validated.
- Trusting client-sent `price` values is a security vulnerability. Prices must be looked up server-side.

---

### 8. No error handling on fetches (CORRECTNESS)

None of the three `fetch()` calls check `response.ok` or handle network errors. A 404/500 would silently produce undefined data.

---

## Refactored Code

### `app/products/page.tsx` (Server Component)

```typescript
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { ProductList } from './ProductList';
import { Sidebar } from './Sidebar';

interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
}

interface Category {
  id: string;
  name: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${url} (${res.status})`);
  }
  return res.json();
}

// Extracted into its own async component for Suspense streaming
async function SidebarSection() {
  const [categories, userPrefs] = await Promise.all([
    fetchJson<Category[]>('https://api.example.com/categories'),
    fetchJson<UserPreferences>('https://api.example.com/preferences'),
  ]);

  return <Sidebar categories={categories} userPrefs={userPrefs} />;
}

// Server-side data joining -- minimizes client serialization
async function ProductSection() {
  const [products, categories] = await Promise.all([
    fetchJson<Product[]>('https://api.example.com/products'),
    fetchJson<Category[]>('https://api.example.com/categories'),
  ]);

  // Build index once server-side instead of O(n*m) on client
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const productsWithCategory = products.map(p => ({
    ...p,
    categoryName: categoryMap.get(p.categoryId)?.name ?? 'Unknown',
  }));

  return <ProductList products={productsWithCategory} />;
}

export default async function ProductsPage() {
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value ?? 'light';

  return (
    <div className={theme}>
      <Suspense fallback={<div>Loading sidebar...</div>}>
        <SidebarSection />
      </Suspense>
      <Suspense fallback={<div>Loading products...</div>}>
        <ProductSection />
      </Suspense>
    </div>
  );
}
```

### `app/products/ProductList.tsx` (Client Component)

```typescript
'use client';

import { useState } from 'react';

interface ProductWithCategory {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
}

// Only receives pre-joined, minimal data from the server
export function ProductList({ products }: {
  products: ProductWithCategory[];
}) {
  const [search, setSearch] = useState('');

  // Derive filtered list during render, not in an effect
  const filtered = search
    ? products.filter(p => p.name.includes(search))
    : products;

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.map(p => (
        <ProductCard
          key={p.id}
          product={p}
        />
      ))}
    </div>
  );
}
```

### `app/actions/checkout.ts` (Server Action -- moved out of api route)

```typescript
'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth'; // project auth utility

const OrderItemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
});

const OrderSchema = z.array(OrderItemSchema).min(1);

export async function createOrder(formData: FormData) {
  // Authenticate
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Validate input
  const rawItems = JSON.parse(formData.get('items') as string);
  const items = OrderSchema.parse(rawItems);

  // Look up prices server-side -- never trust client prices
  const products = await db.product.findMany({
    where: { id: { in: items.map(i => i.productId) } },
    select: { id: true, price: true },
  });

  const priceMap = new Map(products.map(p => [p.id, p.price]));
  const total = items.reduce((sum, item) => {
    const price = priceMap.get(item.productId);
    if (price == null) throw new Error(`Unknown product: ${item.productId}`);
    return sum + price * item.qty;
  }, 0);

  await db.order.create({
    data: {
      userId: session.user.id,
      items: items.map(i => ({
        productId: i.productId,
        qty: i.qty,
        unitPrice: priceMap.get(i.productId)!,
      })),
      total,
    },
  });

  return { success: true };
}
```

## Summary of Changes

| Issue | Skill Rule | Fix |
|---|---|---|
| Sequential fetches | `Promise.all()` for independent ops | Parallelized in each Suspense section |
| No streaming | Use Suspense boundaries | Split into `SidebarSection` / `ProductSection` async components |
| Oversized client props | Minimize data across RSC boundary | Join categories server-side, pass only `categoryName` string |
| O(n*m) lookup | Build Map for repeated lookups | `Map` built server-side, lookup eliminated from client |
| Unused import | No orphans | Removed `headers` import |
| Missing `useState` import | Correctness | Added import |
| Wrong directive on route | Server Actions != route handlers | Moved to `app/actions/checkout.ts` with `'use server'` |
| No auth on server action | Authenticate server actions | Added `auth()` check |
| Client-trusted prices | Security | Prices looked up server-side from DB |
| No input validation | Correctness | Added Zod schema validation |
| No fetch error handling | Correctness | Added `fetchJson` helper that checks `res.ok` |
