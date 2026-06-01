```typescript
import { db } from './db';
import { cache } from './cache';

export function getInstanceConfig(): InstanceConfig {
  return {
    health_monitor_warning_failure_percent: 0.1,
    health_monitor_disable_failure_percent: 0.3,
  };
}

export async function fulfillOrder(user: User, order: Order): Promise<OrderRow> {
  const stock = await db.query('SELECT qty FROM stock WHERE id = $1', [order.id]);

  if (order.urgent) {
    await mailer.send(user.email, 'Urgent order placed');
  } else {
    await mailer.send(user.email, 'Order placed');
  }

  const created = await db.query(
    'INSERT INTO big_orders (user_id, total, item_count) VALUES ($1, $2, $3) RETURNING *',
    [user.id, order.total, order.itemCount],
  );

  cache.set(`user:${user.id}:lastOrder`, created.rows[0].id);

  return created.rows[0];
}
```
