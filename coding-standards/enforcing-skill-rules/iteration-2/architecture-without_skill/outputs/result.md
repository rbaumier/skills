# Architecture Review: Mini E-Commerce Backend

## Critical: Race Condition on Inventory

The stock check and stock decrement are **not atomic**. Two concurrent requests can both read sufficient stock, both pass validation, and both decrement — overselling inventory.

**Fix**: Wrap the entire order flow (check + insert + decrement) in a single database transaction using `BEGIN`/`COMMIT`, and use `SELECT ... FOR UPDATE` on the inventory rows to acquire row-level locks.

```typescript
const client = await db.connect();
try {
  await client.query('BEGIN');
  for (const item of items) {
    const stock = await client.query(
      'SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE',
      [item.productId]
    );
    if (!stock.rows[0] || stock.rows[0].quantity < item.quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Not enough stock for ${item.productId}` });
    }
  }
  const order = await client.query(
    'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING id',
    [userId, 'pending']
  );
  for (const item of items) {
    await client.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2',
      [item.quantity, item.productId]
    );
  }
  await client.query('COMMIT');
  // ... send response, then email
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

## Critical: No Error Handling

Every `await` can throw. A DB error mid-loop leaves inventory partially decremented with no rollback. The transaction fix above also solves this — `ROLLBACK` in the `catch` block restores consistency.

The `GET /api/orders/:id` route also has zero error handling; a DB connection failure crashes the process.

**Fix**: Add try/catch to every route, or use an Express async error wrapper.

## High: Email Blocks the Response

The `fetch()` to the email service is `await`ed before sending the HTTP response. If the email service is slow or down, the user waits or gets a 500 — even though the order succeeded.

**Fix**: Fire-and-forget the email (drop the `await`), or better, push to a job queue (e.g., pg-boss, BullMQ) for reliable async delivery with retries.

```typescript
// Fire-and-forget (minimum viable fix)
fetch('https://email-api.internal/send', { ... }).catch(console.error);
res.json({ orderId: order.rows[0].id, status: 'pending' });
```

## High: No Input Validation

- `item.productId` and `item.quantity` are never validated. A non-numeric quantity or missing productId produces a cryptic DB error or worse.
- `req.body` is never parsed — `express.json()` middleware is missing.
- No check that `quantity > 0` (negative quantity would *add* stock).

**Fix**: Add `app.use(express.json())` and validate each item's shape and types before any DB call. Use a schema validator (zod, etc.) or manual checks.

## High: No Authorization

Any caller can create orders for any `userId` and read any order by ID. There is no authentication or ownership check.

**Fix**: Add auth middleware. On `GET /api/orders/:id`, verify the authenticated user owns the order.

## Medium: N+1 Query Pattern

Each item triggers its own `SELECT` and `UPDATE` — 2N queries per order. For an order with 10 items, that is 20 round-trips.

**Fix**: Batch the stock check into a single query using `WHERE product_id = ANY($1)`, and batch the decrements similarly or use a CTE.

## Medium: No `order_items` Table

Items are decremented from inventory but never recorded. There is no way to know what was in an order, calculate totals, or handle returns.

**Fix**: Insert rows into an `order_items` table linking each item (product_id, quantity, unit_price) to the order.

## Medium: Missing `express.json()` Middleware

`req.body` will be `undefined` without body-parsing middleware. The destructuring `const { userId, items } = req.body` will throw immediately.

**Fix**: Add `app.use(express.json())` before the routes.

## Low: Null Dereference on Unknown Product

`stock.rows[0].quantity` throws if the product does not exist (`rows[0]` is `undefined`).

**Fix**: Guard with `if (!stock.rows[0])` before accessing `.quantity`.

## Low: No Graceful Shutdown

`app.listen(3000)` with no signal handling means in-flight requests are dropped on deploy.

**Fix**: Handle `SIGTERM`, stop accepting new connections, drain existing ones, then close the DB pool.

---

## Summary (Priority Order)

| # | Severity | Issue |
|---|----------|-------|
| 1 | Critical | Race condition — no transaction, no row locking |
| 2 | Critical | No error handling — partial writes on failure |
| 3 | High | Email blocks response — couples availability to external service |
| 4 | High | No input validation, missing `express.json()` |
| 5 | High | No authentication or authorization |
| 6 | Medium | N+1 queries per order |
| 7 | Medium | No `order_items` table — items are unrecoverable |
| 8 | Low | Null dereference on unknown product |
| 9 | Low | No graceful shutdown |
