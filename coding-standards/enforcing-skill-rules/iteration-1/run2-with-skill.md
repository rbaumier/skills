# Run 2 — With Skill (Sonnet + coding-standards SKILL.md)

```typescript
/**
 * Order fulfillment module — validates user and items, calculates totals, persists the order.
 *
 * How it works:
 * 1. Fetch and validate the user (must exist, must not be blocked).
 * 2. Validate each line item against stock, compute totals with tax and discounts.
 * 3. Persist the order row and set priority.
 * 4. Fire side-effects (big-order alerts, confirmation emails) via injected dependencies.
 */

import type { Database } from './db';
import type { Cache } from './cache';
import type { Mailer } from './mailer';

// --- Constants — externalized so business params change without editing function bodies ---

/** Orders above this threshold trigger a notification to the user and a big_orders audit row. */
const BIG_ORDER_THRESHOLD_CENTS = 1000;

/** Discount codes mapped to their fixed deduction in cents. Add new codes here, not in logic. */
const DISCOUNT_AMOUNTS: Readonly<Record<string, number>> = {
  FREE50: 50,
  FREE20: 20,
} as const;

// --- Types — strict, no `any`, make invalid states unrepresentable ---

type OrderStatus = 'pending' | 'fulfilled' | 'cancelled';
type OrderPriority = 'high' | 'normal';

interface LineItem {
  readonly id: string;
  readonly qty: number;
  readonly price: number;
  readonly isActive: boolean;
}

interface FulfillOrderOptions {
  readonly userId: string;
  readonly items: ReadonlyArray<LineItem>;
  readonly isUrgent: boolean;
  readonly taxRate: number;
  readonly discountCode: string | null;
  readonly confirmationEmail: { readonly to: string } | null;
}

interface OrderRow {
  readonly id: string;
  readonly user_id: string;
  readonly total: number;
  readonly item_count: number;
  readonly status: OrderStatus;
  readonly priority: OrderPriority;
}

interface OrderResult {
  readonly orderId: string;
  readonly total: number;
  readonly itemCount: number;
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
    | 'INVALID_TAX_RATE'
    | 'INVALID_ITEM';
  readonly detail: string;
}

// --- Dependencies ---

interface OrderServiceDeps {
  readonly db: Database;
  readonly cache: Cache;
  readonly mailer: Mailer;
}

/**
 * Creates the order service. Call once at the composition root.
 *
 * @example
 * const orderService = createOrderService({ db, cache, mailer });
 * const result = await orderService.fulfillOrder({ userId: '42', items, ... });
 * if (!result.ok) handleOrderError(result.error);
 * // => { ok: true, value: { orderId: '99', total: 230, ... } }
 */
export function createOrderService(deps: OrderServiceDeps) {
  const { db, cache, mailer } = deps;

  function discountForCode(code: string | null): number {
    if (code === null) return 0;
    return DISCOUNT_AMOUNTS[code] ?? 0;
  }

  function computeLineTotal(
    qty: number,
    unitPrice: number,
    taxRate: number,
    discountCode: string | null,
  ): number {
    const subtotal = qty * unitPrice;
    const taxMultiplier = 1 + taxRate;
    const discount = discountForCode(discountCode);
    return subtotal * taxMultiplier - discount;
  }

  function validateLineItem(item: LineItem): string | null {
    if (item.qty <= 0) return `Item ${item.id}: qty must be positive, got ${item.qty}.`;
    if (item.price < 0) return `Item ${item.id}: price must be non-negative, got ${item.price}.`;
    if (!item.isActive) return `Item ${item.id}: item is inactive and cannot be ordered.`;
    return null;
  }

  async function checkStockForItems(
    activeItems: ReadonlyArray<LineItem>,
  ): Promise<Result<void, OrderError>> {
    for (const item of activeItems) {
      const stockResult = await db.query('SELECT qty FROM stock WHERE id = $1', [item.id]);
      const availableQty = stockResult.rows[0]?.qty ?? 0;

      if (availableQty < item.qty) {
        return err({
          type: 'INSUFFICIENT_STOCK',
          detail: `Item ${item.id} requested ${item.qty} but only ${availableQty} in stock. Reduce quantity or remove item.`,
        });
      }
    }
    return ok(undefined);
  }

  async function insertOrder(
    userId: string,
    total: number,
    itemCount: number,
    priority: OrderPriority,
  ): Promise<OrderRow> {
    const result = await db.query(
      'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, total, itemCount, 'pending', priority],
    );
    return result.rows[0] as OrderRow;
  }

  function toOrderResult(row: OrderRow): OrderResult {
    return {
      orderId: row.id,
      total: row.total,
      itemCount: row.item_count,
      status: row.status,
      priority: row.priority,
    };
  }

  async function fireSideEffects(
    userId: string,
    userEmail: string,
    order: OrderRow,
    total: number,
    isUrgent: boolean,
    confirmationEmail: { readonly to: string } | null,
  ): Promise<void> {
    // Big-order notification — alerts the user and creates an audit trail.
    if (total > BIG_ORDER_THRESHOLD_CENTS) {
      await Promise.all([
        mailer.send(userEmail, `Big order: ${total}`),
        db.query(
          'INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)',
          [userId, total, Date.now()],
        ),
      ]);
    }

    if (isUrgent) {
      await mailer.send(userEmail, 'Urgent order placed');
    }

    if (confirmationEmail !== null) {
      await mailer.send(confirmationEmail.to, 'Order confirmation', JSON.stringify(order));
    }

    // Cache the user's most recent order id — the dashboard reads this
    // to show "Your latest order" without a DB round-trip.
    cache.set(`user:${userId}:lastOrder`, order.id);
  }

  async function fulfillOrder(
    options: FulfillOrderOptions,
  ): Promise<Result<OrderResult, OrderError>> {
    const { userId, items, isUrgent, taxRate, discountCode, confirmationEmail } = options;

    if (taxRate < 0 || taxRate > 1) {
      return err({
        type: 'INVALID_TAX_RATE',
        detail: `Tax rate must be between 0 and 1, got ${taxRate}. Pass 0.1 for 10%.`,
      });
    }

    if (items.length === 0) {
      return err({
        type: 'EMPTY_ORDER',
        detail: 'Order must contain at least one item. Add items before submitting.',
      });
    }

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    if (!user) {
      return err({
        type: 'USER_NOT_FOUND',
        detail: `No user with id "${userId}". Verify the id and retry.`,
      });
    }

    if (user.blocked) {
      return err({
        type: 'USER_BLOCKED',
        detail: `User "${userId}" is blocked. Contact support to resolve account restrictions.`,
      });
    }

    for (const item of items) {
      const validationMessage = validateLineItem(item);
      if (validationMessage !== null) {
        return err({ type: 'INVALID_ITEM', detail: validationMessage });
      }
    }

    const stockCheck = await checkStockForItems(items);
    if (!stockCheck.ok) return stockCheck;

    const lineTotals = items.map((item) =>
      computeLineTotal(item.qty, item.price, taxRate, discountCode),
    );

    const chargeableLines = lineTotals.filter((amount) => amount > 0);
    const total = chargeableLines.reduce((sum, amount) => sum + amount, 0);
    const itemCount = chargeableLines.length;

    const priority: OrderPriority = isUrgent ? 'high' : 'normal';
    const orderRow = await insertOrder(userId, total, itemCount, priority);

    await fireSideEffects(userId, user.email, orderRow, total, isUrgent, confirmationEmail);

    return ok(toOrderResult(orderRow));
  }

  return { fulfillOrder } as const;
}
```
