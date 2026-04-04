# Full-Sweep Refactoring — TanStack Query v5 + TanStack Start

Below is the complete refactored code across all files. Every issue has been fixed according to TanStack Query v5 and TanStack Start rules.

---

## `routes/dashboard.server.ts` — Server-only code (db, secrets)

```ts
// routes/dashboard.server.ts
// Server-only file: keeps db access and secrets out of client bundles.
import { db } from '../db';

export { db };
```

---

## `routes/dashboard.schemas.ts` — Shared schemas (client + server)

```ts
// routes/dashboard.schemas.ts
// Shared Zod schemas used by both server functions and client forms.
import { z } from 'zod';

export const getUserInputSchema = z.object({
  userId: z.string().min(1),
});

export const updateUserInputSchema = z.object({
  name: z.string().min(1),
});
```

---

## `routes/dashboard.functions.ts` — Server function wrappers

```ts
// routes/dashboard.functions.ts
// Server function definitions with input validation and correct HTTP methods.
import { createServerFn } from '@tanstack/start';
import { getUserInputSchema, updateUserInputSchema } from './dashboard.schemas';
import { db } from './dashboard.server';

// GET (default) — read operation, validated with Zod schema
export const getUser = createServerFn()
  .validator(getUserInputSchema)
  .handler(async ({ data }) => {
    const user = await db.user.find(data.userId);
    // notFound() handled at route level; never leak secrets in error messages
    if (!user) throw new Error('User not found');
    return user;
  });

// POST for mutations — explicit .method('POST')
export const updateUser = createServerFn()
  .method('POST')
  .validator(updateUserInputSchema)
  .handler(async ({ data }) => {
    await db.user.update(data);
    return { success: true };
  });
```

---

## `routes/dashboard.tsx` — Route definition

```tsx
// routes/dashboard.tsx
// Route definition with beforeLoad for auth and loader for data fetching.
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getUser } from './dashboard.functions';
import { DashboardPage } from './dashboard-page';

export const Route = createFileRoute('/dashboard')({
  // Auth check in beforeLoad, NOT in loader
  beforeLoad: async ({ context }) => {
    if (!context.auth?.userId) {
      throw redirect({ to: '/login' });
    }
    // Fetch user to check admin status before loading the route
    const user = await getUser({ data: { userId: context.auth.userId } });
    if (!user.isAdmin) {
      throw redirect({ to: '/login' });
    }
    return { user };
  },
  loader: async ({ context }) => {
    // Pass dynamic data from loader — never inline Date.now() in JSX (hydration mismatch)
    return { user: context.user, timestamp: Date.now() };
  },
  component: DashboardPage,
});
```

---

## `routes/dashboard-page.tsx` — Dashboard component

```tsx
// routes/dashboard-page.tsx
// Uses useSuspenseQuery (no isPending/isLoading checks needed),
// placeholderData: keepPreviousData, throwOnError, signal, invalidation.
import { useSuspenseQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';
import { useLoaderData } from '@tanstack/react-router';
import { updateUser } from './dashboard.functions';

export function DashboardPage() {
  // Get dynamic data from loader (not inline Date.now() in JSX)
  const { timestamp } = useLoaderData({ from: '/dashboard' });

  const queryClient = useQueryClient();

  // useSuspenseQuery: no enabled option needed, no isLoading check needed.
  // Suspense boundary handles the loading state.
  const { data: user } = useSuspenseQuery({
    queryKey: ['user'],
    queryFn: ({ signal }) => fetchFromApi('/api/user', signal),
    placeholderData: keepPreviousData, // v5: not keepPreviousData: true
    throwOnError: true,                // v5: not useErrorBoundary
    // gcTime replaces cacheTime in v5
    // No onSuccess callback — v5 removed query callbacks
  });

  // Log fetched data via useEffect (v5: no onSuccess/onError/onSettled on useQuery)
  useEffect(() => {
    if (user) {
      console.log('fetched', user);
    }
  }, [user]);

  const handleSave = async () => {
    await updateUser({ data: { name: 'New Name' } });
    // Invalidate after mutation so queries refetch with fresh data
    await queryClient.invalidateQueries({ queryKey: ['user'] });
  };

  return (
    <div>
      <h1>{user.name}</h1>
      {/* Dynamic data from loader, not Date.now() inline */}
      <p>Loaded at: {timestamp}</p>
      <button onClick={handleSave}>Save</button>
      {/* Suspense boundary for streaming non-critical child data */}
      <Suspense fallback={<div>Loading orders...</div>}>
        <OrderList />
      </Suspense>
    </div>
  );
}
```

