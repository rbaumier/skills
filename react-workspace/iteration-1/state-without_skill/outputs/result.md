# React Component Review: `UserDashboard`

## Issues Found

### 1. Derived State Stored in `useState` (Critical)

`filteredUsers` is derived from `users` + `searchTerm`. Storing it in state via `useEffect` causes:
- **Extra render cycle**: every change triggers render with stale `filteredUsers`, then the effect runs, calls `setFilteredUsers`, triggering a *second* render with the correct value.
- **Stale UI flash**: between the two renders, users see inconsistent data (e.g., `count` shows old value while `searchTerm` is already updated).

**Fix**: Replace with `useMemo`. Derived data should be computed, not synchronized.

### 2. Memory Leak: Missing Cleanup in Resize Listener

The `resize` event listener is never removed. Every mount leaks a listener (and in StrictMode, two). Eventually causes performance degradation and updates to unmounted components.

**Fix**: Return a cleanup function from `useEffect`.

### 3. Unused State: `isAdmin`

`isAdmin` is declared with `useState(false)` but never set to `true` anywhere. It is dead code that:
- Adds a state slot that never changes.
- Makes `UserCard` receive `isAdmin={false}` permanently, making the `{isAdmin && <button>Edit</button>}` branch unreachable.

**Fix**: Remove it. If admin status is needed, it should come from props or context.

### 4. Object Literal Created Every Render Defeats `React.memo`

`DEFAULT_STYLE` is declared inside the render body. A new object reference is created every render, so `UserCard` (wrapped in `React.memo`) always re-renders because `style` fails referential equality.

**Fix**: Move the constant outside the component.

### 5. `key={index}` on List Items

Using array index as key breaks React's reconciliation when the list is sorted or filtered. Items get wrong DOM reuse, causing visual glitches and stale internal state.

**Fix**: Use `user.id` as key.

### 6. Pointless `useMemo` Wrappers

- `greeting`: string concatenation is trivially cheap. `useMemo` adds overhead (closure + deps comparison) that exceeds the cost of the computation.
- `count`: `.length` is O(1). Wrapping it in `useMemo` is pure noise.

**Fix**: Remove both `useMemo` calls; inline the expressions.

### 7. `sortedUsers` Recomputed Every Render

The sort creates a new array and runs `O(n log n)` comparison on every render, even when neither `filteredUsers` nor `sortDirection` changed. This is the one place `useMemo` would actually help.

**Fix**: Wrap in `useMemo` with `[filteredUsers, sortDirection]` deps.

### 8. SSR Incompatibility

`useState(window.innerWidth)` crashes during SSR because `window` is undefined on the server.

**Fix**: Guard with `typeof window !== 'undefined'` or lazy initializer.

### 9. `greeting` References `searchTerm` (Semantic Bug)

`"Hello, ${searchTerm}"` makes no sense as a greeting. It shows "Hello, " when empty and "Hello, jo" mid-typing. This is almost certainly a bug.

**Fix**: Remove it, or replace with an actual greeting (e.g., from a `currentUser` prop).

### 10. `handleSearch` Unnecessarily Wrapped in `useCallback`

`handleSearch` is passed to a native `<input>`, not a memoized child. `useCallback` adds overhead with zero benefit here.

**Fix**: Remove `useCallback` wrapper.

### 11. Missing `React` Import for `React.memo`

`React.memo` is used but `React` is not imported (only named imports). This will fail in environments without the JSX transform's automatic React import.

---

## Refactored Code

```typescript
import { useState, useEffect, useMemo, useCallback, memo } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: Date;
  preferences: Record<string, unknown>;
}

interface UserDashboardProps {
  users: User[];
  isAdmin?: boolean;
}

const CARD_STYLE: React.CSSProperties = { padding: '16px', border: '1px solid #ccc' };

function UserDashboard({ users, isAdmin = false }: UserDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );

  const sortedUsers = useMemo(() => {
    const filtered = users.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const sorted = filtered.toSorted((a, b) =>
      sortDirection === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name),
    );
    return sorted;
  }, [users, searchTerm, sortDirection]);

  const toggleSort = useCallback(() => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  return (
    <div>
      <p>Count: {sortedUsers.length}</p>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button onClick={toggleSort}>Sort</button>
      {sortedUsers.map((user) => (
        <UserCard key={user.id} user={user} style={CARD_STYLE} isAdmin={isAdmin} />
      ))}
      {isAdmin && <AdminPanel users={users} />}
    </div>
  );
}

const UserCard = memo(function UserCard({
  user,
  style,
  isAdmin,
}: {
  user: User;
  style: React.CSSProperties;
  isAdmin: boolean;
}) {
  return (
    <div style={style}>
      <p>{user.name}</p>
      {isAdmin && <button>Edit</button>}
    </div>
  );
});
```

## Summary of Changes

| # | Issue | Fix |
|---|-------|-----|
| 1 | `filteredUsers` state + sync effect | Replaced with `useMemo` — single render, always consistent |
| 2 | Resize listener leak | Added cleanup return |
| 3 | Dead `isAdmin` state | Moved to prop with default `false` |
| 4 | `DEFAULT_STYLE` inside render | Hoisted to module-level constant |
| 5 | `key={index}` | Changed to `key={user.id}` |
| 6 | Pointless `useMemo` on `greeting`/`count` | Removed; inlined `.length` |
| 7 | `sortedUsers` recomputed every render | Combined filter+sort into single `useMemo` |
| 8 | SSR crash on `window.innerWidth` | Lazy initializer with `typeof` guard |
| 9 | Nonsensical greeting | Removed |
| 10 | Unnecessary `useCallback` on `handleSearch` | Inlined arrow function |
| 11 | `React.memo` without `React` import | Changed to named `memo` import |
