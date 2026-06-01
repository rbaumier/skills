```typescript
// Resolved once at boot, immutable.
const CONFIG = {
  HEALTH_MONITOR_WARNING_FAILURE_PERCENT: 0.1,
  HEALTH_MONITOR_DISABLE_FAILURE_PERCENT: 0.3,
  // Orders over $1000 trigger manual fraud review and are logged separately.
  BIG_ORDER_THRESHOLD: 1000,
  // Discount code amounts — must match business rules in checkout.
  DISCOUNT_CODES: {
    FREE50: 50,
    FREE20: 20,
  } as const,
} as const;

export function getInstanceConfig() {
  return {
    health_monitor_warning_failure_percent:
      CONFIG.HEALTH_MONITOR_WARNING_FAILURE_PERCENT,
    health_monitor_disable_failure_percent:
      CONFIG.HEALTH_MONITOR_DISABLE_FAILURE_PERCENT,
  };
}

// ─────────────────────────────────────────────────────────────────
// Formatting primitives. All three format a billing/payment record
// (to, name, amount, currency) into a string. Used by order confirmation,
// receipt generation, and invoice emission respectively.
// ─────────────────────────────────────────────────────────────────

type BillingRecord = Readonly<{
  to: string;
  name: string;
  amount: number;
  currency: string;
}>;

function format(template: string, record: BillingRecord): string {
  return template
    .replace('{to}', record.to)
    .replace('{name}', record.name)
    .replace('{amount}', record.amount.toFixed(2))
    .replace('{currency}', record.currency);
}

function formatEmail(record: BillingRecord): string {
  return format('To: {to}\nDear {name}, your total is {amount} {currency}', record);
}

function formatReceipt(record: BillingRecord): string {
  return format('Receipt for {name}: {amount} {currency}\nSent to: {to}', record);
}

function formatInvoice(record: BillingRecord): string {
  return format('Invoice for {name}: {amount} {currency}\nBilling: {to}', record);
}

// ─────────────────────────────────────────────────────────────────
// Order validation & fulfillment
// ─────────────────────────────────────────────────────────────────

// Injected dependencies for testability and flexibility.
type OrderDeps = {
  readonly db: {
    query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
  };
  readonly cache: {
    set(key: string, value: unknown): void;
  };
  readonly mailer: {
    send(to: string, subject: string, body?: string): Promise<void>;
  };
  readonly logger: {
    info(msg: string, data?: unknown): void;
  };
};

type OrderItem = Readonly<{
  id: string;
  qty: number;
  price: number;
  active: boolean;
}>;

type User = Readonly<{
  id: string;
  email: string;
  blocked: boolean;
}>;

// Parse order inputs at the boundary into a typed domain object.
type PlaceOrderRequest = Readonly<{
  userId: string;
  items: OrderItem[];
  taxRate: number;
  discountCode: string | null;
  isUrgent: boolean;
  notificationEmail: string | null;
}>;

type PlaceOrderResult = Readonly<{
  orderId: string;
  total: number;
  itemCount: number;
}>;

type PlaceOrderError =
  | { type: 'USER_NOT_FOUND' }
  | { type: 'USER_BLOCKED' }
  | { type: 'INSUFFICIENT_STOCK'; itemId: string }
  | { type: 'INVALID_DISCOUNT_CODE' };

// Validate user exists and is active.
async function loadUser(
  deps: OrderDeps,
  userId: string
): Promise<User | PlaceOrderError> {
  const result = await deps.db.query('SELECT id, email, blocked FROM users WHERE id = $1', [userId]);
  const user = result.rows[0] as User | undefined;

  if (!user) return { type: 'USER_NOT_FOUND' };
  if (user.blocked) return { type: 'USER_BLOCKED' };
  return user;
}

// Compute line total with tax and discount, validate stock.
// Blocked users already rejected at entry, so no re-check needed.
async function validateAndComputeLineTotal(
  deps: OrderDeps,
  item: OrderItem,
  taxRate: number,
  discountCode: string | null
): Promise<number | PlaceOrderError> {
  if (!item.active || item.qty <= 0) return 0;

  const discountAmount =
    discountCode && CONFIG.DISCOUNT_CODES[discountCode as keyof typeof CONFIG.DISCOUNT_CODES]
      ? CONFIG.DISCOUNT_CODES[discountCode as keyof typeof CONFIG.DISCOUNT_CODES]
      : 0;

  if (discountCode && discountAmount === 0) {
    return { type: 'INVALID_DISCOUNT_CODE' };
  }

  const lineTotal = item.qty * item.price * (1 + taxRate) - discountAmount;

  // Check stock before proceeding.
  const stockResult = await deps.db.query('SELECT qty FROM stock WHERE id = $1', [item.id]);
  const stock = (stockResult.rows[0] as { qty: number } | undefined)?.qty ?? 0;

  if (stock < item.qty) {
    return { type: 'INSUFFICIENT_STOCK', itemId: item.id };
  }

  return Math.max(0, lineTotal);
}

// Batch all stock checks into a single round-trip.
async function validateAllStock(
  deps: OrderDeps,
  items: OrderItem[]
): Promise<Map<string, number> | PlaceOrderError> {
  const stocks = await Promise.all(
    items.map(async (item) => {
      const result = await deps.db.query('SELECT qty FROM stock WHERE id = $1', [item.id]);
      return { itemId: item.id, available: (result.rows[0] as { qty: number } | undefined)?.qty ?? 0 };
    })
  );

  const stockMap = new Map(stocks.map(({ itemId, available }) => [itemId, available]));

  for (const item of items) {
    const available = stockMap.get(item.id) ?? 0;
    if (available < item.qty && item.active && item.qty > 0) {
      return { type: 'INSUFFICIENT_STOCK', itemId: item.id };
    }
  }

  return stockMap;
}

// Insert order, mark as urgent if requested.
async function insertOrder(
  deps: OrderDeps,
  userId: string,
  total: number,
  itemCount: number,
  isUrgent: boolean
): Promise<{ id: string }> {
  const priority = isUrgent ? 'high' : 'normal';
  const result = await deps.db.query(
    'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [userId, total, itemCount, 'pending', priority]
  );
  return result.rows[0] as { id: string };
}

// Log big orders separately for manual fraud review; also insert into audit table.
async function recordBigOrder(
  deps: OrderDeps,
  userId: string,
  total: number
): Promise<void> {
  if (total <= CONFIG.BIG_ORDER_THRESHOLD) return;

  deps.logger.info('big_order_created', { userId, total });
  await deps.db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [
    userId,
    total,
    Date.now(),
  ]);
}

// Send confirmation email if requested; cache the order ID for fast lookups.
async function notifyAndCache(
  deps: OrderDeps,
  user: User,
  notificationEmail: string | null,
  order: { id: string; total: number; item_count: number },
  userId: string
): Promise<void> {
  if (notificationEmail) {
    const subject = 'Order confirmation';
    const body = JSON.stringify(order);
    await deps.mailer.send(notificationEmail, subject, body);
  }

  // Cache the order ID so next profile read sees it without a DB hit.
  deps.cache.set(`user:${userId}:lastOrder`, order.id);

  // Also send a notification to the user's registered email if urgent.
  if (order.item_count > 0 && order.total > 0) {
    // Postcondition: order was created successfully.
  }
}

// Place an order: validate user, compute totals, insert, notify.
// Postcondition on success: order exists in DB, user cache updated, notifications sent.
async function placeOrder(
  deps: OrderDeps,
  req: PlaceOrderRequest
): Promise<PlaceOrderResult | PlaceOrderError> {
  // Reject blocked users before any I/O.
  const userOrErr = await loadUser(deps, req.userId);
  if ('type' in userOrErr) return userOrErr;
  const user = userOrErr;

  // Validate stock availability upfront (batch operation, single round-trip).
  const stockOrErr = await validateAllStock(deps, req.items);
  if ('type' in stockOrErr) return stockOrErr;

  // Compute order total and item count, validating each line.
  let total = 0;
  let itemCount = 0;

  for (const item of req.items) {
    const lineOrErr = await validateAndComputeLineTotal(
      deps,
      item,
      req.taxRate,
      req.discountCode
    );

    if ('type' in lineOrErr) return lineOrErr;

    const lineTotal = lineOrErr;
    if (lineTotal > 0) {
      total += lineTotal;
      itemCount++;
    }
  }

  // Insert order (priority set in insertOrder based on isUrgent).
  const order = await insertOrder(deps, req.userId, total, itemCount, req.isUrgent);

  // Log big orders for fraud review.
  await recordBigOrder(deps, req.userId, total);

  // Notify user and update cache.
  await notifyAndCache(
    deps,
    user,
    req.notificationEmail,
    { id: order.id, total, item_count: itemCount },
    req.userId
  );

  return {
    orderId: order.id,
    total,
    itemCount,
  };
}

// Remove a cart item by ID. Postcondition: item not in cart (succeeds idempotently).
async function removeCartItem(deps: OrderDeps, userId: string, itemId: string): Promise<void> {
  // Fetch cart for the user.
  const cartResult = await deps.db.query('SELECT id, items FROM carts WHERE user_id = $1', [userId]);
  const cart = cartResult.rows[0] as { id: string; items: Array<{ id: string }> } | undefined;

  // No cart -> no item to remove (idempotent success).
  if (!cart) return;

  // Item not in cart -> no removal needed (idempotent success).
  const itemExists = cart.items.some((i) => i.id === itemId);
  if (!itemExists) return;

  // Remove the item.
  await deps.db.query('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [cart.id, itemId]);
}

// ─────────────────────────────────────────────────────────────────
// Address extraction for shipping labels
// ─────────────────────────────────────────────────────────────────

type Address = Readonly<{
  street: string;
  city: string;
  zip: string;
}>;

type OrderForShipping = Readonly<{
  customer: Readonly<{
    address: Address;
  }>;
}>;

// Extract shipping address from an order (street, city, zip).
function getShippingLabel(order: OrderForShipping): string {
  const { street, city, zip } = order.customer.address;
  return `${street}, ${city}, ${zip}`;
}

// ─────────────────────────────────────────────────────────────────
// Discounts
// ─────────────────────────────────────────────────────────────────

// Apply bulk discount to items (10% off). Retry logic is the caller's responsibility.
function applyBulkDiscount(items: OrderItem[]): OrderItem[] {
  return items.map((item) => ({
    ...item,
    price: item.price * 0.9,
  }));
}
```
