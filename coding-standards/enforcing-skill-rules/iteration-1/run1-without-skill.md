# Run 1 — Without Skill (Opus baseline)

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

interface Address {
  street: string;
  city: string;
  zip: string;
}

interface Customer {
  name: string;
  address: Address;
}

interface OrderData {
  customer: Customer;
  items: OrderItem[];
  currency: string;
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

// --- Constants ---

const BIG_ORDER_THRESHOLD = 1000;
const BULK_DISCOUNT_RATE = 0.9;

// --- User ---

async function getActiveUser(userId: string) {
  const result = await db.query('SELECT id, email, blocked FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.blocked) throw new Error(`User is blocked: ${userId}`);
  return user;
}

// --- Stock validation ---

async function validateStock(items: OrderItem[]): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      const result = await db.query('SELECT qty FROM stock WHERE id = $1', [item.id]);
      const available = result.rows[0]?.qty ?? 0;
      if (available < item.qty) {
        throw new Error(`Insufficient stock for item ${item.id}: need ${item.qty}, have ${available}`);
      }
    }),
  );
}

// --- Order totals ---

function computeOrderTotals(
  items: OrderItem[],
  taxRate: number,
  discountCode?: string,
): { total: number; itemCount: number } {
  const discount = getDiscount(discountCode);
  const taxMultiplier = 1 + taxRate;

  let total = 0;
  let itemCount = 0;

  for (const item of items) {
    const lineTotal = item.qty * item.price * taxMultiplier - discount;
    if (lineTotal > 0) {
      total += lineTotal;
      itemCount++;
    }
  }

  return { total, itemCount };
}

// --- Core: create order ---

export async function createOrder(params: CreateOrderParams): Promise<Order> {
  const { userId, items, isUrgent, taxRate, discountCode, confirmationEmail } = params;

  const user = await getActiveUser(userId);

  const activeItems = items.filter((item) => item.qty > 0 && item.active);
  await validateStock(activeItems);

  const { total, itemCount } = computeOrderTotals(activeItems, taxRate, discountCode);
  const priority: OrderPriority = isUrgent ? 'high' : 'normal';

  const result = await db.query(
    'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, total, itemCount, 'pending', priority],
  );
  const order: Order = result.rows[0];

  // Fire side-effect notifications concurrently
  const notifications: Promise<unknown>[] = [];

  if (total > BIG_ORDER_THRESHOLD) {
    notifications.push(mailer.send(user.email, `Large order placed: $${total}`));
    notifications.push(
      db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [
        userId, total, Date.now(),
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

// --- Cart ---

export async function removeCartItem(userId: string, itemId: string): Promise<void> {
  const cart = await db.query('SELECT id, items FROM carts WHERE user_id = $1', [userId]);
  if (!cart.rows[0]) throw new Error(`Cart not found for user: ${userId}`);

  const hasItem = cart.rows[0].items.some((item: { id: string }) => item.id === itemId);
  if (!hasItem) throw new Error(`Item ${itemId} not in cart`);

  await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [cart.rows[0].id, itemId]);
}

// --- Formatting (unified) ---

type DocumentKind = 'email' | 'receipt' | 'invoice';

function formatDocument(kind: DocumentKind, to: string, name: string, amount: number, currency: string): string {
  const amountStr = `${amount} ${currency}`;
  switch (kind) {
    case 'email':
      return `To: ${to}\nDear ${name}, your total is ${amountStr}`;
    case 'receipt':
      return `Receipt for ${name}: ${amountStr}\nSent to: ${to}`;
    case 'invoice':
      return `Invoice for ${name}: ${amountStr}\nBilling: ${to}`;
  }
}

// --- Shipping ---

function getShippingLabel(order: OrderData): string {
  const { street, city, zip } = order.customer.address;
  return `${street}, ${city}, ${zip}`;
}

// --- Validation ---

function validateOrder(order: OrderData): string {
  if (!order.customer.address.city) throw new Error('Missing city');

  const total = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (total <= 0) throw new Error('Invalid total');

  return `${order.customer.name} - ${total.toFixed(2)} ${order.currency}`;
}

// --- Bulk discount ---

export function applyBulkDiscount(items: OrderItem[]): OrderItem[] {
  return items.map((item) => ({ ...item, price: item.price * BULK_DISCOUNT_RATE }));
}
```
