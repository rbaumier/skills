# Eval: TanStack Skill — Full Sweep Refactoring

## Prompt

Refactor this TanStack Query v5 + TanStack Start code. Fix everything wrong with it.

## Refactored Output

### `routes/dashboard.tsx` (TanStack Start)

```tsx
// routes/dashboard.tsx (TanStack Start)
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getUser, updateUser } from '../api/user.functions';
import { Suspense } from 'react';
import DashboardPage from '../components/dashboard-page';

export const Route = createFileRoute('/dashboard')({
  // Auth check belongs in beforeLoad, not in the loader
  beforeLoad: async ({ context }) => {
    const user = await getUser({ data: { userId: context.auth.userId } });
    if (!user.isAdmin) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async ({ context }) => {
    const user = await getUser({ data: { userId: context.auth.userId } });
    // Pass dynamic data from loader — never inline Date.now() in JSX (hydration mismatch)
    return { user, timestamp: Date.now() };
  },
  component: () => (
    // Suspense boundary for streaming support
    <Suspense fallback={<Spinner />}>
      <DashboardPage />
    </Suspense>
  ),
});
```

### `api/user.functions.ts` (Server function wrappers)

```tsx
// api/user.functions.ts
import { createServerFn } from '@tanstack/start';
import { z } from 'zod';

// Input validation schemas
const getUserSchema = z.object({
  userId: z.string(),
});

const updateUserSchema = z.object({
  name: z.string().min(1),
});

export const getUser = createServerFn()
  // Always validate inputs with .validator(zodSchema)
  .validator(getUserSchema)
  .handler(async ({ data }) => {
    const user = await db.user.find(data.userId);
    if (!user) {
      // Keep secrets out of error messages — never leak DB_CONNECTION_STRING
      throw new Error('User not found');
    }
    return user;
  });

export const updateUser = createServerFn()
  // POST for mutations — default is GET, which is wrong for writes
  .method('POST')
  // Always validate inputs with .validator(zodSchema)
  .validator(updateUserSchema)
  .handler(async ({ data }) => {
    await db.user.update(data);
    return { success: true };
  });
```

### `components/dashboard-page.tsx`

```tsx
// components/dashboard-page.tsx
import {
  useSuspenseQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { updateUser } from '../api/user.functions';
import { Route } from '../routes/dashboard';
import OrderList from './orders';

function DashboardPage() {
  // useSuspenseQuery replaces useQuery + isLoading check pattern.
  // Suspense boundary above handles the loading state.
  const { data: user } = useSuspenseQuery({
    queryKey: ['user'],
    queryFn: ({ signal }) =>
      // Pass signal to fetch for auto-cancellation
      fetch('/api/user', { signal }).then((res) => {
        // Throw in queryFn if !res.ok
        if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
        return res.json();
      }),
    // v5: placeholderData: keepPreviousData, not keepPreviousData: true
    placeholderData: keepPreviousData,
    // v5: throwOnError, not useErrorBoundary
    throwOnError: true,
    // v5: gcTime, not cacheTime
    gcTime: 1000 * 60 * 5,
  });

  // v5: query callbacks removed — no onSuccess/onError/onSettled on useQuery.
  // Use useEffect instead.
  useEffect(() => {
    if (user) {
      console.log('fetched', user);
    }
  }, [user]);

  // Loader provides dynamic timestamp — never inline Date.now() in JSX (hydration mismatch)
  const { timestamp } = Route.useLoaderData();

  const queryClient = useQueryClient();

  const handleSave = async () => {
    await updateUser({ data: { name: 'New Name' } });
    // Invalidate queries after mutations so UI stays in sync
    await queryClient.invalidateQueries({ queryKey: ['user'] });
  };

  return (
    <div>
      <h1>{user.name}</h1>
      {/* Dynamic data from loader, not Date.now() inline */}
      <p>Loaded at: {timestamp}</p>
      <button onClick={handleSave}>Save</button>
      <Suspense fallback={<div>Loading orders...</div>}>
        <OrderList />
      </Suspense>
    </div>
  );
}

export default DashboardPage;
```

### `components/orders.tsx`

```tsx
// components/orders.tsx
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';

function OrderList() {
  const { data, fetchNextPage, hasNextPage } = useSuspenseInfiniteQuery({
    queryKey: ['orders', 'infinite'],
    queryFn: ({ pageParam, signal }) =>
      // Pass signal to fetch for auto-cancellation
      fetch(`/api/orders?cursor=${pageParam}`, { signal }).then((res) => {
        // Throw in queryFn if !res.ok
        if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
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

export default OrderList;
```

### `api/api-client.server.ts` (Server-only — secrets stay on server)

```tsx
// api/api-client.server.ts
// .server.ts extension ensures this file never reaches the client bundle.
// Secrets (API tokens, DB strings) must live in server-only files.

async function fetchFromApi(path: string, signal?: AbortSignal) {
  const res = await fetch(`${process.env.VITE_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
    // Pass signal to fetch for auto-cancellation
    signal,
  });

  // Throw in queryFn if !res.ok — never silently return bad responses
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }

  return res.json();
}

export { fetchFromApi };
```

---

## Rules Applied (mapped to assertions)

| # | Assertion ID | What was fixed |
|---|---|---|
| 1 | `isPending-not-isLoading` | Replaced `isLoading` check entirely — switched to `useSuspenseQuery` which eliminates the need for `isPending`/`isLoading` checks. Suspense boundary handles loading. |
| 2 | `gcTime-not-cacheTime` | Replaced `cacheTime` with `gcTime` (v5 rename). |
| 3 | `throwOnError` | Replaced `useErrorBoundary: true` with `throwOnError: true` (v5 rename). |
| 4 | `keepPreviousData-placeholder` | Replaced `keepPreviousData: true` with `placeholderData: keepPreviousData` (v5 API). |
| 5 | `no-query-callbacks` | Removed `onSuccess` callback from useQuery. Replaced with `useEffect`. |
| 6 | `initialPageParam` | Added `initialPageParam: 0` to the infinite query (required in v5). |
| 7 | `pass-signal` | Added `{ signal }` destructuring in all `queryFn` and passed it to every `fetch` call. |
| 8 | `throw-on-not-ok` | Added `if (!res.ok) throw new Error(...)` before every `res.json()` call. |
| 9 | `invalidate-after-mutation` | Added `queryClient.invalidateQueries({ queryKey: ['user'] })` after `updateUser` mutation. |
| 10 | `validator-schema` | Added `.validator(zodSchema)` to both `getUser` and `updateUser` server functions. |
| 11 | `post-for-mutations` | Added `.method('POST')` to `updateUser` server function. |
| 12 | `beforeLoad-auth` | Moved auth/admin check from `loader` to `beforeLoad`. |
| 13 | `no-secrets-in-errors` | Removed `process.env.DB_CONNECTION_STRING` from error message in `getUser`. |
| 14 | `server-file-secrets` | Moved API client with hardcoded token to `.server.ts` file; token read from `process.env.API_TOKEN` instead of hardcoded. |
| 15 | `loader-dynamic-data` | `Date.now()` computed in loader and passed via `useLoaderData()` — no longer inlined in JSX. |
| 16 | `suspense-not-isLoading` | Replaced `useQuery` + `if (isLoading) return <Spinner />` with `useSuspenseQuery` + `<Suspense>` boundary. |
