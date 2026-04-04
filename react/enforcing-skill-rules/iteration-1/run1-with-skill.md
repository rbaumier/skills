# React/Next.js Code Review — Full Sweep

## Issues Found

### 1. Sequential Fetches (Server Component)

`fetchUser`, `fetchOrders`, and `fetchAnalytics` are awaited sequentially. `fetchOrders` and `fetchAnalytics` both depend on `user.id`, so they must wait for `fetchUser` — but they are independent of each other. **Start promises early, await late**:

```tsx
const user = await fetchUser(session?.value);
const pOrders = fetchOrders(user.id);
const pAnalytics = fetchAnalytics(user.id);
const [orders, analytics] = await Promise.all([pOrders, pAnalytics]);
```

### 2. Missing React.cache() on Data-Fetching Functions

`fetchUser` and `fetchAnalytics` are plain async functions in a Server Component. If multiple server components in the same request call these, they will hit the database multiple times. Wrap them in `React.cache()` for per-request deduplication:

```tsx
const fetchUser = React.cache(async (sessionId: string) => {
  return db.user.find(sessionId);
});

const fetchAnalytics = React.cache(async (userId: string) => {
  return db.analytics.find(userId);
});
```

### 3. cookies() Makes Route Dynamic

`cookies()` in the page component makes the entire route dynamic. This is a page (not a layout), so the blast radius is limited to this route — but be aware: if this were in a layout, ALL child pages would become dynamic. Flag this intentional use and consider whether the session could be passed differently (e.g., middleware setting a header).

### 4. Duplicate Serialization / Excessive Data to Client

All data (`user`, `orders`, `analytics`) is passed from the server component to a single client component. This serializes everything across the RSC boundary. Instead, keep as much rendering as possible in Server Components and only pass the minimal data the client needs for interactivity. Split `DashboardClient` into smaller client components that each receive only the props they need, and keep static rendering in the server component.

### 5. useEffect with [] is NOT componentDidMount

The comment says `// runs like componentDidMount` — this is incorrect. `useEffect` with an empty dependency array runs **after paint**, not before. It is NOT equivalent to `componentDidMount` which runs synchronously after mount but before the browser paints. If `initDashboard()` needs synchronous DOM measurement, use `useLayoutEffect` instead.

### 6. useState for High-Frequency Mouse Position

`useState` for mouse position triggers a re-render on every `mousemove` event (potentially 60+ times/second). Use `useRef` + direct DOM mutation instead:

```tsx
const mousePosRef = useRef({ x: 0, y: 0 });

useEffect(() => {
  const handler = (e) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    // If you need to update DOM, do it directly:
    // someElement.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  };
  window.addEventListener('mousemove', handler);
  return () => window.removeEventListener('mousemove', handler);
}, []);
```

### 7. Derived State in Effect (totalRevenue)

`totalRevenue` is computed from `orders` inside a `useEffect` + `useState` — this causes an unnecessary extra render. Derive state during render:

```tsx
const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
```

Remove both the `useState(0)` and the `useEffect` for `totalRevenue`.

### 8. Premature useMemo

`useMemo(() => selectedTab.toUpperCase(), [selectedTab])` is premature optimization. `.toUpperCase()` is a trivial string operation — the memoization overhead exceeds the computation cost. Just inline it:

```tsx
const tabLabel = selectedTab.toUpperCase();
```

### 9. Object Dependency in useEffect

`useEffect(() => { trackPageView(user); }, [user])` — `user` is an object. This effect re-runs whenever the object **reference** changes, even if the contents are identical (which happens on every server render / prop change). Extract the primitive field:

```tsx
useEffect(() => {
  trackPageView(user);
}, [user.id]);
```

### 10. Manual Loading Boolean — Use useTransition

The `handleExport` function manually manages `loading`/`setLoading`. Use `useTransition` instead:

```tsx
const [isPending, startTransition] = useTransition();

const handleExport = () => {
  startTransition(async () => {
    const data = await exportDashboard(user.id);
    download(data);
  });
};

// Replace {loading && <Spinner />} with {isPending && <Spinner />}
```

Remove the `const [loading, setLoading] = useState(false)`.

### 11. useState(window.innerWidth) Crashes in SSR

