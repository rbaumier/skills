# Refactored: Start Promises Early, Await Late

## Rule applied

**Start promises early, await late** — declare all promises BEFORE awaiting any. The three DB queries (`user`, `orders`, `prefs`) are independent once `session` is resolved, so they should run concurrently.

## Before

```typescript
export async function GET(req: Request) {
  const session = await getSession(req);
  const user = await db.user.findUnique({ where: { id: session.userId } });
  const orders = await db.order.findMany({ where: { userId: session.userId } });
  const prefs = await db.preferences.findFirst({ where: { userId: session.userId } });
  return Response.json({ user, orders, prefs });
}
```

**Problem**: Each query waits for the previous one to finish. If each takes 100ms, total is ~300ms of sequential I/O.

## After

```typescript
export async function GET(req: Request) {
  const session = await getSession(req);

  // Start all independent queries immediately (I/O begins now)
  const pUser = db.user.findUnique({ where: { id: session.userId } });
  const pOrders = db.order.findMany({ where: { userId: session.userId } });
  const pPrefs = db.preferences.findFirst({ where: { userId: session.userId } });

  // Await all together — total time = max(individual times), not sum
  const [user, orders, prefs] = await Promise.all([pUser, pOrders, pPrefs]);

  return Response.json({ user, orders, prefs });
}
```

## Why this matters

- **Before**: ~300ms (100 + 100 + 100, sequential)
- **After**: ~100ms (all three run concurrently, total = slowest query)

The `session` must be awaited first because the other queries depend on `session.userId`. But the three DB calls are independent of each other, so they can fire in parallel.
