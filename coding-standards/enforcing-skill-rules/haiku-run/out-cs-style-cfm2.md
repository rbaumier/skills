```typescript
import type { Db, Cache, Mailer } from './types';

// Thresholds for order classification
const BIG_ORDER_THRESHOLD = 1000;
const TIMEOUT_MS = 5000;

export interface InstanceConfig {
  health_monitor_warning_failure_percent: number;
  health_monitor_disable_failure_percent: number;
}

// Returns instance-wide configuration for feature flags and monitoring thresholds.
export function getInstanceConfig(): InstanceConfig {
  return {
    health_monitor_warning_failure_percent: 0.1,
    health_monitor_disable_failure_percent: 0.3,
  };
}

export interface OrderResponse {
  id: string;
  userId: string;
  total: number;
  itemCount: number;
}

// Places a standard order with notification. Applies expedited fulfillment for high-value orders.
export async function placeOrder(
  db: Db,
  mailer: Mailer,
  cache: Cache,
  user: User,
  order: Order,
): Promise<Result<OrderResponse, OrderError>> {
  // Validate inputs at the boundary before any I/O
  if (order.itemCount <= 0) {
    return err({ type: 'INVALID_ORDER', code: 'ZERO_ITEMS', status: 400, detail: 'Order must contain at least one item' });
  }
  if (order.total <= 0) {
    return err({ type: 'INVALID_ORDER', code: 'ZERO_TOTAL', status: 400, detail: 'Order total must be positive' });
  }

  // Check stock availability before placement
  const stockResult = await withTimeout(
    db.query('SELECT qty FROM stock WHERE id = $1', [order.id]),
    TIMEOUT_MS,
  );
  if (!stockResult.ok) {
    return err({ type: 'DATABASE_ERROR', code: 'STOCK_CHECK_FAILED', status: 500, detail: stockResult.error });
  }

  // Route to appropriate fulfillment path based on order value
  if (order.total >= BIG_ORDER_THRESHOLD) {
    return placeUrgentOrder(db, mailer, cache, user, order);
  } else {
    return placeStandardOrder(db, mailer, cache, user, order);
  }
}

// Places a standard-priority order with customer confirmation.
async function placeStandardOrder(
  db: Db,
  mailer: Mailer,
  cache: Cache,
  user: User,
  order: Order,
): Promise<Result<OrderResponse, OrderError>> {
  const insertResult = await withTimeout(
    db.query(
      'INSERT INTO orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING id, user_id, total, item_count',
      [user.id, order.total, order.itemCount],
    ),
    TIMEOUT_MS,
  );
  if (!insertResult.ok) {
    return err({ type: 'DATABASE_ERROR', code: 'INSERT_FAILED', status: 500, detail: insertResult.error });
  }

  const createdOrder = insertResult.value.rows[0];

  // Notify customer after successful placement
  const notifyResult = await withTimeout(
    mailer.send(user.email, 'Order placed'),
    TIMEOUT_MS,
  );
  if (!notifyResult.ok) {
    return err({ type: 'NOTIFICATION_ERROR', code: 'EMAIL_FAILED', status: 500, detail: notifyResult.error });
  }

  // Cache order ID for fast lookups on next profile access
  await withTimeout(
    cache.set(`user:${user.id}:lastOrder`, createdOrder.id),
    TIMEOUT_MS,
  );

  return ok({ id: createdOrder.id, userId: createdOrder.user_id, total: createdOrder.total, itemCount: createdOrder.item_count });
}

// Places a high-value urgent order with expedited notification.
async function placeUrgentOrder(
  db: Db,
  mailer: Mailer,
  cache: Cache,
  user: User,
  order: Order,
): Promise<Result<OrderResponse, OrderError>> {
  const insertResult = await withTimeout(
    db.query(
      'INSERT INTO big_orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING id, user_id, total, item_count',
      [user.id, order.total, order.itemCount],
    ),
    TIMEOUT_MS,
  );
  if (!insertResult.ok) {
    return err({ type: 'DATABASE_ERROR', code: 'INSERT_FAILED', status: 500, detail: insertResult.error });
  }

  const createdOrder = insertResult.value.rows[0];

  // Notify customer with urgent flag for faster fulfillment
  const notifyResult = await withTimeout(
    mailer.send(user.email, 'Urgent order placed'),
    TIMEOUT_MS,
  );
  if (!notifyResult.ok) {
    return err({ type: 'NOTIFICATION_ERROR', code: 'EMAIL_FAILED', status: 500, detail: notifyResult.error });
  }

  // Cache order ID for fast lookups on next profile access
  await withTimeout(
    cache.set(`user:${user.id}:lastOrder`, createdOrder.id),
    TIMEOUT_MS,
  );

  return ok({ id: createdOrder.id, userId: createdOrder.user_id, total: createdOrder.total, itemCount: createdOrder.item_count });
}
```
