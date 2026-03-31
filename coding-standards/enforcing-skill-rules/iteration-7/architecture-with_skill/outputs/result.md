# Architectural Review: Order Endpoint

Every issue below references a specific rule from the coding standards skill.

---

## 1. No Factory DI — Hard-Imported I/O Modules

**Rule**: *Inject dependencies via factory: `createService(deps)` — never hard-import I/O modules (db, cache, email). Composition root is the only place that knows concrete implementations. Most impactful architectural rule.*

**Also**: *Factory DI — `createOrderService({ db, emailer, logger })`. No containers, no decorators.*

`Pool` is instantiated at module scope and `fetch` is called inline. Both `db` and the email client must be injected via a factory function. This is flagged as the **most impactful architectural rule**.

```
const db = new Pool();                    // hard-coupled I/O
await fetch('https://email-api.internal/send', ...);  // hard-coupled I/O
```

**Fix**: `createOrderRoutes({ db, emailer })` — accept all I/O as deps.

---

## 2. Missing API Contract (API-First Violation)

**Rule**: *API-first — define schema (OpenAPI, route schema) BEFORE handler. In reviews: if handler exists without schema, flag "missing API contract".*

Neither `POST /api/orders` nor `GET /api/orders/:id` has a standalone API schema artifact. There is no OpenAPI spec, no route schema definition. The contract must exist as a standalone artifact clients can generate types from.

---

## 3. Bare `{ message }` Error Responses (Structured API Errors Violation)

**Rule**: *Structured API errors — `{ type, code, status, detail }`. Never bare `{ message }`.*

Every error response uses `{ message: '...' }`:

```
res.status(400).json({ message: 'Invalid order' });
res.status(400).json({ message: `Not enough stock for ${item.productId}` });
res.status(404).json({ message: 'Not found' });
```

**Fix**: Return `{ type, code, status, detail }` on every error path.

---

## 4. No Crosscutting via Wrapping — Logging/Tracing Absent

**Rule**: *Crosscutting via wrapping — `withTracing(service)` / `withLogging(service)` wrappers intercept every method. Never scatter `logger.info()` in business logic.*

There is zero observability. No logging, no tracing, no error monitoring. When these are added, the skill mandates the wrapper pattern — not inline `logger.info()` calls inside handlers.

---

## 5. No Vertical Slice — Business Logic in Route Handler

**Rule**: *Vertical slices — each feature owns schema/errors/data/logic/API.*

All business logic (stock validation, order creation, inventory update, email notification) is inlined in the route handler. The order feature should own its own schema, error types, data access, domain logic, and API layer as a cohesive slice.

---

## 6. Functional Core, Imperative Shell Violation

**Rule**: *Functional Core, Imperative Shell — pure business logic, side effects at boundaries.*

Stock validation logic is tangled with database queries and HTTP responses. The pure domain rule ("does inventory satisfy the order?") should be a testable pure function, separate from the I/O that fetches inventory and persists orders.

---

## 7. No Timeout on I/O

**Rule**: *Timeout on every I/O.*

Three distinct I/O calls have no timeout:
- `db.query(...)` — no statement timeout or connection timeout
- `fetch('https://email-api.internal/send', ...)` — no `AbortSignal.timeout()`
- The Pool itself — no `connectionTimeoutMillis`

Any of these hanging will block the request indefinitely.

---

## 8. No Error Handling — Silent Failures

**Rule**: *No silent failures — never empty catch. Result/Either for expected errors — exceptions for exceptional only.*

Zero `try/catch` or Result handling around any I/O. If `db.query` throws, `fetch` fails, or `stock.rows[0]` is `undefined` (no matching product), the process crashes or returns an unstructured 500. Every expected failure path (network error, missing product, email service down) needs explicit handling.

---

## 9. Race Condition — No Transaction

**Rule**: *Bound every input — reject, never fallback.*

Stock is checked in one query, then decremented in a separate query with no transaction. Between the SELECT and UPDATE, another request can claim the same stock. This is a correctness bug, not just a style issue. The entire check-and-decrement must be atomic (transaction with `SELECT ... FOR UPDATE` or a single conditional UPDATE).

---

## 10. Sequential Queries Where `Promise.all` Applies

**Rule**: *`Promise.all` for independent async ops.*

Stock checks iterate sequentially:

```typescript
for (const item of items) {
  const stock = await db.query(...);
}
```

Each stock check is independent and could run in parallel. Same applies to inventory decrements (though those have transaction ordering concerns — see issue 9).

---

## 11. Magic Strings

**Rule**: *No magic numbers/strings — named constants.*

Hardcoded values throughout:
- `'pending'` — order status
- `'https://email-api.internal/send'` — email service URL
- `'order-confirmation'` — email template name
- `3000` — server port

These should be named constants or externalized config.

---

## 12. Config Not Externalized

**Rule**: *Externalize config (env vars, defaults file).*

`new Pool()` relies on implicit `PG*` env vars with no validation. Port `3000` is hardcoded. Email API URL is hardcoded. All config should be explicitly loaded, validated, and injected.

---

## 13. CQS Violation

**Rule**: *CQS — command OR query, never both.*

The POST handler both mutates state (creates order, decrements inventory, sends email) and returns the created order data. The mutation and the query of the result should be separated.

---

## 14. No Input Parsing at Boundary

**Rule**: *Parse, Don't Validate — trusted types at boundary, no scattered checks.*

`req.body` is used with a loose truthy check (`!userId || !items?.length`). There is no schema parsing that produces a typed, validated object. After the guard clause, `items` is still `any` — `item.productId` and `item.quantity` are completely unvalidated. Invalid types (string quantity, missing productId) would propagate to SQL queries.

---

## 15. No Strict Typing

**Rule**: *Strict typing non-negotiable.*

Everything is implicitly `any`: `req.body`, `items`, `stock.rows[0]`, `order.rows[0]`. No TypeScript interfaces, no generics on `db.query<T>()`, no typed request/response.

---

## Summary

| # | Issue | Severity |
|---|-------|----------|
| 1 | No Factory DI | Critical |
| 2 | Missing API contract | Critical |
| 3 | Bare `{ message }` errors | High |
| 4 | No crosscutting wrappers | High |
| 5 | No vertical slice | High |
| 6 | Pure logic mixed with I/O | High |
| 7 | No I/O timeouts | High |
| 8 | No error handling | Critical |
| 9 | Race condition (no transaction) | Critical |
| 10 | Sequential independent async | Medium |
| 11 | Magic strings | Medium |
| 12 | Config not externalized | Medium |
| 13 | CQS violation | Medium |
| 14 | No input parsing at boundary | High |
| 15 | No strict typing | High |
