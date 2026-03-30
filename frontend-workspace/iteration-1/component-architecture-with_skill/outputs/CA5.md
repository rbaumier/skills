# CA5: What order should I structure the internals of a React component file?

Follow this specific order:

1. **Types** — interfaces, type aliases
2. **Hooks** — useState, useReducer, custom hooks
3. **useMemo** — memoized computations
4. **useCallback** — memoized callbacks
5. **Render** — JSX return
6. **Default export** — `export default ComponentName`

```tsx
// 1. Types
interface DashboardProps {
  userId: string;
}

// Component
function Dashboard({ userId }: DashboardProps) {
  // 2. Hooks
  const [data, setData] = useState<Data | null>(null);
  const theme = useTheme();

  // 3. useMemo
  const sortedItems = useMemo(() => data?.items.sort(byDate), [data]);

  // 4. useCallback
  const handleRefresh = useCallback(() => { /* ... */ }, []);

  // 5. Render
  return <div>{/* ... */}</div>;
}

// 6. Default export
export default Dashboard;
```
