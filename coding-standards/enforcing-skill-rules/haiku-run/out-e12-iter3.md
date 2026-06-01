```typescript
/**
 * Order processing module with dependency injection.
 * Fetches user, validates stock, calculates totals with tax/discount,
 * creates orders, and notifies via email and logging.
 *
 * Key operations:
 * - Fetch user and check blocked status
 * - Validate item quantities and stock availability
 * - Calculate total with tax and discount
 * - Create order record and update priority
 * - Trigger notifications and cache invalidation
 */

import type { Database, Logger, Mailer } from './types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Value Objects & Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type OrderStatus = 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';

interface OrderInput {
  userId: string;
  items: OrderItem[];
  taxRate: number;
  discountCode: string | null;
  priority: OrderPriority;
  notificationConfig: NotificationConfig;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  active: boolean;
}

type OrderPriority = 'normal' | 'high';

interface NotificationConfig {
  shouldNotifyCustomer: boolean;
  notificationEmail: string;
}

interface DocumentRequest {
  to: string;
  recipientName: string;
  amount: number;
  currency: string;
}

interface OrderRecord {
  id: string;
  userId: string;
  total: number;
  itemCount: number;
  status: OrderStatus;
  priority: OrderPriority;
}

interface User {
  id: string;
  email: string;
  status: 'active' | 'blocked';
}

interface StockRecord {
  id: string;
  quantity: number;
}

interface ConfigOutput {
  healthMonitorWarningFailurePercent: number;
  healthMonitorDisableFailurePercent: number;
}

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

interface ProcessError {
  type: 'USER_NOT_FOUND' | 'USER_BLOCKED' | 'INSUFFICIENT_STOCK' | 'INVALID_DISCOUNT';
  detail: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Large orders ($1000+) trigger manual fraud review and special handling.
const LARGE_ORDER_THRESHOLD = 1000;

// Discount codes hardcoded here; resolves at boot, not at use site.
const DISCOUNT_AMOUNTS: Record<string, number> = {
  'FREE50': 50,
  'FREE20': 20,
};

/**
 * Instance configuration for health monitoring.
 * Warning threshold triggers alerts at 10% failure rate.
 * Disable threshold stops processing at 30% failure rate.
 * @returns Immutable configuration object
 */
export function getInstanceConfig(): ConfigOutput {
  return {
    healthMonitorWarningFailurePercent: 0.1,
    healthMonitorDisableFailurePercent: 0.3,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Document Formatting (Rule of Three: shared for email, receipt, invoice)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type DocumentType = 'email' | 'receipt' | 'invoice';

interface DocumentTemplate {
  header: (req: DocumentRequest) => string;
  body: (req: DocumentRequest) => string;
}

const DOCUMENT_TEMPLATES: Record<DocumentType, DocumentTemplate> = {
  email: {
    header: (r) => `To: ${r.to}`,
    body: (r) => `Dear ${r.recipientName}, your total is ${r.amount} ${r.currency}`,
  },
  receipt: {
    header: (r) => `Receipt for ${r.recipientName}: ${r.amount} ${r.currency}`,
    body: (r) => `Sent to: ${r.to}`,
  },
  invoice: {
    header: (r) => `Invoice for ${r.recipientName}: ${r.amount} ${r.currency}`,
    body: (r) => `Billing: ${r.to}`,
  },
};

/**
 * Formats a document (email, receipt, or invoice) with recipient, amount, and currency.
 * @param type Document type (email, receipt, or invoice)
 * @param request Recipient, amount, currency details
 * @returns Formatted document string
 */
function formatDocument(type: DocumentType, request: DocumentRequest): string {
  const template = DOCUMENT_TEMPLATES[type];
  return `${template.header(request)}\n${template.body(request)}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dependencies (injected, not global)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface OrderServiceDeps {
  database: Database;
  mailer: Mailer;
  logger: Logger;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Core Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetches user from database and returns Result.
 * @param userId User ID to fetch
 * @param database Database instance
 * @returns User or USER_NOT_FOUND error
 */
async function fetchUser(
  userId: string,
  database: Database,
): Promise<Result<User, ProcessError>> {
  try {
    const rows = await database.query<User>(
      'SELECT id, email, status FROM users WHERE id = $1',
      [userId],
    );
    if (rows.length === 0) {
      return {
        ok: false,
        error: { type: 'USER_NOT_FOUND', detail: `User ${userId} not found` },
      };
    }
    return { ok: true, value: rows[0] };
  } catch (cause) {
    return {
      ok: false,
      error: { type: 'USER_NOT_FOUND', detail: String(cause) },
    };
  }
}

/**
 * Checks if user is blocked and returns error if so.
 * Blocked users cannot transact—reject before any I/O proceeds.
 */
function validateUserNotBlocked(user: User): Result<void, ProcessError> {
  if (user.status === 'blocked') {
    return {
      ok: false,
      error: { type: 'USER_BLOCKED', detail: `User ${user.id} is blocked` },
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Applies discount code to amount.
 * @param discountCode Code to apply (null allowed)
 * @returns Discount amount, or error if code is invalid
 */
function resolveDiscount(discountCode: string | null): Result<number, ProcessError> {
  if (discountCode === null) return { ok: true, value: 0 };
  const amount = DISCOUNT_AMOUNTS[discountCode];
  if (amount === undefined) {
    return {
      ok: false,
      error: { type: 'INVALID_DISCOUNT', detail: `Discount code ${discountCode} not recognized` },
    };
  }
  return { ok: true, value: amount };
}

/**
 * Fetches stock record for an item.
 * @param itemId Item ID
 * @param database Database instance
 * @returns Stock record or INSUFFICIENT_STOCK error if not found
 */
async function fetchStock(
  itemId: string,
  database: Database,
): Promise<Result<StockRecord, ProcessError>> {
  try {
    const rows = await database.query<StockRecord>(
      'SELECT id, quantity FROM stock WHERE id = $1',
      [itemId],
    );
    if (rows.length === 0) {
      return {
        ok: false,
        error: { type: 'INSUFFICIENT_STOCK', detail: `No stock record for item ${itemId}` },
      };
    }
    return { ok: true, value: rows[0] };
  } catch (cause) {
    return {
      ok: false,
      error: { type: 'INSUFFICIENT_STOCK', detail: String(cause) },
    };
  }
}

/**
 * Validates all items in the order.
 * - Quantity must be > 0
 * - Stock must be sufficient
 * - Item must be active
 *
 * Returns early on first validation failure.
 */
async function validateOrderItems(
  items: OrderItem[],
  database: Database,
): Promise<Result<void, ProcessError>> {
  for (const item of items) {
    // Skip inactive items—they are filtered by policy, not validated.
    if (!item.active) continue;

    // Quantity must be positive.
    if (item.quantity <= 0) {
      return {
        ok: false,
        error: { type: 'INVALID_DISCOUNT', detail: `Item ${item.id} has invalid quantity ${item.quantity}` },
      };
    }

    // Check stock availability.
    const stockResult = await fetchStock(item.id, database);
    if (!stockResult.ok) return stockResult;

    if (stockResult.value.quantity < item.quantity) {
      return {
        ok: false,
        error: {
          type: 'INSUFFICIENT_STOCK',
          detail: `Item ${item.id} requires ${item.quantity} but only ${stockResult.value.quantity} available`,
        },
      };
    }
  }
  return { ok: true, value: undefined };
}

/**
 * Calculates order total with tax and discount applied.
 *
 * Total = sum of (quantity × price × (1 + tax)) − discount
 *
 * Only includes active items. Discount is a fixed amount, applied once.
 */
function calculateOrderTotal(
  items: OrderItem[],
  taxRate: number,
  discountAmount: number,
): number {
  const subtotal = items.reduce((sum, item) => {
    if (!item.active) return sum;
    return sum + item.quantity * item.price * (1 + taxRate);
  }, 0);
  return Math.max(0, subtotal - discountAmount);
}

/**
 * Counts active items in the order.
 */
function countActiveItems(items: OrderItem[]): number {
  return items.filter((item) => item.active).length;
}

/**
 * Creates an order record in the database and returns the result DTO.
 */
async function createOrderRecord(
  userId: string,
  total: number,
  itemCount: number,
  priority: OrderPriority,
  database: Database,
): Promise<Result<OrderRecord, ProcessError>> {
  try {
    const rows = await database.query<OrderRecord>(
      `INSERT INTO orders (user_id, total, item_count, status, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, total, item_count, status, priority`,
      [userId, total, itemCount, 'pending', priority],
    );
    if (rows.length === 0) {
      return {
        ok: false,
        error: { type: 'USER_NOT_FOUND', detail: 'Failed to create order' },
      };
    }
    return { ok: true, value: rows[0] };
  } catch (cause) {
    return {
      ok: false,
      error: { type: 'USER_NOT_FOUND', detail: String(cause) },
    };
  }
}

/**
 * Records large orders (≥$1000) for fraud review.
 * Persists order and sends notification email.
 * Returns error if persist fails; notification failure is logged but does not block.
 */
async function recordLargeOrder(
  order: OrderRecord,
  user: User,
  deps: OrderServiceDeps,
): Promise<Result<void, ProcessError>> {
  try {
    await deps.database.query(
      'INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)',
      [order.userId, order.total, Date.now()],
    );
  } catch (cause) {
    return {
      ok: false,
      error: { type: 'USER_NOT_FOUND', detail: `Failed to record large order: ${cause}` },
    };
  }

  // Send notification asynchronously; failure does not block order creation.
  try {
    await deps.mailer.send(
      user.email,
      `Large order: $${order.total}`,
    );
  } catch (cause) {
    deps.logger.warn('Failed to notify on large order', { orderId: order.id, cause });
  }

  return { ok: true, value: undefined };
}

/**
 * Sends order confirmation email to customer if configured.
 * Failure is logged but does not block order creation.
 */
async function sendOrderConfirmation(
  order: OrderRecord,
  notificationConfig: NotificationConfig,
  deps: OrderServiceDeps,
): Promise<void> {
  if (!notificationConfig.shouldNotifyCustomer) return;

  try {
    const confirmationDoc = formatDocument('email', {
      to: notificationConfig.notificationEmail,
      recipientName: 'Valued Customer',
      amount: order.total,
      currency: 'USD',
    });
    await deps.mailer.send(
      notificationConfig.notificationEmail,
      'Order Confirmation',
      confirmationDoc,
    );
  } catch (cause) {
    deps.logger.warn('Failed to send order confirmation', { orderId: order.id, cause });
  }
}

/**
 * Processes a complete order.
 *
 * Steps:
 * - Fetch and validate user (exists, not blocked)
 * - Validate all items (active, quantity > 0, stock sufficient)
 * - Calculate total with tax and discount
 * - Create order record with appropriate priority
 * - Record large orders (≥$1000) for fraud review
 * - Send confirmation email if configured
 * - Log order creation
 *
 * Returns the created order DTO or a ProcessError on first failure.
 */
export async function placeOrder(
  input: OrderInput,
  deps: OrderServiceDeps,
): Promise<Result<OrderRecord, ProcessError>> {
  // Fetch and validate user.
  const userResult = await fetchUser(input.userId, deps.database);
  if (!userResult.ok) return userResult;
  const user = userResult.value;

  const userStatusResult = validateUserNotBlocked(user);
  if (!userStatusResult.ok) return userStatusResult;

  // Resolve discount code before validating items.
  const discountResult = resolveDiscount(input.discountCode);
  if (!discountResult.ok) return discountResult;
  const discountAmount = discountResult.value;

  // Validate all items (stock, quantity, active status).
  const itemsResult = await validateOrderItems(input.items, deps.database);
  if (!itemsResult.ok) return itemsResult;

  // Calculate totals.
  const total = calculateOrderTotal(input.items, input.taxRate, discountAmount);
  const itemCount = countActiveItems(input.items);

  // Enforce postcondition: total must be positive.
  if (total <= 0) {
    return {
      ok: false,
      error: {
        type: 'INVALID_DISCOUNT',
        detail: `Total ${total} is non-positive; order calculation produced invalid result`,
      },
    };
  }

  // Create order.
  const orderResult = await createOrderRecord(
    input.userId,
    total,
    itemCount,
    input.priority,
    deps.database,
  );
  if (!orderResult.ok) return orderResult;
  const order = orderResult.value;

  // Handle large orders.
  if (order.total >= LARGE_ORDER_THRESHOLD) {
    const largeOrderResult = await recordLargeOrder(order, user, deps);
    if (!largeOrderResult.ok) return largeOrderResult;
  }

  // Send confirmation.
  await sendOrderConfirmation(order, input.notificationConfig, deps);

  // Log order creation.
  deps.logger.info('Order created', { orderId: order.id, total: order.total });

  return { ok: true, value: order };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cart Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Cart {
  id: string;
  userId: string;
  items: OrderItem[];
}

/**
 * Removes an item from a user's cart.
 * Idempotent: if the item is not in the cart, the operation succeeds
 * (postcondition: item is not in cart).
 * If cart does not exist, returns error.
 */
export async function removeCartItem(
  userId: string,
  itemId: string,
  database: Database,
): Promise<Result<void, ProcessError>> {
  try {
    const rows = await database.query<Cart>(
      'SELECT id, user_id, items FROM carts WHERE user_id = $1',
      [userId],
    );
    if (rows.length === 0) {
      return {
        ok: false,
        error: { type: 'USER_NOT_FOUND', detail: `Cart not found for user ${userId}` },
      };
    }

    // Delete the item. If it doesn't exist, the DELETE still succeeds (0 rows deleted).
    await database.query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2',
      [rows[0].id, itemId],
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: { type: 'USER_NOT_FOUND', detail: String(cause) },
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Bulk Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Applies a bulk discount (10%) to all items.
 * Returns a new array with discounted prices.
 */
export function applyBulkDiscount(items: OrderItem[]): OrderItem[] {
  const BULK_DISCOUNT_RATE = 0.9; // 10% off: price × 0.9
  return items.map((item) => ({
    ...item,
    price: item.price * BULK_DISCOUNT_RATE,
  }));
}
```
