# React/Next.js Gotchas Review

## Component 1: ThemeProvider -- `useEffect` is NOT `componentDidMount`

**Severity: High -- Hydration flicker**

The comment says "This runs like componentDidMount" but the skill explicitly warns:

> `useEffect` with an empty dep array `[]` is NOT `componentDidMount`. It runs after paint, not before.

`useEffect(() => {}, [])` fires **after** the browser paints. The component renders with `'light'`, the user sees it, then the effect runs and switches to the saved theme -- causing a visible flash of wrong theme (FOUC).

**Fix options (pick one):**

1. **Inline script tag** (best for SSR/Next.js) -- the skill recommends "Use inline script tags to prevent hydration flicker for client-only data":
   ```html
   <script dangerouslySetInnerHTML={{ __html: `
     document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
   `}} />
   ```
   Then read `document.documentElement.dataset.theme` as initial state.

2. **`useLayoutEffect`** -- runs synchronously before paint, preventing flicker. Appropriate when you need synchronous DOM measurement or must block paint.

3. **Cookie-based server rendering** -- read the theme from a cookie on the server so the initial HTML is already correct. Pair with `suppressHydrationWarning` for expected mismatches.

**Additional skill rule violated:** "Cache localStorage/sessionStorage reads, don't read repeatedly." If `ThemeProvider` ever re-mounts, it reads localStorage again. Store the value in a module-level variable after the first read.

---

## Component 2: NotificationBell -- Premature Memoization

**Severity: Medium -- Unnecessary complexity**

The skill is explicit:

> `useMemo`/`useCallback` for every value is premature optimization. Only memoize when: passing to React.memo'd children, or computation is genuinely expensive (>1ms).

Three violations:

| Expression | Cost | Verdict |
|---|---|---|
| `useMemo(() => unreadCount > 0, [unreadCount])` | A single boolean comparison | **Remove.** Derive inline: `const hasUnread = unreadCount > 0;` |
| `useMemo(() => hasUnread ? 'red' : 'gray', [hasUnread])` | A ternary on a boolean | **Remove.** Derive inline: `const bellColor = hasUnread ? 'red' : 'gray';` |
| `useMemo(() => notifications.filter(...).length, [...])` | Linear scan | **Keep only if** `notifications` array is large (hundreds+). Otherwise remove. |

The skill rule: "Don't wrap simple primitive expressions in useMemo."

The `useCallback` on `handleClick` is justified **only if** `Bell` is wrapped in `React.memo`. If it is not, remove the `useCallback` -- it adds overhead without benefit. The skill rule: "Use functional setState for stable callbacks" is already correctly applied here (using `prev =>`), which is good.

**Suggested rewrite:**

```typescript
function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasUnread = unreadCount > 0;
  const bellColor = hasUnread ? 'red' : 'gray';

  const handleClick = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  return <Bell color={bellColor} count={unreadCount} onClick={handleClick} />;
}
```

---

## Component 3: UserProfile -- Multiple Issues

### 3a. Missing cleanup / race condition

**Severity: High -- Correctness bug**

When `userId` changes rapidly, multiple fetches run concurrently. The last `setUser(data)` call wins, but it may not correspond to the current `userId`. This is a classic stale-closure race condition.

Fix: Use an `AbortController` for cleanup, or use SWR/TanStack Query. The skill recommends: "Use SWR for automatic client request deduplication."

```typescript
useEffect(() => {
  const controller = new AbortController();
  setLoading(true);
  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then(res => res.json())
    .then(data => setUser(data))
    .catch(err => { if (err.name !== 'AbortError') throw err; })
    .finally(() => setLoading(false));
  return () => controller.abort();
}, [userId]);
```

### 3b. Unnecessary `flushSync`

**Severity: Medium -- Performance anti-pattern**

The skill warns:

> State updates in React 18+ are auto-batched everywhere (including promises, timeouts). Don't wrap in `flushSync` unless you specifically need synchronous rendering.

`flushSync(() => setLoading(true))` forces a synchronous re-render, bypassing React's batching. There is no reason for this -- the loading state will be set and the fetch will proceed. Remove `flushSync` entirely.

### 3c. Manual loading state boolean

**Severity: Low -- Prefer idiomatic React 18+**

The skill recommends: "Prefer useTransition over manual loading state booleans."

Using `useTransition` or a data-fetching library (SWR, TanStack Query) would eliminate the manual `loading`/`setLoading` state management and handle race conditions automatically.

### 3d. `fetchUser` defined outside effect

**Severity: Low -- Lint warning**

`fetchUser` is defined in the component body and called inside `useEffect` without being listed in deps. This violates the exhaustive-deps rule. Either move `fetchUser` inside the effect or wrap it in `useCallback` with `[userId]` deps.

---

## Component 4: RootLayout -- Dynamic Route Opt-out

**Severity: High -- Performance / architecture**

The skill warns:

> Next.js App Router: `cookies()`, `headers()` make the entire route dynamic. One call in a layout makes ALL child pages dynamic.

Calling `cookies()` in `app/layout.tsx` (the **root** layout) means **every single page** in the application becomes dynamically rendered. No page can be statically generated or cached. This is almost certainly unintended for a locale preference.

**Fix options:**

1. **Middleware** (recommended) -- read the cookie in `middleware.ts` and rewrite/redirect based on locale. The layout receives locale from the URL segment, no `cookies()` call needed.

2. **Client component** -- extract the locale reader into a small client component that reads `document.cookie` or uses a context provider hydrated from an inline script.

3. **Accept the tradeoff** -- if all pages are already dynamic (e.g., fully authenticated app), this is fine. But it should be a conscious decision, not an accident.

**Additional note:** The component is missing TypeScript typing for `children`. It should be `{ children }: { children: React.ReactNode }`.

---

## Summary Table

| # | Component | Issue | Severity | Skill Rule |
|---|---|---|---|---|
| 1 | ThemeProvider | `useEffect` is not `componentDidMount`, causes FOUC | High | useEffect vs useLayoutEffect; inline script for hydration flicker |
| 2 | NotificationBell | Premature `useMemo` on trivial expressions | Medium | Don't wrap simple primitives in useMemo |
| 3a | UserProfile | No fetch cleanup, race condition on userId change | High | Missing cleanup in effects |
| 3b | UserProfile | Unnecessary `flushSync` | Medium | React 18 auto-batching |
| 3c | UserProfile | Manual loading boolean instead of useTransition | Low | Prefer useTransition |
| 3d | UserProfile | `fetchUser` not in effect deps | Low | Correctness / lint |
| 4 | RootLayout | `cookies()` in root layout forces all pages dynamic | High | cookies()/headers() make route dynamic |
| 4 | RootLayout | Missing TypeScript props type | Low | Correctness |
