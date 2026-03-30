# PS2: Should I put all my TypeScript types in a global types/ folder?

**No.** Types should be colocated with their feature, not dumped in a global `types/` folder.

```
// BAD - global types dump
src/
  types/
    user.ts        # who uses this? auth? profile? dashboard?
    order.ts
    product.ts

// GOOD - colocated with feature
src/
  features/
    auth/
      types/
        index.ts   # AuthUser, LoginPayload, AuthState
    orders/
      types/
        index.ts   # Order, OrderItem, OrderStatus
```

Colocated types make it clear which feature owns them, are easier to find, and get deleted when the feature is removed. A global types folder becomes a dumping ground with unclear ownership and stale types that nobody dares delete.
