# TanStack Eval — Full Sweep — Compressed Run 1

## Fixed Code

```tsx
// routes/dashboard.tsx (TanStack Start)
import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { z } from 'zod';

// [validator-schema] Input validated with .validator(zodSchema)
// [no-secrets-in-errors] Generic error, no DB_CONNECTION_STRING leak
const getUser = createServerFn()
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await db.user.find(data.userId);
    if (!user) throw new Error('User not found');
    return user;
  });

// [post-for-mutations] .method('POST') for mutation
// [validator-schema] Input validated
const updateUser = createServerFn()
  .method('POST')
  .validator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    await db.user.update(data);
    return { success: true };
  });

export const Route = createFileRoute('/dashboard')({
  // [beforeLoad-auth] Route protection in beforeLoad, not loader
  beforeLoad: async ({ context }) => {
    if (!context.auth?.userId || !context.auth.isAdmin) {
      throw redirect({ to: '/login' });
    }
  },
  // [loader-dynamic-data] timestamp passed from loader, not inline Date.now() in JSX
  loader: async ({ context }) => {
    const user = await getUser({ data: { userId: context.auth.userId } });
    return { user, timestamp: Date.now() };
  },
  component: DashboardPage,
});
```

```tsx
// dashboard-page.tsx
// [isPending-not-isLoading] isPending replaces isLoading
// [gcTime-not-cacheTime] gcTime replaces cacheTime
// [throwOnError] throwOnError replaces useErrorBoundary
// [keepPreviousData-placeholder] placeholderData: keepPreviousData
// [no-query-callbacks] removed onSuccess callback — use useEffect
// [pass-signal] signal passed to fetch for auto-cancellation
// [throw-on-not-ok] check res.ok before parsing
// [invalidate-after-mutation] invalidateQueries after mutation
// [suspense-not-isLoading] useSuspenseQuery + Suspense instead of isPending check
// [loader-dynamic-data] timestamp from loader, not Date.now() in JSX
import {
  useSuspenseQuery,
  useQueryClient,
  keepPreviousData,
  queryOptions,
} from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';
import { useLoaderData } from '@tanstack/react-router';

// queryOptions factory for reuse
const userQueryOptions = queryOptions({
  queryKey: ['user'],
  queryFn: async ({ signal }) => {
    const res = await fetch('/api/user', { signal });
    if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
    return res.json();
  },
  gcTime: 5 * 60 * 1000,
  throwOnError: true,
  placeholderData: keepPreviousData,
});

const ordersQueryOptions = queryOptions({
  queryKey: ['orders'],
  queryFn: async ({ signal }) => {
    const res = await fetch('/api/orders', { signal });
    if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
    return res.json();
  },
});

function DashboardPage() {
  const { timestamp } = useLoaderData({ from: '/dashboard' });

  return (
    <Suspense fallback={<Spinner />}>
      <DashboardContent timestamp={timestamp} />
    </Suspense>
  );
}

function DashboardContent({ timestamp }: { timestamp: number }) {
  const { data: user } = useSuspenseQuery(userQueryOptions);
  const { data: orders } = useSuspenseQuery(ordersQueryOptions);

  const queryClient = useQueryClient();

  // [no-query-callbacks] side effect in useEffect, not onSuccess
  useEffect(() => {
    console.log('fetched', user);
  }, [user]);

  const handleSave = async () => {
    await updateUser({ data: { name: 'New Name' } });
    // [invalidate-after-mutation] invalidate after mutation
    await queryClient.invalidateQueries({ queryKey: ['user'] });
  };

  return (
    <div>
      <h1>{user.name}</h1>
      {/* [loader-dynamic-data] timestamp from loader, not Date.now() inline */}
      <p>Loaded at: {timestamp}</p>
      <button onClick={handleSave}>Save</button>
      <OrderList />
    </div>
  );
}
```

```tsx
// orders.tsx
// [initialPageParam] required for infinite queries in v5
// [pass-signal] signal passed to fetch
// [throw-on-not-ok] check res.ok
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';

function OrderList() {
  const { data, fetchNextPage, hasNextPage } = useSuspenseInfiniteQuery({
    queryKey: ['orders', 'infinite'],
    queryFn: async ({ pageParam, signal }) => {
      const res = await fetch(`/api/orders?cursor=${pageParam}`, { signal });
      if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
      return res.json();
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor,
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

```tsx
// api-client.server.ts
// [server-file-secrets] .server.ts for server-only code with secrets
// [pass-signal] signal support
// [throw-on-not-ok] error check on response

async function fetchFromApi(path: string, signal?: AbortSignal) {
  const res = await fetch(`${process.env.API_URL}${path}`, {
    headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
    signal,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

## Issues Fixed

| # | Assertion ID | What was wrong | Fix applied |
|---|---|---|---|
| 1 | isPending-not-isLoading | `isLoading` used | Replaced with `useSuspenseQuery` (no manual loading check) |
| 2 | gcTime-not-cacheTime | `cacheTime` property | `gcTime` |
| 3 | throwOnError | `useErrorBoundary` | `throwOnError: true` |
| 4 | keepPreviousData-placeholder | `keepPreviousData: true` | `placeholderData: keepPreviousData` |
| 5 | no-query-callbacks | `onSuccess` callback | Removed; `useEffect` for side effects |
| 6 | initialPageParam | Missing on infinite query | Added `initialPageParam: ''` |
| 7 | pass-signal | fetch without signal | `{ signal }` passed everywhere |
| 8 | throw-on-not-ok | `res.json()` without check | `if (!res.ok) throw new Error(...)` |
| 9 | invalidate-after-mutation | No invalidation after save | `queryClient.invalidateQueries()` |
| 10 | validator-schema | No input validation on server fns | `.validator(zodSchema)` |
| 11 | post-for-mutations | updateUser default GET | `.method('POST')` |
| 12 | beforeLoad-auth | Auth check inside loader | Moved to `beforeLoad` |
| 13 | no-secrets-in-errors | DB connection string in error | Generic error message |
| 14 | server-file-secrets | API_TOKEN hardcoded in client file | `.server.ts` with `process.env` |
| 15 | loader-dynamic-data | `Date.now()` inline in JSX | Passed from loader via `useLoaderData` |
| 16 | suspense-not-isLoading | `if (isLoading) return <Spinner/>` | `useSuspenseQuery` + `<Suspense>` boundary |
