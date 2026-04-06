# Run 3 — Without Skill (Sonnet baseline)

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
  sendConfirmationTo?: string;
  taxRate?: number;
  discountCode?: string;
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

const BIG_ORDER_THRESHOLD = 1000;

function getDiscount(code?: string): number {
  if (!code) return 0;
  return DISCOUNT_CODES[code] ?? 0;
}

// --- Domain helpers ---

function computeItemTotal(item: OrderItem, taxRate: number, discount: number): number {
  const subtotal = item.qty * item.price * (1 + taxRate);
  return Math.max(subtotal - discount, 0);
}

async function validateStock(items: OrderItem[]): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      const result = await db.query('SELECT qty FROM stock WHERE id = $1', [item.id]);
      const available = result.rows[0]?.qty ?? 0;
      if (available < item.qty) {
        throw new Error(`Insufficient stock for item ${item.id}: requested ${item.qty}, available ${available}`);
      }
    }),
  );
}

async function fetchUser(userId: string) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  if (!user) throw new Error(`User ${userId} not found`);
  if (user.blocked) throw new Error(`User ${userId} is blocked`);
  return user;
}

async function notifyBigOrder(userId: string, email: string, total: number): Promise<void> {
  await Promise.all([
    mailer.send(email, `Big order: ${total}`),
    db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [userId, total, Date.now()]),
  ]);
}

// --- Main entry point ---

export async function createOrder(params: CreateOrderParams): Promise<Order> {
  const { userId, items, isUrgent, sendConfirmationTo, taxRate = 0, discountCode } = params;

  const user = await fetchUser(userId);

  const activeItems = items.filter((item) => item.qty > 0 && item.active);
  if (activeItems.length === 0) {
    throw new Error('No valid items in order');
  }

  const discount = getDiscount(discountCode);
  let total = 0;
  for (const item of activeItems) {
    total += computeItemTotal(item, taxRate, discount);
  }

  await validateStock(activeItems);

  if (total > BIG_ORDER_THRESHOLD) {
    await notifyBigOrder(userId, user.email, total);
  }

  const priority: OrderPriority = isUrgent ? 'high' : 'normal';
  const result = await db.query(
    'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, total, activeItems.length, 'pending', priority],
  );
  const order: Order = result.rows[0];

  const sideEffects: Promise<unknown>[] = [];

  if (isUrgent) {
    sideEffects.push(mailer.send(user.email, 'Urgent order placed'));
  }
  if (sendConfirmationTo) {
    sideEffects.push(mailer.send(sendConfirmationTo, 'Order confirmation', JSON.stringify(order)));
  }

  await Promise.all(sideEffects);

  cache.set(`user:${userId}:lastOrder`, order.id);

  return order;
}
```
