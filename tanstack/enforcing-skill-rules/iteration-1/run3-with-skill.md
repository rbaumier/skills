# Full-Sweep Refactoring: TanStack Query v5 + TanStack Start

Below is the complete refactored code across all files, applying every applicable rule from the TanStack skill.

---

## `schemas/user.ts` (shared schema -- client + server)

```ts
import { z } from 'zod';

export const getUserInputSchema = z.object({
  userId: z.string().min(1),
});

export const updateUserInputSchema = z.object({
  name: z.string().min(1),
});
```

---

## `user.server.ts` (server-only -- db access, secrets stay here)

```ts
import { db } from './db';

export async function findUser(userId: string) {
  return db.user.find(userId);
}

export async function updateUserInDb(data: { name: string }) {
  return db.user.update(data);
}
```

---

## `user.functions.ts` (server function wrappers)

```ts
import { createServerFn } from '@tanstack/start';
import { getUserInputSchema, updateUserInputSchema } from './schemas/user';
import { findUser, updateUserInDb } from './user.server';
import { notFound } from '@tanstack/react-router';

// GET (default) -- read operation, validated with zod schema
export const getUser = createServerFn()
  .validator(getUserInputSchema)
  .handler(async ({ data }) => {
    const user = await findUser(data.userId);
    if (!user) {
      throw notFound();
    }
    return user;
  });

// POST for mutation -- validated with zod schema
export const updateUser = createServerFn()
  .method('POST')
  .validator(updateUserInputSchema)
  .handler(async ({ data }) => {
    await updateUserInDb(data);
    return { success: true };
  });
```

**Fixes applied:**
- `.validator(zodSchema)` on both server functions (was: no input validation)
- `.method('POST')` on `updateUser` (was: default GET for a mutation)
- `notFound()` instead of throwing a raw error for missing user (was: `throw new Error(...)`)
- Secret removed from error message (was: `process.env.DB_CONNECTION_STRING` leaked in error)
- DB access moved to `.server.ts` file (was: inline in route-accessible file)

---

## `routes/dashboard.tsx` (TanStack Start route)

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getUser } from '../user.functions';
import { DashboardPage } from '../dashboard-page';

export const Route = createFileRoute('/dashboard')({
  // Auth check in beforeLoad, NOT in loader
  beforeLoad: async ({ context }) => {
    const user = await getUser({ data: { userId: context.auth.userId } });
    if (!user.isAdmin) {
      throw redirect({ to: '/login' });
    }
    return { user };
  },
  loader: async ({ context }) => {
    // Dynamic data passed from loader, consumed in component via useLoaderData
    return { timestamp: Date.now() };
  },
  component: DashboardPage,
});
```

**Fixes applied:**
- Auth check moved to `beforeLoad` (was: inside `loader`)
- `Date.now()` passed from loader, not inlined in JSX (prevents hydration mismatch)

---

## `dashboard-page.tsx` (component)

```tsx
import { useSuspenseQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useLoaderData } from '@tanstack/react-router';
import { Suspense } from 'react';
import { updateUser } from './user.functions';
import { OrderList } from './orders';

