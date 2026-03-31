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
  status: "completed";
}

interface OrderError {
  ok: false;
  error: string;
  status: "failed";
}

type OrderResult = OrderSuccess | OrderError;

// --- Dependencies (Factory DI) ---

interface OrderDeps {
  processUrgentOrder: (order: Order) => Promise<{ ok: boolean }>;
  processNormalOrder: (order: Order) => Promise<{ ok: boolean }>;
  ship: (order: Order) => Promise<void>;
  fetchInventory: (warehouseId: string) => Promise<unknown>;
  fetchPricing: (region: string) => Promise<unknown>;
}

// --- Validation (guard clauses, parse don't validate) ---

function validateOrder(order: Order): OrderError | null {
  if (order.items.length === 0) {
    return { ok: false, error: "empty order", status: "failed" };
  }
  if (!order.customer) {
    return { ok: false, error: "no customer", status: "failed" };
  }
  if (!order.customer.verified) {
    return { ok: false, error: "not verified", status: "failed" };
  }
  return null;
}

// --- No boolean flag: two named functions ---

function createOrderHandler(deps: OrderDeps) {
  async function handleUrgentOrder(order: Order): Promise<OrderResult> {
    const validationError = validateOrder(order);
    if (validationError) return validationError;

    const [result] = await Promise.all([
      deps.processUrgentOrder(order),
      deps.fetchInventory(order.warehouseId),
      deps.fetchPricing(order.region),
    ]);

    if (!result.ok) {
      return { ok: false, error: "processing failed", status: "failed" };
    }

    if (order.needsShipping) {
      await deps.ship(order);
    }

    return { ok: true, status: "completed" };
  }

  async function handleNormalOrder(order: Order): Promise<OrderResult> {
    const validationError = validateOrder(order);
    if (validationError) return validationError;

    const [result] = await Promise.all([
      deps.processNormalOrder(order),
      deps.fetchInventory(order.warehouseId),
      deps.fetchPricing(order.region),
    ]);

    if (!result.ok) {
      return { ok: false, error: "processing failed", status: "failed" };
    }

    if (order.needsShipping) {
      await deps.ship(order);
    }

    return { ok: true, status: "completed" };
  }

  return { handleUrgentOrder, handleNormalOrder };
}

export { createOrderHandler, validateOrder };
export type { Order, OrderResult, OrderDeps, Customer };
