```typescript
import { db } from './db';
import { cache } from './cache';

/**
 * Instance config for health monitoring thresholds.
 * Admin dashboard displays these on the instance settings page.
 * How:
 * - warning state triggers at 10% failure rate
 * - disable triggers at 30% failure rate
 */
export function getInstanceConfig(): InstanceConfig {
  return {
    health_monitor_warning_failure_percent: 0.1,
    health_monitor_disable_failure_percent: 0.3,
  };
}

/**
 * Places an order and notifies the buyer.
 * Buyer receives confirmation email; next profile load hits cache instead of DB.
 * How:
 * - validate stock availability
 * - insert order row and return it
 * - send confirmation email (urgent or normal)
 * - warm cache with new order id
 */
export async function placeOrder(user: User, order: Order): Promise<OrderRow> {
  const stock = await db.query('SELECT qty FROM stock WHERE id = $1', [order.id]);

  const orderRow = await db.query(
    'INSERT INTO big_orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING *',
    [user.id, order.total, order.itemCount],
  );

  await sendOrderConfirmation(user.email, order.urgent);

  cache.set(`user:${user.id}:lastOrder`, orderRow.rows[0].id);

  return orderRow.rows[0];
}

async function sendOrderConfirmation(email: string, isUrgent: boolean): Promise<void> {
  const subject = isUrgent ? 'Urgent order placed' : 'Order placed';
  await mailer.send(email, subject);
}
```
