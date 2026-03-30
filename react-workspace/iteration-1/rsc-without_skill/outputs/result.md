# Next.js App Router Server Component Review

## Issues Found

### 1. Sequential Data Fetching (Performance — Critical)

All three `fetch` calls run sequentially. Each waits for the previous to resolve before starting. This is the single biggest performance issue — it adds unnecessary latency equal to the sum of all request times instead of the maximum.

```typescript
// BAD: Sequential — total time = T1 + T2 + T3
const products = await fetch('https://api.example.com/products').then(r => r.json());
const categories = await fetch('https://api.example.com/categories').then(r => r.json());
const userPrefs = await fetch('https://api.example.com/preferences').then(r => r.json());
```

**Fix**: Use `Promise.all` for parallel fetching, or better yet, use React's streaming model with `Suspense` boundaries to start rendering before all data arrives.

---

### 2. No Fetch Error Handling (Reliability — Critical)

None of the `fetch` calls check `response.ok`. A 404 or 500 response will silently produce garbage data (the error page HTML parsed as JSON, or a thrown parse error).

```typescript
// BAD: No status check
await fetch('https://api.example.com/products').then(r => r.json());
```

**Fix**: Check `response.ok` before parsing, or use a helper that throws on non-2xx.

---

### 3. No Fetch Caching/Revalidation Strategy (Performance — High)

Next.js extends `fetch` with caching options. Without specifying `cache` or `next.revalidate`, the behavior depends on the Next.js version and configuration defaults. This should be explicit.

---

### 4. Missing `headers()` Import Usage (Code Quality — Low)

`headers` is imported from `next/headers` but never used. Dead import.

---

### 5. Wrong Directive on Server Action File (Correctness — Critical)

```typescript
// app/api/checkout/route.ts
'use server';
```

This file is in `app/api/`, suggesting it is a **Route Handler**. Route Handlers use `export async function POST/GET/...` — they do not use the `'use server'` directive. The `'use server'` directive is for **Server Actions** (which belong in `actions.ts` or inline in server components).

Additionally, `createOrder` is not exported as a named HTTP method handler (`POST`, `GET`, etc.), so Next.js will not wire it up as a route.

---

### 6. No Input Validation on Server Action (Security — Critical)

```typescript
const items = JSON.parse(formData.get('items') as string);
const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
```

Problems:
- **`JSON.parse` can throw** on malformed input — no try/catch.
- **Price is trusted from the client**. The server recalculates `total` from client-supplied `item.price` — an attacker can set `price: 0` for every item. Prices must come from the database.
- **No type validation** — `items` is `any`. Use Zod or similar.
- **`as string` cast** — `formData.get()` returns `FormDataEntryValue | null`. If the field is missing, this is `null`, and `JSON.parse(null as string)` returns `null`, bypassing the reduce.

---

### 7. Unnecessary Client Component Boundary (Architecture — High)

`ProductList` is marked `'use client'` and receives large serialized props (`products`, `categories`, `userPrefs`). This means the entire dataset is serialized into the RSC payload and sent to the client, increasing bundle size and Time to Interactive.

Only the search `<input>` needs client interactivity. The rest can stay on the server.

**Fix**: Extract a small `SearchInput` client component. Keep filtering and rendering on the server, or use a URL-based search pattern with `searchParams`.

---

### 8. O(n*m) Category Lookup (Performance — Medium)

```typescript
categories.find(c => c.id === p.categoryId)
```

This runs inside `.map()` over products, making it O(products × categories). Pre-build a lookup map.

---

## Refactored Code

### `app/products/page.tsx`

```typescript
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { ProductList } from './ProductList';
import { Sidebar } from './Sidebar';
import { fetchJson } from '@/lib/fetch';

type SearchParams = Promise<{ q?: string }>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q: search } = await searchParams;
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value ?? 'light';

  return (
    <div className={theme}>
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList search={search} />
      </Suspense>
    </div>
  );
}

function SidebarSkeleton() {
  return <div>Loading sidebar...</div>;
}

function ProductListSkeleton() {
  return <div>Loading products...</div>;
}
```

Key changes:
- **Suspense boundaries** — sidebar and product list load independently, streaming to the client as each resolves.
- **Search via URL `searchParams`** — no client state needed for filtering. The search input navigates via `router.push` or a `<form>`, making the page shareable/bookmarkable and keeping filtering on the server.
- **Removed unused `headers` import.**
- **Data fetching moved into each component** — each component fetches only what it needs, enabling parallel streaming.

