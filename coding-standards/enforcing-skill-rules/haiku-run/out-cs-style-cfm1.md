```typescript
import { db } from './db';
import { cache } from './cache';

// Threshold (0-1) that triggers warning alerts when failure rate exceeds it.
const HEALTH_MONITOR_WARNING_THRESHOLD = 0.1;

// Threshold (0-1) that triggers service disablement when failure rate exceeds it.
const HEALTH_MONITOR_DISABLE_THRESHOLD = 0.3;

/**
 * Resolves instance health monitoring configuration.
 * Returns thresholds used by the monitoring agent to determine when to emit alerts or disable service.
 */
export function resolveHealthConfig(): InstanceConfig {
  return {
    healthMonitorWarningFailurePercent: HEALTH_MONITOR_WARNING_THRESHOLD,
    healthMonitorDisableFailurePercent: HEALTH_MONITOR_DISABLE_THRESHOLD,
  };
}

/**
 * Places an order: validates stock, persists to the database, sends confirmation to user, and caches the result.
 * Returns the inserted order row from the database.
 */
export async function placeOrder(user: User, order: Order): Promise<OrderRow> {
  // Validate input at boundary before any I/O.
  if (!order.itemCount || order.itemCount <= 0) {
    return Result.err({ type: 'INVALID_INPUT', code: 'ITEM_COUNT_REQUIRED', status: 400, detail: 'Order must contain at least one item' });
  }
  if (!order.total || order.total <= 0) {
    return Result.err({ type: 'INVALID_INPUT', code: 'TOTAL_REQUIRED', status: 400, detail: 'Order total must be greater than zero' });
  }

  // Check stock with timeout to prevent hanging.
  const stockCheckResult = await withTimeout(
    db.query('SELECT qty FROM stock WHERE id = $1', [order.id]),
    5000
  );
  if (stockCheckResult.isErr()) {
    return stockCheckResult;
  }
  const stock = stockCheckResult.value;
  if (!stock || stock.qty < order.itemCount) {
    return Result.err({ type: 'OUT_OF_STOCK', code: 'INSUFFICIENT_STOCK', status: 409, detail: `Only ${stock?.qty ?? 0} items available` });
  }

  // Send confirmation; route depends on urgency.
  const confirmationSubject = order.isUrgent ? 'Urgent order placed' : 'Order placed';
  const notifyResult = await withTimeout(
    mailer.send(user.email, confirmationSubject),
    10000
  );
  if (notifyResult.isErr()) {
    return notifyResult;
  }

  // Insert order row with timeout.
  const insertResult = await withTimeout(
    db.query(
      'INSERT INTO orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING *',
      [user.id, order.total, order.itemCount]
    ),
    5000
  );
  if (insertResult.isErr()) {
    return insertResult;
  }
  const createdRow = insertResult.value.rows[0];

  // Cache the result for next read to avoid DB hit.
  await withTimeout(
    cache.set(`user:${user.id}:lastOrder`, createdRow.id),
    3000
  );

  return Result.ok(createdRow);
}
```
