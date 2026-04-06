# Run 1 — Without Skill (Sonnet baseline)

```typescript
import { db } from './db';
import { cache } from './cache';
import { mailer } from './mailer';

// --- Types ---

interface OrderItem {
  id: string;
  qty: number;
  price: number;
  active: boolean;
}

interface CreateOrderParams {
  userId: string;
  items: OrderItem[];
  isUrgent: boolean;
  taxRate: number;
  discountCode?: string;
  confirmationEmail?: string;
}

interface Order {
  id: string;
  user_id: string;
  total: number;
  item_count: number;
  status: OrderStatus;
  priority: OrderPriority;
}

type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'cancelled';
type OrderPriority = 'high' | 'normal';

// --- Discount logic ---

const DISCOUNT_CODES: Record<string, number> = {
  FREE50: 50,
  FREE20: 20,
};

function getDiscount(code?: string): number {
  if (!code) return 0;
  return DISCOUNT_CODES[code] ?? 0;
}

// --- Large order threshold ---

const BIG_ORDER_THRESHOLD = 1000;

// --- Core ---

async function getActiveUser(userId: string) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];

  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.blocked) throw new Error(`User is blocked: ${userId}`);

  return user;
}

async function calculateOrderTotals(
  items: OrderItem[],
  taxRate: number,
  discountCode?: string,
): Promise<{ total: number; itemCount: number }> {
  const discount = getDiscount(discountCode);
  const taxMultiplier = 1 + taxRate;

  const activeItems = items.filter((item) => item.qty > 0 && item.active);

  await Promise.all(
    activeItems.map(async (item) => {
      const stock = await db.query('SELECT qty FROM stock WHERE id = $1', [item.id]);
      const available = stock.rows[0]?.qty ?? 0;

      if (available < item.qty) {
        throw new Error(`Insufficient stock for item ${item.id}: need ${item.qty}, have ${available}`);
      }
    }),
  );

  let total = 0;
  let itemCount = 0;

  for (const item of activeItems) {
    const lineTotal = item.qty * item.price * taxMultiplier - discount;

    if (lineTotal > 0) {
      total += lineTotal;
      itemCount++;
    }
  }

  return { total, itemCount };
}

export async function createOrder(params: CreateOrderParams): Promise<Order> {
  const { userId, items, isUrgent, taxRate, discountCode, confirmationEmail } = params;

  const user = await getActiveUser(userId);

  const { total, itemCount } = await calculateOrderTotals(items, taxRate, discountCode);

  const priority: OrderPriority = isUrgent ? 'high' : 'normal';

  const result = await db.query(
    'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, total, itemCount, 'pending', priority],
  );
  const order: Order = result.rows[0];

  const notifications: Promise<void>[] = [];

  if (total > BIG_ORDER_THRESHOLD) {
    notifications.push(
      mailer.send(user.email, `Large order placed: $${total}`),
      db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [
        userId,
        total,
        Date.now(),
      ]),
    );
  }

  if (isUrgent) {
    notifications.push(mailer.send(user.email, 'Your urgent order has been placed'));
  }

  if (confirmationEmail) {
    notifications.push(
      mailer.send(confirmationEmail, 'Order confirmation', JSON.stringify(order)),
    );
  }

  await Promise.all(notifications);

  cache.set(`user:${userId}:lastOrder`, order.id);

  return order;
}
```
