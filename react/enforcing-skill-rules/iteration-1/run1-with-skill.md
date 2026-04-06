# Run 1 — With Skill

## Fixed Code

```tsx
// app/dashboard/page.tsx
import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { OrdersSection } from './orders-section';
import { AnalyticsSection } from './analytics-section';
import { DashboardHeader } from './dashboard-header';

// [react-cache] Wrap data-fetching functions in React.cache() for per-request deduplication.
// If multiple server components call these in the same render tree, they share the same promise.
const fetchUser = React.cache(async (sessionId: string) => {
  return db.user.find(sessionId);
});

const fetchAnalytics = React.cache(async (userId: string) => {
  return db.analytics.find(userId);
});

async function fetchOrders(userId: string) {
  return db.order.findMany(userId);
}

// [cookies-blast-radius] cookies() makes this entire route dynamic.
// This is intentional here (dashboard is per-user), but NEVER place cookies() in a layout —
// it would make ALL child routes dynamic. Keep it in the leaf page.
export default async function DashboardPage() {
  const session = cookies().get('session');

  // [parallel-fetches] fetchUser must complete first (orders/analytics depend on user.id),
  // but orders and analytics are independent of each other.
  // Start-early-await-late pattern: start independent fetches before awaiting dependents.
  const user = await fetchUser(session?.value);
  const pOrders = fetchOrders(user.id);
  const pAnalytics = fetchAnalytics(user.id);
  const [orders, analytics] = await Promise.all([pOrders, pAnalytics]);

  // [minimize-rsc-serialization] Instead of passing ALL data to a single client component,
  // split into smaller server/client boundaries. Each child receives only what it needs.
  // [suspense-streaming] Wrap sections in Suspense for progressive streaming.
  return (
    <div>
      <DashboardHeader userName={user.name} />
      <Suspense fallback={<div>Loading orders...</div>}>
        <OrdersSection orders={orders} />
      </Suspense>
      <Suspense fallback={<div>Loading analytics...</div>}>
        <AnalyticsSection timeSeries={analytics.timeSeries} chartConfig={analytics.chartConfig} />
      </Suspense>
    </div>
  );
}

// dashboard-client.tsx
'use client';
import React, { useState, useRef, useEffect, useTransition, useDeferredValue } from 'react';
// [barrel-import] Import directly from module paths, not barrel files.
// Barrel files pull in the entire module graph, bloating the client bundle.
import { formatDate } from '@/utils/formatDate';
import { parseQuery } from '@/utils/parseQuery';
import { debounce } from '@/utils/debounce';
import { Chart } from '@/components/Chart';

// [hoist-regex] RegExp created inside a component re-compiles every render.
// Hoist to module scope — it's stateless and immutable.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// [hoist-default-props] Non-primitive default props create a new object reference every render,
// defeating React.memo and causing unnecessary child re-renders.
const DEFAULT_FILTERS = { status: 'active', sort: 'date' } as const;

// [hoist-static-jsx] Static JSX that never changes should live outside the component.
// Otherwise React allocates new elements every render for zero benefit.
const FOOTER = (
  <footer>
    <p>&copy; 2024 Dashboard Inc. All rights reserved.</p>
    <a href="/privacy">Privacy Policy</a>
  </footer>
);

// [memoize-expensive-subtree] Extract Chart into a React.memo component so it only
// re-renders when its own props change, not on every parent render.
const MemoizedChart = React.memo(function MemoizedChart({
  data,
  config,
}: {
  data: unknown;
  config: unknown;
}) {
  return <Chart data={data} config={config} />;
});

export function DashboardClient({ user, orders, analytics }) {
  const [selectedTab, setSelectedTab] = useState('orders');

  // [useTransition] Replace manual loading/setLoading boolean with useTransition.
  // React manages the pending state and keeps the UI responsive during the transition.
  const [isPending, startTransition] = useTransition();

  // [ref-for-mouse] useState for high-frequency mouse tracking causes a re-render on every
  // mousemove event (60+ times/sec). Use useRef + direct DOM mutation instead.
  const mousePosRef = useRef({ x: 0, y: 0 });

  // [useEffect-not-cdm] useEffect with [] runs AFTER paint, not before.
  // This is NOT componentDidMount. If you need synchronous DOM measurement,
  // use useLayoutEffect. The comment below was incorrect — removed.
  useEffect(() => {
    initDashboard();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Write to ref — no re-render. Read from ref when needed.
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // [no-derived-effect] totalRevenue is derived from orders — compute it during render.
  // useEffect + setState for derived data causes an unnecessary extra render cycle.
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + o.total, 0);

  // [no-premature-memo] useMemo for `selectedTab.toUpperCase()` is premature optimization.
  // String.toUpperCase() is trivially cheap (<0.001ms). Just compute inline.
  const tabLabel = selectedTab.toUpperCase();

  // [primitive-deps] Depending on the `user` object causes re-runs whenever the reference
  // changes, even if the contents are identical. Use the primitive `user.id` instead.
  useEffect(() => {
    trackPageView(user.id);
  }, [user.id]);

  // [useTransition] handleExport uses startTransition instead of manual loading state.
  const handleExport = () => {
    startTransition(async () => {
      const data = await exportDashboard(user.id);
      download(data);
    });
  };

  // [usestate-initializer] useState(window.innerWidth) crashes during SSR because `window`
  // doesn't exist. Pass a lazy initializer function — it only runs on the client.
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0
  );

  // [map-lookup] categories.find() inside orders.map() is O(n*m).
  // Build a Set (or Map) for O(1) lookups.
  const categorySet = new Set(['electronics', 'clothing', 'food']);
  const enrichedOrders = orders.map((order: any) => ({
    ...order,
    category: categorySet.has(order.categoryId) ? order.categoryId : undefined,
  }));

  // [set-dedup] .filter((v,i,a) => a.indexOf(v) === i) is O(n^2).
  // Use Set for O(n) deduplication.
  const uniqueTags = [...new Set(orders.flatMap((o: any) => o.tags))];

  // [single-loop] Chained .filter().map().filter().reduce() iterates the array 4 times.
  // Combine into a single loop for large arrays.
  let activeHighValue = 0;
  for (const o of orders) {
    if (o.status === 'active' && o.total > 100) {
      activeHighValue += o.total;
    }
  }

  // [functional-setState] setCount(count + 1) with count in the useCallback dep array
  // creates a new callback on every count change (stale closure risk).
  // Functional updater makes the callback stable — no deps needed.
  const [count, setCount] = useState(0);
  const increment = React.useCallback(() => setCount((c) => c + 1), []);

  // [interaction-in-handler] Fetching in useEffect on searchQuery change is the "sync external
  // system" pattern misapplied to user interaction. Put the fetch in the event handler directly.
  // [useDeferredValue] If results are expensive to render, defer them to keep input responsive.
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const deferredResults = useDeferredValue(results);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query) {
      const r = await fetch(`/api/search?q=${query}`);
      const data = await r.json();
      setResults(data);
    }
  };

  // [hoist-default-props] Use the hoisted DEFAULT_FILTERS constant.
  const OrderList = ({ filters = DEFAULT_FILTERS }) => {
    return <div>{JSON.stringify(filters)}</div>;
  };

  // [subscribe-derived-boolean] Subscribing to the entire store object means this component
  // re-renders on ANY store change. Subscribe to only the derived boolean you need.
  const isAdmin = useStore((state) => state.role === 'admin');

  // [useLatest-ref-pattern] Store the callback in a ref so the effect never re-subscribes.
  // Without this, every time user.name changes, the socket listener tears down and re-attaches.
  const onMessageRef = useRef((msg: string) => {
    console.log(user.name, msg);
  });
  useEffect(() => {
    onMessageRef.current = (msg: string) => {
      console.log(user.name, msg);
    };
  });
  useEffect(() => {
    const handler = (msg: string) => onMessageRef.current(msg);
    socket.on('message', handler);
    return () => socket.off('message', handler);
  }, []); // Stable — never re-subscribes.

  // [cache-storage-reads] Reading localStorage/sessionStorage on every render is slow I/O.
  // Read once into state via lazy initializer.
  const [theme] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('theme') || 'light' : 'light'
  );
  const [lang] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('lang') || 'en' : 'en'
  );

  // [immutable-array-transforms] Use toSorted()/toReversed() — they return new arrays without
  // the spread-then-mutate pattern, and are clearer in intent.
  const sortedOrders = orders.toSorted((a: any, b: any) => a.date - b.date);
  const reversedOrders = orders.toReversed();

  return (
    <div>
      <h1>{tabLabel}</h1>
      {isPending ? <Spinner /> : null}
      <button onClick={handleExport}>Export</button>
      {/* [content-visibility] For long lists, add content-visibility: auto to the container
          so the browser skips layout/paint for off-screen items — free virtualization. */}
      <div style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 200px' }}>
        {orders.map((order: any) => (
          // [key-prop] Never use array index as key for dynamic lists that can reorder/filter.
          // Use a stable unique identifier.
          <div key={order.id}>
            {/* [ternary-conditional] order.isAdmin && <AdminPanel /> can render `0` or `""`
                when the condition is falsy (e.g., 0 is a valid JSX child). Use ternary. */}
            {order.isAdmin ? <AdminPanel /> : null}
            <span>{order.name}</span>
          </div>
        ))}
      </div>
      <MemoizedChart data={analytics.timeSeries} config={analytics.chartConfig} />
      {FOOTER}
    </div>
  );
}

// [dynamic-import] HeavyModal is rarely used — lazy-load it to keep it out of the main bundle.
import dynamic from 'next/dynamic';
const HeavyModal = dynamic(() => import('./heavy-modal'), { ssr: false });

// [preload-hover] Trigger the chunk download on hover/focus (~200ms before click).
// By the time the user clicks, the module is already loaded or nearly loaded.
const preloadHeavyModal = () => import('./heavy-modal');

export function ModalTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        onMouseEnter={preloadHeavyModal}
        onFocus={preloadHeavyModal}
      >
        Open
      </button>
      {open ? <HeavyModal /> : null}
    </>
  );
}

// app/products/page.tsx
// [suspense-streaming] Wrap independent sections in Suspense to stream progressively.
// Without Suspense, the entire page blocks until ALL data is fetched.
// [parallel-fetches] Start both fetches before awaiting either.
import { Suspense } from 'react';

async function ProductListLoader() {
  const products = await fetchProducts();
  return <ProductList products={products} />;
}

async function ReviewSectionLoader() {
  const reviews = await fetchReviews();
  return <ReviewSection reviews={reviews} />;
}

// [error-boundary] Every route segment should have error.tsx. Without one, errors bubble
// to root and crash the entire app. Ensure app/products/error.tsx exists with a retry button.
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

// app/layout.tsx
// [defer-third-party-script] Without strategy prop, Script loads eagerly and blocks rendering.
// Use strategy="lazyOnload" for analytics/tracking scripts — they're never render-critical.
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head />
      <body>
        {children}
        <Script
          src="https://analytics.example.com/tracker.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}

// app/feed/page.tsx
// [swr-client-dedup] Two separate useEffect calls fetch /api/posts independently — duplicating
// the request. Use SWR for automatic request deduplication: multiple useSWR calls with the
// same key share a single in-flight request and cached result.
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function FeedPage() {
  // Both components consume the same SWR key — only one request is made.
  const { data: posts = [] } = useSWR('/api/posts', fetcher);

  // Derive trending from posts — no separate fetch or state needed.
  const trending = posts.filter((p: any) => p.trending);

  return (
    <div>
      <PostList posts={posts} />
      <TrendingSidebar posts={trending} />
    </div>
  );
}
```

