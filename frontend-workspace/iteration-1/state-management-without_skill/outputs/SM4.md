# SM4: Is it okay to call fetch() directly inside my React component?

You can, but it's generally better to abstract your API calls into separate functions or a service layer. This makes them easier to test and reuse:

```tsx
// api.ts
export async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// Component
function UserProfile({ id }) {
  useEffect(() => {
    getUser(id).then(setUser);
  }, [id]);
}
```

Using a library like TanStack Query or SWR is even better as they handle caching, refetching, and error states.
