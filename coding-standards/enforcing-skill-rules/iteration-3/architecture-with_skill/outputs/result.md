# Architecture Review: Mini E-Commerce Backend

## Verdict: Major rework needed

This single-file app violates nearly every load-bearing principle from the coding standards. Below are the issues grouped by severity, each traced to the specific standard it breaks.

---

## Critical Issues

### 1. Race condition on inventory (no transaction)

**Standard**: *Functional Core, Imperative Shell* / *CQS* / *Make Invalid States Unrepresentable*

The stock check and the stock decrement are separate queries with no transaction wrapping them. Two concurrent orders for the last item will both pass the check, both decrement, and inventory goes negative.

```
// Current: CHECK then UPDATE with no atomicity
const stock = await db.query('SELECT quantity ...');  // T1 reads 1
                                                       // T2 reads 1
await db.query('UPDATE inventory SET quantity = quantity - $1 ...'); // T1 → 0
                                                                     // T2 → -1
```

**Fix**: Wrap the entire order in a single database transaction. Use `SELECT ... FOR UPDATE` or a single atomic `UPDATE ... WHERE quantity >= $1 RETURNING quantity` to make the check-and-decrement atomic.

---

### 2. Hard-imported dependencies — untestable, unconfigurable

**Standard**: *Inject dependencies, never hard-import them* / *Factory-function DI everywhere*

`db`, `fetch`, and `express` are all instantiated at module scope. You cannot test any route without a live Postgres and a live email API.

**Fix**: Use factory-function DI:
```typescript
createOrderService({ db, emailClient, logger })
```
The composition root (entry point) is the only place that knows about concrete implementations.

---

### 3. No error handling — silent failures, no timeouts

**Standard**: *No silent failures* / *Define timeout on every I/O* / *Use Result/Either types for expected errors*

- `db.query` calls have no try/catch — a DB error crashes the process with an unhandled rejection.
- `fetch('https://email-api.internal/send')` has no timeout, no error handling. If the email service is down, the request hangs forever (cascading failure).
- The stock check (`stock.rows[0].quantity`) will throw `TypeError: Cannot read property 'quantity' of undefined` if the product doesn't exist in inventory.

**Fix**: Wrap all I/O in error handling. Set timeouts on every external call. Use structured error responses. Handle the "product not found in inventory" case explicitly.

---

### 4. No input validation / parsing at the boundary

**Standard**: *Parse, Don't Validate* / *Bound every input* / *Strict typing is non-negotiable*

`req.body` is used raw — no schema validation, no type narrowing. The check `!userId || !items?.length` is a minimal existence check, not parsing. There is no validation that:
- `userId` is a valid format (UUID, integer, etc.)
- `items` is an array of objects with `productId` (string/int) and `quantity` (positive integer)
- `quantity` is bounded (min 1, max reasonable limit)
- The request body isn't arbitrarily large

**Fix**: Use Zod (or similar) to parse the request body into a typed `CreateOrderRequest` at the boundary. After parsing, the type guarantees correctness throughout the handler.

---

## Structural Issues

### 5. Single file, no separation of concerns

**Standard**: *Feature modules as vertical slices* / *SRP* / *Group by feature, not by type*

All concerns are in one handler: input parsing, authorization, business logic, data access, external API calls, and response formatting. This violates SRP — there are at least 5 reasons for this function to change.

**Fix**: Split into vertical slices:
- `orders/order.schema.ts` — Zod schemas and types
- `orders/order.service.ts` — business logic (pure, receives deps)
- `orders/order.repository.ts` — data access
- `orders/order.routes.ts` — HTTP layer (thin, delegates to service)
- `orders/order.errors.ts` — domain errors

---

### 6. Synchronous email sending blocks the response

**Standard**: *CQS — command OR query, never both*

The order creation endpoint sends an email synchronously before responding. This couples order success to email delivery — if the email API is slow (or down), the user waits (or gets an error) even though the order was already placed.

**Fix**: Emit a domain event (`OrderCreated`) and handle email asynchronously (message queue, or at minimum a fire-and-forget with error logging). The order endpoint's job is to create the order, not to send emails.

---

### 7. Bare `{ message: "..." }` error responses

**Standard**: *Structured errors for APIs*

All error responses are `{ message: string }`. This is not machine-readable. Clients cannot programmatically distinguish "out of stock" from "invalid input" from "not found" without parsing English strings.

**Fix**: Return structured errors:
```typescript
{
  type: "INSUFFICIENT_STOCK",
  code: "ORDER_VALIDATION_ERROR",
  status: 400,
  detail: "Product X has 2 units available, 5 requested"
}
```

---

### 8. No authorization check

**Standard**: *Constrain first, relax later* / *Bound every input*

- `POST /api/orders`: Anyone can place orders for any `userId`.
- `GET /api/orders/:id`: Anyone can read any order. No ownership check.

**Fix**: Authenticate the request, derive `userId` from the auth token (never from the body), and enforce ownership on reads.

---

## Minor Issues

### 9. Sequential awaits on independent operations

**Standard**: *Parallelize independent async operations*

The stock check loop runs sequentially: each item is checked one at a time. These are independent queries.

**Fix**: `await Promise.all(items.map(item => checkStock(item)))` — or better yet, a single SQL query with `WHERE product_id IN (...)`.

---

### 10. Magic strings and numbers

**Standard**: *No magic numbers/strings* / *Every constant is a decision*

- `'pending'` — order status as a string literal. Should be a const/enum.
- `3000` — port hardcoded. Should come from config/env.
- `'https://email-api.internal/send'` — URL hardcoded. Should be config.
- `'order-confirmation'` — template name hardcoded.

---

### 11. `SELECT *` in the GET endpoint

**Standard**: *Entropy is the enemy*

`SELECT *` returns all columns, including potentially sensitive internal fields. It also breaks if columns are added.

**Fix**: Explicitly select the columns the API contract requires.

---

### 12. No `express.json()` middleware visible

The code accesses `req.body` but never calls `app.use(express.json())`. This would silently result in `undefined` body, caught only at runtime.

---

## Summary Table

| # | Issue | Severity | Principle Violated |
|---|-------|----------|--------------------|
| 1 | Race condition (no transaction) | Critical | Make Invalid States Unrepresentable |
| 2 | Hard-imported deps | Critical | Inject dependencies, factory-function DI |
| 3 | No error handling / no timeouts | Critical | No silent failures, timeout on every I/O |
| 4 | No input parsing at boundary | Critical | Parse Don't Validate, Bound every input |
| 5 | Single file, mixed concerns | Structural | Feature modules as vertical slices, SRP |
| 6 | Synchronous email blocks response | Structural | CQS, Functional Core Imperative Shell |
| 7 | Bare message strings | Structural | Structured errors for APIs |
| 8 | No auth/authorization | Structural | Constrain first, relax later |
| 9 | Sequential independent awaits | Minor | Parallelize independent async operations |
| 10 | Magic strings/numbers | Minor | No magic numbers, externalize config |
| 11 | SELECT * | Minor | Entropy is the enemy |
| 12 | Missing express.json() | Minor | Fail fast |
