# Run 1 — Without Skill

```tsx
// ---------------------------------------------------------------------------
// app/dashboard/page.tsx
// ---------------------------------------------------------------------------
import { cookies } from 'next/headers';
import { cache } from 'react';
import { Suspense } from 'react';
import { DashboardOrders } from './dashboard-orders';
import { DashboardAnalytics } from './dashboard-analytics';
import { DashboardHeader } from './dashboard-header';

// React.cache() for per-request deduplication in server components
const fetchUser = cache(async (sessionId: string) => {
  return db.user.find(sessionId);
});

const fetchOrders = cache(async (userId: string) => {
  return db.orders.find(userId);
});

const fetchAnalytics = cache(async (userId: string) => {
  return db.analytics.find(userId);
});

// NOTE: cookies() makes this route fully dynamic — every request hits the server.
// If possible, move auth to middleware and pass userId via searchParams/headers
// to reduce dynamic blast radius.
export default async function DashboardPage() {
  const session = (await cookies()).get('session');
  const user = await fetchUser(session?.value);

  // Parallelize independent fetches — don't await sequentially
  const [orders, analytics] = await Promise.all([
    fetchOrders(user.id),
    fetchAnalytics(user.id),
  ]);

  // Minimize RSC → client serialization: split into focused server components
  // that each pass only the data their client children need.
  return (
    <div>
      <DashboardHeader user={{ id: user.id, name: user.name }} />
      <Suspense fallback={<div>Loading orders...</div>}>
        <DashboardOrders orders={orders} />
      </Suspense>
      <Suspense fallback={<div>Loading analytics...</div>}>
        <DashboardAnalytics analytics={analytics} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// dashboard-client.tsx
// ---------------------------------------------------------------------------
'use client';
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
  useDeferredValue,
} from 'react';
// Direct module imports — avoid barrel files that pull the entire package
import { formatDate } from '@/utils/formatDate';
import { parseQuery } from '@/utils/parseQuery';
import { debounce } from '@/utils/debounce';
import { Chart } from '@/components/Chart';
import dynamic from 'next/dynamic';

// --- Hoisted constants (outside component) ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CATEGORIES = new Set(['electronics', 'clothing', 'food']);

const DEFAULT_FILTERS = { status: 'active', sort: 'date' } as const;

const DashboardFooter = (
  <footer>
    <p>&copy; 2024 Dashboard Inc. All rights reserved.</p>
    <a href="/privacy">Privacy Policy</a>
  </footer>
);

// Memoized Chart wrapper — expensive subtree should not re-render on every parent render
const MemoizedChart = React.memo(function MemoizedChart({
  data,
  config,
}: {
  data: unknown;
  config: unknown;
}) {
  return <Chart data={data} config={config} />;
});

// Lazy-load heavy modal with next/dynamic
const HeavyModal = dynamic(() => import('./heavy-modal'), {
  loading: () => <div>Loading...</div>,
});

export function DashboardClient({ user, orders, analytics }) {
  const [selectedTab, setSelectedTab] = useState('orders');
  const [isPending, startTransition] = useTransition();

  // useEffect with [] runs AFTER paint, not like componentDidMount.
  // If you need synchronous DOM measurement, use useLayoutEffect.
  useEffect(() => {
    initDashboard();
  }, []);

  // High-frequency mouse position: use ref, not state (avoids re-render per move)
  const mousePosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Derive state during render — never in useEffect
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + o.total, 0);

  // Simple expression — useMemo overhead not justified
  const tabLabel = selectedTab.toUpperCase();

  // Primitive dependency (user.id) instead of whole user object
  useEffect(() => {
    trackPageView(user.id);
  }, [user.id]);

  // useTransition instead of manual loading boolean
  const handleExport = () => {
    startTransition(async () => {
      const data = await exportDashboard(user.id);
      download(data);
    });
  };

  // SSR-safe useState initializer — lazy function avoids window access during SSR
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );

  // Map/Set lookup instead of .find() inside .map() — O(n) instead of O(n*m)
  const enrichedOrders = orders.map((order: any) => ({
    ...order,
    category: CATEGORIES.has(order.categoryId) ? order.categoryId : undefined,
  }));

  // Set-based deduplication instead of .filter((v,i,a) => a.indexOf(v) === i)
  const uniqueTags = [...new Set(orders.flatMap((o: any) => o.tags))];

  // Single loop instead of chained .filter().map().filter().reduce()
  let activeHighValue = 0;
  for (const o of orders) {
    if (o.status === 'active' && o.total > 100) {
      activeHighValue += o.total;
    }
  }

  // Functional setState for stable callback — avoids stale closure over `count`
  const [count, setCount] = useState(0);
  const increment = useCallback(() => setCount((c) => c + 1), []);

  // Interaction logic belongs in event handler, not useEffect
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query) {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await r.json();
      setResults(data);
    }
  }, []);

  // Default non-primitive prop hoisted outside render (DEFAULT_FILTERS above)
  const OrderList = ({ filters = DEFAULT_FILTERS }) => {
    return <div>{JSON.stringify(filters)}</div>;
  };

  // Subscribe to derived boolean, not full store
  const isAdmin = useStore((state) => state.role === 'admin');

  // useLatest/ref pattern — stable callback reference avoids effect re-subscribe
  const onMessageRef = useRef((msg: string) => {
    console.log(user.name, msg);
  });
  useEffect(() => {
    onMessageRef.current = (msg: string) => {
      console.log(user.name, msg);
    };
  }, [user.name]);
  useEffect(() => {
    const handler = (msg: string) => onMessageRef.current(msg);
    socket.on('message', handler);
    return () => socket.off('message', handler);
  }, []); // stable — never re-subscribes

  // Cache storage reads — read once into state, not on every render
  const [theme] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('theme') || 'light'
      : 'light',
  );
  const [lang] = useState(() =>
    typeof window !== 'undefined'
      ? sessionStorage.getItem('lang') || 'en'
      : 'en',
  );

  // Immutable array transforms — toSorted / toReversed instead of spread+mutate
  const sortedOrders = orders.toSorted((a: any, b: any) => a.date - b.date);
  const reversedOrders = orders.toReversed();

  return (
    <div>
      <h1>{tabLabel}</h1>
      {isPending ? <Spinner /> : null}
      <button onClick={handleExport}>Export</button>
      {/* content-visibility: auto for long off-screen lists */}
      <div style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }}>
        {orders.map((order: any) => (
          <div key={order.id}>
            {order.isAdmin ? <AdminPanel /> : null}
            <span>{order.name}</span>
          </div>
        ))}
      </div>
      <MemoizedChart data={analytics.timeSeries} config={analytics.chartConfig} />
      {DashboardFooter}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal trigger with lazy import + hover preloading
// ---------------------------------------------------------------------------
export function ModalTrigger() {
  const [open, setOpen] = useState(false);

  // Preload on hover/focus so the chunk is ready when clicked
  const preload = () => {
    import('./heavy-modal');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        onMouseEnter={preload}
        onFocus={preload}
      >
        Open
      </button>
      {open ? <HeavyModal /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// app/products/page.tsx — Suspense boundaries for progressive streaming
// ---------------------------------------------------------------------------
import { Suspense } from 'react';

async function ProductListLoader() {
  const products = await fetchProducts();
  return <ProductList products={products} />;
}

async function ReviewSectionLoader() {
  const reviews = await fetchReviews();
  return <ReviewSection reviews={reviews} />;
}

export default function ProductsPage() {
  return (
    <div>
      <Suspense fallback={<div>Loading products...</div>}>
        <ProductListLoader />
      </Suspense>
      <Suspense fallback={<div>Loading reviews...</div>}>
        <ReviewSectionLoader />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// app/layout.tsx — defer third-party script
// ---------------------------------------------------------------------------
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head />
      <body>
        {children}
        {/* strategy="lazyOnload" defers loading until after hydration + idle */}
        <Script
          src="https://analytics.example.com/tracker.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}

// ---------------------------------------------------------------------------
// app/feed/page.tsx — deduplicate client fetches with SWR
// ---------------------------------------------------------------------------
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function FeedPage() {
  // SWR deduplicates: both usages resolve from the same in-flight request
  const { data: posts = [] } = useSWR('/api/posts', fetcher);

  const trending = posts.filter((p: any) => p.trending);

  return (
    <div>
      <PostList posts={posts} />
      <TrendingSidebar posts={trending} />
    </div>
  );
}
```