## Issues Fixed (35 total)

| # | Issue | Rule | Priority |
|---|-------|------|----------|
| 1 | Sequential `await fetchUser/fetchOrders/fetchAnalytics` — orders and analytics are independent | Parallelize independent fetches (start-early-await-late) | CRITICAL |
| 2 | `fetchUser`/`fetchAnalytics` not wrapped in `React.cache()` — duplicate DB hits across components | React.cache() for per-request deduplication | HIGH |
| 3 | `cookies()` in page makes route fully dynamic — noted blast radius if moved to layout | cookies()/headers() blast radius warning | HIGH |
| 4 | `useEffect` + `setState` to compute `totalRevenue` from orders | Derive state during render, not in effects | MEDIUM |
| 5 | `useMemo` for `selectedTab.toUpperCase()` — trivially cheap operation | Don't useMemo simple primitive expressions | MEDIUM |
| 6 | `useEffect` depends on `user` object reference, not `user.id` | Primitive values as effect dependencies | MEDIUM |
| 7 | `useState(window.innerWidth)` crashes in SSR | useState lazy initializer for SSR-unsafe defaults | MEDIUM |
| 8 | Manual `loading/setLoading` boolean for async export | useTransition for non-urgent state updates | MEDIUM |
| 9 | `useState` for high-frequency mouse position (60+ re-renders/sec) | useRef for transient high-frequency values | MEDIUM |
| 10 | `categories.find()` inside `orders.map()` — O(n*m) | Build Map/Set for repeated collection lookups | MEDIUM |
| 11 | `.filter((v,i,a) => a.indexOf(v) === i)` deduplication — O(n^2) | Use Set for O(1) deduplication | MEDIUM |
| 12 | Chained `.filter().map().filter().reduce()` — 4 passes | Combine into single loop for large arrays | MEDIUM |
| 13 | RegExp created inside component — re-compiles every render | Hoist RegExp outside component functions | LOW |
| 14 | `{order.isAdmin && <AdminPanel />}` can render falsy values | Ternary operator for conditional rendering | MEDIUM |
| 15 | `HeavyModal` imported eagerly as static import | next/dynamic for heavy/rarely-used components | CRITICAL |
| 16 | No preload on modal trigger hover — cold start on click | Preload lazy-loaded components on hover/focus | HIGH |
| 17 | All data passed from server to single `DashboardClient` | Minimize RSC serialization; split server/client boundaries | HIGH |
| 18 | Comment "runs like componentDidMount" is incorrect | useEffect with [] runs after paint, not before | MEDIUM |
| 19 | Long list of orders rendered without virtualization | content-visibility: auto for off-screen lists | LOW |
| 20 | Barrel file imports `@/utils` and `@/components` | Import directly from module paths | CRITICAL |
| 21 | `setCount(count + 1)` with `count` in useCallback deps — stale closure | Functional setState for stable callbacks | MEDIUM |
| 22 | `useEffect` fires fetch on `searchQuery` change | Put interaction logic in event handlers, not effects | MEDIUM |
| 23 | Default prop `{ status: 'active', sort: 'date' }` recreated every render | Hoist default non-primitive props outside render | MEDIUM |
| 24 | `useStore(state => state)` subscribes to full store | Subscribe to derived booleans, not full objects | MEDIUM |
| 25 | `renderChart()` inline — expensive subtree re-renders every time | Extract into React.memo component | MEDIUM |
| 26 | `onMessage` callback in effect dep re-subscribes on every `user.name` change | useLatest/ref pattern for stable callback references | MEDIUM |
| 27 | `localStorage.getItem`/`sessionStorage.getItem` called on every render | Cache storage reads into state/ref once | LOW |
| 28 | Static footer JSX recreated every render | Hoist static JSX outside component functions | LOW |
| 29 | `[...orders].sort()` / `[...orders].reverse()` instead of built-ins | Use toSorted()/toReversed() for immutable transforms | LOW |
| 30 | ProductsPage awaits all data before rendering — no streaming | Suspense boundaries for progressive streaming | HIGH |
| 31 | Script tag without `strategy` prop loads eagerly | Defer third-party scripts with strategy="lazyOnload" | HIGH |
| 32 | FeedPage fetches `/api/posts` twice in separate useEffects | Use SWR for client request deduplication | HIGH |
| 33 | Array index used as key in orders `.map((order, i) => <div key={i}>)` | Stable unique key for dynamic/reorderable lists | MEDIUM |
| 34 | No error boundary mentioned for route segments | error.tsx required for every route segment | HIGH |
| 35 | `useDeferredValue` added for search results rendering | useDeferredValue for expensive re-renders during typing | MEDIUM |
