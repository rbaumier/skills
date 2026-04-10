# Run 3 — With Skill (Opus 4.6 + coding-standards SKILL.md)

## Violations Found

| # | Rule | Violation | Fix |
|---|------|-----------|-----|
| 1 | Naming: banned words | `handleOrderData` uses `handle` + `data` | Rename to `fulfillOrder` |
| 2 | Naming: abbreviations | `u`, `usr`, `ct`, `itm`, `amt`, `s`, `i` | Full words: `userResult`, `user`, `itemCount`, `item`, `lineTotal`, `stockResult` |
| 3 | Result for ALL errors | Six `throw new Error(...)` across module | Return `Result<T, E>` everywhere |
| 4 | Error messages ARE comments | `'not found'`, `'stock'`, `'blocked'`, `'missing city'`, `'invalid total'` | Actionable messages explaining what went wrong and what to do |
| 5 | Max 3 positional args | `handleOrderData` has 7 positional args; `formatEmail/Receipt/Invoice` have 4 | Options object `FulfillOrderOptions`; `MoneyRecipient` value object |
| 6 | Boolean flag -> two functions | `isUrgent` and `sendEmail` control branches | Split `fulfillUrgentOrder` / `fulfillNormalOrder`; confirmation email via explicit `confirmationEmailTo` |
| 7 | Inject deps via factory | Hard imports of `db`, `cache`, `mailer` | `createOrderService({ db, cache, mailer })` |
| 8 | Max 30 lines per function | `handleOrderData` ~35 lines of dense logic | Extract `lookupUser`, `computeLineTotal`, `checkStock`, `persistOrder`, `fireSideEffects` |
| 9 | One level of abstraction | Mixes orchestration (user lookup, insert) with inline arithmetic and SQL | Separate pure computation from I/O |
| 10 | `Promise.all` for independent async ops | Sequential `await` for stock checks; sequential side-effect sends | `Promise.all` where calls are independent |
| 11 | No nested ternaries | `discountCode === 'FREE50' ? 50 : discountCode === 'FREE20' ? 20 : 0` | Object map `DISCOUNT_AMOUNTS` |
| 12 | Intermediate variables | `itm.qty * itm.price * (taxRate ? 1 + taxRate : 1) - (...)` compound inline | Extract `subtotal`, `taxMultiplier`, `totalBeforeDiscount`, `lineTotal` |
| 13 | Extract literals to named constants | `1000`, `0.9`, `'pending'`, `'high'`, `'normal'`, `'FREE50'`, `'FREE20'` | Named constants |
| 14 | Strict typing / No `any` | `order: any`, `items: any[]`, `userId: any`, `OrderStatus = string` | Union literals, strict interfaces |
| 15 | Data clumps -> Value Object | `(to, name, amount, currency)` repeated across `formatEmail`, `formatReceipt`, `formatInvoice` | Extract `MoneyRecipient` value object |
| 16 | Law of Demeter | `order.customer.address.street/city/zip` — 3 dots deep | Flat `ShippingAddress` passed directly |
| 17 | Crosscutting via wrapping | `console.log` inside business logic | Remove; logging via `withLogging(service)` wrapper |
| 18 | Map DB entities to DTOs | Returns raw `order.rows[0]` | Map to `OrderResult` DTO |
| 19 | Module-level orientation | No module comment | Add "What it does" + "How it works" |
| 20 | JSDoc on exported functions | None | Add block description + `@example` with call AND return |
| 21 | Comments — why & consequences | Zero comments | Add why/consequence comments throughout |
| 22 | Unused params | `applyBulkDiscount` takes `retryCount`, `retryDelayMs`, `maxRetries` — all unused | Remove dead params |
| 23 | Dead code | `formatEmail`, `formatReceipt`, `formatInvoice`, `getShippingLabel`, `validateOrder` — unexported, unused internally | Remove dead code or export with clear purpose |
| 24 | Redundant check | `!usr.blocked` rechecked inside loop after early-return guard already handled it | Remove duplicate |
| 25 | Immutable — no mutation | `let total = 0; total += amt` mutates accumulator | `reduce` over line totals |
| 26 | Bound every input — reject | No validation on `userId`, `items`, `taxRate`, `qty`, `price` | Validate and reject at barricade |
| 27 | `?? defaultValue` on external input | `taxRate ? 1 + taxRate : 1` silently treats falsy taxRate as 0; discount silently defaults unknown codes to 0 | Reject invalid taxRate; reject unknown discount codes |
| 28 | No default parameters | `applyBulkDiscount` has dead retry params implying hidden defaulting | Remove; if retry needed, separate concern |
| 29 | Reuse before creating | Three `format*` functions with identical `(to, name, amount, currency)` signature and near-identical body | Single `formatDocument` with template + `MoneyRecipient` value object |
| 30 | Option for absence | `removeCartItem` throws on missing cart/item — absence is normal, not failure | Idempotent design ("define errors out of existence") |
| 31 | Barricade pattern | Validation scattered inside loop and deep logic | Validate all inputs at function entry, code inside barricade assumes clean data |
| 32 | Timeout on every I/O | No timeouts on `db.query`, `mailer.send` | Deps contract should enforce; document expectation |
| 33 | CQS | `fulfillOrder` both mutates and returns | Acceptable for commands returning confirmation; document the choice |
| 34 | Focused modules | Order fulfillment, cart ops, document formatting, shipping all in one file | Separate into order-service, cart-service, document-formatting, shipping modules |
| 35 | No hidden control flow | Direct function calls throughout — no issue here | No change needed |

