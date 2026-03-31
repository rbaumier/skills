# Architecture Review: Mini E-Commerce Backend

## Verdict: Major rework needed

This single-file endpoint has **7 critical issues** that would cause data corruption, lost revenue, and outages in production.

---

## Critical Issues

### 1. Race Condition on Inventory (Data Corruption)

**Violation:** No transactional integrity — stock check and stock decrement are separate queries with no locking.

Two concurrent orders for the last item both pass the `SELECT quantity` check, both decrement, inventory goes negative. Lost revenue or overselling.

**Fix:** Wrap the entire order flow in a `BEGIN`/`COMMIT` transaction with `SELECT ... FOR UPDATE` on inventory rows. This is non-negotiable for any operation that reads-then-writes.

```typescript
const client = await db.connect();
try {
  await client.query('BEGIN');
  for (const item of items) {
    const stock = await client.query(
      'SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE',
      [item.productId]
    );
    if (stock.rows[0].quantity < item.quantity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `Insufficient stock for ${item.productId}` });
    }
    await client.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2',
      [item.quantity, item.productId]
    );
  }
  const order = await client.query(
    'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING id',
    [userId, 'pending']
  );
  await client.query('COMMIT');
  // ... respond, then send email async
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### 2. Synchronous Email Blocks the Response (Reliability)

**Violation:** Functional Core, Imperative Shell — side effects mixed into business logic. The `fetch` to the email API is **in the request path**. If the email service is slow or down, the order response hangs or fails even though the order succeeded.

**Fix:** Fire-and-forget with error logging, or better: publish an `order.created` event and let a separate consumer handle notifications. The order endpoint's job is to create the order, nothing else (SRP).

### 3. Zero Error Handling (Silent Failures)

**Violation:** "No silent failures — never empty catch blocks" and "Define timeout on every I/O."

- No `try/catch` around any DB query or the `fetch` call.
- No timeout on the email `fetch`.
- If `stock.rows[0]` is `undefined` (product doesn't exist), the code throws `Cannot read property 'quantity' of undefined` — an unhandled 500 with a leaked stack trace.

**Fix:** Wrap in try/catch, add `AbortSignal.timeout()` on fetch, validate that inventory rows exist before accessing `.quantity`.

### 4. No Input Validation / Parsing (Security + Correctness)

**Violation:** "Parse, Don't Validate" — the code checks `userId` and `items?.length` exist but never parses them into trusted types. `items` could contain anything: negative quantities, missing `productId`, SQL-friendly strings.

**Fix:** Parse at the boundary with a schema (Zod, etc.):

```typescript
const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(999),
});
const CreateOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1).max(50),
});
```

Reject anything that doesn't parse. After parsing, the types are trusted downstream.

### 5. No Authentication or Authorization

**Violation:** "Constrain first, relax later — least privilege."

- `POST /api/orders` trusts `userId` from the request body. Any caller can create orders for any user.
- `GET /api/orders/:id` returns any order to any caller — no ownership check.

**Fix:** Extract `userId` from an authenticated session/JWT. Scope queries to the authenticated user.

### 6. Single-File Monolith (Architecture)

**Violation:** "Feature module structure: schema → errors → repository → service → routes → index" and "SRP — one reason to change."

Everything is in one file: routing, validation, persistence, external API calls. This prevents testing, reuse, and independent change.

**Fix:** Split into a vertical feature slice:

```
orders/
  schema.ts       — Zod schemas (CreateOrderSchema)
  errors.ts       — OrderNotFound, InsufficientStock
  repository.ts   — DB queries (createOrder, findById, decrementStock)
  service.ts      — Business logic (pure: validate stock, compute totals)
  routes.ts       — HTTP handlers (thin: parse, call service, respond)
  index.ts        — Composition root (wire dependencies)
```

### 7. Magic Strings and Missing Constants

**Violation:** "No magic numbers/strings — extract to const or enum."

- `'pending'` status is a raw string. Should be a discriminated union or enum: `OrderStatus.Pending`.
- `'order-confirmation'` email template name is hardcoded.
- Port `3000` is hardcoded — should come from env config.

---

## Secondary Issues

| Issue | Violation | Fix |
|---|---|---|
| `express.json()` middleware missing | Body will be `undefined` | Add `app.use(express.json())` |
| `Pool` created with no config | Relies on implicit `PG*` env vars with no validation | Explicit config with defaults, validated at startup |
| No `order_items` table | Items are decremented from inventory but never recorded | Insert into `order_items` within the transaction |
| No request body size limit | Unbounded `items` array = DoS vector | `express.json({ limit: '100kb' })` + schema `.max(50)` |
| `req.params.id` not validated | Could be any string passed to SQL | Parse as integer/UUID before querying |
| No graceful shutdown | `app.listen` with no signal handling | Handle `SIGTERM`, drain connections, close pool |
| No health check endpoint | Can't monitor readiness | Add `GET /health` that pings DB |

---

## Priority Order

1. **Transaction + row locking** — prevents data corruption (money is at stake)
2. **Input parsing with Zod** — prevents crashes and injection
3. **Auth** — prevents unauthorized access
4. **Error handling + timeouts** — prevents cascading failures
5. **Async email** — prevents user-facing latency from third-party
6. **Feature module split** — enables testing and maintainability
7. **Constants, config, health check** — operational hygiene
