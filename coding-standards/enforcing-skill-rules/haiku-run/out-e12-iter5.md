```typescript
import { db } from './db';
import { cache } from './cache';
import { mailer } from './mailer';

// Instance thresholds for health monitoring—triggers manual review at 10%, auto-disables at 30%
const HEALTH_MONITOR_WARNING_THRESHOLD = 0.1;
const HEALTH_MONITOR_DISABLE_THRESHOLD = 0.3;

// Orders exceeding this amount trigger fraud review
const HIGH_VALUE_ORDER_THRESHOLD = 1000;

// Discount code amounts (use dedicated constants, not scattered magic numbers)
const DISCOUNT_CODES: Record<string, number> = {
  'FREE50': 50,
  'FREE20': 20,
};

/**
 * Fetch active instance configuration thresholds.
 * Used by admin dashboard settings page to display current health monitoring boundaries.
 * Returns: object with warning and disable failure percentage thresholds.
 */
export function getInstanceConfig() {
  return {
    health_monitor_warning_failure_percent: HEALTH_MONITOR_WARNING_THRESHOLD,
    health_monitor_disable_failure_percent: HEALTH_MONITOR_DISABLE_THRESHOLD,
  };
}

// ============ Order placement—main workflow ============

type OrderInput = {
  userId: string;
  items: CartItem[];
  isUrgent: boolean;
  shouldSendConfirmation: boolean;
  confirmationEmail: string;
  taxRate: number;
  discountCode: string;
};

type CartItem = {
  id: string;
  qty: number;
  price: number;
  active: boolean;
};

type User = {
  id: string;
  email: string;
  blocked: boolean;
};

type OrderRow = {
  id: string;
  user_id: string;
  total: number;
  item_count: number;
  status: 'pending' | 'high' | 'normal';
  priority: 'high' | 'normal';
};

/**
 * Place an order: validate cart, check stock, calculate total (with tax & discount),
 * create order, set priority, and email confirmation.
 *
 * - Fetches user; rejects if blocked
 * - Validates each item: qty > 0, active status, stock available
 * - Applies tax rate and discount code
 * - Records high-value orders (>$1000) for fraud review
 * - Sends confirmation if requested
 * - Returns order record with computed priority
 */
export async function placeOrder(input: OrderInput): Promise<OrderRow | { type: 'USER_NOT_FOUND' | 'USER_BLOCKED' | 'INSUFFICIENT_STOCK' | 'INVALID_CART' | 'INVARIANT_VIOLATION'; code: string; status: number; detail: string }> {
  // Boundary validation: reject invalid inputs before I/O
  if (!input.userId) return { type: 'INVALID_CART', code: 'MISSING_USER_ID', status: 400, detail: 'User ID required' };
  if (!input.items || input.items.length === 0) return { type: 'INVALID_CART', code: 'EMPTY_CART', status: 400, detail: 'Cart cannot be empty' };
  if (input.taxRate < 0 || input.taxRate > 1) return { type: 'INVALID_CART', code: 'INVALID_TAX_RATE', status: 400, detail: 'Tax rate must be 0–1' };

  // Fetch user with timeout
  let userResult;
  try {
    userResult = await Promise.race([
      db.query('SELECT * FROM users WHERE id = $1', [input.userId]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } catch (cause) {
    return { type: 'USER_NOT_FOUND', code: 'DB_TIMEOUT', status: 503, detail: 'User lookup timeout', cause };
  }

  const user = userResult.rows[0] as User | undefined;
  if (!user) {
    return { type: 'USER_NOT_FOUND', code: 'USER_ID_INVALID', status: 404, detail: `User ${input.userId} not found` };
  }

  // Blocked users cannot transact—reject before any further I/O
  if (user.blocked) {
    return { type: 'USER_BLOCKED', code: 'ACCOUNT_BLOCKED', status: 403, detail: 'Your account is blocked' };
  }

  // Validate and price each cart item in parallel
  const itemResults = await Promise.all(
    input.items.map(async (item) => {
      // Reject invalid item data immediately
      if (item.qty <= 0) {
        return { type: 'INVALID_CART' as const, code: 'INVALID_QTY', status: 400, detail: `Item ${item.id}: quantity must be > 0` };
      }
      if (!item.active) {
        return { type: 'INVALID_CART' as const, code: 'ITEM_INACTIVE', status: 400, detail: `Item ${item.id} is no longer available` };
      }
      if (item.price < 0) {
        return { type: 'INVALID_CART' as const, code: 'INVALID_PRICE', status: 400, detail: `Item ${item.id}: price cannot be negative` };
      }

      // Check stock with timeout
      let stockResult;
      try {
        stockResult = await Promise.race([
          db.query('SELECT qty FROM stock WHERE id = $1', [item.id]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]);
      } catch (cause) {
        return { type: 'INSUFFICIENT_STOCK' as const, code: 'STOCK_CHECK_TIMEOUT', status: 503, detail: `Stock check timeout for item ${item.id}`, cause };
      }

      const availableStock = stockResult.rows[0]?.qty ?? 0;
      if (availableStock < item.qty) {
        return { type: 'INSUFFICIENT_STOCK' as const, code: 'OUT_OF_STOCK', status: 409, detail: `Item ${item.id}: only ${availableStock} available` };
      }

      // Compute item total: price × qty, apply tax, apply discount
      const subtotal = item.price * item.qty;
      const taxed = subtotal * (1 + input.taxRate);
      const discount = DISCOUNT_CODES[input.discountCode] ?? 0;
      const itemTotal = Math.max(0, taxed - discount);

      return { type: 'OK' as const, id: item.id, total: itemTotal };
    }),
  );

  // Abort if any item validation failed
  const firstError = itemResults.find((r): r is any => r.type !== 'OK');
  if (firstError) {
    return firstError;
  }

  // Sum totals (all items are OK at this point)
  const itemTotals = itemResults.filter((r): r is { type: 'OK'; id: string; total: number } => r.type === 'OK');
  const orderTotal = itemTotals.reduce((sum, item) => sum + item.total, 0);
  const itemCount = itemTotals.length;

  // Invariant: total must be positive after valid prices
  if (orderTotal <= 0) {
    return { type: 'INVARIANT_VIOLATION', code: 'INVALID_TOTAL', status: 400, detail: 'Order total must be > 0 after discounts' };
  }

  // Create order record with timeout
  let orderResult;
  try {
    orderResult = await Promise.race([
      db.query(
        'INSERT INTO orders (user_id, total, item_count, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [input.userId, orderTotal, itemCount, 'pending'],
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } catch (cause) {
    return { type: 'INVALID_CART', code: 'ORDER_INSERT_FAILED', status: 500, detail: 'Failed to create order', cause };
  }

  const order = orderResult.rows[0] as OrderRow;

  // Set priority and notify if urgent
  const priority = input.isUrgent ? 'high' : 'normal';
  try {
    await Promise.race([
      db.query('UPDATE orders SET priority = $1 WHERE id = $2', [priority, order.id]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } catch (cause) {
    // Log but do not fail—priority update is a best-effort enhancement
    logOrderError({ orderId: order.id, error: 'Priority update failed', cause });
  }

  // Send confirmation if requested
  if (input.shouldSendConfirmation && input.confirmationEmail) {
    try {
      await Promise.race([
        mailer.send(input.confirmationEmail, 'Order confirmation', formatOrderConfirmation(order, user)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);
    } catch (cause) {
      // Log but do not fail—email delivery is a side effect, not a transaction requirement
      logOrderError({ orderId: order.id, error: 'Confirmation email failed', cause });
    }
  }

  // Record high-value orders for fraud review
  if (orderTotal > HIGH_VALUE_ORDER_THRESHOLD) {
    try {
      await Promise.race([
        db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [input.userId, orderTotal, Date.now()]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);
    } catch (cause) {
      // Log but do not fail—audit logging must not block happy path
      logOrderError({ orderId: order.id, error: 'Big orders audit log failed', cause });
    }
  }

  // Update cache with last order (best-effort; no I/O timeout needed for cache)
  try {
    cache.set(`user:${input.userId}:lastOrder`, order.id);
  } catch (cause) {
    logOrderError({ orderId: order.id, error: 'Cache update failed', cause });
  }

  return order;
}

/**
 * Remove an item from a user's cart.
 * Postcondition: item is not in cart (succeeds idempotently even if item was already absent).
 */
export async function removeCartItem(userId: string, itemId: string): Promise<{ type: 'OK' } | { type: 'INVALID_INPUT'; code: string; status: number; detail: string }> {
  // Boundary validation
  if (!userId) return { type: 'INVALID_INPUT', code: 'MISSING_USER_ID', status: 400, detail: 'User ID required' };
  if (!itemId) return { type: 'INVALID_INPUT', code: 'MISSING_ITEM_ID', status: 400, detail: 'Item ID required' };

  // Fetch cart with timeout
  let cartResult;
  try {
    cartResult = await Promise.race([
      db.query('SELECT * FROM carts WHERE user_id = $1', [userId]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } catch (cause) {
    return { type: 'INVALID_INPUT', code: 'CART_LOOKUP_TIMEOUT', status: 503, detail: 'Cart lookup timeout', cause };
  }

  const cartRow = cartResult.rows[0];
  if (!cartRow) {
    // Idempotent: cart doesn't exist = item not in cart (success)
    return { type: 'OK' };
  }

  const itemExists = (cartRow.items as Array<{ id: string }>).some((i) => i.id === itemId);
  if (!itemExists) {
    // Idempotent: item not in cart (success)
    return { type: 'OK' };
  }

  // Delete item with timeout
  try {
    await Promise.race([
      db.query('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [cartRow.id, itemId]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } catch (cause) {
    return { type: 'INVALID_INPUT', code: 'DELETE_FAILED', status: 500, detail: `Failed to remove item ${itemId}`, cause };
  }

  return { type: 'OK' };
}

/**
 * Apply bulk discount to items (10% off).
 * Injected dependencies (db, mailer) are passed by placeOrder; no mechanism config leaks to caller.
 */
export function applyBulkDiscount(items: CartItem[]): CartItem[] {
  return items.map((item) => ({
    ...item,
    price: item.price * 0.9,
  }));
}

// ============ Formatting—shared utilities ============

type EmailFormat = {
  to: string;
  name: string;
  amount: number;
  currency: string;
};

/**
 * Format document (email/receipt/invoice) from shared fields.
 * Delegates to specialized formatters per document type.
 *
 * - Caller: order confirmation pipeline, admin receipts, invoice generation
 * - Returns: formatted string ready for transport (email, PDF, etc.)
 */
function formatDocument(type: 'email' | 'receipt' | 'invoice', fields: EmailFormat): string {
  const formatters = {
    email: (f: EmailFormat) => `To: ${f.to}\nDear ${f.name}, your total is ${f.amount} ${f.currency}`,
    receipt: (f: EmailFormat) => `Receipt for ${f.name}: ${f.amount} ${f.currency}\nSent to: ${f.to}`,
    invoice: (f: EmailFormat) => `Invoice for ${f.name}: ${f.amount} ${f.currency}\nBilling: ${f.to}`,
  };
  return formatters[type](fields);
}

function formatOrderConfirmation(order: OrderRow, user: User): string {
  return `Order #${order.id}\nStatus: ${order.status}\nTotal: $${order.total}\nItems: ${order.item_count}\nConfirmation sent to ${user.email}`;
}