## Refactored Code

```typescript
/**
 * Order fulfillment module — validates a user, prices line items, checks stock,
 * persists the order, and fires notifications.
 *
 * How it works:
 * 1. Validate all inputs at the barricade (user exists, not blocked, items valid, discount recognized).
 * 2. Compute line totals with tax and discount — pure math, no I/O.
 * 3. Check stock for all qualifying items in parallel.
 * 4. Persist the order in a single INSERT with priority already set (no UPDATE round-trip).
 * 5. Fire side-effects (big-order alert, urgent notification, confirmation email) in parallel.
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

/** Orders above this amount trigger a big-order alert and an audit row in `big_orders`. */
const BIG_ORDER_THRESHOLD_CENTS = 1000;

/** Bulk discount multiplier — 10% off, applied uniformly to every item's unit price. */
const BULK_DISCOUNT_MULTIPLIER = 0.9;

/**
 * Maps recognized discount codes to their fixed cent deduction per line item.
 * Add new codes here — the computation reads this map, no branching needed.
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

/** DTO returned to callers — never expose raw DB rows outside the module. */
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

/** Flat shipping address — callers pass this directly, never reaching through nested objects. */
interface ShippingAddress {
  readonly street: string;
  readonly city: string;
  readonly zip: string;
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
 * because a typo in a code should charge full price visibly, not hide the mistake.
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
 * Computes the total for one line item after tax and discount.
 * Pure arithmetic — no I/O, no side effects.
 *
 * @example
 * computeLineTotal(2, 100, 0.1, 50) // => 170  (2 * 100 * 1.1 - 50)
 */
function computeLineTotal(
  qty: number,
  unitPriceCents: number,
  taxRate: number,
  discountCents: number,
): number {
  const subtotal = qty * unitPriceCents;
  const taxMultiplier = 1 + taxRate;
  const totalBeforeDiscount = subtotal * taxMultiplier;

  return totalBeforeDiscount - discountCents;
}

/**
 * Validates a single line item at the barricade boundary.
 * Returns null when valid, or a human-readable rejection reason when invalid.
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
 * Callers never see internal column names like `user_id` or `item_count` — those are
 * implementation details of the persistence layer.
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

// --- Document formatting — single function + templates, eliminates 3-function data clump ---

/**
 * Formats a document from a `MoneyRecipient` value object and a template function.
 * Replaces the three near-identical `formatEmail`, `formatReceipt`, `formatInvoice`
 * functions that all took the same (to, name, amount, currency) data clump.
 *
 * @example
 * const recipient = { to: 'alice@co.com', name: 'Alice', amount: 99, currency: 'USD' };
 * formatDocument(recipient, emailTemplate)
 * // => "To: alice@co.com\nDear Alice, your total is 99 USD"
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

/**
 * Builds a shipping label from a flat address value object.
 * Callers pass the address directly — no reaching through `order.customer.address`.
 * The original `getShippingLabel(order)` violated Law of Demeter with 3-dot chains.
 *
 * @example
 * buildShippingLabel({ street: '42 Oak Ave', city: 'Portland', zip: '97201' })
 * // => "42 Oak Ave, Portland, 97201"
 */
function buildShippingLabel(address: ShippingAddress): string {
  return `${address.street}, ${address.city}, ${address.zip}`;
}

// --- Bulk discount — dead params removed, strict input types ---

/**
 * Applies the standard 10% bulk discount to every item's unit price.
 * Returns a new array — inputs are never mutated.
 * The original had unused `retryCount`, `retryDelayMs`, `maxRetries` params — removed as dead code.
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
 * Two named functions instead of a boolean `isUrgent` flag — each is self-documenting
 * and independently callable.
 *
 * @example
 * const orderService = createOrderService({ db, cache, mailer });
 * const result = await orderService.fulfillUrgentOrder({
 *   userId: '42', items, taxRate: 0.1, discountCode: null, confirmationEmailTo: null,
 * });
 * if (!result.ok) console.error(result.error.detail);
 * // => { ok: true, value: { orderId: '99', total: 220, itemCount: 2, status: 'pending', priority: 'high' } }
 */
export function createOrderService(deps: OrderServiceDeps) {
  const { db, cache, mailer } = deps;

  // --- I/O helpers (private, closure-scoped) ---

  async function lookupUser(userId: string): Promise<Result<UserRow, OrderError>> {
    const userResult = await db.query('SELECT id, email, blocked FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0] as UserRow | undefined;

    if (!user) {
      return err({
        type: 'USER_NOT_FOUND',
        detail: `No user with id "${userId}". Verify the id is correct and retry.`,
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
    // All stock queries are independent — run in parallel to cut N round-trips to 1.
    const stockResults = await Promise.all(
      items.map((item) => db.query('SELECT qty FROM stock WHERE id = $1', [item.id])),
    );

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const availableQty = (stockResults[index].rows[0] as { qty: number } | undefined)?.qty ?? 0;

      if (availableQty < item.qty) {
        return err({
          type: 'INSUFFICIENT_STOCK',
          detail: `Item "${item.id}" requested ${item.qty} units but only ${availableQty} available. Reduce quantity or remove the item.`,
        });
      }
    }

    return ok(undefined);
  }

  async function persistOrder(
    userId: string,
    totalCents: number,
    itemCount: number,
    priority: OrderPriority,
  ): Promise<OrderRow> {
    // Single INSERT with priority baked in — the original did INSERT then UPDATE, wasting a round-trip.
    const result = await db.query(
      'INSERT INTO orders (user_id, total, item_count, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, totalCents, itemCount, 'pending', priority],
    );

    return result.rows[0] as OrderRow;
  }

  async function fireSideEffects(
    userId: string,
    userEmail: string,
    orderRow: OrderRow,
    totalCents: number,
    isUrgent: boolean,
    confirmationEmailTo: string | null,
  ): Promise<void> {
    const sideEffects: Array<Promise<unknown>> = [];

    // Big-order alert — notifies the user and writes an audit row so finance can review high-value orders.
    if (totalCents > BIG_ORDER_THRESHOLD_CENTS) {
      sideEffects.push(mailer.send(userEmail, `Big order: ${totalCents}`));
      sideEffects.push(
        db.query('INSERT INTO big_orders (user_id, total, ts) VALUES ($1, $2, $3)', [
          userId,
          totalCents,
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

    // All side-effects are independent — fire in parallel to minimize total latency.
    await Promise.all(sideEffects);

    // Cache the user's latest order id so the dashboard reads it without a DB round-trip.
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

    // Only check stock for active items with positive quantities — already validated above.
    const stockCheck = await checkStockForItems(items);
    if (!stockCheck.ok) return stockCheck;

    // --- Pure computation: totals (functional, no mutation) ---

    const lineTotals = items.map((item) =>
      computeLineTotal(item.qty, item.price, taxRate, discountCents),
    );
    const chargeableLineTotals = lineTotals.filter((amount) => amount > 0);
    const totalCents = chargeableLineTotals.reduce((sum, amount) => sum + amount, 0);
    const itemCount = chargeableLineTotals.length;

    // --- Persist + side-effects ---

    const orderRow = await persistOrder(userId, totalCents, itemCount, priority);
    const isUrgent = priority === 'high';
    await fireSideEffects(userId, user.email, orderRow, totalCents, isUrgent, confirmationEmailTo);

    return ok(toOrderResult(orderRow));
  }

  // --- Public API: two named functions instead of a boolean flag ---

  /**
   * Fulfill an urgent order — priority set to 'high', triggers an urgent notification email.
   *
   * @example
   * const result = await service.fulfillUrgentOrder({
   *   userId: '1', items, taxRate: 0.1, discountCode: null, confirmationEmailTo: null,
   * });
   * if (!result.ok) log(result.error.detail);
   * // => { ok: true, value: { orderId: '7', total: 220, itemCount: 2, status: 'pending', priority: 'high' } }
   */
  async function fulfillUrgentOrder(
    options: FulfillOrderOptions,
  ): Promise<Result<OrderResult, OrderError>> {
    return fulfillOrderWithPriority(options, 'high');
  }

  /**
   * Fulfill a normal-priority order — no urgent notification sent.
   *
   * @example
   * const result = await service.fulfillNormalOrder({
   *   userId: '1', items, taxRate: 0.1, discountCode: 'FREE50', confirmationEmailTo: 'user@x.com',
   * });
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
 * Creates the cart service with injected database dependency.
 *
 * @example
 * const cartService = createCartService({ db });
 * await cartService.removeCartItem('user-1', 'item-42');
 * // Idempotent — succeeds even if item was already absent.
 */
export function createCartService(deps: CartServiceDeps) {
  const { db } = deps;

  /**
   * Removes an item from the user's cart.
   * Idempotent by design — if the item or cart does not exist, this is a no-op.
   * "Define errors out of existence": the caller's postcondition is "after this call,
   * the item is not in the cart." That holds whether the item was there or not.
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

// --- Exported formatters and types ---

export { formatDocument, emailTemplate, receiptTemplate, invoiceTemplate };
export { buildShippingLabel };
export type {
  MoneyRecipient,
  ShippingAddress,
  LineItem,
  OrderResult,
  FulfillOrderOptions,
  OrderError,
  OrderServiceDeps,
  CartServiceDeps,
};
```
