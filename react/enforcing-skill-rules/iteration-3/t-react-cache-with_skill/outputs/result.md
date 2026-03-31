# Code Review: Dashboard Server Components

## Issue: Duplicate notification fetch across server components

**Severity**: Medium -- unnecessary database query per request

Both `Header` and `Sidebar` independently call `db.notification.findMany({ where: { userId: user.id } })`. In the current code, this executes two separate database queries for identical data within the same request.

### Recommendation: Wrap in `React.cache()` for per-request deduplication

Create a cached data-fetching function that both components share. `React.cache()` deduplicates calls with the same arguments within a single server request -- the second call returns the same promise without hitting the database again.

```typescript
// app/dashboard/queries.ts
import { cache } from "react";

export const getNotifications = cache(async (userId: string) =>
  db.notification.findMany({ where: { userId } })
);
```

```typescript
// app/dashboard/Header.tsx (Server Component)
import { getNotifications } from "./queries";

async function Header({ user }: { user: User }) {
  const notifications = await getNotifications(user.id);
  return <header>{user.name} ({notifications.length})</header>;
}
```

```typescript
// app/dashboard/Sidebar.tsx (Server Component)
import { getNotifications } from "./queries";

async function Sidebar({ user }: { user: User }) {
  const notifications = await getNotifications(user.id);
  return <aside>{notifications.map(n => <div key={n.id}>{n.text}</div>)}</aside>;
}
```

With this change, regardless of how many server components call `getNotifications(user.id)` during a single request, the database query runs exactly once.

## Secondary issue: Sequential fetches in DashboardPage

`DashboardPage` fetches the user and then passes it to child components that each fetch notifications sequentially (since server components render top-down). The user fetch and the notification fetch are independent -- they could be parallelized using the start-early-await-late pattern inside each child, or by restructuring the page to use Suspense boundaries so children stream in parallel.

### Recommendation: Add Suspense boundaries for parallel streaming

```typescript
async function DashboardPage({ params }: { params: { userId: string } }) {
  const user = await db.user.findUnique({ where: { id: params.userId } });
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header user={user} />
      </Suspense>
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar user={user} />
      </Suspense>
      <Content userId={params.userId} />
    </div>
  );
}
```

Wrapping async server components in `<Suspense>` lets them fetch and render in parallel rather than sequentially, improving time-to-first-paint.

## Summary

| Finding | Severity | Fix |
|---|---|---|
| Duplicate `db.notification.findMany` in Header and Sidebar | Medium | Wrap in `React.cache()` shared function |
| Sequential child rendering without Suspense | Low | Add `<Suspense>` boundaries around async children |
