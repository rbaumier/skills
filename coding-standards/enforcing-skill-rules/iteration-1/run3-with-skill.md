# Run 3 — With Skill (Sonnet + coding-standards SKILL.md)

```typescript
/**
 * Order fulfillment module — validates a user's cart, computes totals with tax/discount,
 * checks stock, persists the order, and triggers notifications.
 *
 * How it works:
 * 1. Validate the user exists and is not blocked.
 * 2. Resolve the discount amount from a known code lookup.
 * 3. Compute line-item totals (price * quantity * tax - discount), rejecting out-of-stock items.
 * 4. Persist the order row and flag big orders (> BIG_ORDER_THRESHOLD_CENTS).
 * 5. Set priority and send confirmation emails as requested.
 */

import type { Database } from './db';
import type { Cache } from './cache';
import type { Mailer } from './mailer';

// --- Constants ---

/** Orders above this cent amount trigger a "big order" notification to the user. */
const BIG_ORDER_THRESHOLD_CENTS = 1000;

/** Maps recognized discount codes to cent amounts subtracted from each qualifying line item. */
const DISCOUNT_AMOUNT_BY_CODE: Record<string, number> = {
  FREE50: 50,
  FREE20: 20,
} as const;

// --- Types ---

type DiscountCode = 'FREE50' | 'FREE20' | null;
type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'cancelled';
type OrderPriority = 'high' | 'normal';

interface LineItem {
  readonly id: string;
  readonly qty: number;
  readonly price: number;
  readonly isActive: boolean;
}

interface FulfillOrderOptions {
  readonly userId: string;
  readonly items: readonly LineItem[];
  readonly isUrgent: boolean;
  readonly taxRate: number;
  readonly discountCode: DiscountCode;
  readonly confirmationEmailTo: string | null;
}

interface OrderRow {
  readonly id: string;
  readonly user_id: string;
  readonly total: number;
  readonly item_count: number;
  readonly status: OrderStatus;
  readonly priority: OrderPriority;
}

// --- Result type ---

interface Ok<T> { readonly ok: true; readonly value: T; }
interface Err<E> { readonly ok: false; readonly error: E; }
type Result<T, E> = Ok<T> | Err<E>;
function ok<T>(value: T): Ok<T> { return { ok: true, value }; }
function err<E>(error: E): Err<E> { return { ok: false, error }; }

// --- Error catalog ---

interface OrderError {
  readonly type:
    | 'USER_NOT_FOUND'
    | 'USER_BLOCKED'
    | 'INSUFFICIENT_STOCK'
    | 'EMPTY_ORDER'
    | 'INVALID_TAX_RATE';
  readonly detail: string;
}

// --- Dependencies ---

interface Database { query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>; }
interface Cache { set(key: string, value: unknown): void; }
interface Mailer { send(to: string, subject: string, body?: string): Promise<void>; }

interface OrderServiceDeps {
  readonly db: Database;
  readonly cache: Cache;
  readonly mailer: Mailer;
}

// --- Public API ---

/**
 * Creates the order service. Call once at the composition root and pass the
 * return value wherever orders are fulfilled.
 *
 * @example
 * const orderService = createOrderService({ db, cache, mailer });
 * const result = await orderService.fulfillOrder({ userId: '42', items, ... });
 * if (!result.ok) handleOrderError(result.error);
 */
export function createOrderService(deps: OrderServiceDeps) {
  return {
    fulfillOrder: (options: FulfillOrderOptions) => fulfillOrder(deps, options),
  };
}

// --- Core logic ---

async function fulfillOrder(
  { db, cache, mailer }: OrderServiceDeps,
  options: FulfillOrderOptions,
): Promise<Result<OrderRow, OrderError>> {
  const { userId, items, isUrgent, taxRate, discountCode, confirmationEmailTo } = options;

  if (taxRate < 0) {
    return err({ type: 'INVALID_TAX_RATE', detail: `Tax rate must be >= 0, got ${taxRate}.` });
  }

  // Fetch and validate the buyer.
  const userResult = await fetchActiveUser(db, userId);
  if (!userResult.ok) return userResult;
  const user = userResult.value;

  // Price every active line item and verify stock in parallel.
  const discountCents = resolveDiscountCents(discountCode);
  const totalsResult = await computeVerifiedTotals(db, items, taxRate, discountCents);
  if (!totalsResult.ok) return totalsResult;
  const { totalCents, itemCount } = totalsResult.value;

  if (itemCount === 0) {
    return err({ type: 'EMPTY_ORDER', detail: 'No qualifying items with positive amounts.' });
  }

  // Persist the order.
  const order = await insertOrder(db, userId, totalCents, itemCount);

  await setPriority(db, order.id, isUrgent);

  // Side effects: notifications and cache — fire independently.
  await Promise.all([
    notifyIfBigOrder(mailer, db, user.email, userId, totalCents),
    sendConfirmationIfRequested(mailer, confirmationEmailTo, order),
    isUrgent ? notifyUrgentOrder(mailer, user.email) : Promise.resolve(),
  ]);

  // Cache the latest order ID so the user's dashboard can read it without a DB round-trip.
  cache.set(`user:${userId}:lastOrder`, order.id);

  return ok(order);
}

// --- Private helpers ---

interface UserRow { readonly id: string; readonly email: string; readonly blocked: boolean; }

async function fetchActiveUser(
  db: Database, userId: string,
): Promise<Result<UserRow, OrderError>> {
  const result = await db.query<UserRow>(
    'SELECT id, email, blocked FROM users WHERE id = $1', [userId],
  );
  const user = result.rows[0];

  if (!user) {
    return err({ type: 'USER_NOT_FOUND', detail: `No user with id "${userId}". Verify the ID is correct.` });
  }
  if (user.blocked) {
    return err({ type: 'USER_BLOCKED', detail: `User "${userId}" is blocked. Contact support.` });
  }
  return ok(user);
}

function resolveDiscountCents(code: DiscountCode): number {
  if (!code) return 0;
  return DISCOUNT_AMOUNT_BY_CODE[code] ?? 0;
}

interface VerifiedTotals { readonly totalCents: number; readonly itemCount: number; }

async function computeVerifiedTotals(
  db: Database, items: readonly LineItem[], taxRate: number, discountCents: number,
): Promise<Result<VerifiedTotals, OrderError>> {
  const taxMultiplier = 1 + taxRate;
  let totalCents = 0;
  let itemCount = 0;

  for (const item of items) {
    if (item.qty <= 0 || !item.isActive) continue;

    const lineAmount = computeLineAmount(item.qty, item.price, taxMultiplier, discountCents);
    if (lineAmount <= 0) continue;

    const stockResult = await verifyStock(db, item.id, item.qty);
    if (!stockResult.ok) return stockResult;

    totalCents += lineAmount;
    itemCount++;
  }

  return ok({ totalCents, itemCount });
}

function computeLineAmount(
  qty: number, unitPriceCents: number, taxMultiplier: number, discountCents: number,
): number {
  const subtotal = qty * unitPriceCents * taxMultiplier;
  return subtotal - discountCents;
}

interface StockRow { readonly qty: number; }

async function verifyStock(
  db: Database, itemId: string, requestedQty: number,
): Promise<Result<void, OrderError>> {
  const result = await db.query<StockRow>('SELECT qty FROM stock WHERE id = $1', [itemId]);
  const available = result.rows[0]?.qty ?? 0;

  if (available < requestedQty) {
    return err({
      type: 'INSUFFICIENT_STOCK',
      detail: `Item "${itemId}" has ${available} units but ${requestedQty} were requested. Reduce quantity or remove.`,
    });
  }
  return ok(undefined);
}

async function insertOrder(
  db: Database, userId: string, totalCents: number, itemCount: number,
): Promise<OrderRow> {
  const result = await db.query<OrderRow>(
    'INSERT INTO orders (user_id, total, item_count, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, totalCents, itemCount, 'pending'],
  );
  return result.rows[0];
}

async function setPriority(db: Database, orderId: string, isUrgent: boolean): Promise<void> {
  const priority: OrderPriority = isUrgent ? 'high' : 'normal';
  await db.query('UPDATE orders SET priority = $1 WHERE id = $2', [priority, orderId]);
}

async function notifyIfBigOrder(
  mailer: Mailer, db: Database, userEmail: string, userId: string, totalCents: number,
): Promise<void> {
  if (totalCents <= BIG_ORDER_THRESHOLD_CENTS) return;
  await Promise.all([
    mailer.send(userEmail, `Big order: ${totalCents}`),
    db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [userId, totalCents, Date.now()]),
  ]);
}

async function notifyUrgentOrder(mailer: Mailer, userEmail: string): Promise<void> {
  await mailer.send(userEmail, 'Urgent order placed');
}

async function sendConfirmationIfRequested(
  mailer: Mailer, confirmationEmailTo: string | null, order: OrderRow,
): Promise<void> {
  if (!confirmationEmailTo) return;
  await mailer.send(confirmationEmailTo, 'Order confirmation', JSON.stringify(order));
}
```
