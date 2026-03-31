# Review: `app/api/dashboard/route.ts`

## Issues Found

### 1. Sequential awaits on independent operations (Critical)
**Skill rule violated**: *Use Promise.all() for independent async operations*

All four DB queries (`user`, `orders`, `recommendations`, `notifications`) are independent but awaited sequentially. This means total latency = sum of all query times instead of max.

### 2. Cache check happens AFTER all the work (Critical)
**Skill rule violated**: *Move await into branches where actually needed, don't block early*

The code fetches all data, then checks the cache. The entire point of caching is to skip the expensive work. The cache check must happen first.

### 3. Analytics blocks the response (High)
**Skill rule violated**: *Use after() for non-blocking post-response work*

`analytics.track` calls are awaited before returning the response. Analytics is fire-and-forget work that should run after the response is sent to the client.

### 4. No authentication guard (High)
**Skill rule violated**: *Authenticate server actions like API routes*

`getSession(req)` is called but there is no check for a missing/invalid session. If `session` is null, `userId` is undefined and every query silently runs with `where: { id: undefined }`.

### 5. No error handling (Medium)
Any DB failure crashes the route with a 500. At minimum, wrap in try/catch and return structured error responses.

---

## Refactored Code

```typescript
// app/api/dashboard/route.ts
import { after } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';
import { analytics } from '@/lib/analytics';

export async function GET(req: Request) {
  // 1. Auth guard
  const session = await getSession(req);
  if (!session?.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId } = session;

  // 2. Check cache FIRST -- skip all work if hit
  const cacheKey = `dashboard:${userId}`;
  const cached = cache.get(cacheKey);
  if (cached) return Response.json(cached);

  // 3. Parallel fetches -- independent operations via Promise.all
  const [user, orders, recommendations, notifications] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.order.findMany({ where: { userId } }),
    getRecommendations(userId),
    db.notification.findMany({ where: { userId, read: false } }),
  ]);

  const result = { user, orders, recommendations, notifications };
  cache.set(cacheKey, result, { ttl: 60 });

  // 4. Defer analytics to after response is sent
  after(() => {
    analytics.track('dashboard_view', { userId });
    analytics.track('active_user', { userId });
  });

  return Response.json(result);
}
```

## Changes Summary

| # | What changed | Skill rule applied |
|---|---|---|
| 1 | Auth guard added before any work | Authenticate server actions like API routes |
| 2 | Cache check moved before DB queries | Move await into branches where actually needed, don't block early |
| 3 | 4 sequential awaits replaced with `Promise.all` | Use Promise.all() for independent async operations |
| 4 | Analytics moved to `after()` callback | Use after() for non-blocking post-response work |
