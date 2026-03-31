# Code Review: `app/api/dashboard/route.ts`

## Critical Issues

### 1. Cache check AFTER all DB queries (severity: critical)

The cache lookup happens **after** all four database queries and the recommendations call have already executed. This completely defeats the purpose of caching -- every request pays the full cost regardless of cache state.

```typescript
// Current: queries run FIRST, cache checked AFTER
const user = await db.user.findUnique(...);
const orders = await db.order.findMany(...);
const recommendations = await getRecommendations(userId);
const notifications = await db.notification.findMany(...);
// ... then checks cache (too late)
```

### 2. Sequential awaits (severity: high)

Four independent async operations are awaited one after another. Each blocks the next. If each takes 50ms, that is 200ms total instead of ~50ms with `Promise.all`.

### 3. Analytics blocks the response (severity: high)

Two `analytics.track` calls are awaited sequentially before the response is sent. Analytics should never be in the critical path -- these are fire-and-forget operations.

### 4. No session/auth validation (severity: high)

No null check on `session` or `userId`. If `getSession` returns `null`, the code will throw an unhandled error or worse, query the database with `undefined`.

### 5. Two separate analytics calls (severity: low)

`dashboard_view` and `active_user` could be a single call or at minimum parallelized, but they should not block the response at all.

### 6. Missing `getSession` import (severity: low)

`getSession` is used but not imported.

---

## Refactored Code

```typescript
// app/api/dashboard/route.ts
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { analytics } from "@/lib/analytics";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession(req);

  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = session;

  // 1. Check cache FIRST -- skip all DB work on hit
  const cacheKey = `dashboard:${userId}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    // Fire analytics in the background, don't block the response
    trackAnalytics(userId);
    return Response.json(cached);
  }

  // 2. Parallelize all independent queries
  const [user, orders, recommendations, notifications] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.order.findMany({ where: { userId } }),
    getRecommendations(userId),
    db.notification.findMany({ where: { userId, read: false } }),
  ]);

  const result = { user, orders, recommendations, notifications };

  // 3. Cache the result
  cache.set(cacheKey, result, { ttl: 60 });

  // 4. Fire-and-forget analytics (non-blocking)
  trackAnalytics(userId);

  return Response.json(result);
}

function trackAnalytics(userId: string) {
  // Intentionally not awaited -- analytics must never block the response.
  // Errors are caught to prevent unhandled rejections.
  Promise.all([
    analytics.track("dashboard_view", { userId }),
    analytics.track("active_user", { userId }),
  ]).catch(() => {
    // Analytics failure is non-critical; swallow silently.
  });
}
```

---

## Summary of Changes

| Change | Impact |
|---|---|
| Cache check moved before DB queries | Eliminates all DB/network cost on cache hit |
| `Promise.all` for 4 independent queries | ~4x latency reduction on cache miss |
| Analytics made fire-and-forget | Removes 2 sequential awaits from critical path |
| Auth guard with 401 response | Prevents undefined userId from reaching DB |
| `getSession` import added | Fixes missing dependency |
| Analytics extracted to helper | Single responsibility, reusable, error-isolated |

### Estimated latency improvement

Assuming 50ms per DB call, 100ms for recommendations, 20ms per analytics call:

- **Before**: 50 + 50 + 100 + 50 + 20 + 20 = **290ms** (even on cache hit)
- **After (cache hit)**: **~0ms** (memory lookup only)
- **After (cache miss)**: **~100ms** (bounded by slowest parallel query)
