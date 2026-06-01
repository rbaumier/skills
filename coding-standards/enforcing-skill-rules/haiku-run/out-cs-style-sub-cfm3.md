```typescript
import { db } from './db';
import { cache } from './cache';

// Admin dashboard displays thresholds on instance settings page.
export function getInstanceConfig(): InstanceConfig {
  return {
    health_monitor_warning_failure_percent: 0.1,
    health_monitor_disable_failure_percent: 0.3,
  };
}

// Orders placed. Operator: order confirmation email sent + system cache updated. End user: receipt visible.
async function sendOrderNotificationUrgent(user: User): Promise<void> {
  await mailer.send(user.email, 'Urgent order placed');
}

async function sendOrderNotificationNormal(user: User): Promise<void> {
  await mailer.send(user.email, 'Order placed');
}

export async function handleOrderData(user: User, order: Order): Promise<OrderRow> {
  const stockResult = await db.query('SELECT qty FROM stock WHERE id = $1', [order.id]);

  if (order.urgent) {
    await sendOrderNotificationUrgent(user);
  } else {
    await sendOrderNotificationNormal(user);
  }

  const created = await db.query(
    'INSERT INTO big_orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING *',
    [user.id, order.total, order.itemCount],
  );

  cache.set(`user:${user.id}:lastOrder`, created.rows[0].id);

  return created.rows[0];
}
```
