```typescript
import { z } from 'zod';

// Value Object for monetary amounts with currency
type Money = {
  amount: number;
  currency: string;
};

// Value Object for customer contact and address
type CustomerInfo = {
  email: string;
  name: string;
  address: {
    street: string;
    city: string;
    zip: string;
  };
};

// Value Object for order line item
type OrderItem = {
  price: number;
  qty: number;
};

// Domain-specific parsers at the boundary
const parseUserId = (id: unknown) => {
  const result = z.string().min(1).safeParse(id);
  return result.success ? result.data : undefined;
};

const parseOrderItems = (items: unknown) => {
  const itemSchema = z.object({
    price: z.number().positive(),
    qty: z.number().int().positive(),
  });
  const result = z.array(itemSchema).min(1).safeParse(items);
  return result.success ? result.data : undefined;
};

const parseCustomer = (row: unknown) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
  });
  const result = schema.safeParse(row);
  return result.success ? result.data : undefined;
};

// Factory: inject dependencies explicitly
type PlaceOrderDeps = {
  db: { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> };
  cache: { set: (key: string, value: string) => void };
  mailer: { send: (to: string, subject: string, body: string) => Promise<void> };
};

// Orchestrator: reads top-to-bottom as business steps
export async function placeOrder(
  deps: PlaceOrderDeps,
  userId: string,
  items: unknown,
): Promise<{ id: string; total: number; status: string } | undefined> {
  // Step 1: Validate and parse inputs at boundary
  const parsedUserId = parseUserId(userId);
  if (!parsedUserId) {
    return undefined; // invalid userId
  }

  const parsedItems = parseOrderItems(items);
  if (!parsedItems || parsedItems.length === 0) {
    return undefined; // empty or invalid items
  }

  // Step 2: Fetch customer data
  const userResult = await deps.db.query('SELECT * FROM users WHERE id = $1', [parsedUserId]);
  if (userResult.rows.length === 0) {
    return undefined; // user not found
  }

  const customer = parseCustomer(userResult.rows[0]);
  if (!customer) {
    return undefined; // user data malformed
  }

  // Step 3: Calculate total
  const money = calculateOrderTotal(parsedItems);

  // Step 4: Persist order
  const orderResult = await deps.db.query(
    'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING id, total, status',
    [parsedUserId, money.amount, 'pending'],
  );

  const orderId = orderResult.rows[0]?.id;
  if (!orderId) {
    return undefined; // insert failed
  }

  // Step 5: Send confirmation and cache
  const emailBody = formatOrderConfirmation(customer.name, money);
  await deps.mailer.send(customer.email, 'Order placed', emailBody);
  deps.cache.set(`user:${parsedUserId}:lastOrder`, orderId);

  return {
    id: orderId,
    total: money.amount,
    status: 'pending',
  };
}

// Helper: calculate total from items (independently testable, named by intent)
function calculateOrderTotal(items: OrderItem[]): Money {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return { amount: total, currency: 'USD' };
}

// Helper: format order confirmation email
function formatOrderConfirmation(name: string, money: Money): string {
  return `Dear ${name}, your total is ${money.amount} ${money.currency}`;
}

// Factory: apply bulk discount, no unused params
function applyBulkDiscount(items: OrderItem[]): OrderItem[] {
  return items.map((item) => ({ ...item, price: item.price * 0.9 }));
}
```
