# Architectural Review — `POST /api/orders`

Every issue below references a specific rule from the coding standards skill.

---

## 1. No Dependency Injection — Hardcoded `db`, `fetch`

**Rule**: *Factory DI — `createOrderService({ db, emailer, logger })`. Use plain functions, keep it framework-free.*

`Pool` is instantiated at module scope and used directly inside the handler. `fetch` is called inline for the email side effect. This makes the handler impossible to unit test without mocking globals and couples business logic to concrete I/O implementations.

**Fix**: Extract an `createOrderService({ db, emailClient })` factory. Handler calls the service; service receives deps.

---

## 2. No Error Handling — Unguarded `await` Calls

**Rule**: *Surface all failures — every `catch` must handle or propagate.*
**Rule**: *Timeout on every I/O.*

Five `await` calls (3 DB queries, 1 `fetch`, implicit `res.json`) have zero `try/catch`. A DB connection failure, a network timeout on the email API, or a missing `stock.rows[0]` (no inventory row) all produce unhandled promise rejections that crash the process.

**Fix**: Wrap in try/catch with structured error responses. Add timeouts (AbortSignal) on the `fetch` call and connection/statement timeouts on the pool.

---

## 3. Business Logic Inside Route Handler

**Rule**: *Functional Core, Imperative Shell — pure business logic, side effects at boundaries.*
**Rule**: *Vertical slices — each feature owns schema/errors/data/logic/API.*

Validation, stock checking, order creation, and email notification are all inlined in a single route callback. This violates separation of concerns and makes the logic untestable in isolation.

**Fix**: Extract pure validation and stock-check logic into a service module. The handler becomes a thin shell that parses input, calls the service, and maps the result to HTTP.

---

## 4. No Input Validation / Parsing

**Rule**: *Parse, Don't Validate — trusted types at boundary, no scattered checks.*
**Rule**: *Bound every input — reject, always reject.*

`req.body` is used with a shallow truthiness check (`!userId || !items?.length`). There is no schema validation — `items[n].productId` and `items[n].quantity` are never type-checked, never bounded. A negative quantity, a string quantity, or extra fields all pass through silently.

**Fix**: Define a Zod (or equivalent) schema for the request body. Parse at the boundary and reject with structured errors. Validate quantity > 0, productId format, array length limits.

---

## 5. Sequential DB Queries in a Loop — No `Promise.all`

**Rule**: *`Promise.all` for independent async ops.*

```typescript
for (const item of items) {
  const stock = await db.query(...)
```

Each inventory check runs sequentially. For N items, this is N round-trips. The stock checks are independent and should run concurrently.

**Fix**: `Promise.all(items.map(item => db.query(...)))` then validate all results.

---

## 6. Race Condition — No Transaction

**Rule**: *Make Invalid States Unrepresentable.*

Stock is checked, then the order is inserted — as two separate, non-transactional operations. Between the check and the insert, another request can claim the same inventory. Stock is never actually decremented. This is a textbook TOCTOU (time-of-check/time-of-use) bug.

**Fix**: Wrap the stock check + decrement + order insert in a single DB transaction with `SELECT ... FOR UPDATE` on inventory rows.

---

## 7. Fire-and-Forget Email — Unhandled Side Effect

**Rule**: *Surface all failures — every `catch` must handle or propagate.*
**Rule**: *Functional Core, Imperative Shell.*

The `fetch` to the email API is `await`ed but its response is never checked (no status check, no error handling). If it fails, the order is already created but the user gets no confirmation — a silent partial failure. Worse, if it throws, the handler crashes after the order is committed.

**Fix**: Make email sending a separate, resilient step (queue-based or fire-and-forget with logging). Do not block the order response on email delivery.

---

## 8. Raw DB Entity Returned as API Response

**Rule**: *Map DB entities to DTOs for API responses — always create dedicated response types.*

```typescript
res.json(order.rows[0]);
```