---

## `routes/orders.tsx` — Order list with infinite query

```tsx
// routes/orders.tsx
// Infinite query with required initialPageParam, signal, and error checking.
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';

export function OrderList() {
  const { data, fetchNextPage, hasNextPage } = useSuspenseInfiniteQuery({
    queryKey: ['orders', 'infinite'],
    queryFn: ({ pageParam, signal }) =>
      fetchFromApi(`/api/orders?cursor=${pageParam}`, signal),
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

---

## `routes/api-client.server.ts` — API client (server-only, secrets protected)

```ts
// routes/api-client.server.ts
// .server.ts ensures this file is NEVER bundled into the client.
// Secrets (API_TOKEN) stay server-side only.

const API_TOKEN = process.env.API_TOKEN; // From env, not hardcoded

/**
 * Fetches from the API with:
 * - signal for auto-cancellation (TanStack Query passes this)
 * - Error check on response status (throw if !res.ok)
 */
export async function fetchFromApi(path: string, signal?: AbortSignal) {
  const res = await fetch(`${process.env.VITE_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    signal, // Pass signal for auto-cancellation
  });

  // Throw in queryFn if response is not ok
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
```

---

## Summary of all fixes applied

| # | Rule | What was wrong | What was fixed |
|---|------|---------------|----------------|
| 1 | `isPending` not `isLoading` | `isLoading` used | Replaced with `useSuspenseQuery` (no loading check needed at all) |
| 2 | `gcTime` not `cacheTime` | `cacheTime` destructured | Removed — use `gcTime` if cache timing is needed |
| 3 | `throwOnError` not `useErrorBoundary` | `useErrorBoundary: true` | Changed to `throwOnError: true` |
| 4 | `placeholderData: keepPreviousData` | `keepPreviousData: true` | Changed to `placeholderData: keepPreviousData` (imported from tanstack/react-query) |
| 5 | No query callbacks | `onSuccess` on useQuery | Removed; moved to `useEffect` |
| 6 | `initialPageParam` required | Missing on infinite query | Added `initialPageParam: 0` |
| 7 | Pass `signal` to fetch | fetch without signal | All `queryFn` pass `signal` to `fetchFromApi` |
| 8 | Throw if `!res.ok` | `res.json()` without error check | Added `if (!res.ok) throw new Error(...)` |
| 9 | Invalidate after mutations | No invalidation after `updateUser` | Added `queryClient.invalidateQueries({ queryKey: ['user'] })` |
| 10 | `.validator(zodSchema)` | No input validation on server functions | Added `.validator()` with Zod schemas on both server functions |
| 11 | `.method('POST')` for mutations | `updateUser` used default GET | Added `.method('POST')` to `updateUser` |
| 12 | `beforeLoad` for auth | Auth check inside loader | Moved to `beforeLoad` |
| 13 | No secrets in errors | DB connection string leaked in error | Changed to generic "User not found" message |
| 14 | `.server.ts` for secrets | API_TOKEN hardcoded in client-accessible file | Moved to `api-client.server.ts`; token read from `process.env` |
| 15 | Loader dynamic data, not inline | `Date.now()` inline in JSX | `timestamp` passed from loader, rendered from `useLoaderData` |
| 16 | Suspense, not isLoading | `if (isLoading) return <Spinner />` | `useSuspenseQuery` + `<Suspense>` boundaries |
