# Run 2 — Without Skill (Sonnet baseline)

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

// --- Constants ---

const BIG_ORDER_THRESHOLD = 1000;

const DISCOUNT_VALUES: Record<string, number> = {
  FREE50: 50,
  FREE20: 20,
};

// --- Core ---

export async function createOrder(params: CreateOrderParams): Promise<Order> {
  const { userId, items, isUrgent, taxRate, discountCode, confirmationEmail } = params;

  const user = await fetchVerifiedUser(userId);
  const { total, itemCount } = await computeOrderTotal(items, taxRate, discountCode);
  const priority: OrderPriority = isUrgent ? 'high' : 'normal';

  const order = await insertOrder(userId, total, itemCount, priority);

  await handlePostOrderSideEffects(order, user, isUrgent, confirmationEmail);

  return order;
}

// --- Helpers ---

async function fetchVerifiedUser(userId: string) {
  const result = await db.query('SELECT id, email, blocked FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];

  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.blocked) throw new Error(`User is blocked: ${userId}`);

  return user as { id: string; email: string; blocked: boolean };
}

async function computeOrderTotal(
  items: OrderItem[],
  taxRate: number,
  discountCode?: string,
): Promise<{ total: number; itemCount: number }> {
  const activeItems = items.filter((item) => item.active && item.qty > 0);

  if (activeItems.length === 0) {
    throw new Error('No valid items in order');
  }

  await Promise.all(activeItems.map((item) => assertStockAvailable(item.id, item.qty)));

  const taxMultiplier = 1 + (taxRate ?? 0);
  const discount = discountCode ? (DISCOUNT_VALUES[discountCode] ?? 0) : 0;

  const subtotal = activeItems.reduce((sum, item) => sum + item.qty * item.price * taxMultiplier, 0);

  const total = Math.max(subtotal - discount, 0);

  return { total, itemCount: activeItems.length };
}

async function assertStockAvailable(itemId: string, requestedQty: number): Promise<void> {
  const result = await db.query('SELECT qty FROM stock WHERE id = $1', [itemId]);
  const available = result.rows[0]?.qty ?? 0;

  if (available < requestedQty) {
    throw new Error(`Insufficient stock for item ${itemId}: requested ${requestedQty}, available ${available}`);
  }
}

async function insertOrder(
  userId: string,
  total: number,
  itemCount: number,
  priority: OrderPriority,
): Promise<Order> {
  const result = await db.query(
    'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, total, itemCount, 'pending', priority],
  );

  return result.rows[0] as Order;
}

async function handlePostOrderSideEffects(
  order: Order,
  user: { id: string; email: string },
  isUrgent: boolean,
  confirmationEmail?: string,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (order.total > BIG_ORDER_THRESHOLD) {
    tasks.push(mailer.send(user.email, `Big order: ${order.total}`));
    tasks.push(
      db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [
        user.id,
        order.total,
        Date.now(),
      ]) as unknown as Promise<void>,
    );
  }

  if (isUrgent) {
    tasks.push(mailer.send(user.email, 'Urgent order placed'));
  }

  if (confirmationEmail) {
    tasks.push(mailer.send(confirmationEmail, 'Order confirmation', JSON.stringify(order)));
  }

  await Promise.all(tasks);

  try {
    cache.set(`user:${user.id}:lastOrder`, order.id);
  } catch {
    // Cache miss is non-critical
  }
}
```
