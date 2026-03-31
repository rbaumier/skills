# React Skill Review: UserDashboard Component

## Issues Found (mapped to SKILL.md rules)

### 1. Derived state in useEffect (State & Rendering)
> "Derive state during render, never in effects"

`filteredUsers` is derived from `users` + `searchTerm` but stored as separate state updated via `useEffect`. This causes an unnecessary extra render cycle on every keystroke: state changes -> render with stale `filteredUsers` -> effect fires -> `setFilteredUsers` -> second render with correct data.

**Fix**: Compute `filteredUsers` with `useMemo` during render (the filtering is a genuine O(n) computation worth memoizing if the list is large).

### 2. Missing event listener cleanup (State & Rendering)
> "Put interaction logic in event handlers, not effects" / cleanup responsibilities

The resize `useEffect` never returns a cleanup function. Every re-mount leaks an event listener. This is a memory leak bug.

**Fix**: Return `() => window.removeEventListener('resize', handler)`.

### 3. Unnecessary useMemo on trivial expressions (State & Rendering)
> "Don't wrap simple primitive expressions in useMemo"

- `greeting` is a simple string template -- zero computation cost.
- `count` is a `.length` property access -- O(1).

Neither justifies `useMemo` overhead.

**Fix**: Inline both as plain expressions.

### 4. Unnecessary useCallback with no memo'd consumer (State & Rendering)
> "useMemo/useCallback for every value is premature optimization. Only memoize when: passing to React.memo'd children, or computation is genuinely expensive"

- `handleSort` is passed to a plain `<button>` -- not a `React.memo` component.
- `handleSearch` is passed to a plain `<input>` -- same.

Neither benefits from `useCallback`.

**Fix**: Remove `useCallback` wrappers; use inline handlers or plain functions.

### 5. useState with browser API crashes SSR (State & Rendering)
> "Pass initializer function to useState for expensive or SSR-unsafe defaults -- `useState(window.innerWidth)` crashes in SSR"

`useState(window.innerWidth)` evaluates `window.innerWidth` eagerly on every render and crashes in SSR.

**Fix**: Use lazy initializer `useState(() => window.innerWidth)`. Or better: question whether `windowWidth` is needed at all (it is set but never read in the JSX). If unused, remove it entirely.

### 6. Object/style literal created inside render (State & Rendering)
> "Hoist default non-primitive props outside render (objects, arrays, styles)"

`DEFAULT_STYLE` is declared inside the component body. While `const`, it is re-created every render, breaking `React.memo` on `UserCard` because the `style` prop is a new object reference each time.

**Fix**: Hoist `DEFAULT_STYLE` to module scope.

### 7. Array index as key (Correctness)
> "array index as key" is flagged as a diagnostic issue

`key={index}` on `UserCard` will cause incorrect DOM reuse when the list is sorted/filtered. Users have a stable `id` field.

**Fix**: Use `key={user.id}`.

### 8. Unused state: isAdmin (Dead Code)
`isAdmin` is initialized to `false` and never set to `true` anywhere. It should either come from props/context or be removed. As-is, the `AdminPanel` is unreachable and `UserCard` always receives `isAdmin={false}`.

**Fix**: Accept `isAdmin` as a prop or from an auth context. For this refactor, assume it comes as a prop.

### 9. Unused state: windowWidth (Dead Code)
`windowWidth` is written but never read in the render output. The resize listener + state is pure waste.

**Fix**: Remove entirely. If needed later, extract to a `useWindowWidth()` hook with proper cleanup.

### 10. React.memo defeated by unstable props (Performance)
`UserCard` is wrapped in `React.memo`, but receives `style={DEFAULT_STYLE}` (new object each render) and `isAdmin` (constant `false`). The memo is defeated by the style reference. After hoisting the style, `React.memo` becomes effective.

---

## Refactored Code

```typescript
import { useMemo } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: Date;
  preferences: Record<string, unknown>;
}

// Hoisted outside render -- stable reference for React.memo
const USER_CARD_STYLE: React.CSSProperties = {
  padding: '16px',
  border: '1px solid #ccc',
};

interface UserDashboardProps {
  users: User[];
  isAdmin: boolean;
}

function UserDashboard({ users, isAdmin }: UserDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Derived during render -- no useEffect, no extra state
  const sortedUsers = useMemo(() => {
    const filtered = users.filter((u) =>
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
      <input onChange={(e) => setSearchTerm(e.target.value)} />
      <button onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}>
        Sort
      </button>
      {sortedUsers.map((user) => (
        <UserCard key={user.id} user={user} style={USER_CARD_STYLE} isAdmin={isAdmin} />
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

| # | What changed | Skill rule applied |
|---|---|---|
| 1 | Removed `filteredUsers` state + useEffect; derived via `useMemo` during render | Derive state during render, never in effects |
| 2 | Removed resize listener entirely (unused `windowWidth`) | Dead code removal; SSR-unsafe useState |
| 3 | Removed `useMemo` on `greeting` and `count` | Don't wrap simple primitive expressions in useMemo |
| 4 | Removed `useCallback` on `handleSort` and `handleSearch` | Only memoize when passing to React.memo'd children |
| 5 | Hoisted `DEFAULT_STYLE` to module-level `USER_CARD_STYLE` | Hoist default non-primitive props outside render |
| 6 | Changed `key={index}` to `key={user.id}` | Array index as key causes incorrect DOM reuse |
| 7 | Moved `isAdmin` from internal state to prop | Dead code -- was always `false`, never settable |
| 8 | Used `toSorted()` for immutable sort | Use toSorted()/toReversed() for immutable array transforms |
| 9 | Changed `&&` to ternary for conditional rendering | Use ternary operator, not && for conditional rendering |
| 10 | Combined filter + sort into single `useMemo` | Eliminated intermediate state and extra render cycle |

**State reduction**: 5 `useState` calls reduced to 2. Two `useEffect` calls reduced to 0. Two `useMemo` and two `useCallback` calls replaced by one `useMemo` that does real work.
