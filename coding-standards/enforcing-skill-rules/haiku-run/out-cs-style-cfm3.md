```typescript
// Configuration for health monitoring thresholds.
// Resolved once at boot, injected into operations.
interface HealthConfig {
  // Orders over this % failure rate trigger warning alerts.
  warningFailurePercent: number;
  // Orders over this % failure rate are automatically disabled.
  disableFailurePercent: number;
}

// Domain object: configuration resolved at boot (required fields, no nulls).
interface InstanceConfig {
  health: HealthConfig;
}

// DTO returned from place-order operation.
interface PlacedOrder {
  id: string;
  userId: string;
  total: number;
  itemCount: number;
  createdAt: Date;
}

// Create a placeOrder operation with injected dependencies.
// Caller benefits: next order-related operation sees current state in cache;
// fulfillment backend processes within SLA via urgent channel.
interface PlaceOrderDeps {
  db: DatabaseClient;
  cache: CacheClient;
  mailer: MailerClient;
  config: InstanceConfig;
}

export function createPlaceOrder(deps: PlaceOrderDeps) {
  return async function placeOrder(user: User, order: Order): Promise<PlacedOrder> {
    // Reject invalid inputs before any I/O.
    if (!user?.id) {
      return err({ type: 'INVALID_USER', code: 'ERR_USER_REQUIRED', status: 400, detail: 'User ID missing' });
    }
    if (!order?.id || order.total <= 0 || order.itemCount <= 0) {
      return err({ type: 'INVALID_ORDER', code: 'ERR_ORDER_INVALID', status: 400, detail: 'Order total and item count must be positive' });
    }

    // Check stock availability before committing.
    const stockResult = await withTimeout(
      deps.db.query('SELECT qty FROM stock WHERE id = $1', [order.id]),
      5000
    );
    if (stockResult.err) {
      return err({ type: 'STOCK_CHECK_FAILED', code: 'ERR_STOCK_UNAVAILABLE', status: 500, detail: stockResult.detail });
    }

    // Insert order; seller receives notification via urgent channel if time-sensitive.
    const insertResult = await withTimeout(
      deps.db.query(
        'INSERT INTO orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING id, user_id, total, item_count, created_at',
        [user.id, order.total, order.itemCount]
      ),
      5000
    );
    if (insertResult.err) {
      return err({ type: 'ORDER_INSERT_FAILED', code: 'ERR_INSERT', status: 500, detail: insertResult.detail });
    }

    const createdRow = insertResult.data.rows[0];
    const placed: PlacedOrder = {
      id: createdRow.id,
      userId: createdRow.user_id,
      total: createdRow.total,
      itemCount: createdRow.item_count,
      createdAt: new Date(createdRow.created_at),
    };

    // Warm cache so next user profile read avoids DB hit.
    const cacheSetResult = await withTimeout(
      deps.cache.set(`user:${user.id}:lastOrder`, placed.id),
      2000
    );
    if (cacheSetResult.err) {
      // Cache miss is degradation, not failure; log but do not reject the order.
      console.warn('Cache set failed', { userId: user.id, detail: cacheSetResult.detail });
    }

    // Route to fulfillment: urgent orders skip queue; normal orders batch.
    const template = order.urgent ? 'urgent-order-placed' : 'order-placed';
    const mailResult = await withTimeout(
      deps.mailer.send(user.email, template, { orderId: placed.id }),
      3000
    );
    if (mailResult.err) {
      // Notification failure does not invalidate the order; seller is notified async.
      console.warn('Mailer failed', { userId: user.id, detail: mailResult.detail });
    }

    return ok(placed);
  };
}

// Instantiate at boot; inject config + external dependencies.
// Health config: thresholds define when orders are auto-disabled due to supplier health.
export function getInstanceConfig(): InstanceConfig {
  return {
    health: {
      // Orders exceed warning threshold when supplier failure rate hits 10%;
      // alerts trigger so ops can monitor SLA deterioration.
      warningFailurePercent: 0.1,
      // Orders auto-disabled when supplier failure rate hits 30%;
      // prevent customer harm by redirecting to fallback supplier.
      disableFailurePercent: 0.3,
    },
  };
}
```
