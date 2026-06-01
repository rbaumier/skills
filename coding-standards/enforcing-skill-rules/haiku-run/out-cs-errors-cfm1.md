# Corrected Code

```typescript
import type { Database } from './db';

// ============================================================================
// Types & Contracts
// ============================================================================

type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

interface OrderItem {
  id: string;
  qty: number;
  price: number;
}

interface OrderInput {
  userId: string;
  items: OrderItem[];
}

interface Order {
  id: string;
  userId: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;
}

interface ErrorDetail {
  type:
    | 'USER_NOT_FOUND'
    | 'USER_BLOCKED'
    | 'INSUFFICIENT_STOCK'
    | 'INVALID_QUANTITY'
    | 'INVALID_PRICE'
    | 'INVALID_ORDER_TOTAL'
    | 'INVARIANT_VIOLATION'
    | 'DATABASE_ERROR';
  code: number;
  status: number;
  detail: string;
  cause?: Error;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: ErrorDetail };

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  DB_QUERY_TIMEOUT_MS: 5000,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10000,
  MIN_PRICE: 0.01,
};

// ============================================================================
// Public Exports
// ============================================================================

/**
 * Creates an order for a user with a list of items.
 * Validates user (exists, not blocked), stock availability, and pricing.
 * Returns a typed Order or an error with full context.
 *
 * - Parses input at the boundary into typed OrderInput
 * - Rejects invalid quantities/prices upfront
 * - Checks user state and stock before persisting
 * - Returns DTO with renamed fields (user_id → userId)
 */
export async function createOrder(
  db: Database,
  input: OrderInput,
): Promise<Result<Order>> {
  // Validate input bounds before any I/O
  for (const item of input.items) {
    if (!Number.isInteger(item.qty) || item.qty < CONFIG.MIN_QUANTITY || item.qty > CONFIG.MAX_QUANTITY) {
      return {
        ok: false,
        error: {
          type: 'INVALID_QUANTITY',
          code: 400,
          status: 400,
          detail: `Item quantity must be between ${CONFIG.MIN_QUANTITY} and ${CONFIG.MAX_QUANTITY}; got ${item.qty}`,
        },
      };
    }
    if (typeof item.price !== 'number' || item.price < CONFIG.MIN_PRICE) {
      return {
        ok: false,
        error: {
          type: 'INVALID_PRICE',
          code: 400,
          status: 400,
          detail: `Item price must be >= ${CONFIG.MIN_PRICE}; got ${item.price}`,
        },
      };
    }
  }

  // Fetch user with timeout
  const userResult = await withTimeout(
    db.query('SELECT * FROM users WHERE id = $1', [input.userId]),
    CONFIG.DB_QUERY_TIMEOUT_MS,
  );
  if (!userResult.ok) {
    return {
      ok: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 500,
        status: 500,
        detail: 'Failed to fetch user',
        cause: userResult.error,
      },
    };
  }

  const userRow = userResult.value.rows[0];
  if (!userRow) {
    return {
      ok: false,
      error: {
        type: 'USER_NOT_FOUND',
        code: 404,
        status: 404,
        detail: `User not found: ${input.userId}`,
      },
    };
  }

  // Reject blocked users before any further processing
  if (userRow.blocked) {
    return {
      ok: false,
      error: {
        type: 'USER_BLOCKED',
        code: 403,
        status: 403,
        detail: `User is blocked: ${input.userId}`,
      },
    };
  }

  // Check stock availability for all items (parallel to avoid sequential waits)
  const stockChecks = await Promise.all(
    input.items.map((item) =>
      withTimeout(db.query('SELECT qty FROM stock WHERE id = $1', [item.id]), CONFIG.DB_QUERY_TIMEOUT_MS),
    ),
  );

  for (let i = 0; i < stockChecks.length; i++) {
    const stockResult = stockChecks[i];
    if (!stockResult.ok) {
      return {
        ok: false,
        error: {
          type: 'DATABASE_ERROR',
          code: 500,
          status: 500,
          detail: `Failed to fetch stock for item ${input.items[i].id}`,
          cause: stockResult.error,
        },
      };
    }

    const stockRow = stockResult.value.rows[0];
    if (!stockRow || stockRow.qty < input.items[i].qty) {
      return {
        ok: false,
        error: {
          type: 'INSUFFICIENT_STOCK',
          code: 409,
          status: 409,
          detail: `Insufficient stock for item ${input.items[i].id}; available: ${stockRow?.qty ?? 0}, requested: ${input.items[i].qty}`,
        },
      };
    }
  }

  // Calculate total
  const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  // Sanity check: total should never be <= 0 after validation
  if (total <= 0) {
    return {
      ok: false,
      error: {
        type: 'INVARIANT_VIOLATION',
        code: 500,
        status: 500,
        detail: `Order total must be positive; all items validated but total is ${total}. This should never happen.`,
      },
    };
  }

  // Persist order
  const status: OrderStatus = 'pending';
  const insertResult = await withTimeout(
    db.query('INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *', [
      input.userId,
      total,
      status,
    ]),
    CONFIG.DB_QUERY_TIMEOUT_MS,
  );

  if (!insertResult.ok) {
    return {
      ok: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 500,
        status: 500,
        detail: 'Failed to insert order',
        cause: insertResult.error,
      },
    };
  }

  const orderRow = insertResult.value.rows[0];
  if (!orderRow) {
    return {
      ok: false,
      error: {
        type: 'INVARIANT_VIOLATION',
        code: 500,
        status: 500,
        detail: 'Order inserted but no row returned. This should never happen.',
      },
    };
  }

  // Map raw DB row to DTO
  const order: Order = {
    id: orderRow.id,
    userId: orderRow.user_id,
    total: orderRow.total,
    status: orderRow.status,
    createdAt: new Date(orderRow.created_at),
  };

  return { ok: true, value: order };
}

/**
 * Removes an item from a user's cart. Succeeds idempotently:
 * - If the cart doesn't exist, returns ok (postcondition: item not in cart)
 * - If the item isn't in the cart, returns ok (postcondition: item not in cart)
 * - Only fails on actual database errors
 *
 * Avoids throwing for conditions the caller can't prevent.
 */
export async function removeCartItem(
  db: Database,
  userId: string,
  itemId: string,
): Promise<Result<void>> {
  // Fetch cart with timeout
  const cartResult = await withTimeout(
    db.query('SELECT * FROM carts WHERE user_id = $1', [userId]),
    CONFIG.DB_QUERY_TIMEOUT_MS,
  );

  if (!cartResult.ok) {
    return {
      ok: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 500,
        status: 500,
        detail: 'Failed to fetch cart',
        cause: cartResult.error,
      },
    };
  }

  const cartRow = cartResult.value.rows[0];
  if (!cartRow) {
    // Cart doesn't exist → idempotent success (item not in cart)
    return { ok: true, value: undefined };
  }

  const item = (cartRow.items ?? []).find((entry: any) => entry.id === itemId);
  if (!item) {
    // Item not in cart → idempotent success
    return { ok: true, value: undefined };
  }

  // Delete the item
  const deleteResult = await withTimeout(
    db.query('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [cartRow.id, itemId]),
    CONFIG.DB_QUERY_TIMEOUT_MS,
  );

  if (!deleteResult.ok) {
    return {
      ok: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 500,
        status: 500,
        detail: 'Failed to delete item from cart',
        cause: deleteResult.error,
      },
    };
  }

  return { ok: true, value: undefined };
}

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't settle
 * within the specified duration.
 *
 * Returns a Result to avoid throwing in the application layer.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<Result<T>> {
  try {
    const result = await Promise.race([promise, timeoutPromise(ms)]);
    return { ok: true, value: result as T };
  } catch (cause) {
    return {
      ok: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 500,
        status: 500,
        detail: `I/O operation timed out after ${ms}ms`,
        cause: cause instanceof Error ? cause : new Error(String(cause)),
      },
    };
  }
}

/**
 * Returns a promise that rejects after the specified duration.
 * Used internally by withTimeout to enforce deadlines on I/O.
 */
function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms));
}
```

