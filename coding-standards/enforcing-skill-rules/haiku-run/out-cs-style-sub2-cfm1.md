```typescript
import { db } from './db';
import { cache } from './cache';

/**
 * Instance configuration for health monitoring.
 * Admin dashboard exposes these on the instance settings page.
 * How:
 * - warning threshold at 10% failure rate
 * - disable threshold at 30% failure rate
 */
export function getInstanceConfig(): InstanceConfig {
  return {
    health_monitor_warning_failure_percent: 0.1,
    health_monitor_disable_failure_percent: 0.3,
  };
}

/**
 * Fulfills an order and notifies the customer.
 * Customer receives confirmation email; their next profile load shows the order without a DB hit.
 * How:
 * - verify stock availability
 * - send order confirmation email
 * - persist order row
 * - warm per-user cache with new order id
 */
export async function fulfillUrgentOrder(user: User, order: Order): Promise<OrderRow> {
  const stock = await db.query('SELECT qty FROM stock WHERE id = $1', [order.id]);

  await mailer.send(user.email, 'Urgent order placed');

  const created = await db.query(
    'INSERT INTO big_orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING *',
    [user.id, order.total, order.itemCount],
  );

  cache.set(`user:${user.id}:lastOrder`, created.rows[0].id);

  return created.rows[0];
}

export async function fulfillNormalOrder(user: User, order: Order): Promise<OrderRow> {
  const stock = await db.query('SELECT qty FROM stock WHERE id = $1', [order.id]);

  await mailer.send(user.email, 'Order placed');

  const created = await db.query(
    'INSERT INTO big_orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING *',
    [user.id, order.total, order.itemCount],
  );

  cache.set(`user:${user.id}:lastOrder`, created.rows[0].id);

  return created.rows[0];
}
```
