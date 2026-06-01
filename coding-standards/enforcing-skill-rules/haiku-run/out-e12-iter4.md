```typescript
// Domain types (at top)
type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
type DiscountCode = 'NONE' | 'FREE50' | 'FREE20';

interface Item {
  id: string;
  qty: number;
  price: number;
  active: boolean;
}

interface User {
  id: string;
  email: string;
  blocked: boolean;
}

interface Order {
  id: string;
  userId: string;
  total: number;
  itemCount: number;
  status: OrderStatus;
}

interface PlaceOrderRequest {
  userId: string;
  items: Item[];
  taxRate: number;
  discountCode: DiscountCode;
  isUrgent: boolean;
  shouldNotify: boolean;
  notificationEmail: string;
}

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

interface ErrorDetail {
  type: 'USER_NOT_FOUND' | 'USER_BLOCKED' | 'INSUFFICIENT_STOCK' | 'INVALID_ORDER' | 'DB_ERROR';
  code: string;
  detail: string;
}

// Config types & resolution
interface HealthMonitorConfig {
  warningFailurePercent: number;
  disableFailurePercent: number;
}

const HEALTH_MONITOR_CONFIG: HealthMonitorConfig = {
  warningFailurePercent: 0.1,
  disableFailurePercent: 0.3,
};

// This config is consumed by the admin dashboard settings page and other health monitoring systems.
// Exposes platform-wide thresholds for monitoring behavior.
export function getInstanceHealthConfig(): HealthMonitorConfig {
  return HEALTH_MONITOR_CONFIG;
}

// Constants with rationale
const LARGE_ORDER_THRESHOLD = 1000; // Orders over $1000 trigger manual fraud review + notification
const DISCOUNT_VALUES: Record<DiscountCode, number> = {
  NONE: 0,
  FREE50: 50,
  FREE20: 20,
};

// Formatting logic: parameterized single function instead of three variants
type FormattingStyle = 'email' | 'receipt' | 'invoice';

function formatDocument(
  style: FormattingStyle,
  to: string,
  name: string,
  amount: number,
  currency: string,
): string {
  switch (style) {
    case 'email':
      return `To: ${to}\nDear ${name}, your total is ${amount} ${currency}`;
    case 'receipt':
      return `Receipt for ${name}: ${amount} ${currency}\nSent to: ${to}`;
    case 'invoice':
      return `Invoice for ${name}: ${amount} ${currency}\nBilling: ${to}`;
  }
}

// Structured error with context preserved
function createError(
  type: ErrorDetail['type'],
  code: string,
  detail: string,
): ErrorDetail {
  return { type, code, detail };
}

// Extracted validation logic
function validateOrderTotal(total: number): Result<number, ErrorDetail> {
  if (total <= 0) {
    return {
      ok: false,
      error: createError('INVALID_ORDER', 'ZERO_TOTAL', 'Order total must be greater than zero'),
    };
  }
  return { ok: true, value: total };
}

// Extracted address destructuring at boundary
function extractShippingAddress(
  order: any,
): Result<string, ErrorDetail> {
  const city = order.customer?.address?.city;
  if (!city) {
    return {
      ok: false,
      error: createError('INVALID_ORDER', 'MISSING_CITY', 'Shipping address requires city'),
    };
  }
  // Destructure at boundary to avoid chained access in logic
  const { street, zip } = order.customer.address;
  return { ok: true, value: `${street}, ${city}, ${zip}` };
}

// Dependencies injected via factory, not module globals
interface OrderServiceDeps {
  db: any; // db connection/query interface
  cache: any; // cache interface
  mailer: any; // mailer interface
}

// Dedicated interface to capture the shared Value Object for formatting
interface ContactInfo {
  to: string;
  name: string;
  amount: number;
  currency: string;
}

// Factory creates the bound operations
export function createOrderService(deps: OrderServiceDeps) {
  const { db, cache, mailer } = deps;

  // Core operation: place an urgent order (variant 1 of placeOrder)
  // Urgent orders skip normal processing — jump to fulfillment with escalated priority.
  async function placeUrgentOrder(
    userId: string,
    items: Item[],
    taxRate: number,
    discountCode: DiscountCode,
  ): Promise<Result<Order, ErrorDetail>> {
    // Fetch and validate user (fails fast before any I/O)
    const userResult = await fetchUser(userId);
    if (!userResult.ok) return userResult;
    const user = userResult.value;

    // Compute order total and validate items (fails before inventory check)
    const totalResult = computeOrderTotal(items, taxRate, discountCode);
    if (!totalResult.ok) return totalResult;
    const total = totalResult.value;

    // Check stock availability for all items in parallel (avoid per-item sequential waits)
    const stockResult = await checkAllItemsInStock(items);
    if (!stockResult.ok) return stockResult;

    // Insert order with high priority
    const order = await db.query(
      'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, total, items.length, 'pending', 'high'],
    );

    // Notify fulfillment immediately for urgent orders
    await mailer.send(user.email, 'Urgent order placed', JSON.stringify(order.rows[0]));

    // Cache the result for next user read
    cache.set(`user:${userId}:lastOrder`, order.rows[0].id);

    return { ok: true, value: mapRowToOrder(order.rows[0]) };
  }

  // Core operation: place a standard order with optional notification (variant 2)
  // Standard orders follow normal fulfillment workflow with optional customer notification.
  async function placeStandardOrder(
    userId: string,
    items: Item[],
    taxRate: number,
    discountCode: DiscountCode,
    shouldNotify: boolean,
    notificationEmail: string,
  ): Promise<Result<Order, ErrorDetail>> {
    // Fetch and validate user
    const userResult = await fetchUser(userId);
    if (!userResult.ok) return userResult;
    const user = userResult.value;

    // Compute order total
    const totalResult = computeOrderTotal(items, taxRate, discountCode);
    if (!totalResult.ok) return totalResult;
    const total = totalResult.value;

    // Check stock availability in parallel
    const stockResult = await checkAllItemsInStock(items);
    if (!stockResult.ok) return stockResult;

    // Insert order with normal priority
    const order = await db.query(
      'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, total, items.length, 'pending', 'normal'],
    );

    // If order exceeds threshold, flag for fraud review and notify ops
    if (total > LARGE_ORDER_THRESHOLD) {
      await mailer.send(user.email, `Order received: ${total}`, `Your order #${order.rows[0].id} has been received and will be reviewed.`);
      await db.query(
        'INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)',
        [userId, total, Date.now()],
      );
    }

    // If customer requested notification, send confirmation to provided email
    if (shouldNotify) {
      const contactInfo: ContactInfo = {
        to: notificationEmail,
        name: user.id, // Replace with actual user.name if available
        amount: total,
        currency: 'USD', // Replace with actual currency if available
      };
      const emailBody = formatDocument('email', contactInfo.to, contactInfo.name, contactInfo.amount, contactInfo.currency);
      await mailer.send(notificationEmail, 'Order confirmation', emailBody);
    }

    // Cache the result
    cache.set(`user:${userId}:lastOrder`, order.rows[0].id);

    return { ok: true, value: mapRowToOrder(order.rows[0]) };
  }

  // Private helpers

  async function fetchUser(userId: string): Promise<Result<User, ErrorDetail>> {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!result.rows[0]) {
      return {
        ok: false,
        error: createError('USER_NOT_FOUND', 'NOT_FOUND', `User ${userId} not found`),
      };
    }
    const user = result.rows[0];
    if (user.blocked) {
      return {
        ok: false,
        error: createError('USER_BLOCKED', 'BLOCKED', `User ${userId} is blocked from transacting`),
      };
    }
    return { ok: true, value: user };
  }

  function computeOrderTotal(
    items: Item[],
    taxRate: number,
    discountCode: DiscountCode,
  ): Result<number, ErrorDetail> {
    let total = 0;
    const discountAmount = DISCOUNT_VALUES[discountCode];

    for (const item of items) {
      // Only process active items with positive quantity
      if (!item.active || item.qty <= 0) continue;

      const lineTotal = item.qty * item.price * (1 + taxRate);
      total += lineTotal;
    }

    // Apply discount and validate result
    total -= discountAmount;
    return validateOrderTotal(total);
  }

  async function checkAllItemsInStock(items: Item[]): Promise<Result<void, ErrorDetail>> {
    // Check all items in parallel to avoid per-item sequential waits
    const checks = items.map(async (item) => {
      if (item.qty <= 0) return { ok: true } as const;

      const result = await db.query(
        'SELECT qty FROM stock WHERE id = $1',
        [item.id],
      );
      const availableQty = result.rows[0]?.qty ?? 0;

      if (availableQty < item.qty) {
        return {
          ok: false,
          error: createError(
            'INSUFFICIENT_STOCK',
            'OUT_OF_STOCK',
            `Item ${item.id} has only ${availableQty} available, need ${item.qty}`,
          ),
        };
      }
      return { ok: true } as const;
    });

    const stockResults = await Promise.all(checks);
    const failure = stockResults.find((r) => !r.ok);
    if (failure && !failure.ok) return failure;

    return { ok: true, value: undefined };
  }

  function mapRowToOrder(row: any): Order {
    return {
      id: row.id,
      userId: row.user_id,
      total: row.total,
      itemCount: row.item_count,
      status: row.status as OrderStatus,
    };
  }

  // Public API
  return {
    placeUrgentOrder,
    placeStandardOrder,
  };
}

// Remove order from cart idempotently: succeed even if item is already gone (postcondition: item not in cart)
export async function removeCartItem(
  db: any,
  userId: string,
  itemId: string,
): Promise<Result<void, ErrorDetail>> {
  const cartResult = await db.query('SELECT * FROM carts WHERE user_id = $1', [userId]);
  if (!cartResult.rows[0]) {
    // Cart does not exist; idempotent success (item already not in cart)
    return { ok: true, value: undefined };
  }

  const cart = cartResult.rows[0];
  const itemExists = cart.items?.find((i: any) => i.id === itemId);

  if (!itemExists) {
    // Item already absent; idempotent success
    return { ok: true, value: undefined };
  }

  // Item exists, delete it
  await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [
    cart.id,
    itemId,
  ]);

  return { ok: true, value: undefined };
}

// Bulk discount: simplified to remove unused mechanism config params
export function applyBulkDiscount(items: Item[]): Item[] {
  // Apply 10% discount uniformly; retry logic belongs in the I/O layer, not here
  return items.map((item) => ({
    ...item,
    price: item.price * 0.9,
  }));
}
```
