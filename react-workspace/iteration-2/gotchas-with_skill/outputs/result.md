# React Gotchas Review

## Component: ThemeProvider

### 1. `useEffect([])` is NOT `componentDidMount` -- hydration flicker

**Severity: High** | Skill rule: *Gotchas*, *Hydration & SSR*

The comment says `// This runs like componentDidMount` -- it does not. `useEffect` with `[]` runs **after paint**, not before. The user will see a flash of the default `'light'` theme before the saved theme is applied from localStorage.

**Fix**: Use an inline `<script>` tag in `<head>` (before React hydrates) to read the theme from localStorage and apply it to `<html>`. This prevents the visible flicker entirely. `suppressHydrationWarning` on the themed element is complementary but does not fix the flash itself.

```tsx
// In layout <head>:
<script dangerouslySetInnerHTML={{ __html: `
  const t = localStorage.getItem('theme');
  if (t) document.documentElement.dataset.theme = t;
`}} />
```

### 2. localStorage read on every render path

**Severity: Low** | Skill rule: *Performance Micro-optimizations*

If `ThemeProvider` ever re-renders before the effect fires, `useState('light')` always starts with the hardcoded default. The localStorage read is deferred to an effect so the initial render always shows `'light'`. This is a design consequence of issue #1 above. If you keep the effect approach, use a lazy initializer:

```tsx
const [theme, setTheme] = useState(() => {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem('theme') ?? 'light';
});
```

This avoids the extra render cycle (effect -> setState -> re-render) but still flickers without the inline script approach.

---

## Component: NotificationBell

### 3. Chained trivial `useMemo` calls -- premature optimization

**Severity: Medium** | Skill rule: *Gotchas*, *State & Rendering*

```tsx
const hasUnread = useMemo(() => unreadCount > 0, [unreadCount]);
const bellColor = useMemo(() => hasUnread ? 'red' : 'gray', [hasUnread]);
```

These are simple boolean/ternary expressions on primitive values. The overhead of `useMemo` (storing the previous value, comparing deps) exceeds the cost of the computation itself. The skill explicitly states: *"Don't wrap simple primitive expressions in useMemo"* and *"Only memoize when computation is genuinely expensive (>1ms)"*.

**Fix**: Derive inline during render:

```tsx
const hasUnread = unreadCount > 0;
const bellColor = hasUnread ? 'red' : 'gray';
```

The first `useMemo` for `unreadCount` (the `.filter()`) is borderline acceptable if the notifications list is large. For small lists it is also unnecessary.

---

## Component: UserProfile

### 4. Missing cleanup -- race condition on `userId` change

**Severity: High** | Skill rule: *State & Rendering*

When `userId` changes rapidly, the effect fires a new fetch but does not cancel the previous one. The older response can resolve after the newer one, overwriting `user` with stale data.

**Fix**: Use an `AbortController` or a cleanup flag:

```tsx
useEffect(() => {
  const controller = new AbortController();
  setLoading(true);
  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then(res => res.json())
    .then(setUser)
    .catch(err => { if (err.name !== 'AbortError') throw err; })
    .finally(() => setLoading(false));
  return () => controller.abort();
}, [userId]);
```

### 5. `fetchUser` is recreated every render -- stale closure risk

**Severity: Medium** | Skill rule: *State & Rendering*

`fetchUser` is defined inside the component body but is not wrapped in `useCallback` and is not listed in the effect's dependency array. ESLint `exhaustive-deps` would flag this. The current code works by accident because `fetchUser` captures `userId` from the closure and the effect re-runs on `[userId]`, but it is fragile.

**Fix**: Either inline the fetch logic inside the effect (preferred) or use the `useLatest`/ref pattern for the callback.

### 6. Unnecessary `flushSync` in `handleRefresh`

**Severity: Medium** | Skill rule: *Gotchas*

```tsx
const handleRefresh = () => { flushSync(() => setLoading(true)); fetchUser(); };
```

React 18+ auto-batches state updates everywhere (promises, timeouts, event handlers). `flushSync` forces synchronous re-rendering, bypassing batching and hurting performance. The skill states: *"Don't wrap in flushSync unless you specifically need synchronous rendering."*

There is no demonstrated need for synchronous rendering here. The spinner will show on the next paint regardless.

**Fix**: Remove `flushSync`:

```tsx
const handleRefresh = () => { setLoading(true); fetchUser(); };
```

### 7. Manual loading state -- prefer `useTransition`

**Severity: Low** | Skill rule: *State & Rendering*

The pattern `const [loading, setLoading] = useState(false)` with manual toggle is exactly what `useTransition` replaces. `startTransition` integrates with Suspense and concurrent features.

```tsx
const [isPending, startTransition] = useTransition();
const handleRefresh = () => startTransition(() => fetchUser());
```

---

## Component: RootLayout (Next.js App Router)

### 8. `cookies()` makes the entire route tree dynamic

**Severity: High** | Skill rule: *Gotchas*

```tsx
const cookieStore = await cookies();
```

The skill explicitly warns: *"`cookies()`, `headers()` make the entire route dynamic. One call in a layout makes ALL child pages dynamic."*

Because this is in `RootLayout`, **every single page** in the application becomes dynamically rendered -- no static generation, no ISR, no caching. This is almost certainly unintentional for a locale preference.

**Fix**: Read the locale via middleware and set it on a header or searchParam that individual pages can opt into, or use `next-intl` / a cookie-free approach (e.g., URL-based locale like `/en/...`). If cookies are truly needed, move the read to the specific layouts/pages that require it.

---

## Summary

| # | Component | Issue | Severity | Skill Section |
|---|-----------|-------|----------|---------------|
| 1 | ThemeProvider | `useEffect([])` is not `componentDidMount` -- causes hydration flicker | High | Gotchas, Hydration & SSR |
| 2 | ThemeProvider | localStorage not read via lazy initializer | Low | Performance Micro-optimizations |
| 3 | NotificationBell | Trivial expressions wrapped in `useMemo` | Medium | Gotchas, State & Rendering |
| 4 | UserProfile | No fetch cleanup -- race condition on userId change | High | State & Rendering |
| 5 | UserProfile | `fetchUser` not in effect deps -- fragile closure | Medium | State & Rendering |
| 6 | UserProfile | Unnecessary `flushSync` defeats auto-batching | Medium | Gotchas |
| 7 | UserProfile | Manual loading state instead of `useTransition` | Low | State & Rendering |
| 8 | RootLayout | `cookies()` in root layout forces all pages dynamic | High | Gotchas |

**High severity: 3** | **Medium severity: 3** | **Low severity: 2**
