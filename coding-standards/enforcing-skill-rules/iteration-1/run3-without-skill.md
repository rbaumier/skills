# Run 3 — Without Skill (Opus baseline)

```typescript
import { db } from './db';
import { cache } from './cache';
import { mailer } from './mailer';

// --- Result type for error handling without exceptions ---

type Result<T, E = OrderError> = { ok: true; value: T } | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// --- Error types ---

interface OrderError {
  type: 'NOT_FOUND' | 'BLOCKED' | 'INSUFFICIENT_STOCK' | 'EMPTY_ORDER' | 'DB_ERROR';
  detail: string;
}

// --- Domain types ---

interface OrderItem {
  id: string;
  qty: number;
  price: number;
  active: boolean;
}

interface OrderParams {
  userId: string;
  items: OrderItem[];
  taxRate: number;
  discountCode: string;
}

interface UrgentOrderParams extends OrderParams {}
interface NormalOrderParams extends OrderParams {
  confirmationEmail?: string;
}

interface Order {
  id: string;
  user_id: string;
  total: number;
  item_count: number;
  status: 'pending';
  priority: 'high' | 'normal';
}

interface User {
  id: string;
  email: string;
  blocked: boolean;
}

// --- Constants — externalized so business rules are changeable without editing logic ---

const DISCOUNT_AMOUNTS: Record<string, number> = {
  FREE50: 50,
  FREE20: 20,
};

const BIG_ORDER_THRESHOLD_CENTS = 1000;
const BULK_DISCOUNT_MULTIPLIER = 0.9;

// --- Value Object: Money calculation for a single line item ---

/** Compute the net amount for one line item after tax and discount. */
function computeLineItemAmount(
  quantity: number,
  unitPrice: number,
  taxRate: number,
  discountAmount: number,
): number {
  const subtotalWithTax = quantity * unitPrice * (1 + taxRate);
  const netAmount = subtotalWithTax - discountAmount;
  // Negative totals are clamped — a discount larger than the subtotal yields zero, not a credit.
  return Math.max(netAmount, 0);
}

// --- Data access helpers ---

/** Fetch and validate a user, returning a Result instead of throwing. */
async function findVerifiedUser(userId: string): Promise<Result<User>> {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];

  if (!user) {
    return err({ type: 'NOT_FOUND', detail: `User ${userId} not found. Verify the ID is correct.` });
  }

  if (user.blocked) {
    return err({ type: 'BLOCKED', detail: `User ${userId} is blocked. Contact support to resolve account restrictions.` });
  }

  return ok(user);
}

/** Check stock levels for all items in parallel. Returns the first shortage found. */
async function verifyStockAvailability(items: OrderItem[]): Promise<Result<void>> {
  const stockChecks = await Promise.all(
    items.map(async (item) => {
      const result = await db.query('SELECT qty FROM stock WHERE id = $1', [item.id]);
      const availableQuantity = result.rows[0]?.qty ?? 0;

      if (availableQuantity < item.qty) {
        return err({
          type: 'INSUFFICIENT_STOCK' as const,
          detail: `Item ${item.id}: requested ${item.qty}, only ${availableQuantity} available. Reduce quantity or remove the item.`,
        });
      }

      return ok(undefined);
    }),
  );

  const firstShortage = stockChecks.find((check) => !check.ok);
  if (firstShortage && !firstShortage.ok) {
    return firstShortage;
  }

  return ok(undefined);
}

// --- Order totaling ---

/** Filter to purchasable items and compute the order total. */
function computeOrderTotal(
  items: OrderItem[],
  taxRate: number,
  discountCode: string,
): Result<{ activeItems: OrderItem[]; total: number }> {
  const activeItems = items.filter((item) => item.qty > 0 && item.active);

  if (activeItems.length === 0) {
    return err({ type: 'EMPTY_ORDER', detail: 'No active items with positive quantity. Add at least one valid item.' });
  }

  const discountAmount = DISCOUNT_AMOUNTS[discountCode] ?? 0;

  const total = activeItems.reduce(
    (sum, item) => sum + computeLineItemAmount(item.qty, item.price, taxRate, discountAmount),
    0,
  );

  return ok({ activeItems, total });
}

// --- Side effects after order creation ---

/** Flag high-value orders for review — finance team monitors the big_orders table. */
async function flagBigOrder(userId: string, userEmail: string, total: number): Promise<void> {
  await Promise.all([
    mailer.send(userEmail, `Big order: ${total}`),
    db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [userId, total, Date.now()]),
  ]);
}

// --- Public API: two explicit entry points instead of a boolean flag ---

/** Place an urgent order — sets priority to 'high' and notifies the user immediately. */
export async function placeUrgentOrder(params: UrgentOrderParams): Promise<Result<Order>> {
  const userResult = await findVerifiedUser(params.userId);
  if (!userResult.ok) return userResult;
  const user = userResult.value;

  const totalResult = computeOrderTotal(params.items, params.taxRate, params.discountCode);
  if (!totalResult.ok) return totalResult;
  const { activeItems, total } = totalResult.value;

  const stockResult = await verifyStockAvailability(activeItems);
  if (!stockResult.ok) return stockResult;

  if (total > BIG_ORDER_THRESHOLD_CENTS) {
    await flagBigOrder(params.userId, user.email, total);
  }

  const insertResult = await db.query(
    'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [params.userId, total, activeItems.length, 'pending', 'high'],
  );
  const order: Order = insertResult.rows[0];

  // Urgent notification sent after commit — the user needs immediate awareness.
  await mailer.send(user.email, 'Urgent order placed');

  cache.set(`user:${params.userId}:lastOrder`, order.id);

  return ok(order);
}

/** Place a normal-priority order, optionally sending a confirmation email. */
export async function placeNormalOrder(params: NormalOrderParams): Promise<Result<Order>> {
  const userResult = await findVerifiedUser(params.userId);
  if (!userResult.ok) return userResult;
  const user = userResult.value;

  const totalResult = computeOrderTotal(params.items, params.taxRate, params.discountCode);
  if (!totalResult.ok) return totalResult;
  const { activeItems, total } = totalResult.value;

  const stockResult = await verifyStockAvailability(activeItems);
  if (!stockResult.ok) return stockResult;

  if (total > BIG_ORDER_THRESHOLD_CENTS) {
    await flagBigOrder(params.userId, user.email, total);
  }

  const insertResult = await db.query(
    'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [params.userId, total, activeItems.length, 'pending', 'normal'],
  );
  const order: Order = insertResult.rows[0];

  if (params.confirmationEmail) {
    await mailer.send(params.confirmationEmail, 'Order confirmation', JSON.stringify(order));
  }

  cache.set(`user:${params.userId}:lastOrder`, order.id);

  return ok(order);
}

// --- Cart operations ---

/** Remove a single item from the user's cart. Idempotent — succeeds even if the item is already gone. */
export async function removeCartItem(userId: string, itemId: string): Promise<Result<void>> {
  const cart = await db.query('SELECT * FROM carts WHERE user_id = $1', [userId]);

  if (!cart.rows[0]) {
    return err({ type: 'NOT_FOUND', detail: `No cart found for user ${userId}. The cart may have already been cleared.` });
  }

  const cartId = cart.rows[0].id;

  // Delete is idempotent — if the item was already removed, this is a no-op.
  await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [cartId, itemId]);

  return ok(undefined);
}

// --- Formatting: Value Object for document rendering ---

interface DocumentRecipient {
  email: string;
  name: string;
}

interface MoneyAmount {
  value: number;
  currency: string;
}

/** Format an email body for the given recipient and amount. */
function formatEmail(recipient: DocumentRecipient, amount: MoneyAmount): string {
  return `To: ${recipient.email}\nDear ${recipient.name}, your total is ${amount.value} ${amount.currency}`;
}

/** Format a receipt for the given recipient and amount. */
function formatReceipt(recipient: DocumentRecipient, amount: MoneyAmount): string {
  return `Receipt for ${recipient.name}: ${amount.value} ${amount.currency}\nSent to: ${recipient.email}`;
}

/** Format an invoice for the given recipient and amount. */
function formatInvoice(recipient: DocumentRecipient, amount: MoneyAmount): string {
  return `Invoice for ${recipient.name}: ${amount.value} ${amount.currency}\nBilling: ${recipient.email}`;
}

// --- Shipping ---

interface ShippingAddress {
  street: string;
  city: string;
  zip: string;
}

/** Build a one-line shipping label from a structured address. */
function buildShippingLabel(address: ShippingAddress): string {
  return `${address.street}, ${address.city}, ${address.zip}`;
}

// --- Order validation ---

interface ValidatableOrder {
  customerName: string;
  shippingCity: string;
  items: OrderItem[];
  currency: string;
}

/** Validate an order and return a formatted summary string. */
function validateOrderSummary(order: ValidatableOrder): Result<string> {
  if (!order.shippingCity) {
    return err({ type: 'NOT_FOUND', detail: 'Shipping city is required. Add a city to the customer address.' });
  }

  const total = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  if (total <= 0) {
    return err({ type: 'EMPTY_ORDER', detail: 'Order total must be positive. Check item prices and quantities.' });
  }

  const summary = `${order.customerName} - ${total.toFixed(2)} ${order.currency}`;
  return ok(summary);
}

// --- Bulk discount ---

/** Apply a 10% bulk discount to every item in the list. Returns a new array — inputs are not mutated. */
export function applyBulkDiscount(items: OrderItem[]): OrderItem[] {
  return items.map((item) => ({
    ...item,
    price: item.price * BULK_DISCOUNT_MULTIPLIER,
  }));
}
```
