# React/Next.js Code Review — Full Sweep

## Issues Found: 19

---

### 1. Sequential Fetches — Parallelize with Start-Early-Await-Late

**File:** `app/dashboard/page.tsx`

The three fetches run sequentially. `fetchOrders` and `fetchAnalytics` both depend only on `user.id`, so they can run in parallel. `fetchUser` must complete first since the others need `user.id`, but orders and analytics are independent of each other.

```tsx
// BEFORE (sequential — total time = sum of all three)
const user = await fetchUser(session?.value);
const orders = await fetchOrders(user.id);
const analytics = await fetchAnalytics(user.id);

// AFTER (start-early-await-late — orders + analytics run in parallel)
const user = await fetchUser(session?.value);
const pOrders = fetchOrders(user.id);
const pAnalytics = fetchAnalytics(user.id);
const [orders, analytics] = await Promise.all([pOrders, pAnalytics]);
```

---

### 2. React.cache() Missing for Per-Request Deduplication

**File:** `app/dashboard/page.tsx`

Server component data-fetching functions should be wrapped in `React.cache()` for per-request deduplication. If other server components in the same request call `fetchUser` or `fetchAnalytics`, they will hit the database again without this.

```tsx
import React from 'react';

const fetchUser = React.cache(async (sessionId: string) => {
  return db.user.find(sessionId);
});

const fetchAnalytics = React.cache(async (userId: string) => {
  return db.analytics.find(userId);
});
```

---

### 3. cookies() Makes the Entire Route Dynamic

**File:** `app/dashboard/page.tsx`

`cookies()` in a page (or worse, a layout) makes the entire route dynamic — no static generation, no ISR. This is fine if intentional, but be aware of the blast radius: if this were in a layout, ALL child pages would become dynamic. Consider whether you can move the session check to a more targeted location (e.g., a dedicated auth server component or middleware) to keep other routes static.

---

### 4. useEffect with [] is NOT componentDidMount

**File:** `app/dashboard/dashboard-client.tsx`

The comment says "runs like componentDidMount" — this is incorrect. `useEffect` with `[]` runs **after paint**, not before. The old `componentDidMount` ran synchronously before the browser painted. If `initDashboard()` needs to measure the DOM synchronously before the user sees the page, use `useLayoutEffect` instead. Either way, remove the misleading comment.

```tsx
// BEFORE
// componentDidMount equivalent
useEffect(() => {
  // runs like componentDidMount
  initDashboard();
}, []);

// AFTER — remove misleading comment, use useLayoutEffect if DOM measurement needed
useEffect(() => {
  initDashboard();
}, []);
```

---

### 5. useRef for High-Frequency Mouse Position Tracking

**File:** `app/dashboard/dashboard-client.tsx`

`useState` for mouse position causes a re-render on every `mousemove` event (potentially 60+ times/sec). Use `useRef` + direct DOM mutation instead to avoid flooding the render queue.

```tsx
// BEFORE
const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
useEffect(() => {
  const handler = (e) => setMousePos({ x: e.clientX, y: e.clientY });
  window.addEventListener('mousemove', handler);
  return () => window.removeEventListener('mousemove', handler);
}, []);

// AFTER
const mousePosRef = useRef({ x: 0, y: 0 });
useEffect(() => {
  const handler = (e: MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    // If you need to update the DOM, do it directly:
    // cursorEl.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  };
  window.addEventListener('mousemove', handler);
  return () => window.removeEventListener('mousemove', handler);
}, []);
```

---

### 6. Derive State During Render, Not in Effects

**File:** `app/dashboard/dashboard-client.tsx`

`totalRevenue` is derived from `orders` — computing it in a `useEffect` creates an unnecessary extra render cycle (render with stale value, then effect fires, then re-render with correct value). Compute it inline during render.

```tsx
// BEFORE
const [totalRevenue, setTotalRevenue] = useState(0);
useEffect(() => {
  setTotalRevenue(orders.reduce((sum, o) => sum + o.total, 0));
}, [orders]);

// AFTER — derived during render, zero extra renders
const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
```

---

### 7. Premature useMemo on Simple Primitive Expression

