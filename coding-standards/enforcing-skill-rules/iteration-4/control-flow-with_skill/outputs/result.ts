/**
 * Order processing result — discriminated union for type-safe error handling.
 * Success carries processed data; failure carries a machine-readable error code.
 */
type OrderResult =
  | { ok: true; data: unknown }
  | { ok: false; error: "empty_order" | "no_customer" | "not_verified" };

/**
 * Validates order preconditions and processes an urgent order.
 * Returns a discriminated result — caller decides what to do with failures.
 *
 * Why separate from processNormalOrder: the skill mandates "no boolean flags as args —
 * a function with a boolean flag is two functions pretending to be one."
 */
async function handleUrgentOrder(order: Order, deps: OrderDeps): Promise<OrderResult> {
  return handleOrderInternal(order, deps, deps.processUrgent);
}

/**
 * Validates order preconditions and processes a normal (non-urgent) order.
 */
async function handleNormalOrder(order: Order, deps: OrderDeps): Promise<OrderResult> {
  return handleOrderInternal(order, deps, deps.processNormal);
}

// --- Implementation details ---

/**
 * Shared validation + processing pipeline. Not exported — callers use
 * handleUrgentOrder / handleNormalOrder which encode urgency in the function name,
 * eliminating the boolean flag entirely.
 */
async function handleOrderInternal(
  order: Order,
  deps: OrderDeps,
  process: (order: Order) => Promise<{ ok: boolean }>,
): Promise<OrderResult> {
  // Guard clauses — fail fast, one concern per check, max 1 indent level
  if (order.items.length === 0) {
    return { ok: false, error: "empty_order" };
  }
  if (!order.customer) {
    return { ok: false, error: "no_customer" };
  }
  if (!order.customer.verified) {
    return { ok: false, error: "not_verified" };
  }

  // Parallelize independent I/O — sequential awaits on independent work is wasted time
  const [result, _inventory, _pricing] = await Promise.all([
    process(order),
    deps.fetchInventory(order.warehouseId),
    deps.fetchPricing(order.region),
  ]);

  // Ship only on success — single level of nesting
  if (result.ok && order.needsShipping) {
    await deps.ship(order);
  }

  return result.ok ? { ok: true, data: result } : { ok: false, error: "not_verified" }; // preserve downstream failure
}

// --- Types ---

interface Order {
  items: unknown[];
  customer: { verified: boolean } | null;
  needsShipping: boolean;
  warehouseId: string;
  region: string;
}

/**
 * Dependency injection — every I/O operation is injected, never hard-imported.
 * This makes every function testable with simple stubs.
 */
interface OrderDeps {
  processUrgent: (order: Order) => Promise<{ ok: boolean }>;
  processNormal: (order: Order) => Promise<{ ok: boolean }>;
  fetchInventory: (warehouseId: string) => Promise<unknown>;
  fetchPricing: (region: string) => Promise<unknown>;
  ship: (order: Order) => Promise<void>;
}
