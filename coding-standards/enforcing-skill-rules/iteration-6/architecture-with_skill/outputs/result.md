# Architectural Review: Mini E-Commerce Backend

Code reviewed: `server.ts` (single-file Express app with order creation and retrieval)

---

## Issues by Skill Section

### Architecture & Patterns

#### 1. No Feature Modules / Vertical Slices

> "Each feature owns its schema, errors, data access, business logic, and API surface."

Everything lives in a single file. There are at least two features here (orders, inventory) mashed together. Order creation directly queries and mutates the inventory table — a cross-feature import at the most intimate level.

**Fix:** Split into `orders/` and `inventory/` feature modules, each owning its own data access and business logic.

#### 2. No Factory-Function DI — Hard-Imported Dependencies

> "Inject dependencies, never hard-import them — every module that does I/O must receive its dependencies as arguments via a factory function."

`db` (Pool) and `fetch` (email API) are hard-wired globals. This makes every handler untestable without mocking module internals or spinning up real Postgres.

**Fix:** `createOrderService({ db, emailClient, logger })` returning a plain object. The composition root (`server.ts`) is the only place that knows about concrete `Pool` and `fetch`.

#### 3. No Crosscutting Concerns via Wrapping

> "Is logging/tracing scattered inside business logic, or applied via a wrapper?"

There is zero logging, tracing, or observability. When it inevitably gets added, it will be `console.log` scattered inside handlers.

**Fix:** Apply `withTracing(orderService)` / `withLogging(orderService)` wrappers at the composition root.

#### 4. Bare `{ message: "..." }` Error Responses — No Structured Errors

> "Never return bare `{ message: '...' }` strings."

Every error response is `{ message: "..." }` — not machine-readable, no error type, no error code, no HTTP status in the body.

**Fix:** Define a structured error format: `{ type, code, status, detail }`. Map domain errors to API errors via a single mapping function.

#### 5. No API-First Design

> "Does each endpoint have a schema defined BEFORE its handler?"

No OpenAPI spec, no route schemas, no contract artifact. Clients cannot generate types from this API.

**Fix:** Define an OpenAPI spec (or at minimum route-level schemas) before writing handlers. Runtime validation (Zod) is complementary but not sufficient.

---

### Functions & Architecture

#### 6. No Input Parsing — Validate-and-Pray Pattern

> "Parse, Don't Validate — transform untrusted data into trusted types at the boundary once."

`req.body` is used raw. `userId` could be anything. `items` is assumed to have `productId` and `quantity` fields with correct types. The shallow `!userId || !items?.length` check is validation, not parsing.

**Fix:** Parse `req.body` through a Zod schema (or equivalent) that produces a typed `CreateOrderRequest`. After parsing, the type guarantees correctness.

#### 7. SRP Violation — Handler Does Everything

> "SRP — one reason to change."

The `POST /api/orders` handler does: input validation, stock checking, order insertion, inventory decrement, and email notification. Five responsibilities, five reasons to change.

**Fix:** Extract `checkStock()`, `createOrder()`, `decrementInventory()`, `sendOrderConfirmation()` as separate pure/service functions.

#### 8. Function Length

> "No functions above 30 lines."

The POST handler is ~20 lines of dense logic but does 5 distinct things. It is on the edge and will grow. The real problem is responsibility count, not line count.

---

### Control Flow & Complexity

#### 9. Sequential Awaits on Independent Operations

> "Parallelize independent async operations."

Stock checks for each item are done sequentially in a `for` loop. These are independent queries that could run in parallel.

**Fix:** `await Promise.all(items.map(item => checkStock(item)))`.

#### 10. No Bound on Inputs — Reject, Never Fallback

> "Every parameter from outside your trust boundary must be validated and rejected if invalid."

- `items` array has no max length — a request with 10,000 items will hammer the DB.
- `quantity` has no upper/lower bound — negative quantities would increase stock.
- `productId` is not validated against any format.
- `userId` is not validated.

**Fix:** Parse and bound every field. Reject with a structured error on invalid input.