**File:** `app/dashboard/dashboard-client.tsx`

`selectedTab.toUpperCase()` is a trivial string operation — well under 1ms. `useMemo` adds overhead (dependency comparison, closure) that exceeds the cost of the computation itself.

```tsx
// BEFORE
const tabLabel = useMemo(() => selectedTab.toUpperCase(), [selectedTab]);

// AFTER
const tabLabel = selectedTab.toUpperCase();
```

---

### 8. Object Dependency in useEffect — Use Primitive

**File:** `app/dashboard/dashboard-client.tsx`

`user` is an object. Every time the parent re-renders and passes a new object reference (even with identical contents), this effect re-fires. Extract the primitive you actually depend on.

```tsx
// BEFORE
useEffect(() => {
  trackPageView(user);
}, [user]);

// AFTER — depend on primitive, pass full object inside
useEffect(() => {
  trackPageView(user);
}, [user.id]);
```

---

### 9. useTransition Instead of Manual Loading Boolean

**File:** `app/dashboard/dashboard-client.tsx`

The manual `loading`/`setLoading` pattern around async work is exactly what `useTransition` solves — it integrates with React's scheduler, avoids the intermediate loading render when the transition is fast, and works with Suspense.

```tsx
// BEFORE
const [loading, setLoading] = useState(false);
const handleExport = async () => {
  setLoading(true);
  try {
    const data = await exportDashboard(user.id);
    download(data);
  } finally {
    setLoading(false);
  }
};

// AFTER
const [isPending, startTransition] = useTransition();
const handleExport = () => {
  startTransition(async () => {
    const data = await exportDashboard(user.id);
    download(data);
  });
};

// In JSX: {isPending ? <Spinner /> : null}
```

---

### 10. useState Initializer for SSR-Unsafe Browser API

**File:** `app/dashboard/dashboard-client.tsx`

`useState(window.innerWidth)` crashes during SSR because `window` is undefined on the server. It also evaluates `window.innerWidth` on every render (the value is discarded after the first, but the access still happens). Use a lazy initializer function.

```tsx
// BEFORE
const [windowWidth, setWindowWidth] = useState(window.innerWidth);

// AFTER — lazy initializer, SSR-safe
const [windowWidth, setWindowWidth] = useState(() =>
  typeof window !== 'undefined' ? window.innerWidth : 0
);
```

---

### 11. Build Map for Repeated Collection Lookups — O(n*m) to O(n)

**File:** `app/dashboard/dashboard-client.tsx`

`categories.find()` inside `orders.map()` is O(n*m). Build a Set (or Map if you need values) first.

```tsx
// BEFORE
const categories = ['electronics', 'clothing', 'food'];
const enrichedOrders = orders.map(order => ({
  ...order,
  category: categories.find(c => c === order.categoryId),
}));

// AFTER — O(1) lookup
const categorySet = new Set(['electronics', 'clothing', 'food']);
const enrichedOrders = orders.map(order => ({
  ...order,
  category: categorySet.has(order.categoryId) ? order.categoryId : undefined,
}));
```

---

### 12. Hoist RegExp Outside Component

**File:** `app/dashboard/dashboard-client.tsx`

`emailRegex` is re-created on every render. Hoist it to module scope — regex compilation is not free and the pattern never changes.

```tsx
// BEFORE (inside component)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// AFTER (module-level constant)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

---

### 13. Use Set for Deduplication Instead of indexOf

**File:** `app/dashboard/dashboard-client.tsx`

The `.filter((v,i,a) => a.indexOf(v) === i)` pattern is O(n^2). Use `Set` for O(n).

```tsx
// BEFORE
const uniqueTags = orders
  .flatMap(o => o.tags)
  .filter((v, i, a) => a.indexOf(v) === i);

// AFTER
const uniqueTags = [...new Set(orders.flatMap(o => o.tags))];
```

---

### 14. Combine Chained filter/map/filter/reduce Into Single Loop

**File:** `app/dashboard/dashboard-client.tsx`

Four chained array methods create three intermediate arrays. For large order lists, consolidate into a single loop.

```tsx
// BEFORE
const activeHighValue = orders
  .filter(o => o.status === 'active')
  .map(o => o.total)
  .filter(t => t > 100)
  .reduce((sum, t) => sum + t, 0);

