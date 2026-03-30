# SM1: Is it okay to destructure the entire Zustand store?

**No.** With Zustand, always use granular selectors. Never destructure the full store.

```tsx
// BAD - re-renders on ANY store change
const { count, name, items } = useStore();

// GOOD - only re-renders when count changes
const count = useStore(s => s.count);
const name = useStore(s => s.name);
```

When you destructure the full store, your component re-renders every time any field in the store changes, even ones you don't use. Granular selectors ensure components only re-render when the specific data they consume changes.
