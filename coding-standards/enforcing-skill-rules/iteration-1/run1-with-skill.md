# Run 1 — With Skill (Sonnet + coding-standards SKILL.md)

```typescript
/**
 * Order fulfillment module — validates a user, prices their cart, persists the order.
 *
 * How it works:
 * 1. Fetch and validate the user (must exist, must not be blocked).
 * 2. Resolve the discount amount from a known code lookup.
 * 3. Compute line-item totals (price * quantity * tax - discount), rejecting out-of-stock items.
 * 4. Persist the order row and set its priority.
 * 5. Fire side-effect notifications (big-order alert, urgent alert, confirmation email).
 * 6. Return the created order as a DTO.
 */

import type { Database } from './db';
import type { Cache } from './cache';
import type { Mailer } from './mailer';

// --- Constants — externalized so business params change without editing function bodies ---

/** Orders above this total trigger an internal "big order" alert to the user's email. */
const BIG_ORDER_THRESHOLD_CENTS = 1000;

/** Discount lookup — maps code string to the flat amount subtracted from each line item. */
const DISCOUNT_AMOUNT_BY_CODE: Readonly<Record<string, number>> = {
  FREE50: 50,
  FREE20: 20,
} as const;

// --- Types — strict, no `any`, making invalid states unrepresentable ---

/** Status is a closed union so callers can exhaustively match. */
type OrderPriority = 'high' | 'normal';

/** A single cart line the caller must provide. */
interface CartItem {
  readonly id: string;
  readonly qty: number;
  readonly price: number;
  readonly isActive: boolean;
}

/** Options bag — avoids > 3 positional args and boolean-flag splitting. */
interface FulfillOrderOptions {
  readonly userId: string;
  readonly items: ReadonlyArray<CartItem>;
  readonly isUrgent: boolean;
  readonly confirmationEmailTo: string | null;
  readonly taxRate: number;
  readonly discountCode: string | null;
}

/** The shape returned to callers — a DTO, never the raw DB row. */
interface OrderDto {
  readonly id: string;
  readonly userId: string;
  readonly total: number;
  readonly itemCount: number;
  readonly status: string;
  readonly priority: OrderPriority;
}

/** Structured error — every failure path returns one of these, never throws. */
interface OrderError {
  readonly type: 'USER_NOT_FOUND' | 'USER_BLOCKED' | 'INSUFFICIENT_STOCK' | 'EMPTY_ORDER';
  readonly detail: string;
}

/** Discriminated union so callers can exhaustively handle success/failure. */
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// --- Result helpers ---

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// --- Dependencies — injected via factory so tests can swap every I/O seam ---

interface OrderServiceDeps {
  readonly db: Database;
  readonly cache: Cache;
  readonly mailer: Mailer;
}

/**
 * Factory that wires the order service to its I/O dependencies.
 *
 * @example
 * const svc = createOrderService({ db, cache, mailer });
 * const result = await svc.fulfillOrder({ userId: '42', items, ... });
 * // => { ok: true, value: { id: '99', total: 230, ... } }
 */
export function createOrderService({ db, cache, mailer }: OrderServiceDeps) {

  async function fetchValidatedUser(
    userId: string,
  ): Promise<Result<{ id: string; email: string }, OrderError>> {
    const result = await db.query('SELECT id, email, blocked FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user) {
      return err({
        type: 'USER_NOT_FOUND',
        detail: `No user with id "${userId}". Verify the id and retry.`,
      });
    }

    if (user.blocked) {
      return err({
        type: 'USER_BLOCKED',
        detail: `User "${userId}" is blocked. Unblock them in the admin panel before placing orders.`,
      });
    }

    return ok({ id: user.id, email: user.email });
  }

  function computeLineAmount(item: CartItem, taxRate: number, discountCode: string | null): number {
    const taxMultiplier = 1 + taxRate;
    const subtotal = item.qty * item.price * taxMultiplier;
    const discountAmount = discountCode ? (DISCOUNT_AMOUNT_BY_CODE[discountCode] ?? 0) : 0;
    const lineTotal = subtotal - discountAmount;
    return Math.max(lineTotal, 0);
  }

  async function verifyStock(
    itemId: string,
    requestedQty: number,
  ): Promise<Result<void, OrderError>> {
    const result = await db.query('SELECT qty FROM stock WHERE id = $1', [itemId]);
    const availableQty = result.rows[0]?.qty ?? 0;

    if (availableQty < requestedQty) {
      return err({
        type: 'INSUFFICIENT_STOCK',
        detail: `Item "${itemId}" has ${availableQty} in stock but ${requestedQty} were requested.`,
      });
    }

    return ok(undefined);
  }

  async function priceCart(
    items: ReadonlyArray<CartItem>,
    taxRate: number,
    discountCode: string | null,
  ): Promise<Result<{ total: number; itemCount: number }, OrderError>> {
    let total = 0;
    let itemCount = 0;

    for (const item of items) {
      if (item.qty <= 0 || !item.isActive) continue;

      const lineAmount = computeLineAmount(item, taxRate, discountCode);
      if (lineAmount <= 0) continue;

      const stockResult = await verifyStock(item.id, item.qty);
      if (!stockResult.ok) return stockResult;

      total += lineAmount;
      itemCount++;
    }

    if (itemCount === 0) {
      return err({
        type: 'EMPTY_ORDER',
        detail: 'No priceable items in the cart. Add at least one active item with qty > 0.',
      });
    }

    return ok({ total, itemCount });
  }

  async function persistOrder(
    userId: string,
    total: number,
    itemCount: number,
    priority: OrderPriority,
  ): Promise<OrderDto> {
    const insertResult = await db.query(
      'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, total, itemCount, 'pending', priority],
    );

    return mapRowToDto(insertResult.rows[0]);
  }

  function mapRowToDto(row: Record<string, unknown>): OrderDto {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      total: row.total as number,
      itemCount: row.item_count as number,
      status: row.status as string,
      priority: row.priority as OrderPriority,
    };
  }

  async function sendNotifications(
    userEmail: string,
    order: OrderDto,
    isUrgent: boolean,
    confirmationEmailTo: string | null,
  ): Promise<void> {
    const notifications: Array<Promise<void>> = [];

    // Big-order alert — ops team wants visibility on orders above the threshold.
    if (order.total > BIG_ORDER_THRESHOLD_CENTS) {
      notifications.push(
        mailer.send(userEmail, `Big order: ${order.total}`),
        db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [
          order.userId,
          order.total,
          Date.now(),
        ]).then(() => undefined),
      );
    }

    if (isUrgent) {
      notifications.push(mailer.send(userEmail, 'Urgent order placed'));
    }

    if (confirmationEmailTo) {
      notifications.push(
        mailer.send(confirmationEmailTo, 'Order confirmation', JSON.stringify(order)),
      );
    }

    await Promise.all(notifications);
  }

  async function fulfillOrder(options: FulfillOrderOptions): Promise<Result<OrderDto, OrderError>> {
    const { userId, items, isUrgent, confirmationEmailTo, taxRate, discountCode } = options;

    const userResult = await fetchValidatedUser(userId);
    if (!userResult.ok) return userResult;
    const user = userResult.value;

    const cartResult = await priceCart(items, taxRate, discountCode);
    if (!cartResult.ok) return cartResult;
    const { total, itemCount } = cartResult.value;

    const priority: OrderPriority = isUrgent ? 'high' : 'normal';
    const order = await persistOrder(userId, total, itemCount, priority);

    // Cache the latest order id — downstream pages use this to show "your last order".
    cache.set(`user:${userId}:lastOrder`, order.id);

    // Fire side-effect emails concurrently — failures here should not roll back the order.
    await sendNotifications(user.email, order, isUrgent, confirmationEmailTo);

    return ok(order);
  }

  return { fulfillOrder } as const;
}
```