// ============ Validators—domain logic with proper error handling ============

type OrderValidationError = {
  type: 'MISSING_FIELD' | 'INVALID_TOTAL';
  code: string;
  status: number;
  detail: string;
};

/**
 * Validate order structure and totals.
 * Returns: formatted order summary (name, total, currency) or validation error.
 * Called by: order persistence layer before commit.
 */
function validateAndFormatOrder(order: any): { type: 'OK'; formatted: string } | OrderValidationError {
  // Boundary check: reject invalid order shape
  if (!order.customer?.address?.city) {
    return { type: 'MISSING_FIELD', code: 'MISSING_CITY', status: 400, detail: 'Order must include customer city' };
  }

  // Recompute total from items (don't trust precomputed value)
  const total = order.items.reduce((sum: number, item: any) => sum + item.price * item.qty, 0);

  // Invariant: total must be positive
  if (total <= 0) {
    return { type: 'INVALID_TOTAL', code: 'NONPOSITIVE_TOTAL', status: 400, detail: 'Order total must be > 0' };
  }

  const formatted = `${order.customer.name} - ${total.toFixed(2)} ${order.currency}`;
  return { type: 'OK', formatted };
}

function getShippingLabel(order: any): string {
  // Destructure at boundary (Law of Demeter: avoid deep chaining)
  const { street, city, zip } = order.customer.address;
  return `${street}, ${city}, ${zip}`;
}

// ============ Observability—crosscutting concerns ============

type OrderErrorContext = {
  orderId: string;
  error: string;
  cause?: unknown;
};

/**
 * Log order operation failures for debugging and monitoring.
 * Not visible in business logic; called from error handlers only.
 * Consumers: log aggregation (DataDog, Splunk), alerting rules.
 */
function logOrderError(context: OrderErrorContext): void {
  // In production, route to structured logging service
  console.error(JSON.stringify({ type: 'ORDER_ERROR', ...context, timestamp: new Date().toISOString() }));
}
```
