# SM1: Is it okay to destructure the entire Zustand store?

You can destructure the Zustand store, but be aware it may cause unnecessary re-renders. For better performance, you can use selectors:

```tsx
const count = useStore((state) => state.count);
```

This way the component only re-renders when `count` changes. For small stores, destructuring everything is usually fine.