The raw Postgres row (with all columns, internal IDs, timestamps in DB format) is sent directly to the client. Schema changes in the DB leak to the API contract.

**Fix**: Define an `OrderResponse` DTO and map the entity before returning.

---

## 9. Unstructured Error Responses — Bare `{ message }`

**Rule**: *Structured API errors — `{ type, code, status, detail }`. Always use machine-readable format.*

```typescript
res.status(400).json({ message: 'Invalid order' });
res.status(400).json({ message: 'Not enough stock' });
```

Clients cannot programmatically distinguish error types. "Not enough stock" does not indicate which product failed.

**Fix**: Return `{ type: 'VALIDATION_ERROR', code: 'INVALID_ORDER', status: 400, detail: '...' }` and `{ type: 'STOCK_INSUFFICIENT', code: 'OUT_OF_STOCK', status: 400, detail: '...', meta: { productId } }`.

---

## 10. No API Contract / Schema Definition

**Rule**: *API-first — define schema (OpenAPI, route schema) BEFORE handler.*

There is no OpenAPI spec, no route schema, no type contract. Clients have no way to generate types or validate against an agreed interface.

**Fix**: Define the route in OpenAPI or a route-level schema before implementing the handler.

---

## 11. Crosscutting Concerns Absent — No Logging, Tracing, or Monitoring

**Rule**: *Crosscutting via wrapping — `withTracing(service)` / `withLogging(service)` wrappers.*
**Rule**: *Tests, linting, CI/CD, monitoring from day 1.*

Zero observability. No request logging, no tracing, no error reporting. When this fails in production, there is no signal.

**Fix**: Add logging/tracing via the wrapper pattern on the service, not inline in the handler.

---

## 12. Hardcoded Literals — Magic Strings and Port

**Rule**: *Extract all literals to named constants.*
**Rule**: *Externalize config.*

`'pending'`, `3000`, `'order-confirmation'`, the email API URL — all hardcoded. The port and URL are environment-specific config. The status string is a domain constant.

**Fix**: Extract `ORDER_STATUS.PENDING`, `EMAIL_TEMPLATES.ORDER_CONFIRMATION` as constants. Port and URLs from environment/config.

---

## 13. `Pool` Instantiated with No Configuration

**Rule**: *Externalize config — business params must be changeable without editing function bodies.*

`new Pool()` relies entirely on `PG*` environment variables being set. No explicit connection config, no pool size limits, no connection timeout, no SSL settings. Silent misconfiguration risk.

**Fix**: Explicit config object from environment with validation at startup.

---

## 14. Unused Query Result

**Rule**: *No Orphans — Remove unused imports/vars.*

```typescript
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

The `user` result is used only to access `user.rows[0].email` for the email call, but there is no check that the user actually exists (`rows[0]` may be `undefined`). Additionally, `SELECT *` fetches all columns when only `email` is needed.

**Fix**: `SELECT email FROM users WHERE id = $1`, guard against empty result with a 404.

---

## Summary

| # | Issue | Severity |
|---|-------|----------|
| 1 | No dependency injection | Critical (testability, coupling) |
| 2 | No error handling / no timeouts | Critical (reliability) |
| 3 | Business logic in handler | High (maintainability) |
| 4 | No input parsing/validation | Critical (security) |
| 5 | Sequential queries in loop | Medium (performance) |
| 6 | No transaction / race condition | Critical (data integrity) |
| 7 | Unhandled email side effect | High (reliability) |
| 8 | Raw DB entity as response | Medium (API contract) |
| 9 | Unstructured error format | Medium (API contract) |
| 10 | No API contract/schema | Medium (API-first) |
| 11 | No observability | High (operability) |
| 12 | Hardcoded literals/config | Medium (maintainability) |
| 13 | Unconfigured DB pool | Medium (operability) |
| 14 | Unguarded user query / SELECT * | Medium (correctness) |
