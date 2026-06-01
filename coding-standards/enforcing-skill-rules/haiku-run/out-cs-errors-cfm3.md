```typescript
import { db } from './db';

// Finite state union — make illegal states unrepresentable
type OrderStatus = 'pending' | 'paid' | 'cancelled';

// Domain objects with explicit types; parse at boundary
interface OrderItem {
  id: string;
  qty: number;
  price: number;
}

interface OrderInput {
  userId: string;
  items: OrderItem[];
}

// DTO response type — map raw DB rows to typed domain objects
interface CreatedOrder {
  id: string;
  userId: string;
  total: number;
  status: OrderStatus;
}

// Error result with all four required fields: type, code, status, detail
interface ErrorDetail {
  type: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INVARIANT_VIOLATION';
  code: string;
  status: number;
  detail: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorDetail };

const DB_TIMEOUT_MS = 5000;

// Query with timeout protection — all I/O must have explicit timeout
async function queryWithTimeout<T>(
  query: string,
  params: unknown[],
): Promise<T[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
  try {
    const result = await db.query(query, params, { signal: controller.signal });
    return result.rows;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createOrder(input: OrderInput): Promise<Result<CreatedOrder>> {
  // Validate all input BEFORE any I/O — reject on invalid bounds
  if (!input.userId || typeof input.userId !== 'string') {
    return {
      ok: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'MISSING_USER_ID',
        status: 400,
        detail: 'userId must be a non-empty string',
      },
    };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      ok: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'EMPTY_ITEMS',
        status: 400,
        detail: 'items must be a non-empty array',
      },
    };
  }

  for (const item of input.items) {
    if (typeof item.qty !== 'number' || item.qty <= 0) {
      return {
        ok: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_QTY',
          status: 400,
          detail: 'item quantity must be a positive number',
        },
      };
    }
    if (typeof item.price !== 'number' || item.price < 0) {
      return {
        ok: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_PRICE',
          status: 400,
          detail: 'item price must be non-negative',
        },
      };
    }
  }

  // Fetch user and check status once — avoid repeated checks in the loop
  const users = await queryWithTimeout('SELECT id, blocked FROM users WHERE id = $1', [
    input.userId,
  ]);
  const user = users[0];

  if (!user) {
    return {
      ok: false,
      error: {
        type: 'NOT_FOUND',
        code: 'USER_NOT_FOUND',
        status: 404,
        detail: 'user does not exist',
      },
    };
  }

  if (user.blocked) {
    return {
      ok: false,
      error: {
        type: 'CONFLICT',
        code: 'USER_BLOCKED',
        status: 403,
        detail: 'blocked users cannot transact',
      },
    };
  }

  // Validate stock for all items and compute total
  let total = 0;
  for (const item of input.items) {
    const stockRows = await queryWithTimeout('SELECT qty FROM stock WHERE id = $1', [item.id]);
    const stock = stockRows[0];

    if (!stock) {
      return {
        ok: false,
        error: {
          type: 'NOT_FOUND',
          code: 'STOCK_NOT_FOUND',
          status: 404,
          detail: `stock not found for item ${item.id}`,
        },
      };
    }

    if (stock.qty < item.qty) {
      return {
        ok: false,
        error: {
          type: 'CONFLICT',
          code: 'INSUFFICIENT_STOCK',
          status: 409,
          detail: `insufficient stock for item ${item.id}; requested ${item.qty}, available ${stock.qty}`,
        },
      };
    }

    total += item.price * item.qty;
  }

  // Invariant check — should never happen if input validation is correct
  if (total <= 0) {
    return {
      ok: false,
      error: {
        type: 'INVARIANT_VIOLATION',
        code: 'NEGATIVE_TOTAL',
        status: 500,
        detail: 'order total must be positive; this should never occur after input validation',
      },
    };
  }

  const status: OrderStatus = 'pending';
  const orderRows = await queryWithTimeout(
    'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING id, user_id, total, status',
    [input.userId, total, status],
  );
  const orderRow = orderRows[0];

  // Map raw DB row to typed DTO
  const order: CreatedOrder = {
    id: orderRow.id,
    userId: orderRow.user_id,
    total: orderRow.total,
    status: orderRow.status,
  };

  return { ok: true, data: order };
}

export async function removeCartItem(
  userId: string,
  itemId: string,
): Promise<Result<void>> {
  // Validate input
  if (!userId || typeof userId !== 'string') {
    return {
      ok: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'MISSING_USER_ID',
        status: 400,
        detail: 'userId must be a non-empty string',
      },
    };
  }

  if (!itemId || typeof itemId !== 'string') {
    return {
      ok: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'MISSING_ITEM_ID',
        status: 400,
        detail: 'itemId must be a non-empty string',
      },
    };
  }

  // Fetch cart — idempotent delete: if cart doesn't exist, succeed
  const cartRows = await queryWithTimeout('SELECT id, items FROM carts WHERE user_id = $1', [
    userId,
  ]);
  const cart = cartRows[0];

  if (!cart) {
    // Postcondition met: item not in any cart for this user
    return { ok: true, data: undefined };
  }

  const item = (cart.items as any[]).find((entry: any) => entry.id === itemId);

  if (!item) {
    // Postcondition met: item already not in cart — idempotent success
    return { ok: true, data: undefined };
  }

  // Delete the item
  await queryWithTimeout('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [
    cart.id,
    itemId,
  ]);

  return { ok: true, data: undefined };
}
```
