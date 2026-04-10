# Run 2 — With Skill (Opus + coding-standards SKILL.md)

## Violations Found

| # | Rule | Violation | Fix |
|---|------|-----------|-----|
| 1 | Naming: banned words | `handleOrderData` uses `handle` + `data` | Rename to `fulfillOrder` |
| 2 | Naming: abbreviations | `u`, `usr`, `ct`, `itm`, `amt`, `s`, `i` | Full words: `userResult`, `user`, `itemCount`, `item`, `lineTotal`, `stockRow` |
| 3 | No default params | `taxRate ? 1 + taxRate : 1` acts as implicit default | Reject invalid input at barricade |
| 4 | Result for ALL errors | Six `throw new Error(...)` | Return `Result<T, E>` everywhere |
| 5 | Error messages ARE comments | `'not found'`, `'stock'`, `'blocked'` | Actionable messages with remediation |
| 6 | Bound every input — reject | No validation on `userId`, `items`, `taxRate`, `qty`, `price` | Validate and reject at barricade |
| 7 | `?? defaultValue` on external input | `discountCode === 'FREE50' ? 50 : ... : 0` silently ignores unknown codes | Reject unknown discount codes with Result error |
| 8 | Max 3 positional args | `handleOrderData` has 7 positional args | Options object `FulfillOrderOptions` |
| 9 | Boolean flag -> two functions | `isUrgent` controls branch, `sendEmail` controls branch | Split `fulfillUrgentOrder` / `fulfillNormalOrder`; remove `sendEmail` flag, make confirmation explicit |
| 10 | Inject deps via factory | Hard-wired `db`, `cache`, `mailer` imports | `createOrderService({ db, cache, mailer })` |
| 11 | Max 30 lines per function | `handleOrderData` is ~35 lines of dense logic | Extract helpers: `lookupUser`, `computeOrderTotals`, `checkStockForItems`, `persistOrder`, `fireSideEffects` |
| 12 | One level of abstraction | Mixes orchestration with inline arithmetic and SQL | Separate pure computation from I/O |
| 13 | `Promise.all` for independent async ops | Sequential `await db.query` for stock checks; sequential side-effect sends | `Promise.all` where calls are independent |
| 14 | Timeout on every I/O | No timeouts on `db.query`, `mailer.send`, `cache.set` | Require `withTimeout` via deps |
| 15 | Intermediate variables | `itm.qty * itm.price * (taxRate ? 1 + taxRate : 1) - (...)` compound inline | Break into `subtotal`, `taxMultiplier`, `discount`, `lineTotal` |
| 16 | No nested ternaries | Discount ternary chain | Object map `DISCOUNT_AMOUNTS` |
| 17 | Extract literals to named constants | `1000`, `0.9`, `'pending'`, `'high'`, `'normal'`, `'FREE50'`, `'FREE20'` | Named constants |
| 18 | Strict typing | `any` in `OrderInput`, params untyped, `OrderStatus = string` | Union literals, strict interfaces |
| 19 | Data clumps -> Value Object | `to, name, amount, currency` repeated in `formatEmail`, `formatReceipt`, `formatInvoice` | Extract `MoneyRecipient` value object |
| 20 | Law of Demeter | `order.customer.address.street` — 3 dots deep | Expose `order.shippingLabel()` or pass flat data |
| 21 | Crosscutting via wrapping | `console.log` inside business logic | Remove; logging via `withLogging(service)` wrapper |
| 22 | Map DB entities to DTOs | Returns raw `order.rows[0]` | Map to `OrderResult` DTO |
| 23 | Module-level orientation | No module comment | Add "What it does" + "How it works" |
| 24 | JSDoc on exported functions | None | Add block description + `@example` |
| 25 | Comments — why & consequences | Zero comments | Add why/consequence comments |
| 26 | Unused params | `applyBulkDiscount` takes `retryCount`, `retryDelayMs`, `maxRetries` — unused | Remove dead params |
| 27 | Dead code | `formatEmail`, `formatReceipt`, `formatInvoice`, `getShippingLabel`, `validateOrder` — unexported, unused | Remove or export with purpose |
| 28 | Redundant check | `!usr.blocked` rechecked inside loop after early-return guard | Remove duplicate |
| 29 | Immutable — no mutation | `let total = 0; total += amt` mutates | `reduce` over line totals |
| 30 | CQS | `fulfillOrder` both mutates state and returns data | Acceptable for commands returning confirmation; document the choice |
| 31 | No `any` | `order: any`, `items: any[]`, `userId: any` | Strict types |
| 32 | Option for absence | `removeCartItem` throws on missing cart/item — absence is normal | Return `Option<void>` / idempotent design ("define errors out of existence") |
| 33 | Barricade pattern | Validation scattered inside loops and deep logic | Validate all inputs at function entry |
| 34 | No default parameters — explicit factories | `applyBulkDiscount` unused retry params suggest hidden defaulting | Remove; if retry needed, separate concern |
| 35 | Reuse before creating | Three `format*` functions with identical signatures and near-identical logic | Single `formatDocument` with template, or a `MoneyRecipient` value object with `.format(template)` |

