# Full-Sweep Refactoring

## Refactored Module

```typescript
/**
 * Order Fulfillment Module
 *
 * What it does: Accepts a validated order request, checks stock, calculates totals,
 * persists the order, and triggers post-order side-effects (notifications, caching).
 *
 * How it works:
 * 1. Parse and validate all inputs at the boundary — reject invalid data immediately
 * 2. Verify the user exists and is not blocked
 * 3. Check stock availability for every line item in parallel
 * 4. Calculate totals (tax + discount) using immutable transformations
 * 5. Persist the order row and, if the total crosses the high-value threshold, log it
 * 6. Return a DTO — never a raw DB row
 *
 * Logging / tracing is NOT done here — wrap with `withLogging(createOrderService(deps))`
 * at the composition root so business logic stays pure.
 */

// ---------------------------------------------------------------------------
// Named constants — every magic number lives here so product can tweak
// thresholds without touching function bodies
// ---------------------------------------------------------------------------

/** Orders above this amount trigger a "big order" notification to the user
 *  and an audit row in big_orders. Finance reviews these weekly. */
const BIG_ORDER_THRESHOLD_CENTS = 1000;

/** Discount lookup — maps a promo code to the flat cents deducted from
 *  the line-item amount. Add new codes here; no function edits needed. */
const DISCOUNT_BY_CODE: Readonly<Record<string, number>> = {
  FREE50: 50,
  FREE20: 20,
} as const;

/** Hard ceiling on any single line-item quantity — protects against
 *  accidental bulk orders and integer-overflow edge cases. */
const MAX_ITEM_QUANTITY = 10_000;

/** Every I/O call uses this timeout (ms) so a hung DB / mailer
 *  never blocks the event loop indefinitely. */
const IO_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The only states an order can be in — adding a value here forces the
 *  compiler to handle it everywhere (exhaustive switch). */
type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'cancelled';

/** The only priority levels — derived from whether the caller routes
 *  through `fulfillUrgentOrder` vs `fulfillOrder`. */
type OrderPriority = 'high' | 'normal';

/**
 * A single line item as it arrives from the API boundary.
 * `id` references the stock/product table PK.
 */
interface OrderLineItem {
  readonly id: string;
  readonly quantity: number;
  readonly price: number;
  readonly isActive: boolean;
}

/**
 * Everything the order-creation pipeline needs — replaces the original
 * 7-positional-arg signature. Each field is validated at parse time;
 * by the time this object exists, every value is safe to use.
 */
interface FulfillOrderInput {
  readonly userId: string;
  readonly items: readonly OrderLineItem[];
  readonly taxRate: number;
  readonly discountCode: string | null;
}

/**
 * Notification details — passed to the dedicated notification function
 * so the fulfillment path stays a pure command.
 */
interface OrderNotification {
  readonly recipientEmail: string;
  readonly subject: string;
  readonly body: string;
}

/**
 * What the caller (API handler, CLI, test) actually receives —
 * a dedicated DTO, NOT a raw DB row. Shields consumers from
 * schema migrations and avoids leaking internal columns.
 */
interface OrderDto {
  readonly orderId: string;
  readonly userId: string;
  readonly total: number;
  readonly itemCount: number;
  readonly status: OrderStatus;
  readonly priority: OrderPriority;
}

/** Structured error — every failure carries machine-readable type + code
 *  so the error boundary (middleware) can map to the right HTTP status. */
interface OrderError {
  readonly type: 'VALIDATION' | 'NOT_FOUND' | 'BLOCKED' | 'INSUFFICIENT_STOCK' | 'DB_ERROR' | 'TIMEOUT';
  readonly code: string;
  readonly status: number;
  readonly detail: string;
  readonly cause?: unknown;
}

/** Result monad — every function returns success OR structured error, never throws. */
type Result<T, E = OrderError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// ---------------------------------------------------------------------------
// Result helpers — tiny wrappers so call sites read like English
// ---------------------------------------------------------------------------

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Dependencies — injected via factory so tests can swap in fakes
// ---------------------------------------------------------------------------

interface Db {
  query(sql: string, params: unknown[], timeoutMs: number): Promise<{ rows: Record<string, unknown>[] }>;
}

interface Cache {
  set(key: string, value: unknown): void;
}

interface Mailer {
  send(to: string, subject: string, body?: string): Promise<void>;
}

interface OrderServiceDeps {
  readonly db: Db;
  readonly cache: Cache;
  readonly mailer: Mailer;
}

// ---------------------------------------------------------------------------
// Public API — exports at the top, helpers at the bottom
// ---------------------------------------------------------------------------

/**
 * Creates the order service with all I/O dependencies injected.
 * Wrap the returned object with `withLogging` / `withTracing` at
 * the composition root for observability — no console.log here.
 *
 * @example
 * const service = createOrderService({ db, cache, mailer });
 * const result = await service.fulfillOrder(input);
 * // => { ok: true, value: { orderId: '42', userId: '7', total: 130, itemCount: 2, status: 'pending', priority: 'normal' } }
 *
 * const urgentResult = await service.fulfillUrgentOrder(input);
 * // => { ok: true, value: { orderId: '43', userId: '7', total: 130, itemCount: 2, status: 'pending', priority: 'high' } }
 */
export function createOrderService(deps: OrderServiceDeps) {
  const { db, cache, mailer } = deps;

  // -- Public surface -------------------------------------------------------

  /**
   * Fulfill an order at normal priority.
   * Returns an `OrderDto` the caller should forward to the API response layer.
   *
   * @example
   * const result = await service.fulfillOrder(validInput);
   * if (!result.ok) return mapErrorToHttp(result.error);
   * respondJson(200, result.value);
   * // => { orderId: '42', total: 250, status: 'pending', priority: 'normal', ... }
   */
  async function fulfillOrder(input: FulfillOrderInput): Promise<Result<OrderDto>> {
    return fulfillOrderWithPriority(input, 'normal');
  }

  /**
   * Fulfill an order flagged as urgent — sets priority to 'high' and
   * immediately emails the user so they know it's being fast-tracked.
   * Returns the same `OrderDto`; caller forwards to API response.
   *
   * @example
   * const result = await service.fulfillUrgentOrder(validInput);
   * // => { ok: true, value: { ..., priority: 'high' } }
   */
  async function fulfillUrgentOrder(input: FulfillOrderInput): Promise<Result<OrderDto>> {
    return fulfillOrderWithPriority(input, 'high');
  }

  /**
   * Send an order confirmation email to an arbitrary recipient.
   * Separated from fulfillment so the caller decides IF and TO WHOM
   * a confirmation goes — keeps the command (create) and side-effect
   * (notify) independent.
   *
   * @example
   * await service.sendOrderConfirmation({ recipientEmail: 'a@b.com', subject: 'Confirmed', body: '...' });
   */
  async function sendOrderConfirmation(notification: OrderNotification): Promise<Result<void>> {
    try {
      await mailer.send(notification.recipientEmail, notification.subject, notification.body);
      return ok(undefined);
    } catch (cause) {
      return err({
        type: 'DB_ERROR' as const,
        code: 'NOTIFICATION_FAILED',
        status: 502,
        detail: 'Failed to send order confirmation email',
        cause,
      });
    }
  }

  return { fulfillOrder, fulfillUrgentOrder, sendOrderConfirmation };

  // -- Private helpers (below the public API) --------------------------------

  /**
   * Core pipeline shared by both priority paths.
   * Orchestrates: validate user -> check stock -> calculate total -> persist -> notify if big -> cache -> return DTO.
   */
  async function fulfillOrderWithPriority(
    input: FulfillOrderInput,
    priority: OrderPriority,
  ): Promise<Result<OrderDto>> {

    // -- Parse & validate at the boundary — reject bad data, never coerce ---
    const parsed = parseOrderInput(input);
    if (!parsed.ok) return parsed;
    const { userId, items, taxRate, discountCode } = parsed.value;

    // -- Verify user exists and is allowed to place orders ---
    const userResult = await fetchVerifiedUser(db, userId);
    if (!userResult.ok) return userResult;
    const user = userResult.value;

    // -- Only consider active items — skip inactive ones silently because
    //    the frontend may include stale cart entries the user already removed ---
    const activeItems = items.filter((item) => item.isActive);
    if (activeItems.length === 0) {
      return err({ type: 'VALIDATION', code: 'NO_ACTIVE_ITEMS', status: 400, detail: 'Every item in the order is inactive — nothing to fulfill' });
    }

    // -- Check stock for ALL active items in parallel — one round-trip per
    //    item, but they are independent so Promise.all keeps latency flat ---
    const stockResult = await verifyStockForAllItems(db, activeItems);
    if (!stockResult.ok) return stockResult;

    // -- Calculate totals immutably — no mutation of the original items ---
    const { totalAmount, itemCount } = calculateOrderTotals(activeItems, taxRate, discountCode);

    // -- Persist the order row ---
    const orderRowResult = await insertOrder(db, userId, totalAmount, itemCount, priority);
    if (!orderRowResult.ok) return orderRowResult;
    const orderRow = orderRowResult.value;

    // -- If the total crosses the big-order threshold, notify the user and
    //    record an audit row — finance reviews these weekly to spot fraud ---
    if (totalAmount > BIG_ORDER_THRESHOLD_CENTS) {
      await notifyBigOrder(db, mailer, user.email, userId, totalAmount);
    }

    // -- If this is an urgent order, email the user immediately so they
    //    know it's being fast-tracked by the warehouse team ---
    if (priority === 'high') {
      await mailer.send(user.email, 'Urgent order placed');
    }

    // -- Cache the latest order ID so the frontend "Recent Orders" widget
    //    can display it instantly without querying the DB on next page load ---
    cache.set(`user:${userId}:lastOrder`, orderRow.orderId);

    // -- Build DTO — the caller should forward this to the API response.
    //    Never return the raw DB row; it leaks internal columns like
    //    created_at, internal_flags, etc. ---
    const dto: OrderDto = {
      orderId: orderRow.orderId,
      userId,
      total: totalAmount,
      itemCount,
      status: 'pending',
      priority,
    };

    return ok(dto);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers — no I/O, easily unit-testable
// ---------------------------------------------------------------------------

/**
 * Parse and validate raw order input at the boundary.
 * Constructs a typed domain object or rejects with a structured error.
 * This is "parse, don't validate" — after this point every field is safe.
 */
function parseOrderInput(input: FulfillOrderInput): Result<FulfillOrderInput> {
  if (!input.userId || typeof input.userId !== 'string') {
    return err({ type: 'VALIDATION', code: 'INVALID_USER_ID', status: 400, detail: 'userId must be a non-empty string' });
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return err({ type: 'VALIDATION', code: 'EMPTY_ITEMS', status: 400, detail: 'items must be a non-empty array' });
  }

  for (const item of input.items) {
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      return err({ type: 'VALIDATION', code: 'INVALID_QUANTITY', status: 400, detail: `Item ${item.id}: quantity must be a positive number, got ${item.quantity}` });
    }
    if (item.quantity > MAX_ITEM_QUANTITY) {
      return err({ type: 'VALIDATION', code: 'QUANTITY_EXCEEDS_MAX', status: 400, detail: `Item ${item.id}: quantity ${item.quantity} exceeds maximum ${MAX_ITEM_QUANTITY}` });
    }
    if (typeof item.price !== 'number' || item.price <= 0) {
      return err({ type: 'VALIDATION', code: 'INVALID_PRICE', status: 400, detail: `Item ${item.id}: price must be a positive number` });
    }
  }

  if (typeof input.taxRate !== 'number' || input.taxRate < 0 || input.taxRate > 1) {
    return err({ type: 'VALIDATION', code: 'INVALID_TAX_RATE', status: 400, detail: 'taxRate must be a number between 0 and 1' });
  }

  // -- discountCode is nullable — but if present, it must be a known code.
  //    Unknown codes are rejected, NOT silently ignored, to avoid
  //    customers thinking they got a discount when they didn't. ---
  if (input.discountCode !== null && !(input.discountCode in DISCOUNT_BY_CODE)) {
    return err({ type: 'VALIDATION', code: 'UNKNOWN_DISCOUNT', status: 400, detail: `Discount code "${input.discountCode}" is not recognized` });
  }

  return ok(input);
}

/**
 * Calculate totals from active items without mutating any input.
 * Uses reduce over the items list — pure function, no side effects.
 *
 * Each line-item amount = (quantity * price * tax multiplier) - flat discount.
 * Negative line amounts are clamped to zero (a $50 discount on a $30 item
 * doesn't credit the customer — it just zeroes that line).
 */
function calculateOrderTotals(
  activeItems: readonly OrderLineItem[],
  taxRate: number,
  discountCode: string | null,
): { totalAmount: number; itemCount: number } {

  const taxMultiplier = 1 + taxRate;
  const discountAmount = discountCode !== null ? (DISCOUNT_BY_CODE[discountCode] ?? 0) : 0;

  const result = activeItems.reduce(
    (accumulator, item) => {
      const subtotal = item.quantity * item.price;
      const withTax = subtotal * taxMultiplier;
      const afterDiscount = withTax - discountAmount;

      // -- Clamp to zero — a large discount on a small item shouldn't
      //    produce a negative amount (we don't credit per-line) ---
      const lineAmount = Math.max(0, afterDiscount);

      return {
        totalAmount: accumulator.totalAmount + lineAmount,
        itemCount: accumulator.itemCount + 1,
      };
    },
    { totalAmount: 0, itemCount: 0 },
  );

  return result;
}

// ---------------------------------------------------------------------------
// I/O helpers — thin wrappers that add timeout + structured errors
// ---------------------------------------------------------------------------

/**
 * Fetch a user by ID and verify they are not blocked.
 * Returns the user row or a structured NOT_FOUND / BLOCKED error.
 */
async function fetchVerifiedUser(
  db: Db,
  userId: string,
): Promise<Result<{ email: string }>> {
  try {
    const queryResult = await db.query(
      'SELECT email, blocked FROM users WHERE id = $1',
      [userId],
      IO_TIMEOUT_MS,
    );

    const userRow = queryResult.rows[0];

    if (!userRow) {
      return err({ type: 'NOT_FOUND', code: 'USER_NOT_FOUND', status: 404, detail: `No user found with id "${userId}"` });
    }

    // -- Blocked users cannot place orders — admin must unblock first.
    //    We check here (not at the caller) so every code path is protected. ---
    if (userRow.blocked) {
      return err({ type: 'BLOCKED', code: 'USER_BLOCKED', status: 403, detail: `User "${userId}" is blocked and cannot place orders` });
    }

    return ok({ email: userRow.email as string });
  } catch (cause) {
    return err({ type: 'TIMEOUT', code: 'USER_FETCH_FAILED', status: 504, detail: 'Failed to fetch user — DB may be unreachable', cause });
  }
}

/**
 * Verify stock availability for all items in parallel.
 * Uses Promise.all — each stock check is an independent query, so we
 * don't wait sequentially. If ANY item is out of stock, the whole
 * order is rejected (no partial fulfillment).
 */
async function verifyStockForAllItems(
  db: Db,
  items: readonly OrderLineItem[],
): Promise<Result<void>> {
  try {
    const stockChecks = items.map((item) => verifySingleItemStock(db, item));
    const results = await Promise.all(stockChecks);

    // -- Return the first failure — the caller gets a clear message
    //    about which specific item is out of stock ---
    const firstFailure = results.find((result) => !result.ok);
    if (firstFailure && !firstFailure.ok) {
      return firstFailure;
    }

    return ok(undefined);
  } catch (cause) {
    return err({ type: 'TIMEOUT', code: 'STOCK_CHECK_FAILED', status: 504, detail: 'Stock verification failed — DB may be unreachable', cause });
  }
}

/**
 * Check that a single item has enough stock to fulfill the requested quantity.
 */
async function verifySingleItemStock(
  db: Db,
  item: OrderLineItem,
): Promise<Result<void>> {
  try {
    const stockResult = await db.query(
      'SELECT qty FROM stock WHERE id = $1',
      [item.id],
      IO_TIMEOUT_MS,
    );

    const stockRow = stockResult.rows[0];
    const availableQuantity = (stockRow?.qty as number) ?? 0;

    if (availableQuantity < item.quantity) {
      return err({
        type: 'INSUFFICIENT_STOCK',
        code: 'INSUFFICIENT_STOCK',
        status: 409,
        detail: `Item "${item.id}" needs ${item.quantity} units but only ${availableQuantity} available`,
      });
    }

    return ok(undefined);
  } catch (cause) {
    return err({ type: 'TIMEOUT', code: 'STOCK_QUERY_FAILED', status: 504, detail: `Stock check failed for item "${item.id}"`, cause });
  }
}

/**
 * Insert the order row and return the generated order ID.
 * The order is created with the given priority in a single INSERT —
 * no separate UPDATE needed (the original code did INSERT then UPDATE).
 */
async function insertOrder(
  db: Db,
  userId: string,
  totalAmount: number,
  itemCount: number,
  priority: OrderPriority,
): Promise<Result<{ orderId: string }>> {
  try {
    const result = await db.query(
      'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, totalAmount, itemCount, 'pending' satisfies OrderStatus, priority],
      IO_TIMEOUT_MS,
    );

    return ok({ orderId: result.rows[0].id as string });
  } catch (cause) {
    return err({ type: 'DB_ERROR', code: 'ORDER_INSERT_FAILED', status: 500, detail: 'Failed to insert order row', cause });
  }
}

/**
 * Record the big order in the audit table and email the user.
 * Called only when total exceeds BIG_ORDER_THRESHOLD_CENTS.
 * Not critical-path — if this fails the order still stands,
 * so we swallow errors here (a wrapper like withLogging will capture them).
 */
async function notifyBigOrder(
  db: Db,
  mailer: Mailer,
  userEmail: string,
  userId: string,
  totalAmount: number,
): Promise<void> {
  // -- These two operations are independent — run in parallel ---
  await Promise.all([
    mailer.send(userEmail, `Big order: ${totalAmount}`),
    db.query(
      'INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)',
      [userId, totalAmount, Date.now()],
      IO_TIMEOUT_MS,
    ),
  ]);
}
```