`useState(window.innerWidth)` runs during render. `window` is undefined on the server, causing an SSR crash. Use an initializer function:

```tsx
const [windowWidth, setWindowWidth] = useState(() =>
  typeof window !== 'undefined' ? window.innerWidth : 0
);
```

### 12. O(n*m) Lookup — Build a Map/Set

`categories.find(c => c === order.categoryId)` inside `orders.map()` is O(n*m). Build a Set for O(1) lookups:

```tsx
const categorySet = new Set(categories);
const enrichedOrders = orders.map(order => ({
  ...order,
  category: categorySet.has(order.categoryId) ? order.categoryId : undefined,
}));
```

(In the general case with richer category objects, use a `Map` keyed by ID.)

### 13. Hoist RegExp Outside Component

`const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;` is recreated on every render. Hoist to module level:

```tsx
// Module-level constant
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### 14. Deduplication with indexOf — Use Set

`.filter((v, i, a) => a.indexOf(v) === i)` is O(n^2). Use:

```tsx
const uniqueTags = [...new Set(orders.flatMap(o => o.tags))];
```

### 15. Chained filter/map/filter/reduce — Single Loop

`.filter().map().filter().reduce()` iterates the array 4 times. Combine into a single loop for large arrays:

```tsx
let activeHighValue = 0;
for (const o of orders) {
  if (o.status === 'active' && o.total > 100) {
    activeHighValue += o.total;
  }
}
```

### 16. Conditional Rendering with && — Use Ternary

`{order.isAdmin && <AdminPanel />}` can render `0` or `""` if `order.isAdmin` is falsy but not `false`. Use ternary:

```tsx
{order.isAdmin ? <AdminPanel /> : null}
```

### 17. HeavyModal Imported Eagerly — Use next/dynamic

`HeavyModal` is imported at the top level but only rendered conditionally. Use `next/dynamic` (or `React.lazy`):

```tsx
import dynamic from 'next/dynamic';

const HeavyModal = dynamic(() => import('./heavy-modal'), {
  loading: () => <ModalSkeleton />,
});
```

### 18. No Preload on Hover for Lazy-Loaded Modal

The `ModalTrigger` button should preload the chunk on hover/focus so it loads during the ~200ms before click:

```tsx
const preloadModal = () => import('./heavy-modal');

<button
  onClick={() => setOpen(true)}
  onMouseEnter={preloadModal}
  onFocus={preloadModal}
>
  Open
</button>
```

### 19. content-visibility: auto for Long Lists

The `orders.map(...)` renders potentially many DOM nodes. Add CSS optimization:

```css
.order-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 80px;
}
```

This gives free browser-level virtualization without any library.

---

## Complete Fixed Code

```tsx
// app/dashboard/page.tsx (Server Component)
import React from 'react';
import { cookies } from 'next/headers';
import { OrderList } from './order-list';
import { ExportButton } from './export-button';
import { AnalyticsSummary } from './analytics-summary';

// React.cache() for per-request deduplication
const fetchUser = React.cache(async (sessionId: string) => {
  return db.user.find(sessionId);
});

const fetchAnalytics = React.cache(async (userId: string) => {
  return db.analytics.find(userId);
});

async function fetchOrders(userId: string) {
  return db.order.findMany(userId);
}

export default async function DashboardPage() {
  // cookies() makes this route dynamic — intentional for session-based auth
  const session = cookies().get('session');
  const user = await fetchUser(session?.value);

  // Start early, await late — parallelize independent fetches
  const pOrders = fetchOrders(user.id);
  const pAnalytics = fetchAnalytics(user.id);
  const [orders, analytics] = await Promise.all([pOrders, pAnalytics]);

  // Keep static rendering in the server component; pass minimal data to client
  return (
    <div>
      <h1>{user.name}'s Dashboard</h1>
      <AnalyticsSummary analytics={analytics} />
      <ExportButton userId={user.id} />
      <OrderList orders={orders} />
    </div>
  );
}
```

```tsx
// app/dashboard/order-list.tsx
'use client';
import React, { useRef, useEffect } from 'react';

