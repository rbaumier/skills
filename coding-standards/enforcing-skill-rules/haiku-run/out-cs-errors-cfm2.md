```typescript
import { db } from './db';

// Status enum: all valid order states must be represented
type OrderStatus = 'pending' | 'paid' | 'cancelled';

// Input types with explicit bounds: all fields required, all validated at entry
interface OrderItem {
  id: string;
  qty: number;
  price: number;
}

interface OrderInput {
  userId: string;
  items: OrderItem[];
}

// DTO response: maps DB row to typed domain object
interface OrderDTO {
  id: string;
  userId: string;
  total: number;
  status: OrderStatus;
}

// Factory: accepts all I/O deps, no module globals
export async function createOrder({ db }: { db: any }) {
  return async function handle(input: OrderInput): Promise<{ ok: true; value: OrderDTO } | { ok: false; error: OrderError }> {
    // Bound every input before any I/O: reject invalid, never default
    if (!input.userId || input.userId.trim() === '') {
      return { ok: false, error: { type: 'INVALID_USER_ID', code: 'E001', status: 400, detail: 'User ID required' } };
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      return { ok: false, error: { type: 'EMPTY_ITEMS', code: 'E002', status: 400, detail: 'At least one item required' } };
    }
    for (const item of input.items) {
      if (!item.id || item.id.trim() === '') {
        return { ok: false, error: { type: 'INVALID_ITEM_ID', code: 'E003', status: 400, detail: 'Item ID required' } };
      }
      if (typeof item.qty !== 'number' || item.qty <= 0) {
        return { ok: false, error: { type: 'INVALID_QUANTITY', code: 'E004', status: 400, detail: 'Quantity must be positive' } };
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        return { ok: false, error: { type: 'INVALID_PRICE', code: 'E005', status: 400, detail: 'Price must be non-negative' } };
      }
    }

    // Wrap I/O with timeout: 5s for DB by convention
    const DB_TIMEOUT_MS = 5000;
    
    // Fetch and validate user (single call, no re-check in loop)
    try {
      const userResult = await db.query(
        'SELECT id, blocked FROM users WHERE id = $1',
        [input.userId],
        { signal: AbortSignal.timeout(DB_TIMEOUT_MS) }
      );
      const user = userResult.rows[0];
      if (!user) {
        return { ok: false, error: { type: 'USER_NOT_FOUND', code: 'E006', status: 404, detail: 'User does not exist' } };
      }
      // Barricade: user validation complete, trust result inside loop
      if (user.blocked) {
        return { ok: false, error: { type: 'USER_BLOCKED', code: 'E007', status: 403, detail: 'User account suspended' } };
      }

      // Check stock for all items in parallel (Promise.all for independent ops)
      const stockChecks = await Promise.all(
        input.items.map(item =>
          db.query(
            'SELECT qty FROM stock WHERE id = $1',
            [item.id],
            { signal: AbortSignal.timeout(DB_TIMEOUT_MS) }
          )
        )
      );

      // Validate stock results after all queries complete
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const stock = stockChecks[i].rows[0];
        if (!stock || stock.qty < item.qty) {
          return { ok: false, error: { type: 'INSUFFICIENT_STOCK', code: 'E008', status: 409, detail: `Item ${item.id} out of stock` } };
        }
      }

      // Calculate total: intermediate variable for compound expression
      let total = 0;
      for (const item of input.items) {
        total += item.price * item.qty;
      }

      // Impossible guard: document why this should never happen
      if (total <= 0) {
        return { ok: false, error: { type: 'INVARIANT_VIOLATION', code: 'E009', status: 500, detail: 'Impossible: valid prices cannot sum to negative' } };
      }

      // Create order with explicit status type
      const status: OrderStatus = 'pending';
      const orderResult = await db.query(
        'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING id, user_id, total, status',
        [input.userId, total, status],
        { signal: AbortSignal.timeout(DB_TIMEOUT_MS) }
      );
      const dbRow = orderResult.rows[0];

      // Map DB row to DTO: explicit type boundary
      const orderDTO: OrderDTO = {
        id: dbRow.id,
        userId: dbRow.user_id,
        total: dbRow.total,
        status: dbRow.status as OrderStatus,
      };

      return { ok: true, value: orderDTO };
    } catch (cause) {
      // Preserve cause, wrap in Result error
      return { ok: false, error: { type: 'DB_ERROR', code: 'E010', status: 500, detail: 'Database operation failed', cause } };
    }
  };
}

// Redefine semantics: removeCartItem succeeds idempotently
// Postcondition: after call, item is not in cart (regardless of prior state)
export async function removeCartItem({ db }: { db: any }) {
  return async function handle(userId: string, itemId: string): Promise<{ ok: true } | { ok: false; error: CartError }> {
    // Validate inputs
    if (!userId || userId.trim() === '') {
      return { ok: false, error: { type: 'INVALID_USER_ID', code: 'E011', status: 400, detail: 'User ID required' } };
    }
    if (!itemId || itemId.trim() === '') {
      return { ok: false, error: { type: 'INVALID_ITEM_ID', code: 'E012', status: 400, detail: 'Item ID required' } };
    }

    try {
      const DB_TIMEOUT_MS = 5000;
      
      // Fetch cart
      const cartResult = await db.query(
        'SELECT id FROM carts WHERE user_id = $1',
        [userId],
        { signal: AbortSignal.timeout(DB_TIMEOUT_MS) }
      );
      const cart = cartResult.rows[0];
      
      // If cart doesn't exist, item is effectively removed — idempotent success
      if (!cart) {
        return { ok: true };
      }

      // Delete item if it exists (DELETE with no WHERE match is idempotent)
      await db.query(
        'DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2',
        [cart.id, itemId],
        { signal: AbortSignal.timeout(DB_TIMEOUT_MS) }
      );

      return { ok: true };
    } catch (cause) {
      return { ok: false, error: { type: 'CART_ERROR', code: 'E013', status: 500, detail: 'Failed to modify cart', cause } };
    }
  };
}

// Error type: diagnostic-complete — all four fields required
interface OrderError {
  type: 'NOT_FOUND' | 'INVALID_USER_ID' | 'EMPTY_ITEMS' | 'INVALID_ITEM_ID' | 'INVALID_QUANTITY' | 'INVALID_PRICE' | 'USER_NOT_FOUND' | 'USER_BLOCKED' | 'INSUFFICIENT_STOCK' | 'INVARIANT_VIOLATION' | 'DB_ERROR';
  code: string;
  status: number;
  detail: string;
  cause?: unknown;
}

interface CartError {
  type: 'INVALID_USER_ID' | 'INVALID_ITEM_ID' | 'CART_ERROR';
  code: string;
  status: number;
  detail: string;
  cause?: unknown;
}
```