// AFTER — single pass, zero intermediate arrays
let activeHighValue = 0;
for (const o of orders) {
  if (o.status === 'active' && o.total > 100) {
    activeHighValue += o.total;
  }
}
```

---

### 15. Ternary for Conditional Rendering, Not &&

**File:** `app/dashboard/dashboard-client.tsx`

`{order.isAdmin && <AdminPanel />}` will render `0` or `""` to the DOM when `isAdmin` is falsy with those values. Use a ternary to guarantee `null` on the false branch.

```tsx
// BEFORE
{order.isAdmin && <AdminPanel />}

// AFTER
{order.isAdmin ? <AdminPanel /> : null}
```

---

### 16. Lazy-Load HeavyModal with next/dynamic

**File:** `app/dashboard/dashboard-client.tsx`

`HeavyModal` is imported eagerly at the top level, increasing the initial bundle size even though the modal is only shown on user interaction. Use `next/dynamic` (or `React.lazy`) to code-split it.

```tsx
// BEFORE
import HeavyModal from './heavy-modal';

// AFTER
import dynamic from 'next/dynamic';
const HeavyModal = dynamic(() => import('./heavy-modal'), {
  loading: () => <div>Loading...</div>,
});
```

---

### 17. Preload on Hover/Focus for Lazy-Loaded Modal

**File:** `app/dashboard/dashboard-client.tsx`

When using dynamic imports, preload the chunk on `onMouseEnter`/`onFocus` so the ~200ms hover-to-click delay is used for loading.

```tsx
// AFTER
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

### 18. Minimize RSC-to-Client Serialization

**File:** `app/dashboard/page.tsx`

The server component passes the entire `user`, `orders`, and `analytics` objects to a single `DashboardClient` component. This serializes everything across the RSC boundary. Instead, split into smaller, focused client components that each receive only the data they need, and keep as much rendering as possible in server components.

```tsx
// BEFORE — all data serialized to one client component
return <DashboardClient user={user} orders={orders} analytics={analytics} />;

// AFTER — split into focused client components, render server-side where possible
return (
  <div>
    <h1>Dashboard</h1>
    <Suspense fallback={<Spinner />}>
      <OrderList orders={orders} />
    </Suspense>
    <Suspense fallback={<Spinner />}>
      <AnalyticsPanel analytics={analytics} />
    </Suspense>
  </div>
);
```

Only pass the minimum fields each client component needs (e.g., `orders.map(o => ({ id: o.id, name: o.name, total: o.total }))` instead of full order objects).

---

### 19. content-visibility: auto for Long Order Lists

**File:** `app/dashboard/dashboard-client.tsx`

The `orders.map(...)` renders potentially many DOM nodes. Apply `content-visibility: auto` on the list item containers for free browser-level rendering optimization — items off-screen skip layout and paint.

```css
/* Add to the order item container */
.order-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 60px; /* estimated height of one item */
}
```

```tsx
{orders.map((order, i) => (
  <div key={order.id} className="order-item">
    {order.isAdmin ? <AdminPanel /> : null}
    <span>{order.name}</span>
  </div>
))}
```

Also note: use `order.id` (or a stable identifier) as the `key`, not the array index `i`.

---

## Complete Fixed Code

```tsx
// app/dashboard/page.tsx (Server Component)
import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { OrderList } from './order-list';
import { AnalyticsPanel } from './analytics-panel';
import { DashboardHeader } from './dashboard-header';

// React.cache() for per-request deduplication
const fetchUser = React.cache(async (sessionId: string) => {
  return db.user.find(sessionId);
});

const fetchAnalytics = React.cache(async (userId: string) => {
  return db.analytics.find(userId);
});

export default async function DashboardPage() {
  // Note: cookies() makes this route dynamic — intentional for auth
  const session = cookies().get('session');
  const user = await fetchUser(session?.value);

  // Start-early-await-late: parallelize independent fetches
  const pOrders = fetchOrders(user.id);
  const pAnalytics = fetchAnalytics(user.id);
  const [orders, analytics] = await Promise.all([pOrders, pAnalytics]);

  // Minimize serialization: split into focused client components
  // Only pass minimum needed fields across the RSC boundary
  return (
    <div>
      <DashboardHeader userName={user.name} />
      <Suspense fallback={<div>Loading orders...</div>}>
        <OrderList orders={orders} userId={user.id} />
      </Suspense>
      <Suspense fallback={<div>Loading analytics...</div>}>
        <AnalyticsPanel analytics={analytics} />
      </Suspense>
    </div>
  );
}
```

