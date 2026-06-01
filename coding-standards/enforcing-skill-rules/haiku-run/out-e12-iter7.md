```typescript
import type { AbortSignal } from 'abort-signal';
import { db } from './db';
import { cache } from './cache';
import { mailer } from './mailer';

// Configuration thresholds — exposed for admin dashboard
const BIG_ORDER_THRESHOLD = 1000; // Orders exceeding this trip manual review + notification
const HEALTH_WARNING_PERCENT = 0.1;
const HEALTH_DISABLE_PERCENT = 0.3;

export function getInstanceConfig() {
  return {
    health_monitor_warning_failure_percent: HEALTH_WARNING_PERCENT,
    health_monitor_disable_failure_percent: HEALTH_DISABLE_PERCENT,
  };
}

// ─── Types ───

type Discount = { code: string; amount: number };
const DISCOUNT_MAP: Record<string, number> = { 'FREE50': 50, 'FREE20': 20 };

type OrderStatus = 'pending' | 'placed' | 'shipped' | 'delivered' | 'cancelled';

type OrderInput = {
  userId: string;
  items: Array<{ id: string; qty: number; price: number; active: boolean }>;
  taxRate: number;
  discountCode?: string | null;
};

type OrderResult = {
  type: 'success' | 'error';
  code: string;
  status: number;
  detail: string;
  order?: { id: string; userId: string; total: number; itemCount: number; status: OrderStatus };
  cause?: Error;
};

// ─── Core Order Operations ───

/**
 * Creates a complete order: validates inputs, checks inventory, applies pricing,
 * persists to database, triggers notifications, and updates cache.
 * 
 * Returns a Result type — either { type: 'success', order } or { type: 'error', code, status, detail }.
 */
export async function createOrder(
  input: OrderInput,
  options: { signal: AbortSignal; isUrgent: boolean; notifyEmail: string | null }
): Promise<OrderResult> {
  // Validate and reject on invalid inputs — must occur before any I/O.
  const userValidation = await validateAndFetchUser(input.userId, options.signal);
  if (userValidation.type === 'error') {
    return userValidation;
  }
  const user = userValidation.user!;

  // Validate items array is non-empty — required collection.
  if (!input.items || input.items.length === 0) {
    return {
      type: 'error',
      code: 'INVALID_INPUT',
      status: 400,
      detail: 'Order must contain at least one item',
    };
  }

  // Compute order total and validate line items.
  const priceResult = calculateOrderTotal(input.items, input.taxRate, input.discountCode ?? null);
  if (priceResult.type === 'error') {
    return priceResult;
  }
  const { total, itemCount, invalidItems } = priceResult;

  // Stock check — reject before persisting if any item is unavailable.
  const stockResult = await checkInventory(input.items, options.signal);
  if (stockResult.type === 'error') {
    return stockResult;
  }

  // Create the order record.
  const createResult = await persistOrder({
    userId: input.userId,
    total,
    itemCount,
    status: 'pending' as OrderStatus,
    signal: options.signal,
  });
  if (createResult.type === 'error') {
    return createResult;
  }
  const order = createResult.order!;

  // Post-creation side effects: priority assignment, notifications, caching.
  if (options.isUrgent) {
    await setOrderPriority(order.id, 'high', options.signal);
    await sendOrderNotification(user.email, 'Urgent order placed', options.signal);
  } else {
    await setOrderPriority(order.id, 'normal', options.signal);
  }

  // Send confirmation if caller requested explicit email address.
  if (options.notifyEmail) {
    await sendOrderConfirmation(options.notifyEmail, order, options.signal);
  }

  // Big-order handling: alert operations and log for manual review.
  if (total > BIG_ORDER_THRESHOLD) {
    await notifyBigOrder(user.email, total, order.id, options.signal);
    await logBigOrder(input.userId, total, options.signal);
  }

  // Update user's cache so next profile read sees latest order without a DB hit.
  await updateOrderCache(input.userId, order.id);

  return {
    type: 'success',
    code: 'ORDER_CREATED',
    status: 201,
    detail: `Order ${order.id} created`,
    order,
  };
}

// ─── Validators ───

async function validateAndFetchUser(
  userId: string,
  signal: AbortSignal
): Promise<{ type: 'success'; user: { id: string; email: string; blocked: boolean } } | OrderResult> {
  // Required string must be non-blank.
  if (!userId || userId.trim() === '') {
    return {
      type: 'error',
      code: 'INVALID_INPUT',
      status: 400,
      detail: 'userId is required and cannot be blank',
    };
  }

  try {
    const result = await withTimeout(
      db.query('SELECT id, email, blocked FROM users WHERE id = $1', [userId]),
      5000,
      signal
    );
    const user = result.rows[0];
    if (!user) {
      return {
        type: 'error',
        code: 'NOT_FOUND',
        status: 404,
        detail: `User ${userId} not found`,
      };
    }
    if (user.blocked) {
      return {
        type: 'error',
        code: 'USER_BLOCKED',
        status: 403,
        detail: `User ${userId} is blocked and cannot place orders`,
      };
    }
    return { type: 'success', user };
  } catch (cause) {
    return {
      type: 'error',
      code: 'DATABASE_ERROR',
      status: 500,
      detail: 'Failed to fetch user',
      cause: cause instanceof Error ? cause : new Error(String(cause)),
    };
  }
}

function calculateOrderTotal(
  items: Array<{ id: string; qty: number; price: number; active: boolean }>,
  taxRate: number,
  discountCode: string | null
): { type: 'success'; total: number; itemCount: number; invalidItems: string[] } | OrderResult {
  let total = 0;
  let itemCount = 0;
  const invalidItems: string[] = [];

  for (const item of items) {
    // Reject: qty must be positive.
    if (item.qty <= 0) {
      invalidItems.push(`item ${item.id}: qty must be > 0, got ${item.qty}`);
      continue;
    }
    // Reject: price must be non-negative.
    if (item.price < 0) {
      invalidItems.push(`item ${item.id}: price must be >= 0, got ${item.price}`);
      continue;
    }
    // Skip inactive items (silent filter is acceptable for visibility flags).
    if (!item.active) {
      continue;
    }

    // Calculate line total: qty × price × (1 + tax) − discount.
    const lineSubtotal = item.qty * item.price * (1 + (taxRate || 0));
    const discount = discountCode && DISCOUNT_MAP[discountCode] ? DISCOUNT_MAP[discountCode] : 0;
    const lineTotal = lineSubtotal - discount;

    if (lineTotal <= 0) {
      invalidItems.push(`item ${item.id}: line total ${lineTotal} is <= 0 after discount`);
      continue;
    }

    total += lineTotal;
    itemCount++;
  }

  if (itemCount === 0) {
    return {
      type: 'error',
      code: 'NO_VALID_ITEMS',
      status: 400,
      detail: `No valid items in order. Issues: ${invalidItems.join('; ')}`,
    };
  }

  // Invariant check: order total should never be negative.
  if (total <= 0) {
    return {
      type: 'error',
      code: 'INVARIANT_VIOLATION',
      status: 500,
      detail: 'Order total is <= 0 after summing valid line items. This should never happen.',
    };
  }

  return { type: 'success', total, itemCount, invalidItems };
}

async function checkInventory(
  items: Array<{ id: string; qty: number; price: number; active: boolean }>,
  signal: AbortSignal
): Promise<{ type: 'success' } | OrderResult> {
  try {
    // Fetch all stock records in parallel instead of sequentially per item.
    const checks = items.map(item =>
      withTimeout(
        db.query('SELECT qty FROM stock WHERE id = $1', [item.id]),
        3000,
        signal
      ).then(result => ({
        itemId: item.id,
        requiredQty: item.qty,
        availableQty: result.rows[0]?.qty ?? 0,
      }))
    );

    const stockStatuses = await Promise.all(checks);
    const outOfStock = stockStatuses.filter(s => s.availableQty < s.requiredQty);

    if (outOfStock.length > 0) {
      const details = outOfStock
        .map(s => `${s.itemId}: need ${s.requiredQty}, have ${s.availableQty}`)
        .join('; ');
      return {
        type: 'error',
        code: 'OUT_OF_STOCK',
        status: 409,
        detail: `Insufficient inventory: ${details}`,
      };
    }

    return { type: 'success' };
  } catch (cause) {
    return {
      type: 'error',
      code: 'DATABASE_ERROR',
      status: 500,
      detail: 'Failed to check inventory',
      cause: cause instanceof Error ? cause : new Error(String(cause)),
    };
  }
}

async function persistOrder(input: {
  userId: string;
  total: number;
  itemCount: number;
  status: OrderStatus;
  signal: AbortSignal;
}): Promise<{ type: 'success'; order: { id: string; userId: string; total: number; itemCount: number; status: OrderStatus } } | OrderResult> {
  try {
    const result = await withTimeout(
      db.query(
        'INSERT INTO orders (user_id, total, item_count, status) VALUES ($1, $2, $3, $4) RETURNING id, user_id, total, item_count, status',
        [input.userId, input.total, input.itemCount, input.status]
      ),
      5000,
      input.signal
    );
    const row = result.rows[0];
    return {
      type: 'success',
      order: {
        id: row.id,
        userId: row.user_id,
        total: row.total,
        itemCount: row.item_count,
        status: row.status as OrderStatus,
      },
    };
  } catch (cause) {
    return {
      type: 'error',
      code: 'DATABASE_ERROR',
      status: 500,
      detail: 'Failed to create order',
      cause: cause instanceof Error ? cause : new Error(String(cause)),
    };
  }
}

// ─── Side Effects ───

async function setOrderPriority(
  orderId: string,
  priority: 'high' | 'normal',
  signal: AbortSignal
): Promise<void> {
  try {
    await withTimeout(
      db.query('UPDATE orders SET priority = $1 WHERE id = $2', [priority, orderId]),
      3000,
      signal
    );
  } catch (error) {
    // Non-critical: priority setting failure is logged but does not fail the order.
    console.error(`Failed to set priority for order ${orderId}:`, error);
  }
}

async function sendOrderNotification(
  email: string,
  subject: string,
  signal: AbortSignal
): Promise<void> {
  try {
    await withTimeout(
      mailer.send(email, subject),
      5000,
      signal
    );
  } catch (error) {
    // Non-critical: notification failures are logged but do not fail the order.
    console.error(`Failed to send notification to ${email}:`, error);
  }
}

async function sendOrderConfirmation(
  email: string,
  order: { id: string; userId: string; total: number; itemCount: number; status: OrderStatus },
  signal: AbortSignal
): Promise<void> {
  try {
    const message = formatOrderConfirmation(email, order);
    await withTimeout(
      mailer.send(email, 'Order confirmation', message),
      5000,
      signal
    );
  } catch (error) {
    console.error(`Failed to send confirmation to ${email}:`, error);
  }
}

async function notifyBigOrder(
  email: string,
  total: number,
  orderId: string,
  signal: AbortSignal
): Promise<void> {
  try {
    const subject = `Big order alert: $${total}`;
    await withTimeout(
      mailer.send(email, subject),
      5000,
      signal
    );
  } catch (error) {
    console.error(`Failed to notify big order ${orderId}:`, error);
  }
}

async function logBigOrder(
  userId: string,
  total: number,
  signal: AbortSignal
): Promise<void> {
  try {
    await withTimeout(
      db.query(
        'INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)',
        [userId, total, new Date().toISOString()]
      ),
      3000,
      signal
    );
  } catch (error) {
    console.error(`Failed to log big order for user ${userId}:`, error);
  }
}

async function updateOrderCache(userId: string, orderId: string): Promise<void> {
  try {
    cache.set(`user:${userId}:lastOrder`, orderId);
  } catch (error) {
    console.error(`Failed to update cache for user ${userId}:`, error);
  }
}

// ─── Cart Operations ───

/**
 * Removes an item from a user's cart.
 * 
 * Succeeds idempotently: if the item is not in the cart, the postcondition
 * (item not in cart) is already true, so no error is thrown.
 */
export async function removeCartItem(
  userId: string,
  itemId: string,
  signal?: AbortSignal
): Promise<{ type: 'success' } | OrderResult> {
  if (!userId?.trim()) {
    return {
      type: 'error',
      code: 'INVALID_INPUT',
      status: 400,
      detail: 'userId is required',
    };
  }
  if (!itemId?.trim()) {
    return {
      type: 'error',
      code: 'INVALID_INPUT',
      status: 400,
      detail: 'itemId is required',
    };
  }

  try {
    const timeoutSignal = signal || AbortSignal.timeout(5000);
    const result = await withTimeout(
      db.query('SELECT id FROM carts WHERE user_id = $1', [userId]),
      5000,
      timeoutSignal
    );
    const cart = result.rows[0];

    // Idempotent: if cart doesn't exist, postcondition (item not in cart) is met.
    if (!cart) {
      return { type: 'success' };
    }

    // Delete the item. If it's not there, the query succeeds with 0 rows affected.
    await withTimeout(
      db.query('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [cart.id, itemId]),
      5000,
      timeoutSignal
    );

    return { type: 'success' };
  } catch (cause) {
    return {
      type: 'error',
      code: 'DATABASE_ERROR',
      status: 500,
      detail: 'Failed to remove cart item',
      cause: cause instanceof Error ? cause : new Error(String(cause)),
    };
  }
}

// ─── Formatting ───

/**
 * Formats an order confirmation message.
 * 
 * Generates a consistent email template with the recipient, order ID, and total.
 */
function formatOrderConfirmation(
  email: string,
  order: { id: string; total: number }
): string {
  return `To: ${email}\nOrder ${order.id} confirmed.\nTotal: $${order.total.toFixed(2)}`;
}

/**
 * Formats a message using a standard template.
 * 
 * Applies consistent formatting across email/receipt/invoice contexts.
 * Takes the message type (email, receipt, invoice) and renders the same data
 * in the appropriate format.
 */
function formatMessage(
  type: 'email' | 'receipt' | 'invoice',
  to: string,
  name: string,
  amount: number,
  currency: string
): string {
  const formatted = `${name}: ${amount} ${currency}`;
  const contact = `To: ${to}`;

  switch (type) {
    case 'email':
      return `${contact}\nDear ${name}, your total is ${amount} ${currency}`;
    case 'receipt':
      return `Receipt for ${formatted}\nSent to: ${to}`;
    case 'invoice':
      return `Invoice for ${formatted}\nBilling: ${to}`;
  }
}

// ─── Discount Application ───

/**
 * Applies a bulk discount to all items in a list.
 * 
 * Returns a new array with prices reduced by 10%; original array is unchanged.
 */
export function applyBulkDiscount(items: Array<{ price: number; [k: string]: unknown }>): Array<{ price: number; [k: string]: unknown }> {
  return items.map(item => ({
    ...item,
    price: item.price * 0.9,
  }));
}

// ─── Utilities ───

/**
 * Wraps a promise with a timeout.
 * 
 * Rejects with an AbortError if the operation does not complete within the
 * specified milliseconds. Respects an existing AbortSignal if provided.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        combinedSignal.addEventListener('abort', () => {
          reject(new DOMException('Operation timed out', 'AbortError'));
        }, { once: true })
      ),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}
```
