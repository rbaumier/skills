# Review: UserDashboard Component

## Issues Found

### 1. Derived state stored in useEffect (Critical - State & Effects)
**Skill rule violated:** "Derive state during render, never in effects"

`filteredUsers` is derived from `users` + `searchTerm`. Storing it via `useEffect` + `setFilteredUsers` causes a wasteful extra render cycle: first render with stale `filteredUsers`, then effect fires, sets state, triggers a second render with correct data. This is the textbook "derived state in useEffect" anti-pattern.

**Fix:** Compute `filteredUsers` with `useMemo` during render.

### 2. Missing event listener cleanup (Critical - State & Effects)
**Skill rule violated:** "Missing cleanup" / "Deduplicate global event listeners"

The resize `useEffect` never removes the event listener. Every mount leaks a listener. On unmount, `setWindowWidth` is called on an unmounted component.

**Fix:** Return a cleanup function.

### 3. `windowWidth` state is unused
**Skill rule violated:** YAGNI / "Don't subscribe to state only used inside callbacks"

`windowWidth` is tracked in state but never read in the render output. This forces a full re-render on every window resize for zero benefit.

**Fix:** Remove entirely. If needed later, add it back.

### 4. `isAdmin` state is set but never toggled
It is initialized to `false` and nothing ever calls `setIsAdmin`. The `isAdmin && <AdminPanel>` branch is dead code, and `isAdmin` is passed to every `UserCard` for nothing.

**Fix:** Remove `isAdmin` state and the dead `AdminPanel` branch, OR accept it as a prop if it should come from outside. Assuming it should be a prop.

### 5. Unnecessary useMemo on trivial expressions (Performance)
**Skill rule violated:** "Don't wrap simple primitive expressions in useMemo"

- `greeting` is a string concatenation -- zero cost, no memoization needed.
- `count` is `.length` -- a property access, not a computation.

**Fix:** Inline both.

### 6. Inline object literal defeats React.memo (Performance)
**Skill rule violated:** "Hoist default non-primitive props outside render"

`DEFAULT_STYLE` is declared inside the component body. Even though it looks constant, it is a new object reference every render, so `React.memo` on `UserCard` never short-circuits on the `style` prop.

**Fix:** Hoist `DEFAULT_STYLE` to module scope.

### 7. Array index used as key (Correctness)
**Skill rule violated:** "Array index as key"

`key={index}` on `UserCard` will cause incorrect reconciliation when the list is sorted or filtered. Items will not unmount/remount correctly.

**Fix:** Use `user.id` as key.

### 8. `sortedUsers` recomputed every render (Performance)
The `.sort()` runs on every render even when neither `filteredUsers` nor `sortDirection` changed.

**Fix:** Wrap in `useMemo`.

### 9. `handleSearch` useCallback with empty deps is fine but `handleSort` is trivially stable
**Skill rule violated:** "useMemo/useCallback for every value is premature optimization. Only memoize when: passing to React.memo'd children, or computation is genuinely expensive."

`handleSort` is not passed to a memoized child -- it goes to a plain `<button>`. The `useCallback` adds overhead for no benefit. Same for `handleSearch` on a plain `<input>`. Remove both.

### 10. Conditional rendering with `&&` (Correctness)
**Skill rule violated:** "Use ternary operator, not && for conditional rendering"

`{isAdmin && <AdminPanel>}` risks rendering `false` or `0` as text if the condition is not strictly boolean. Use ternary.

---

## Refactored Code

```typescript
import { useMemo } from 'react';
import React from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: Date;
  preferences: Record<string, unknown>;
}

// Hoisted outside component -- stable reference, never triggers re-render
const DEFAULT_STYLE: React.CSSProperties = { padding: '16px', border: '1px solid #ccc' };

function UserDashboard({
  users,
  isAdmin = false,
}: {
  users: User[];
  isAdmin?: boolean;
}) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  // Derived during render -- no effect, no extra state, no wasted render cycle
  const sortedUsers = useMemo(() => {
    const filtered = users.filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    return filtered.toSorted((a, b) =>
      sortDirection === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name),
    );
  }, [users, searchTerm, sortDirection]);

  return (
    <div>
      <p>Hello, {searchTerm}</p>
      <p>Count: {sortedUsers.length}</p>
      <input onChange={e => setSearchTerm(e.target.value)} />
      <button onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}>
        Sort
      </button>
      {sortedUsers.map(user => (
        <UserCard key={user.id} user={user} style={DEFAULT_STYLE} isAdmin={isAdmin} />
      ))}
      {isAdmin ? <AdminPanel users={users} /> : null}
    </div>
  );
}

const UserCard = React.memo(
  ({ user, style, isAdmin }: { user: User; style: React.CSSProperties; isAdmin: boolean }) => (
    <div style={style}>
      <p>{user.name}</p>
      {isAdmin ? <button>Edit</button> : null}
    </div>
  ),
);
```

## Summary of Changes

| # | Issue | Fix | Skill Rule |
|---|-------|-----|------------|
| 1 | Derived state in useEffect | `useMemo` during render | Derive state during render, never in effects |
| 2 | Missing resize listener cleanup | Removed entirely (unused) | Missing cleanup / Deduplicate global event listeners |
| 3 | Unused `windowWidth` state | Removed | YAGNI |
| 4 | `isAdmin` never toggled | Moved to prop | Don't subscribe to state only used inside callbacks |
| 5 | Trivial `useMemo` on greeting/count | Inlined | Don't wrap simple primitive expressions in useMemo |
| 6 | Inline object breaks React.memo | Hoisted to module scope | Hoist default non-primitive props outside render |
| 7 | Array index as key | `user.id` | Array index as key |
| 8 | `sortedUsers` recomputed every render | Combined into single `useMemo` with filter | Extract expensive subtrees into memoized components |
| 9 | Unnecessary useCallback | Removed, inlined handlers | useMemo/useCallback only when passing to memo'd children |
| 10 | `&&` conditional rendering | Ternary with `: null` | Use ternary operator, not && |
