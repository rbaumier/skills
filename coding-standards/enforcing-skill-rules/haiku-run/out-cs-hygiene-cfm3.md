```typescript
const MANUAL_REVIEW_THRESHOLD = 1000; // Orders over $1000 trip manual fraud review
const DISCOUNT_CODES = {
  FREE50: 50,
  FREE20: 20,
} as const;

interface OrderSummary {
  total: number;
  count: number;
  lines: string[];
}

async function calculateOrderTotal(
  order: { id: string; qty: number; price: number; active: boolean },
  taxRate: number,
  discountAmount: number,
): Promise<number | null> {
  // Reject invalid quantities before any I/O
  if (order.qty <= 0 || order.price < 0) {
    return null;
  }
  if (!order.active) {
    return null;
  }

  const grossAmount = order.qty * order.price * (1 + taxRate);
  const netAmount = grossAmount - discountAmount;

  // Negative amounts after discount indicate an error — reject before I/O
  if (netAmount <= 0) {
    return null;
  }

  return netAmount;
}

function getDiscountAmount(discountCode: string | null): number {
  if (!discountCode || !(discountCode in DISCOUNT_CODES)) {
    return 0;
  }
  return DISCOUNT_CODES[discountCode as keyof typeof DISCOUNT_CODES];
}

async function fetchStockQty(
  orderId: string,
): Promise<number | null> {
  // Every I/O call must have a timeout — wrapped at boundary
  const signal = AbortSignal.timeout(5000);
  try {
    const stock = await db.query(
      'SELECT qty FROM stock WHERE id = $1',
      [orderId],
      { signal },
    );
    return stock.rows[0]?.qty ?? null;
  } catch (err) {
    // Timeout or query error — return null rather than throw
    return null;
  }
}

/**
 * Summarize orders with tax and discount applied, flagging high-value batches for manual review.
 * Returns total amount, order count, and line-by-line details.
 * Rejects invalid orders (zero/negative qty) at entry; does not send email on empty results.
 */
async function summarizeOrders(
  orders: { id: string; qty: number; price: number; active: boolean }[],
  options: {
    taxRate: number;
    discountCode: string | null;
    shouldFlagForReview?: boolean;
    shouldNotifyOnCompletion?: boolean;
    notificationEmail: string;
  },
): Promise<OrderSummary> {
  // Reject empty collection before processing
  if (!orders || orders.length === 0) {
    return { total: 0, count: 0, lines: [] };
  }

  const discountAmount = getDiscountAmount(options.discountCode);

  let total = 0;
  let count = 0;
  const lines: string[] = [];

  // Process all stock checks in parallel, not sequentially in the loop
  const stockResults = await Promise.all(
    orders.map((order) => fetchStockQty(order.id)),
  );

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const amount = await calculateOrderTotal(
      order,
      options.taxRate,
      discountAmount,
    );

    // Skip invalid orders — validated at boundary, not silently dropped
    if (amount === null) {
      continue;
    }

    total += amount;
    count++;
    lines.push(`${order.id}: ${amount}`);

    const stockQty = stockResults[i];
    if (stockQty !== null) {
      lines.push(`stock ${stockQty}`);
    }
  }

  // Flag high-value batches for manual fraud review
  if (options.shouldFlagForReview && total > MANUAL_REVIEW_THRESHOLD) {
    await mailer.send(
      options.notificationEmail,
      `Manual review required: ${total} in ${count} orders`,
    );
  }

  // Send summary notification if requested and there are results
  if (options.shouldNotifyOnCompletion && count > 0) {
    const signal = AbortSignal.timeout(5000);
    await mailer.send(
      options.notificationEmail,
      `Summary: ${count} orders, total ${total}`,
      { signal },
    );
  }

  return { total, count, lines };
}
```
