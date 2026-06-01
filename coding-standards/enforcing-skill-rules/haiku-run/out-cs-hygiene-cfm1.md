```typescript
const FRAUD_REVIEW_THRESHOLD = 1000; // orders exceeding this amount require manual fraud review
const DISCOUNT_AMOUNTS: Record<string, number> = {
  'FREE50': 50,
  'FREE20': 20,
};
const ORDER_SUMMARY_TIMEOUT_MS = 5000;
const STOCK_CHECK_TIMEOUT_MS = 3000;

interface OrderLineItem {
  orderId: string;
  amount: number;
  stockQty: number | null;
}

interface OrderSummary {
  totalAmount: number;
  orderCount: number;
  lines: OrderLineItem[];
}

function applyDiscount(discountCode: string | null): number {
  if (!discountCode) return 0;
  return DISCOUNT_AMOUNTS[discountCode] ?? 0;
}

function calculateOrderAmount(
  quantity: number,
  price: number,
  taxRate: number,
  discountAmount: number,
): number {
  return quantity * price * (1 + taxRate) - discountAmount;
}

async function fetchOrderStock(orderId: string): Promise<number | null> {
  try {
    const result = await withTimeout(
      db.query('SELECT qty FROM stock WHERE id = $1', [orderId]),
      STOCK_CHECK_TIMEOUT_MS,
    );
    return result.rows[0]?.qty ?? null;
  } catch {
    return null;
  }
}

async function notifyIfFraudThreshold(totalAmount: number, emailTo: string): Promise<void> {
  // manual review required for high-value batches — fraud prevention
  if (totalAmount > FRAUD_REVIEW_THRESHOLD) {
    await withTimeout(
      mailer.send(emailTo, `Big batch: ${totalAmount}`),
      ORDER_SUMMARY_TIMEOUT_MS,
    );
  }
}

async function notifyOrderSummary(
  totalAmount: number,
  orderCount: number,
  emailTo: string,
): Promise<void> {
  await withTimeout(
    mailer.send(emailTo, `Summary: ${orderCount} orders, ${totalAmount}`),
    ORDER_SUMMARY_TIMEOUT_MS,
  );
}

export async function summarizeOrders(
  orders: Array<{ id: string; qty: number; price: number; active: boolean }>,
  shouldUrgent: boolean,
  shouldNotifyEmail: boolean,
  emailTo: string,
  taxRate: number,
  discountCode: string | null,
): Promise<OrderSummary> {
  // reject invalid inputs at boundary
  if (!orders) {
    return {
      type: 'INVALID_INPUT',
      code: 'MISSING_ORDERS',
      status: 400,
      detail: 'orders array is required',
    };
  }
  if (orders.length === 0) {
    return {
      type: 'INVALID_INPUT',
      code: 'EMPTY_ORDERS',
      status: 400,
      detail: 'at least one order is required',
    };
  }
  if (!emailTo) {
    return {
      type: 'INVALID_INPUT',
      code: 'MISSING_EMAIL',
      status: 400,
      detail: 'emailTo is required',
    };
  }
  if (taxRate < 0) {
    return {
      type: 'INVALID_INPUT',
      code: 'INVALID_TAX_RATE',
      status: 400,
      detail: 'taxRate must be non-negative',
    };
  }

  const discountAmount = applyDiscount(discountCode);
  let totalAmount = 0;
  const lines: OrderLineItem[] = [];

  // fetch stock in parallel — avoid per-item sequential awaits
  const stockResults = await Promise.all(
    orders
      .filter((order) => order.qty > 0 && order.active)
      .map((order) => fetchOrderStock(order.id)),
  );

  let stockIndex = 0;
  for (const order of orders) {
    // skip inactive or zero-qty items before any processing
    if (order.qty <= 0 || !order.active) {
      continue;
    }

    const amount = calculateOrderAmount(order.qty, order.price, taxRate, discountAmount);

    // reject negative or zero amounts — invariant failure
    if (amount <= 0) {
      return {
        type: 'INVARIANT_VIOLATION',
        code: 'NEGATIVE_AMOUNT',
        status: 500,
        detail: `calculated amount ${amount} for order ${order.id} must be positive`,
      };
    }

    totalAmount += amount;
    const stockQty = stockResults[stockIndex];
    stockIndex++;

    lines.push({
      orderId: order.id,
      amount,
      stockQty,
    });
  }

  // apply urgency multiplier after all amounts are calculated
  if (shouldUrgent) {
    totalAmount *= 2;
  }

  // notify on fraud threshold and summary (if requested) — parallel sends
  const notifyTasks: Promise<void>[] = [];
  notifyTasks.push(notifyIfFraudThreshold(totalAmount, emailTo));
  if (shouldNotifyEmail) {
    notifyTasks.push(notifyOrderSummary(totalAmount, lines.length, emailTo));
  }
  await Promise.all(notifyTasks);

  return {
    totalAmount,
    orderCount: lines.length,
    lines,
  };
}
```