export function DashboardPage() {
  const { timestamp } = useLoaderData({ from: '/dashboard' });
  const queryClient = useQueryClient();

  // useSuspenseQuery: no isPending check needed, Suspense handles loading
  const { data: user } = useSuspenseQuery({
    queryKey: ['user'],
    queryFn: ({ signal }) => fetch('/api/user', { signal }).then(async (res) => {
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    }),
    placeholderData: keepPreviousData,
    throwOnError: true,
    gcTime: 5 * 60 * 1000,
  });

  // useMutation for save, with invalidation after success
  const { mutate: saveUser, isPending: saving } = useMutation({
    mutationFn: (name: string) => updateUser({ data: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const handleSave = () => {
    saveUser('New Name');
  };

  return (
    <div>
      <h1>{user.name}</h1>
      {/* timestamp from loader, NOT Date.now() inline */}
      <p>Loaded at: {timestamp}</p>
      <button onClick={handleSave} disabled={saving}>Save</button>
      {/* Suspense boundary wraps async child */}
      <Suspense fallback={<div>Loading orders...</div>}>
        <OrderList />
      </Suspense>
    </div>
  );
}
```

**Fixes applied:**
- `isPending` not `isLoading` (v5 rename) -- actually replaced entirely with `useSuspenseQuery` + `Suspense` boundary (no manual loading check)
- `gcTime` not `cacheTime` (v5 rename)
- `throwOnError` not `useErrorBoundary` (v5 rename)
- `placeholderData: keepPreviousData` not `keepPreviousData: true` (v5 rename)
- Removed `onSuccess` callback from query (v5: no query callbacks; used `useMutation.onSuccess` for invalidation instead)
- `signal` passed to `fetch` for auto-cancellation
- `if (!res.ok) throw new Error(...)` check before `.json()`
- `queryClient.invalidateQueries()` after mutation (was: no invalidation)
- `Date.now()` consumed from loader data, not inlined in JSX (hydration mismatch fix)
- No `enabled` needed -- orders moved to own component with `useSuspenseQuery` + `Suspense` boundary (conditional rendering pattern)
- `if (isLoading) return <Spinner />` removed in favor of `useSuspenseQuery` + `Suspense`

---

## `orders.tsx` (orders list with infinite query)

```tsx
import { useSuspenseInfiniteQuery, keepPreviousData } from '@tanstack/react-query';

export function OrderList() {
  const { data, fetchNextPage, hasNextPage } = useSuspenseInfiniteQuery({
    queryKey: ['orders', 'infinite'],
    queryFn: ({ pageParam, signal }) =>
      fetch(`/api/orders?cursor=${pageParam}`, { signal }).then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch orders');
        return res.json();
      }),
    getNextPageParam: (last) => last.nextCursor,
    // v5: initialPageParam is required for infinite queries
    initialPageParam: 0,
  });

  return (
    <div>
      {data.pages.flatMap((p) => p.items).map((order) => (
        <div key={order.id}>{order.name}</div>
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Load more</button>
      )}
    </div>
  );
}
```

**Fixes applied:**
- `initialPageParam: 0` added (was: missing, required in v5)
- `signal` passed to `fetch` for auto-cancellation
- `if (!res.ok) throw new Error(...)` check added
- Uses `useSuspenseInfiniteQuery` -- parent wraps in `<Suspense>` boundary

---

## `api-client.server.ts` (server-only API client -- secrets stay here)

```ts
import { z } from 'zod';

// Validate env vars at startup
const envSchema = z.object({
  API_TOKEN: z.string().min(1),
  API_URL: z.string().url(),
});

const env = envSchema.parse({
  API_TOKEN: process.env.API_TOKEN,
  API_URL: process.env.API_URL,
});

export async function fetchFromApi(path: string, signal?: AbortSignal) {
  const res = await fetch(`${env.API_URL}${path}`, {
    headers: { Authorization: `Bearer ${env.API_TOKEN}` },
    signal,
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }

  return res.json();
}
```

**Fixes applied:**
- Moved to `.server.ts` (was: `api-client.ts` -- secrets accessible to client)
- Hardcoded `API_TOKEN` replaced with env var (was: `'sk-secret-token-123'` hardcoded)
- `VITE_API_URL` renamed to `API_URL` -- this is server-only, no `VITE_` prefix needed
- Env vars validated with Zod at startup
- `signal` parameter accepted for auto-cancellation
- `if (!res.ok) throw new Error(...)` check added (was: `return res.json()` without error check)
- Error message does not leak secrets

---

## Summary of all rules applied

| # | Rule | What was fixed |
|---|------|----------------|
| 1 | `isPending` not `isLoading` | Replaced with `useSuspenseQuery` (no loading state needed) |
| 2 | `gcTime` not `cacheTime` | Renamed to `gcTime` |
| 3 | `throwOnError` not `useErrorBoundary` | Renamed to `throwOnError` |
| 4 | `placeholderData: keepPreviousData` | Replaced `keepPreviousData: true` |
| 5 | No query callbacks | Removed `onSuccess` from `useQuery` |
| 6 | `initialPageParam` required | Added `initialPageParam: 0` to infinite query |
| 7 | Pass `signal` to fetch | Added `signal` to all fetch calls |
| 8 | Throw on `!res.ok` | Added error checks before `.json()` |
| 9 | Invalidate after mutations | Added `queryClient.invalidateQueries()` in mutation `onSuccess` |
| 10 | `.validator(zodSchema)` | Added zod validation to both server functions |
| 11 | `.method('POST')` for mutations | Added to `updateUser` |
| 12 | `beforeLoad` for auth | Moved auth check from `loader` to `beforeLoad` |
| 13 | No secrets in errors | Removed `DB_CONNECTION_STRING` from error message |
| 14 | `.server.ts` for secrets | Moved DB access and API client to `.server.ts` files |
| 15 | Loader dynamic data | `Date.now()` passed from loader, not inlined in JSX |
| 16 | `useSuspenseQuery` + `Suspense` | Replaced `if (isLoading) return <Spinner />` pattern |