## Issues Found and Fixed

| # | Issue | Fix |
|---|-------|-----|
| 1 | **Sequential awaits** — `fetchUser`, `fetchOrders`, `fetchAnalytics` awaited one after another | Parallelized independent fetches with `Promise.all` (user must be fetched first, then orders+analytics in parallel) |
| 2 | **No `React.cache()`** — server-side fetch functions not deduplicated per request | Wrapped `fetchUser`, `fetchOrders`, `fetchAnalytics` in `cache()` |
| 3 | **`cookies()` dynamic blast radius** — calling `cookies()` in page makes the entire route dynamic | Added comment flagging the issue; suggested moving auth to middleware |
| 4 | **Derived state in useEffect** — `totalRevenue` computed via `useEffect` + `setState` | Computed directly during render |
| 5 | **Premature `useMemo`** — `useMemo` for `selectedTab.toUpperCase()` | Removed `useMemo`; inline expression is cheaper than the hook overhead |
| 6 | **Object as effect dependency** — `useEffect` depends on `user` object | Changed to primitive `user.id` |
| 7 | **`useState(window.innerWidth)` crashes SSR** — direct `window` access in initializer | Used lazy initializer `useState(() => ...)` with `typeof window` guard |
| 8 | **Manual loading boolean** — `useState` for loading state during async export | Replaced with `useTransition` |
| 9 | **`useState` for mouse position** — high-frequency updates cause re-renders | Switched to `useRef` |
| 10 | **O(n*m) lookup** — `categories.find()` inside `orders.map()` | Replaced array with `Set` for O(1) lookups |
| 11 | **Quadratic deduplication** — `.filter((v,i,a) => a.indexOf(v) === i)` | Replaced with `[...new Set()]` |
| 12 | **Chained array methods** — `.filter().map().filter().reduce()` | Combined into single `for` loop |
| 13 | **Regex inside component** — `emailRegex` recreated every render | Hoisted `EMAIL_REGEX` outside component |
| 14 | **`&&` conditional rendering** — `{order.isAdmin && <AdminPanel />}` can render `0`/`""` | Changed to ternary `? ... : null` |
| 15 | **Eager import of HeavyModal** — static import of rarely-used heavy component | Used `next/dynamic` for lazy loading |
| 16 | **No hover preload on modal trigger** — chunk only loads on click | Added `onMouseEnter`/`onFocus` that call `import('./heavy-modal')` |
| 17 | **All data serialized to one client component** — massive RSC-to-client payload | Split into focused server components passing only necessary data |
| 18 | **"componentDidMount" comment** — misleading; `useEffect([])` runs after paint | Corrected comment; noted `useLayoutEffect` alternative |
| 19 | **No content-visibility on long list** — all order items rendered eagerly | Added `contentVisibility: 'auto'` CSS for off-screen optimization |
| 20 | **Barrel file imports** — `@/utils` and `@/components` pull entire barrels | Changed to direct module imports |
| 21 | **Stale closure in `setCount`** — `setCount(count + 1)` with `count` in deps | Used functional updater `setCount(c => c + 1)` with empty deps |
| 22 | **Fetch in useEffect on state change** — search fires via effect instead of handler | Moved fetch logic into `handleSearch` event handler |
| 23 | **Non-primitive default prop** — `{ status: 'active', sort: 'date' }` recreated each render | Hoisted `DEFAULT_FILTERS` constant outside component |
| 24 | **Full store subscription** — `useStore(state => state)` re-renders on any store change | Narrowed selector to `useStore(s => s.role === 'admin')` |
| 25 | **Expensive Chart not memoized** — `renderChart()` re-renders on every parent update | Extracted to `React.memo(MemoizedChart)` component |
| 26 | **Callback in effect deps causes re-subscribe** — `onMessage` recreated on `user.name` change | Used `useLatest` ref pattern for stable callback |
| 27 | **`localStorage`/`sessionStorage` read every render** — synchronous I/O on each render | Cached in `useState` lazy initializer (read once) |
| 28 | **Static JSX recreated every render** — footer JSX inside component body | Hoisted `DashboardFooter` outside component as module-level constant |
| 29 | **`[...arr].sort()` / `[...arr].reverse()`** — spread-then-mutate pattern | Used `toSorted()` / `toReversed()` |
| 30 | **No Suspense in ProductsPage** — sequential awaits block entire page | Wrapped each section in `<Suspense>` with async loader components for streaming |
| 31 | **Third-party script loaded eagerly** — `<Script>` without `strategy` blocks rendering | Added `strategy="lazyOnload"` and moved outside `<head>` |
| 32 | **Duplicate fetch in FeedPage** — `/api/posts` fetched twice in separate effects | Replaced with single `useSWR` call; derived `trending` from shared data |
| 33 | **`key={i}` index key on orders** — unstable key if list reorders | Changed to `key={order.id}` |
| 34 | **Missing `encodeURIComponent`** — raw query string injection in search URL | Added `encodeURIComponent(query)` |