---

### Data & Types

#### 11. No TypeScript Types at All

> "Strict typing is non-negotiable."

Despite the `.ts` extension, nothing is typed. `req.body` is `any`, query results are untyped, the response shape is ad-hoc. The TypeScript compiler provides zero value here.

**Fix:** Define `Order`, `OrderItem`, `CreateOrderRequest`, `CreateOrderResponse` types. Type the DB query results.

#### 12. Magic Strings

> "No magic numbers/strings — extract to named constants."

`'pending'`, `'order-confirmation'`, `'https://email-api.internal/send'`, `3000` — all magic values baked into the handler.

**Fix:** Extract to named constants or config: `ORDER_STATUS.PENDING`, `EMAIL_TEMPLATES.ORDER_CONFIRMATION`, `config.emailApiUrl`, `config.port`.

---

### Error Handling

#### 13. Zero Error Handling on DB Queries and HTTP Calls

> "No silent failures."

- Every `db.query()` call can throw — no try/catch, no error middleware.
- `fetch()` to the email API can fail — the order is already created and inventory decremented, but the user gets a 500 and no confirmation.
- `stock.rows[0]` can be `undefined` if the product does not exist — this will throw `Cannot read property 'quantity' of undefined`.

**Fix:** Wrap in try/catch or use Result types. Add Express error middleware. Handle the email call failing gracefully (the order is already committed).

#### 14. No Timeouts on I/O

> "Define timeout on every I/O (HTTP, RPC, SQL)."

- `db.query()` has no statement timeout.
- `fetch()` to the email API has no timeout — if the email service hangs, the request hangs forever.

**Fix:** Set `statement_timeout` on the pool or per-query. Use `AbortSignal.timeout()` on the fetch call.

---

### Data Integrity

#### 15. Race Condition / No Transaction

Stock is checked, then later decremented, with an order insert in between — all outside a transaction. Two concurrent requests can both pass the stock check, both insert orders, and both decrement inventory below zero.

**Fix:** Wrap the entire operation in a `BEGIN ... COMMIT` transaction. Use `SELECT ... FOR UPDATE` on inventory rows to serialize concurrent access.

#### 16. Partial Failure Leaves Inconsistent State

If the second item's inventory update fails (or the email call throws), the first item's inventory is already decremented and the order row exists. There is no rollback.

**Fix:** Transaction. All-or-nothing. Email should be sent asynchronously after commit (outbox pattern or event queue).

---

### Security

#### 17. No Authentication or Authorization

Any client can create orders for any `userId` and read any order by ID. There is no auth middleware, no token validation, no ownership check on the GET endpoint.

#### 18. SQL Injection is Mitigated but Access Control is Not

Parameterized queries prevent SQL injection, but the absence of authorization means the `GET /api/orders/:id` endpoint is an IDOR vulnerability — any user can read any order.

---

### Project & Codebase Hygiene

#### 19. No Tests, No Linting, No CI/CD, No Monitoring

> "Start projects with tests, linting, CI/CD, monitoring from day 1."

None of these exist. The hard-wired dependencies (issue #2) make adding tests retroactively painful.

#### 20. No Graceful Shutdown

`app.listen(3000)` with no signal handling. In-flight requests and DB connections will be killed on deploy.

---

## Summary

| Category | Count |
|---|---|
| Architecture & Patterns (skill section) | 5 |
| Functions & Architecture | 3 |
| Control Flow | 2 |
| Data & Types | 2 |
| Error Handling | 2 |
| Data Integrity | 2 |
| Security | 2 |
| Hygiene | 2 |
| **Total** | **20** |

The most impactful fixes, in order:

1. **Factory-function DI** — unlocks testability for everything else
2. **Transaction with SELECT FOR UPDATE** — fixes the race condition that can corrupt data in production today
3. **Parse inputs with Zod** — eliminates an entire class of runtime errors
4. **Structured errors** — makes the API machine-consumable
5. **Feature module split** — enables independent evolution and ownership
