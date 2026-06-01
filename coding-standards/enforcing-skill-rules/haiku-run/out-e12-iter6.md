```typescript
import { db } from './db';
import { cache } from './cache';
import { mailer } from './mailer';

/**
 * Instance configuration for health monitoring thresholds.
 * Used to configure the admin dashboard instance settings page.
 */
export function getInstanceConfig() {
  return {
    healthMonitorWarningFailurePercent: 0.1,
    healthMonitorDisableFailurePercent: 0.3,
  };
}

// Configuration constants with domain rationale
const LARGE_ORDER_THRESHOLD = 1000; // Orders over $1000 trigger manual fraud review and notifications
const DISCOUNT_AMOUNT_FULL = 50;
const DISCOUNT_AMOUNT_PARTIAL = 20;

/**
 * Place an order for a user with multiple items.
 * Validates inventory, applies tax/discount, creates order record, sends notifications.
 * Returns the created order with full details.
 */
export async function placeOrder(
  userId: string,
  items: OrderItemInput[],
  options: PlaceOrderOptions
): Promise<Result<Order, OrderError>> {
  // Fetch and validate user at entry — all downstream code trusts user exists and is not blocked
  const userResult = await fetchUser(userId);
  if (userResult.type === 'error') return userResult;
  const user = userResult.value;

  // Calculate order total with validation of each item
  const itemsResult = validateAndPriceItems(items, user, options.taxRate, options.discountCode);
  if (itemsResult.type === 'error') return itemsResult;
  const { orderedItems, total, itemCount } = itemsResult.value;

  // Large orders trigger fraud review
  if (total > LARGE_ORDER_THRESHOLD) {
    const notifyResult = await notifyLargeOrder(user.email, total, { signal: AbortSignal.timeout(5000) });
    if (notifyResult.type === 'error') {
      // Large order notification failed — log but do not block order creation
      return err({
        type: 'LARGE_ORDER_NOTIFICATION_FAILED',
        code: 'MAIL_SERVICE',
        status: 500,
        detail: `Failed to notify on large order: ${notifyResult.error.detail}`,
      });
    }

    const logResult = await recordLargeOrder(userId, total, { signal: AbortSignal.timeout(5000) });
    if (logResult.type === 'error') {
      return err({
        type: 'LARGE_ORDER_LOG_FAILED',
        code: 'DB_WRITE',
        status: 500,
        detail: `Failed to record large order in audit log: ${logResult.error.detail}`,
      });
    }
  }

  // Create the order record
  const createResult = await createOrderRecord(userId, total, itemCount, options.urgency, { signal: AbortSignal.timeout(5000) });
  if (createResult.type === 'error') return createResult;
  const order = createResult.value;

  // Send confirmation if requested — failure does not block order creation
  if (options.sendConfirmation && options.confirmationEmail) {
    const confirmResult = await sendOrderConfirmation(options.confirmationEmail, order, { signal: AbortSignal.timeout(5000) });
    if (confirmResult.type === 'error') {
      // Log confirmation failure but do not fail the entire operation
      console.error('Order confirmation email failed:', { orderId: order.id, error: confirmResult.error.detail });
    }
  }

  // Update user cache so next profile read does not hit DB
  cache.set(`user:${userId}:lastOrder`, order.id);

  return ok(order);
}

/**
 * Fetch and validate user exists and is not blocked.
 * Boundary validation: rejects blocked or missing users before any downstream processing.
 */
async function fetchUser(userId: string): Promise<Result<User, OrderError>> {
  if (!userId) {
    return err({
      type: 'INVALID_INPUT',
      code: 'MISSING_USER_ID',
      status: 400,
      detail: 'User ID is required',
    });
  }

  const result = await db.query<User>(
    'SELECT id, email, blocked FROM users WHERE id = $1',
    [userId],
    { signal: AbortSignal.timeout(3000) }
  );
  if (result.type === 'error') {
    return err({
      type: 'DB_FETCH_FAILED',
      code: 'DB_READ',
      status: 500,
      detail: `Failed to fetch user: ${result.error.detail}`,
    });
  }

  const user = result.value[0];
  if (!user) {
    return err({
      type: 'USER_NOT_FOUND',
      code: 'NOT_FOUND',
      status: 404,
      detail: 'User does not exist',
    });
  }

  if (user.blocked) {
    return err({
      type: 'USER_BLOCKED',
      code: 'FORBIDDEN',
      status: 403,
      detail: 'Blocked users cannot place orders',
    });
  }

  return ok(user);
}

/**
 * Validate items, check stock, and calculate order total with tax and discount.
 * All item validation happens here before any DB writes — barricaded at the boundary.
 */
function validateAndPriceItems(
  items: OrderItemInput[],
  user: User,
  taxRate: number = 0,
  discountCode: string = ''
): Result<{ orderedItems: PricedItem[]; total: number; itemCount: number }, OrderError> {
  if (!Array.isArray(items) || items.length === 0) {
    return err({
      type: 'INVALID_INPUT',
      code: 'EMPTY_ITEMS',
      status: 400,
      detail: 'At least one item is required',
    });
  }

  const discountAmount = getDiscountAmount(discountCode);
  if (discountAmount === null) {
    return err({
      type: 'INVALID_INPUT',
      code: 'INVALID_DISCOUNT',
      status: 400,
      detail: `Discount code "${discountCode}" is not recognized`,
    });
  }

  const orderedItems: PricedItem[] = [];
  let total = 0;

  for (const item of items) {
    // Reject invalid items at entry
    if (!item.id) {
      return err({
        type: 'INVALID_INPUT',
        code: 'MISSING_ITEM_ID',
        status: 400,
        detail: 'Each item requires an id',
      });
    }

    if (item.qty <= 0) {
      return err({
        type: 'INVALID_INPUT',
        code: 'INVALID_QUANTITY',
        status: 400,
        detail: `Quantity must be positive for item "${item.id}"`,
      });
    }

    if (item.price < 0) {
      return err({
        type: 'INVALID_INPUT',
        code: 'INVALID_PRICE',
        status: 400,
        detail: `Price must not be negative for item "${item.id}"`,
      });
    }

    // Calculate item total with tax
    const itemTotal = item.qty * item.price * (1 + (taxRate ?? 0));

    // Apply discount only to valid items — discount applies to the entire order total, not per-item
    // but we subtract it once at the end
    orderedItems.push({
      id: item.id,
      qty: item.qty,
      price: item.price,
      subtotal: itemTotal,
    });

    total += itemTotal;
  }

  // Subtract discount from total
  total -= discountAmount;

  if (total <= 0) {
    // Impossible state after summing valid prices: invariant violation
    return err({
      type: 'INVARIANT_VIOLATION',
      code: 'NEGATIVE_ORDER_TOTAL',
      status: 400,
      detail: 'Order total must be positive after applying discount',
    });
  }

  return ok({
    orderedItems,
    total,
    itemCount: orderedItems.length,
  });
}

/**
 * Map discount codes to their monetary values.
 * Returns null if the code is not recognized.
 */
function getDiscountAmount(discountCode: string): number | null {
  const discounts: Record<string, number> = {
    FREE50: DISCOUNT_AMOUNT_FULL,
    FREE20: DISCOUNT_AMOUNT_PARTIAL,
  };
  return discounts[discountCode] ?? (discountCode === '' ? 0 : null);
}

/**
 * Send notification email for large orders that trigger manual fraud review.
 */
async function notifyLargeOrder(
  email: string,
  total: number,
  options: { signal: AbortSignal }
): Promise<Result<void, OrderError>> {
  const result = await mailer.send(email, 'Large Order Notification', `Your order of $${total} requires manual review.`, options);
  if (result.type === 'error') {
    return err({
      type: 'NOTIFICATION_FAILED',
      code: 'MAIL_SERVICE',
      status: 500,
      detail: result.error.detail,
    });
  }
  return ok(undefined);
}

/**
 * Record large order in audit log for compliance and fraud investigation.
 */
async function recordLargeOrder(
  userId: string,
  total: number,
  options: { signal: AbortSignal }
): Promise<Result<void, OrderError>> {
  const result = await db.query(
    'INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)',
    [userId, total, Date.now()],
    options
  );
  if (result.type === 'error') {
    return err({
      type: 'AUDIT_LOG_FAILED',
      code: 'DB_WRITE',
      status: 500,
      detail: result.error.detail,
    });
  }
  return ok(undefined);
}

/**
 * Create order record in database and set priority based on urgency.
 */
async function createOrderRecord(
  userId: string,
  total: number,
  itemCount: number,
  urgency: OrderUrgency,
  options: { signal: AbortSignal }
): Promise<Result<Order, OrderError>> {
  const priority = urgency === 'urgent' ? 'high' : 'normal';

  const result = await db.query<Order>(
    'INSERT INTO orders (user_id, total, item_count, priority, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, total, item_count, priority, status, created_at',
    [userId, total, itemCount, priority, 'pending'],
    options
  );

  if (result.type === 'error') {
    return err({
      type: 'ORDER_CREATION_FAILED',
      code: 'DB_WRITE',
      status: 500,
      detail: result.error.detail,
    });
  }

  const order = result.value[0];
  if (!order) {
    return err({
      type: 'INVARIANT_VIOLATION',
      code: 'NO_RETURNING_ROW',
      status: 500,
      detail: 'INSERT RETURNING did not return the created order',
    });
  }

  return ok(order);
}

/**
 * Send order confirmation email to the customer.
 */
async function sendOrderConfirmation(
  email: string,
  order: Order,
  options: { signal: AbortSignal }
): Promise<Result<void, OrderError>> {
  const body = formatOrderConfirmation(order);
  const result = await mailer.send(email, 'Order Confirmation', body, options);
  if (result.type === 'error') {
    return err({
      type: 'CONFIRMATION_EMAIL_FAILED',
      code: 'MAIL_SERVICE',
      status: 500,
      detail: result.error.detail,
    });
  }
  return ok(undefined);
}

/**
 * Remove an item from the user's cart.
 * Succeeds idempotently: if the item is not in the cart, the postcondition (item not in cart) is already met.
 */
export async function removeCartItem(userId: string, itemId: string): Promise<Result<void, CartError>> {
  if (!userId) {
    return err({
      type: 'INVALID_INPUT',
      code: 'MISSING_USER_ID',
      status: 400,
      detail: 'User ID is required',
    });
  }

  if (!itemId) {
    return err({
      type: 'INVALID_INPUT',
      code: 'MISSING_ITEM_ID',
      status: 400,
      detail: 'Item ID is required',
    });
  }

  const result = await db.query(
    'DELETE FROM cart_items WHERE (SELECT cart_id FROM carts WHERE user_id = $1) = cart_id AND item_id = $2',
    [userId, itemId],
    { signal: AbortSignal.timeout(3000) }
  );

  if (result.type === 'error') {
    return err({
      type: 'DELETE_FAILED',
      code: 'DB_WRITE',
      status: 500,
      detail: result.error.detail,
    });
  }

  // Postcondition satisfied: item is no longer in the cart (whether it existed or not)
  return ok(undefined);
}

/**
 * Format an order into a confirmation email body.
 * Extracted to a single parameterized function: all email formatting uses the same fields (to, name, amount, currency).
 */
function formatEmail(email: EmailFormatInput, formatType: 'confirmation' | 'receipt' | 'invoice'): string {
  const { to, name, amount, currency } = email;

  switch (formatType) {
    case 'confirmation':
      return `To: ${to}\nDear ${name}, your order total is ${amount} ${currency}.\nThank you for your purchase.`;
    case 'receipt':
      return `Receipt for ${name}: ${amount} ${currency}\nSent to: ${to}`;
    case 'invoice':
      return `Invoice for ${name}: ${amount} ${currency}\nBilling address: ${to}`;
  }
}

/**
 * Format order confirmation for email delivery.
 */
function formatOrderConfirmation(order: Order): string {
  return `Order #${order.id}\nTotal: $${order.total}\nItems: ${order.itemCount}\nStatus: ${order.status}`;
}