// Hoist regex to module level
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OrderList({ orders }) {
  // Derive state during render — no useEffect needed
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

  // Primitive dependencies for dedup
  const uniqueTags = [...new Set(orders.flatMap(o => o.tags))];

  // Single loop instead of chained .filter().map().filter().reduce()
  let activeHighValue = 0;
  for (const o of orders) {
    if (o.status === 'active' && o.total > 100) {
      activeHighValue += o.total;
    }
  }

  // Build Set for O(1) lookups instead of .find() in .map()
  const categories = ['electronics', 'clothing', 'food'];
  const categorySet = new Set(categories);
  const enrichedOrders = orders.map(order => ({
    ...order,
    category: categorySet.has(order.categoryId) ? order.categoryId : undefined,
  }));

  return (
    <div>
      <p>Total Revenue: {totalRevenue}</p>
      {/* content-visibility: auto for long lists */}
      {enrichedOrders.map((order) => (
        <div key={order.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 80px' }}>
          {/* Ternary, not && for conditional rendering */}
          {order.isAdmin ? <AdminPanel /> : null}
          <span>{order.name}</span>
        </div>
      ))}
    </div>
  );
}
```

```tsx
// app/dashboard/export-button.tsx
'use client';
import React, { useTransition } from 'react';

export function ExportButton({ userId }: { userId: string }) {
  // useTransition instead of manual loading boolean
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      const data = await exportDashboard(userId);
      download(data);
    });
  };

  return (
    <>
      {isPending ? <Spinner /> : null}
      <button onClick={handleExport} disabled={isPending}>
        Export
      </button>
    </>
  );
}
```

```tsx
// app/dashboard/dashboard-client.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';

export function DashboardClient({ userId }: { userId: string }) {
  const [selectedTab, setSelectedTab] = useState('orders');

  // useEffect with [] is NOT componentDidMount — it runs AFTER paint.
  // Use useLayoutEffect if synchronous DOM measurement is needed.
  useEffect(() => {
    initDashboard();
  }, []);

  // useRef for high-frequency mouse tracking — no re-renders
  const mousePosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Primitive dependency, not object
  useEffect(() => {
    trackPageView(userId);
  }, [userId]);

  // No useMemo for trivial operation
  const tabLabel = selectedTab.toUpperCase();

  // useState initializer for SSR safety
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0
  );

  return (
    <div>
      <h1>{tabLabel}</h1>
    </div>
  );
}
```

```tsx
// app/dashboard/modal-trigger.tsx
'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy load heavy component
const HeavyModal = dynamic(() => import('./heavy-modal'), {
  loading: () => <div>Loading...</div>,
});

// Preload on hover/focus
const preloadModal = () => import('./heavy-modal');

export function ModalTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        onMouseEnter={preloadModal}
        onFocus={preloadModal}
      >
        Open
      </button>
      {open ? <HeavyModal /> : null}
    </>
  );
}
```

---

## Summary of All 19 Issues

| # | Issue | Rule |
|---|-------|------|
| 1 | Sequential awaits for independent fetches | Start early, await late / Promise.all |
| 2 | No React.cache() on data-fetching functions | React.cache() for per-request dedup |
| 3 | cookies() forces route dynamic | cookies()/headers() dynamic blast radius |
| 4 | All data serialized to single client component | Minimize RSC-to-client serialization |
| 5 | useEffect [] != componentDidMount | Runs after paint, not before |
| 6 | useState for mouse position | useRef for high-frequency values |
| 7 | Derived state in useEffect | Derive during render |
| 8 | useMemo for toUpperCase() | No premature memoization |
| 9 | Object in effect dep array | Use primitive deps (user.id) |
| 10 | Manual loading/setLoading | useTransition |
| 11 | useState(window.innerWidth) | Initializer function for SSR safety |
| 12 | .find() inside .map() | Build Map/Set for O(1) lookups |
| 13 | Regex inside component | Hoist to module level |
| 14 | indexOf deduplication | [...new Set(arr)] |
| 15 | Chained .filter().map().filter().reduce() | Single loop for large arrays |
| 16 | && conditional rendering | Ternary operator |
| 17 | Eager import of HeavyModal | next/dynamic |
| 18 | No preload on hover for modal | Preload on hover/focus |
| 19 | Long list without content-visibility | content-visibility: auto |
