# Review: `UserActivity` -- Object references in dependency arrays

## Issues found

### 1. `useEffect` depends on `user` object instead of `user.id` (bug)

```typescript
// Problem: re-fetches on every render if `user` object reference changes,
// even when user.id is identical
useEffect(() => {
  fetchActivityLogs(user.id).then(setLogs);
}, [user]);
```

The effect only uses `user.id`, but the dependency array contains the entire `user` object. Since objects are compared by reference, a parent re-render that creates a new `user` object (same contents, new reference) triggers a redundant fetch. This is one of the most common sources of infinite loops and wasted renders.

**Fix:**

```typescript
useEffect(() => {
  fetchActivityLogs(user.id).then(setLogs);
}, [user.id]);
```

### 2. `useMemo` depends on `user` object instead of `user.preferences` (bug)

```typescript
// Problem: recomputes when any user field changes, not just preferences
const summary = useMemo(() => {
  return computeSummary(logs, user.preferences);
}, [logs, user]);
```

The memo uses `logs` and `user.preferences`, but the dep array lists the whole `user` object. This defeats memoization -- `summary` recomputes on every reference change even when `preferences` hasn't changed.

**Fix:**

```typescript
const summary = useMemo(() => {
  return computeSummary(logs, user.preferences);
}, [logs, user.preferences]);
```

Note: if `user.preferences` is itself a non-primitive (object/array), the same reference-identity issue applies one level deeper. If the parent reconstructs `preferences` on each render, consider extracting a stable primitive (e.g., a serialized key or version number) or memoizing `preferences` upstream.

### 3. Missing cleanup / race condition in `useEffect` (secondary)

If `user.id` changes rapidly, earlier fetches may resolve after later ones, overwriting `logs` with stale data.

**Fix:**

```typescript
useEffect(() => {
  let cancelled = false;
  fetchActivityLogs(user.id).then((result) => {
    if (!cancelled) setLogs(result);
  });
  return () => { cancelled = true; };
}, [user.id]);
```

## Corrected component

```typescript
function UserActivity({ user }: { user: User }) {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchActivityLogs(user.id).then((result) => {
      if (!cancelled) setLogs(result);
    });
    return () => { cancelled = true; };
  }, [user.id]);

  const summary = useMemo(() => {
    return computeSummary(logs, user.preferences);
  }, [logs, user.preferences]);

  return <ActivityList logs={logs} summary={summary} />;
}
```

## Skill rules applied

| Rule | Location |
|---|---|
| Use primitive values as effect/memo dependencies | `useEffect` dep `[user]` -> `[user.id]`, `useMemo` dep `[logs, user]` -> `[logs, user.preferences]` |