---

### `app/products/ProductList.tsx` (Server Component)

```typescript
import { fetchJson } from '@/lib/fetch';
import { SearchInput } from './SearchInput';
import { ProductCard } from './ProductCard';
import type { Product, Category, UserPreferences } from '@/types';

export async function ProductList({ search }: { search?: string }) {
  const [products, categories, userPrefs] = await Promise.all([
    fetchJson<Product[]>('https://api.example.com/products', {
      next: { revalidate: 60 },
    }),
    fetchJson<Category[]>('https://api.example.com/categories', {
      next: { revalidate: 300 },
    }),
    fetchJson<UserPreferences>('https://api.example.com/preferences'),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div>
      <SearchInput defaultValue={search} />
      {filtered.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          category={categoryMap.get(p.categoryId)}
          userPrefs={userPrefs}
        />
      ))}
    </div>
  );
}
```

Key changes:
- **No longer a client component** — removed `'use client'`.
- **Parallel fetching** with `Promise.all`.
- **Explicit revalidation** — products refresh every 60s, categories every 300s.
- **O(1) category lookup** via `Map`.
- **Server-side filtering** via `searchParams` — no client JS needed for search logic.

---

### `app/products/SearchInput.tsx` (Client Component — Minimal)

```typescript
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function SearchInput({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    startTransition(() => {
      const params = new URLSearchParams();
      if (value) params.set('q', value);
      router.push(`/products?${params.toString()}`);
    });
  }

  return (
    <input
      defaultValue={defaultValue}
      onChange={handleChange}
      placeholder="Search products..."
      aria-label="Search products"
      data-pending={isPending || undefined}
    />
  );
}
```

Key changes:
- **Tiny client boundary** — only the interactive input is a client component.
- **`useTransition`** — keeps the UI responsive during navigation; enables pending states.
- **URL-driven search** — bookmarkable, shareable, SSR-friendly.

---

### `lib/fetch.ts` (Shared Fetch Helper)

```typescript
export async function fetchJson<T>(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number; tags?: string[] } },
): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} — ${url}`);
  }

  return res.json() as Promise<T>;
}
```

---

### `app/products/actions.ts` (Server Action — Relocated and Hardened)

```typescript
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';

const OrderItemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
});

const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1),
});

export async function createOrder(formData: FormData) {
  const raw = formData.get('items');
  if (typeof raw !== 'string') {
    return { success: false, error: 'Missing items' };
  }

  const parsed = CreateOrderSchema.safeParse({ items: JSON.parse(raw) });
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten() };
  }

  // Look up prices server-side — never trust client-supplied prices
  const productIds = parsed.data.items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, price: true },
  });

  const priceMap = new Map(products.map((p) => [p.id, p.price]));

  const total = parsed.data.items.reduce((sum, item) => {
    const price = priceMap.get(item.productId);
    if (price == null) throw new Error(`Unknown product: ${item.productId}`);
    return sum + price * item.qty;
  }, 0);

  const order = await db.order.create({
    data: {
      items: parsed.data.items,
      total,
    },
  });

  return { success: true, orderId: order.id };
}
```

Key changes:
- **Moved to `actions.ts`** — not a route handler. `'use server'` is correct here.
- **Zod validation** — structured input validation with proper error reporting.
- **Server-side price lookup** — prices come from the database, not the client.
- **Returns structured errors** instead of throwing unhandled exceptions.

---

## Summary of Changes

| Issue | Severity | Fix |
|---|---|---|
| Sequential fetches | Critical | `Promise.all` + Suspense streaming |
| No fetch error handling | Critical | `fetchJson` helper with `res.ok` check |
| Wrong `'use server'` on route handler | Critical | Moved to `actions.ts` as proper Server Action |
| Client-trusted prices | Critical | Server-side price lookup from DB |
| No input validation | Critical | Zod schema validation |
| Oversized client boundary | High | Extracted minimal `SearchInput` client component |
| No caching strategy | High | Explicit `next.revalidate` on fetches |
| O(n*m) category lookup | Medium | `Map`-based O(1) lookup |
| Unused `headers` import | Low | Removed |