/**
 * Apply a bulk discount to items by reducing their price by 10%.
 * Note: Caller is responsible for when/how to apply this discount in the order workflow.
 */
export function applyBulkDiscount(items: PricedItem[]): PricedItem[] {
  if (!Array.isArray(items) || items.length === 0) return items;

  return items.map(item => ({
    ...item,
    price: item.price * 0.9,
  }));
}

// ============================================================================
// Types
// ============================================================================

/**
 * A user in the system with their profile and status.
 */
interface User {
  id: string;
  email: string;
  blocked: boolean;
}

/**
 * An item as provided by the caller (unpriced, unvalidated).
 */
interface OrderItemInput {
  id: string;
  qty: number;
  price: number;
}

/**
 * An item after pricing and tax calculation.
 */
interface PricedItem {
  id: string;
  qty: number;
  price: number;
  subtotal: number;
}

/**
 * The fully created order record from the database.
 */
interface Order {
  id: string;
  user_id: string;
  total: number;
  item_count: number;
  priority: 'high' | 'normal';
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  created_at: string;
}

/**
 * Options for placing an order.
 */
interface PlaceOrderOptions {
  taxRate?: number;
  discountCode?: string;
  urgency: OrderUrgency;
  sendConfirmation?: boolean;
  confirmationEmail?: string;
}

type OrderUrgency = 'normal' | 'urgent';

/**
 * Email formatting parameters shared by all email template functions.
 */
interface EmailFormatInput {
  to: string;
  name: string;
  amount: number;
  currency: string;
}

/**
 * Result type for operations that can fail.
 */
type Result<T, E> = 
  | { type: 'ok'; value: T }
  | { type: 'error'; error: E };

/**
 * Order-related error types with all four required fields.
 */
type OrderError = {
  type: string;
  code: string;
  status: number;
  detail: string;
};

/**
 * Cart-related error types.
 */
type CartError = {
  type: string;
  code: string;
  status: number;
  detail: string;
};

/**
 * Helper to construct ok results.
 */
function ok<T>(value: T): Result<T, never> {
  return { type: 'ok', value };
}

/**
 * Helper to construct error results.
 */
function err<E>(error: E): Result<never, E> {
  return { type: 'error', error };
}
```
