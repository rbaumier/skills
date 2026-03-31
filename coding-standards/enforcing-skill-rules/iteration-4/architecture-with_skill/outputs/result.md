# Architecture Review: Mini E-Commerce Backend

## Verdict: Significant rework needed

This single-file handler has **critical data integrity bugs** and violates nearly every architectural principle that matters for an order pipeline. Below are the findings ordered by severity.

---

## Critical: Data Integrity

### 1. Race condition on inventory (TOCTOU)

The check-then-act pattern between `SELECT quantity` and `UPDATE inventory` is not atomic. Two concurrent orders for the same product can both pass the stock check and both decrement, driving inventory negative.

**Fix:** Wrap the entire order flow in a database transaction with `SELECT ... FOR UPDATE` on inventory rows, or use a single atomic `UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND quantity >= $1 RETURNING quantity` and check the affected row count.

### 2. No transaction boundary

The order insert and inventory decrements are separate statements with no transaction. If the second item's decrement fails, the first item's stock is already gone and the order row is orphaned in `pending` state with no rollback.

**Fix:** Use `BEGIN` / `COMMIT` / `ROLLBACK`. All mutations for one order must succeed or fail together.

### 3. Email failure kills the request

`fetch()` to the email API has no timeout, no error handling, and blocks the response. If the email service is slow or down, the order appears to fail even though it was committed.

**Fix:** Move email sending out of the request path entirely (message queue, async job, or at minimum a fire-and-forget with error swallowing and a retry mechanism). Define a timeout on the fetch call (`AbortSignal.timeout(5000)`).

---

## High: Architecture

### 4. No dependency injection — violates "Functional Core, Imperative Shell"

`db` and `fetch` are hard-imported globals. Every handler is untestable without a live Postgres and a live email API.

**Fix:** Factory-function DI pattern:

```typescript
// createOrderService({ db, emailer }) => { createOrder, getOrder }
```

The composition root (server startup) wires concrete implementations. Tests pass stubs.

### 5. Single file, no feature separation

Route handlers contain validation, data access, business logic, and side effects in one function. This violates SRP and makes every concern impossible to test in isolation.

**Fix:** Vertical feature slice:

```
orders/
  orders.schema.ts    — Zod input schemas (parse, don't validate)
  orders.service.ts   — pure business logic via factory DI
  orders.routes.ts    — thin HTTP adapter
  orders.errors.ts    — domain error types
```

### 6. No input validation / parsing at the boundary — violates "Parse, Don't Validate"

`req.body` is trusted blindly. `items[*].productId` and `items[*].quantity` are never validated for type, range, or bounds. A negative `quantity` would *increase* stock. A missing `quantity` would produce `NaN` in SQL.

**Fix:** Parse with Zod at the boundary. Enforce `quantity` is a positive integer, `productId` is a valid format, `items` array has a max length. After parsing, the type guarantees correctness downstream.

```typescript
const CreateOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(MAX_QUANTITY_PER_ITEM),
  })).min(1).max(MAX_ITEMS_PER_ORDER),
});
```

---

## Medium: Error Handling & Observability

### 7. No global error handler — silent crashes

Any unhandled rejection in an `async` handler will crash Express (or silently swallow in Express 5). There is no `try/catch`, no error middleware.

**Fix:** Add Express async error middleware. Use Result/Either types for expected domain errors (out of stock, not found) and map them to structured API responses.

### 8. Bare `{ message }` error responses — violates "Structured Errors for APIs"

Errors return `{ message: "..." }` strings. Clients cannot programmatically distinguish error types.

**Fix:** Structured error format:

```typescript
{ type: "OUT_OF_STOCK", code: "ORDER_001", status: 400, detail: "..." }
```

### 9. `stock.rows[0].quantity` — no null check

If a `productId` does not exist in `inventory`, `stock.rows[0]` is `undefined` and `.quantity` throws a TypeError.

**Fix:** Guard clause: if `!stock.rows[0]`, return a "product not found" error.

---

## Medium: Performance

### 10. N+1 queries in a loop

Each item triggers a separate `SELECT` and a separate `UPDATE`. For an order with 10 items, that is 20 round trips.

**Fix:** Batch the stock check into a single query (`WHERE product_id = ANY($1)`) and batch the decrements into a single `UPDATE` with a `VALUES` list or use `unnest`.

### 11. Sequential awaits on independent stock checks — violates "Parallelize Independent Async"

The `for...of` loop awaits each stock check sequentially. These are independent reads.

**Fix:** If you keep individual queries (before batching), at minimum use `Promise.all`. But batching (point 10) is the real fix.

---

## Low: Hygiene

### 12. No timeout on database queries

Every `db.query()` call has no statement timeout. A slow query holds the connection and the request indefinitely.

**Fix:** Set `statement_timeout` on the pool or per-query.

### 13. `app.listen(3000)` — magic number, no graceful shutdown

Port is hardcoded. No `SIGTERM` handler means in-flight requests are killed on deploy.

**Fix:** Read port from env (`process.env.PORT`), add graceful shutdown handler.

### 14. No authorization check on `GET /api/orders/:id`

Any caller can read any order by ID. No ownership or auth check.

**Fix:** Verify the requesting user owns the order or has admin privileges.

### 15. `SELECT *` in the GET handler

Returns all columns including potentially sensitive internal fields.

**Fix:** Explicitly select the columns the API contract requires.

---

## Summary of Required Changes

| # | Issue | Principle Violated | Severity |
|---|-------|--------------------|----------|
| 1 | TOCTOU race on inventory | Make Invalid States Unrepresentable | Critical |
| 2 | No transaction | Make Invalid States Unrepresentable | Critical |
| 3 | Email blocks request, no timeout | Functional Core / Imperative Shell | Critical |
| 4 | Hard-imported `db`, `fetch` | Inject Dependencies | High |
| 5 | Single file, mixed concerns | SRP, Feature Modules | High |
| 6 | No input parsing/bounds | Parse Don't Validate, Bound Every Input | High |
| 7 | No error handling | No Silent Failures | Medium |
| 8 | Bare message strings | Structured Errors | Medium |
| 9 | Missing null check on rows[0] | Fail Fast | Medium |
| 10 | N+1 queries | Entropy is the Enemy | Medium |
| 11 | Sequential independent awaits | Parallelize Independent Async | Medium |
| 12 | No query timeouts | Timeout Every I/O | Low |
| 13 | Hardcoded port, no shutdown | Externalize Config | Low |
| 14 | No auth on GET | Security | Low |
| 15 | SELECT * | Explicit Contracts | Low |