## Refactored Code

```typescript
/**
 * Order fulfillment module — validates users and line items, computes totals, persists orders.
 *
 * How it works:
 * 1. Validate all inputs at the barricade (user exists, not blocked, items valid, stock available).
 * 2. Compute line totals with tax and discount (pure math, no I/O).
 * 3. Persist the order row with priority already set (single INSERT, no UPDATE round-trip).
 * 4. Fire side-effects (big-order alerts, confirmation emails) in parallel via injected deps.
 */

// --- Result type — every function returns Result, never throws ---

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

type Result<T, E> = Ok<T> | Err<E>;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// --- Option type — for normal absence, not failure ---

type Option<T> = T | null;

// --- Structured errors — type + detail with remediation ---

interface OrderError {
  readonly type:
    | 'USER_NOT_FOUND'
    | 'USER_BLOCKED'
    | 'INSUFFICIENT_STOCK'
    | 'EMPTY_ORDER'
    | 'INVALID_TAX_RATE'
    | 'INVALID_ITEM'
    | 'UNKNOWN_DISCOUNT_CODE';
  readonly detail: string;
}

// --- Constants — externalized so business params change without editing functions ---

/** Orders above this amount trigger a big-order alert email and an audit row. */
const BIG_ORDER_THRESHOLD_CENTS = 1000;

/** Bulk discount multiplier — applied uniformly to every item's unit price. */
const BULK_DISCOUNT_MULTIPLIER = 0.9;

/**
 * Discount codes mapped to their fixed cent deduction per line item.
 * Add new codes here — the computation logic reads this map, no branching needed.
 */
const DISCOUNT_AMOUNTS: Readonly<Record<string, number>> = {
  FREE50: 50,
  FREE20: 20,
} as const;

// --- Domain types — strict, no `any`, make invalid states unrepresentable ---

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
  readonly taxRate: number;
  readonly discountCode: string | null;
  readonly confirmationEmailTo: string | null;
}

/** DTO returned to callers — never expose raw DB rows. */
interface OrderResult {
  readonly orderId: string;
  readonly total: number;
  readonly itemCount: number;
  readonly status: OrderStatus;
  readonly priority: OrderPriority;
}

/** Value object — groups the recurring (to, name, amount, currency) data clump. */
interface MoneyRecipient {
  readonly to: string;
  readonly name: string;
  readonly amount: number;
  readonly currency: string;
}

// --- Internal types ---

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly blocked: boolean;
}

interface OrderRow {
  readonly id: string;
  readonly user_id: string;
  readonly total: number;
  readonly item_count: number;
  readonly status: OrderStatus;
  readonly priority: OrderPriority;
}

// --- Dependencies — injected via factory, never imported directly ---

interface Database {
  query(sql: string, params: ReadonlyArray<unknown>): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }>;
}

interface Mailer {
  send(to: string, subject: string, body?: string): Promise<void>;
}

interface Cache {
  set(key: string, value: unknown): void;
}

interface OrderServiceDeps {
  readonly db: Database;
  readonly cache: Cache;
  readonly mailer: Mailer;
}

// --- Pure helpers (no I/O, no deps) ---

/**
 * Looks up the cent deduction for a discount code.
 * Returns Result error for unknown codes — we reject rather than silently defaulting to zero,
 * because a typo in a code should surface immediately, not charge the customer full price.
 *
 * @example
 * resolveDiscount('FREE50') // => ok(50)
 * resolveDiscount('TYPO')   // => err({ type: 'UNKNOWN_DISCOUNT_CODE', ... })
 * resolveDiscount(null)     // => ok(0)
 */
function resolveDiscount(code: string | null): Result<number, OrderError> {
  if (code === null) {
    return ok(0);
  }

  const amount = DISCOUNT_AMOUNTS[code];

  if (amount === undefined) {
    return err({
      type: 'UNKNOWN_DISCOUNT_CODE',
      detail: `Discount code "${code}" is not recognized. Valid codes: ${Object.keys(DISCOUNT_AMOUNTS).join(', ')}.`,
    });
  }

  return ok(amount);
}

/**
 * Computes total for one line item after tax and discount.
 * Pure arithmetic — no I/O, no side effects.
 *
 * @example
 * computeLineTotal(2, 100, 0.1, 50) // => 170  (2*100*1.1 - 50)
 */
function computeLineTotal(
  qty: number,
  unitPrice: number,
  taxRate: number,
  discountCents: number,
): number {
  const subtotal = qty * unitPrice;
  const taxMultiplier = 1 + taxRate;
  const totalBeforeDiscount = subtotal * taxMultiplier;

  return totalBeforeDiscount - discountCents;
}

/**
 * Validates a single line item at the barricade boundary.
 * Returns null when valid, or a human-readable reason when invalid.
 */
function validateLineItem(item: LineItem): Option<string> {
  if (item.qty <= 0) {
    return `Item "${item.id}": qty must be positive, got ${item.qty}. Fix the quantity before resubmitting.`;
  }

  if (item.price < 0) {
    return `Item "${item.id}": price must be non-negative, got ${item.price}. Check catalog pricing.`;
  }

  if (!item.isActive) {
    return `Item "${item.id}" is inactive and cannot be ordered. Remove it from the cart.`;
  }

  return null;
}

/**
 * Maps a raw DB order row to the public DTO.
 * Callers never see internal column names like `user_id` or `item_count`.
 */
function toOrderResult(row: OrderRow): OrderResult {
  return {
    orderId: row.id,
    total: row.total,
    itemCount: row.item_count,
    status: row.status,
    priority: row.priority,
  };
}

/**
 * Formats a document (email, receipt, invoice) from a money-recipient value object.
 * Eliminates the data clump of (to, name, amount, currency) repeated across callers.
 *
 * @example
 * const recipient = { to: 'a@b.com', name: 'Alice', amount: 99, currency: 'USD' };
 * formatDocument(recipient, emailTemplate) // => "To: a@b.com\nDear Alice, your total is 99 USD"
 */
function formatDocument(
  recipient: MoneyRecipient,
  template: (r: MoneyRecipient) => string,
): string {
  return template(recipient);
}

const emailTemplate = (r: MoneyRecipient): string =>
  `To: ${r.to}\nDear ${r.name}, your total is ${r.amount} ${r.currency}`;

const receiptTemplate = (r: MoneyRecipient): string =>
  `Receipt for ${r.name}: ${r.amount} ${r.currency}\nSent to: ${r.to}`;

const invoiceTemplate = (r: MoneyRecipient): string =>
  `Invoice for ${r.name}: ${r.amount} ${r.currency}\nBilling: ${r.to}`;

// --- Shipping label — flat data, no Law of Demeter violation ---

interface ShippingAddress {
  readonly street: string;
  readonly city: string;
  readonly zip: string;
}

/**
 * Builds a shipping label from a flat address.
 * Callers pass the address directly — no reaching through `order.customer.address`.
 *
 * @example
 * buildShippingLabel({ street: '1 Main', city: 'NYC', zip: '10001' })
 * // => "1 Main, NYC, 10001"
 */
function buildShippingLabel(address: ShippingAddress): string {
  return `${address.street}, ${address.city}, ${address.zip}`;
}

// --- Bulk discount — no dead params, strict input ---

/**
 * Applies the standard 10% bulk discount to every item's unit price.
 * Returns new array — inputs are never mutated.
 *
 * @example
 * applyBulkDiscount([{ id: '1', qty: 2, price: 100, isActive: true }])
 * // => [{ id: '1', qty: 2, price: 90, isActive: true }]
 */
export function applyBulkDiscount(items: ReadonlyArray<LineItem>): ReadonlyArray<LineItem> {
  return items.map((item) => ({
    ...item,
    price: item.price * BULK_DISCOUNT_MULTIPLIER,
  }));
}

// --- Order service — factory DI, composition root is the only place knowing concretions ---

/**
 * Creates the order service with injected dependencies.
 * Call once at the composition root, pass the return value to handlers.
 *
 * @example
 * const orderService = createOrderService({ db, cache, mailer });
 * const result = await orderService.fulfillUrgentOrder({ userId: '42', items, taxRate: 0.1, discountCode: null, confirmationEmailTo: null });
 * if (!result.ok) console.error(result.error.detail);
 * // => { ok: true, value: { orderId: '99', total: 230, itemCount: 2, status: 'pending', priority: 'high' } }
 */
export function createOrderService(deps: OrderServiceDeps) {
  const { db, cache, mailer } = deps;

  // --- I/O helpers (private, never exported) ---

  async function lookupUser(userId: string): Promise<Result<UserRow, OrderError>> {
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0] as UserRow | undefined;

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

    return ok(user);
  }

  async function checkStockForItems(
    items: ReadonlyArray<LineItem>,
  ): Promise<Result<void, OrderError>> {
    // All stock queries are independent — run in parallel to avoid sequential round-trips.
    const stockResults = await Promise.all(
      items.map((item) => db.query('SELECT qty FROM stock WHERE id = $1', [item.id])),
    );

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const availableQty = (stockResults[index].rows[0] as { qty: number } | undefined)?.qty ?? 0;

      if (availableQty < item.qty) {
        return err({
          type: 'INSUFFICIENT_STOCK',
          detail: `Item "${item.id}" requested ${item.qty} but only ${availableQty} available. Reduce quantity or remove the item.`,
        });
      }
    }

    return ok(undefined);
  }

  async function persistOrder(
    userId: string,
    total: number,
    itemCount: number,
    priority: OrderPriority,
  ): Promise<OrderRow> {
    // Single INSERT with priority — avoids the original's INSERT-then-UPDATE round-trip.
    const result = await db.query(
      'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, total, itemCount, 'pending', priority],
    );

    return result.rows[0] as OrderRow;
  }

  async function fireSideEffects(
    userId: string,
    userEmail: string,
    orderRow: OrderRow,
    total: number,
    isUrgent: boolean,
    confirmationEmailTo: string | null,
  ): Promise<void> {
    const sideEffects: Array<Promise<unknown>> = [];

    // Big-order alert — notifies the user and creates an audit trail so finance can review.
    if (total > BIG_ORDER_THRESHOLD_CENTS) {
      sideEffects.push(mailer.send(userEmail, `Big order: ${total}`));
      sideEffects.push(
        db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [
          userId,
          total,
          Date.now(),
        ]),
      );
    }

    if (isUrgent) {
      sideEffects.push(mailer.send(userEmail, 'Urgent order placed'));
    }

    if (confirmationEmailTo !== null) {
      sideEffects.push(
        mailer.send(confirmationEmailTo, 'Order confirmation', JSON.stringify(toOrderResult(orderRow))),
      );
    }

    // All side-effects are independent — fire in parallel to reduce latency.
    await Promise.all(sideEffects);

    // Cache the user's latest order id — the dashboard reads this to show
    // "Your latest order" without a DB round-trip.
    cache.set(`user:${userId}:lastOrder`, orderRow.id);
  }

  // --- Core pipeline (shared by both priority variants) ---

  async function fulfillOrderWithPriority(
    options: FulfillOrderOptions,
    priority: OrderPriority,
  ): Promise<Result<OrderResult, OrderError>> {
    const { userId, items, taxRate, discountCode, confirmationEmailTo } = options;

    // --- Barricade: validate everything before any I/O ---

    if (items.length === 0) {
      return err({
        type: 'EMPTY_ORDER',
        detail: 'Order must contain at least one item. Add items before submitting.',
      });
    }

    if (taxRate < 0 || taxRate > 1) {
      return err({
        type: 'INVALID_TAX_RATE',
        detail: `Tax rate must be between 0 and 1, got ${taxRate}. Pass 0.1 for 10%.`,
      });
    }

    for (const item of items) {
      const validationMessage = validateLineItem(item);
      if (validationMessage !== null) {
        return err({ type: 'INVALID_ITEM', detail: validationMessage });
      }
    }

    const discountResult = resolveDiscount(discountCode);
    if (!discountResult.ok) return discountResult;
    const discountCents = discountResult.value;

    // --- I/O phase: user lookup + stock check ---

    const userResult = await lookupUser(userId);
    if (!userResult.ok) return userResult;
    const user = userResult.value;

    const stockCheck = await checkStockForItems(items);
    if (!stockCheck.ok) return stockCheck;

    // --- Pure computation: totals ---

    const lineTotals = items.map((item) =>
      computeLineTotal(item.qty, item.price, taxRate, discountCents),
    );
    const chargeableLineTotals = lineTotals.filter((amount) => amount > 0);
    const total = chargeableLineTotals.reduce((sum, amount) => sum + amount, 0);
    const itemCount = chargeableLineTotals.length;

    // --- Persist + side-effects ---

    const orderRow = await persistOrder(userId, total, itemCount, priority);
    const isUrgent = priority === 'high';
    await fireSideEffects(userId, user.email, orderRow, total, isUrgent, confirmationEmailTo);

    return ok(toOrderResult(orderRow));
  }

  // --- Public API: two named functions instead of a boolean flag ---

  /**
   * Fulfill an urgent order — priority set to 'high', triggers urgent notification.
   *
   * @example
   * const result = await service.fulfillUrgentOrder({ userId: '1', items, taxRate: 0.1, discountCode: null, confirmationEmailTo: null });
   * if (!result.ok) log(result.error.detail);
   * // => { ok: true, value: { orderId: '7', total: 220, itemCount: 2, status: 'pending', priority: 'high' } }
   */
  async function fulfillUrgentOrder(
    options: FulfillOrderOptions,
  ): Promise<Result<OrderResult, OrderError>> {
    return fulfillOrderWithPriority(options, 'high');
  }

  /**
   * Fulfill a normal-priority order.
   *
   * @example
   * const result = await service.fulfillNormalOrder({ userId: '1', items, taxRate: 0.1, discountCode: 'FREE50', confirmationEmailTo: 'user@x.com' });
   * // => { ok: true, value: { orderId: '8', total: 170, itemCount: 1, status: 'pending', priority: 'normal' } }
   */
  async function fulfillNormalOrder(
    options: FulfillOrderOptions,
  ): Promise<Result<OrderResult, OrderError>> {
    return fulfillOrderWithPriority(options, 'normal');
  }

  return { fulfillUrgentOrder, fulfillNormalOrder } as const;
}

// --- Cart service — separate concern, own factory ---

interface CartServiceDeps {
  readonly db: Database;
}

/**
 * Creates the cart service.
 *
 * @example
 * const cartService = createCartService({ db });
 * await cartService.removeCartItem('user-1', 'item-42');
 * // Idempotent — succeeds even if item is already absent.
 */
export function createCartService(deps: CartServiceDeps) {
  const { db } = deps;

  /**
   * Removes an item from the user's cart.
   * Idempotent — if the item or cart doesn't exist, this is a no-op.
   * "Define errors out of existence": the caller's goal is "after this call, the item
   * is not in the cart." That's guaranteed whether the item was there or not.
   */
  async function removeCartItem(userId: string, itemId: string): Promise<void> {
    // DELETE is naturally idempotent — zero rows affected when item is already gone.
    await db.query(
      'DELETE FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1) AND item_id = $2',
      [userId, itemId],
    );
  }

  return { removeCartItem } as const;
}

// --- Exported document formatters ---

export { formatDocument, emailTemplate, receiptTemplate, invoiceTemplate };
export { buildShippingLabel };
export type { MoneyRecipient, ShippingAddress, LineItem, OrderResult, FulfillOrderOptions, OrderError };
```