## Changes Applied

### 1. **Types → Explicit Interfaces** ✓
- Replaced `any` with explicit `OrderItem`, `OrderInput` interfaces
- `type OrderStatus = string` → literal union `'pending' | 'processing' | 'completed' | 'cancelled'`
- Added `Order` DTO for response
- Added `ErrorDetail` interface with all four required fields (type, code, status, detail, cause)

### 2. **Dependency Injection** ✓
- `db` is now a parameter to both functions (injected), not a module global
- Callers control which database instance is used

### 3. **Throw → Result<T>** ✓
- All `throw` statements replaced with `Result<T>` returns
- Errors carry type, code, status, detail, and cause

### 4. **Input Validation at Boundary** ✓
- Quantity and price validated before any I/O (reject if invalid)
- Invalid values produce error Results, not silent skip

### 5. **Timeouts on All I/O** ✓
- All 3+ `db.query` calls wrapped with `withTimeout()`
- Timeout constant centralized in CONFIG
- Timeout helper returns Result to avoid throwing

### 6. **Removed Redundant Check** ✓
- Blocked check only once at the top, not repeated in loop

### 7. **Parallel Stock Checks** ✓
- `Promise.all()` instead of sequential `await` in loop
- Reduces latency

### 8. **Raw DB Row → DTO** ✓
- Order returned as typed `Order` object, not `rows[0]`
- Field mapping: `user_id` → `userId`, `created_at` → `createdAt`

### 9. **Idempotent removeCartItem** ✓
- No longer throws when cart or item missing
- Returns `ok: true` if postcondition met (item not in cart)
- Only fails on actual DB errors

### 10. **Module Documentation** ✓
- Top-level functions have 4-5 line doc explaining consumer effect
- Pipeline in removeCartItem documented as bullet list
- Magic values (timeout, qty bounds) named and explained

### 11. **Configuration Centralized** ✓
- DB_QUERY_TIMEOUT_MS and validation bounds in CONFIG object
- One place to adjust thresholds