```tsx
// app/dashboard/dashboard-client.tsx
'use client';
import React, { useState, useEffect, useRef, useTransition } from 'react';
import dynamic from 'next/dynamic';

// --- Module-level constants (hoisted out of component) ---
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lazy-load heavy modal
const HeavyModal = dynamic(() => import('./heavy-modal'), {
  loading: () => <div>Loading...</div>,
});
const preloadModal = () => import('./heavy-modal');

export function DashboardClient({ user, orders, analytics }) {
  const [selectedTab, setSelectedTab] = useState('orders');

  // useEffect with [] is NOT componentDidMount — it runs after paint
  useEffect(() => {
    initDashboard();
  }, []);

  // useRef for high-frequency mouse tracking (no re-renders)
  const mousePosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Derive state during render — no effect needed
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

  // No useMemo for trivial expression
  const tabLabel = selectedTab.toUpperCase();

  // Primitive dependency — user.id instead of user object
  useEffect(() => {
    trackPageView(user);
  }, [user.id]);

  // useTransition instead of manual loading boolean
  const [isPending, startTransition] = useTransition();
  const handleExport = () => {
    startTransition(async () => {
      const data = await exportDashboard(user.id);
      download(data);
    });
  };

  // Lazy initializer for SSR-unsafe browser API
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0
  );

  // Set for O(1) lookup instead of find() inside map()
  const categorySet = new Set(['electronics', 'clothing', 'food']);
  const enrichedOrders = orders.map(order => ({
    ...order,
    category: categorySet.has(order.categoryId) ? order.categoryId : undefined,
  }));

  // Set for O(n) deduplication instead of O(n^2) indexOf
  const uniqueTags = [...new Set(orders.flatMap(o => o.tags))];

  // Single loop instead of chained filter/map/filter/reduce
  let activeHighValue = 0;
  for (const o of orders) {
    if (o.status === 'active' && o.total > 100) {
      activeHighValue += o.total;
    }
  }

  return (
    <div>
      <h1>{tabLabel}</h1>
      {isPending ? <Spinner /> : null}
      <button onClick={handleExport}>Export</button>
      {/* content-visibility: auto for long lists; use stable key */}
      {orders.map((order) => (
        <div key={order.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}>
          {order.isAdmin ? <AdminPanel /> : null}
          <span>{order.name}</span>
        </div>
      ))}
    </div>
  );
}

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

## Summary

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | Sequential fetches | High | Async & Data Fetching |
| 2 | Missing React.cache() | Medium | Async & Data Fetching |
| 3 | cookies() dynamic blast radius | Medium | Next.js / RSC |
| 4 | useEffect [] != componentDidMount | Low | Correctness |
| 5 | useState for mouse position | High | State & Rendering |
| 6 | Derived state in effect | Medium | State & Rendering |
| 7 | Premature useMemo | Low | State & Rendering |
| 8 | Object dependency in effect | High | State & Rendering |
| 9 | Manual loading boolean | Medium | State & Rendering |
| 10 | useState(window.innerWidth) SSR crash | Critical | Hydration & SSR |
| 11 | O(n*m) find inside map | Medium | Performance |
| 12 | Regex inside component | Low | Performance |
| 13 | O(n^2) deduplication | Medium | Performance |
| 14 | Chained array methods | Medium | Performance |
| 15 | && conditional rendering | Medium | State & Rendering |
| 16 | Eager import of heavy component | Medium | Bundle & Loading |
| 17 | No preload on hover | Low | Bundle & Loading |
| 18 | Over-serialization across RSC boundary | Medium | Server Components |
| 19 | No content-visibility for long list | Low | Performance |
