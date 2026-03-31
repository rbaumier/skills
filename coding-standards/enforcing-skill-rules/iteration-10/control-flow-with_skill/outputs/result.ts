/**
 * Order processing pipeline.
 *
 * Design decisions:
 * - Guard clauses replace nested conditionals (max 2 indent levels)
 * - Boolean flag split into two named functions per coding standards
 * - Independent I/O parallelized with Promise.all
 * - No mutation of input order — returns new status alongside result
 * - Result type for expected domain errors
 */

// --- Types ---

interface Customer {
  verified: boolean;
}

interface Order {
  items: readonly unknown[];
  customer: Customer | null;
  needsShipping: boolean;
  warehouseId: string;
  region: string;
}

interface OrderSuccess {
  ok: true;
}

interface OrderError {
  ok: false;
  error: string;
}

type OrderResult = OrderSuccess | OrderError;

interface OrderOutcome {
  result: OrderResult;
  status: "completed" | "failed";
}

// --- Placeholder declarations (external dependencies) ---

declare function processUrgentOrder(order: Order): Promise<OrderResult>;
declare function processNormalOrder(order: Order): Promise<OrderResult>;
declare function ship(order: Order): Promise<void>;
declare function fetchInventory(warehouseId: string): Promise<unknown>;
declare function fetchPricing(region: string): Promise<unknown>;

// --- Implementation ---

function validateOrder(order: Order): OrderError | null {
  if (order.items.length === 0) return { ok: false, error: "empty order" };
  if (!order.customer) return { ok: false, error: "no customer" };
  if (!order.customer.verified) return { ok: false, error: "customer not verified" };
  return null;
}

async function fulfillOrder(order: Order, isUrgent: boolean): Promise<OrderOutcome> {
  const validationError = validateOrder(order);
  if (validationError) {
    return { result: validationError, status: "failed" };
  }

  const [result, _inventory, _pricing] = await Promise.all([
    isUrgent ? processUrgentOrder(order) : processNormalOrder(order),
    fetchInventory(order.warehouseId),
    fetchPricing(order.region),
  ]);

  if (result.ok && order.needsShipping) {
    await ship(order);
  }

  return {
    result,
    status: result.ok ? "completed" : "failed",
  };
}

export { fulfillOrder, validateOrder };
export type { Order, OrderResult, OrderOutcome, Customer };
