# SM4: Is it okay to call fetch() directly inside my React component?

**No.** Do not put inline fetch calls in components. Isolate API calls in a feature `api/` layer.

```
features/
  users/
    api/
      getUser.ts        # API function lives here
      updateUser.ts
    components/
      UserProfile.tsx   # Component consumes via hook
    hooks/
      useUser.ts        # Hook wraps the API call
```

```tsx
// features/users/api/getUser.ts
export async function getUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

// features/users/hooks/useUser.ts
export function useUser(id: string) {
  return useSuspenseQuery({ queryKey: ['user', id], queryFn: () => getUser(id) });
}
```

This keeps components focused on rendering, makes API calls testable and reusable, and ensures all API responses are typed.
