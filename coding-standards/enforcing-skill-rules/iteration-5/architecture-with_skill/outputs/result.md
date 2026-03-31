# Architecture Review: Mini E-Commerce Backend

## Verdict: Major rework needed

This single-file handler has **7 critical architectural issues** that would cause data corruption, lost orders, and untestable code in production.

---

## Critical Issues

### 1. Race Condition — Stock Check + Decrement Are Not Atomic

**Principle violated:** Make Invalid States Unrepresentable

```typescript
// BUG: Between SELECT and UPDATE, another request can claim the same stock
const stock = await db.query('SELECT quantity FROM inventory WHERE product_id = $1', [item.productId]);
if (stock.rows[0].quantity < item.quantity) { ... }
// ... later ...
await db.query('UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2', [item.quantity, item.productId]);
```

**Fix:** Use a single atomic query with a `WHERE quantity >= $1` guard, or wrap the entire operation in a serializable transaction with `SELECT ... FOR UPDATE`.

```typescript
// Atomic: returns 0 rows if insufficient stock
UPDATE inventory SET quantity = quantity - $1
WHERE product_id = $2 AND quantity >= $1
RETURNING quantity
```

### 2. No Transaction — Partial Order Corruption

**Principle violated:** Functional Core, Imperative Shell / Make Invalid States Unrepresentable

The order INSERT and inventory UPDATEs are separate queries. If the second item's UPDATE fails (or the process crashes), you have an order row with only partial inventory deducted. This is **data corruption**.

**Fix:** Wrap the entire order creation (INSERT order + all inventory decrements) in a single database transaction. Rollback on any failure.

### 3. No Error Handling — Silent Failures Everywhere

**Principle violated:** No silent failures / Define timeout on every I/O

- No `try/catch` on any `db.query` call — an unhandled rejection crashes the process.
- No `try/catch` on `fetch()` to the email API — if email fails, the request throws a 500 even though the order succeeded.
- No timeout on the email `fetch()` — a hanging email service blocks the response indefinitely.
- `stock.rows[0].quantity` throws if the product doesn't exist (`rows[0]` is `undefined`).

**Fix:** Use Result/Either types for expected errors. Wrap I/O in try/catch with timeouts. The email send must be fire-and-forget or queued — never blocking the order response.

### 4. Hard-Wired Dependencies — Untestable

**Principle violated:** Inject dependencies, never hard-import them (the "single most impactful architectural rule")

`db` and `fetch` are module-level singletons. You cannot test the order handler without a real Postgres connection and a real email API.

**Fix:** Factory-function DI:
```typescript
function createOrderService({ db, emailer, logger }: OrderDeps) {
  return { createOrder, getOrder };
}
```

Compose at the entry point. Test with simple stubs.

### 5. No Input Validation / Parsing

**Principle violated:** Parse, Don't Validate / Bound every input — reject, never fallback

- `userId` is unchecked (could be SQL-injection-friendly garbage).
- `items` elements are unvalidated — `item.productId` and `item.quantity` could be `undefined`, negative, or strings.
- No schema (Zod, OpenAPI) defines the contract.

**Fix:** Define a Zod schema for the request body. Parse at the boundary once. After parsing, types guarantee correctness downstream.

```typescript
const CreateOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(MAX_ORDER_QUANTITY),
  })).min(1).max(MAX_ORDER_ITEMS),
});
```

### 6. Sequential Awaits on Independent Work

**Principle violated:** Parallelize independent async operations

The stock-check loop runs N sequential queries. These are independent reads and should use `Promise.all`.

```typescript
// Before: O(N) round trips
for (const item of items) {
  const stock = await db.query(...);
}

// After: O(1) round trip time
const stockChecks = await Promise.all(
  items.map(item => db.query('SELECT ...', [item.productId]))
);
```

### 7. Bare Error Messages — No Structured Errors

**Principle violated:** Structured errors for APIs

`{ message: 'Invalid order' }` is not machine-readable. Clients can't programmatically distinguish "missing userId" from "empty items array."

**Fix:** Structured error format:
```typescript
{
  type: "VALIDATION_ERROR",
  code: "INVALID_ORDER_PAYLOAD",
  status: 400,
  detail: "userId is required; items must be a non-empty array"
}
```

---

## Secondary Issues

| Issue | Principle Violated | Fix |
|---|---|---|
| Single file for everything | Feature modules as vertical slices / SRP | Split into `orders/` feature folder: schema, service, handler, errors |
| `app.listen(3000)` hardcoded | Every constant is a decision — externalize to config | `const PORT = env.PORT ?? 3000` with validation |
| No authorization check | Bound every input | Verify the authenticated user matches `userId` |
| `SELECT *` in GET endpoint | Explicit interface contracts | Select only needed columns; define a response schema |
| Email sent synchronously in request path | SRP / Functional Core, Imperative Shell | Queue the email (Redis/SQS/pg-boss) or fire-and-forget with error logging |
| No request body parsing middleware | Parse, Don't Validate | `app.use(express.json())` is missing entirely — `req.body` is `undefined` |
| Pool created with no config | Define timeout on every I/O | Configure `connectionTimeoutMillis`, `idleTimeoutMillis`, `max` connections |

---

## Recommended Target Architecture

```
src/
  orders/
    order.schema.ts        # Zod schemas (input + output contracts)
    order.service.ts       # createOrderService({ db, emailer }) — pure business logic
    order.handler.ts       # Express route handlers, parse input, call service
    order.errors.ts        # Domain errors → structured API errors mapping
    order.test.ts          # Unit tests with stubbed deps
  inventory/
    inventory.service.ts   # Stock check + decrement (atomic query)
  shared/
    db.ts                  # Pool factory with config + timeouts
    errors.ts              # Base structured error types
    result.ts              # Result<T, E> type
  server.ts                # Composition root: wire deps, mount routes, listen
```

**Key pattern:** `server.ts` is the only file that knows about concrete implementations. Everything else depends on interfaces/types passed via factory functions.
