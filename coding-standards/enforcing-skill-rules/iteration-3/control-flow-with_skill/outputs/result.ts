/**
 * Validates order preconditions and returns an error result if any fail.
 * Guard clauses flatten the control flow — happy path reads linearly.
 */
function validateOrder(order: Order): { error: string } | null {
  if (order.items.length === 0) return { error: "empty order" };
  if (!order.customer) return { error: "no customer" };
  if (!order.customer.verified) return { error: "not verified" };
  return null;
}

/**
 * Processes a validated order: runs urgency-appropriate processing,
 * ships if needed, and returns the result with derived status.
 *
 * Split from `handleOrder` to honor SRP:
 * - `handleOrder` orchestrates validation + processing
 * - `processOrder` owns the processing + shipping logic
 *
 * `isUrgent` kept as a discriminant here (not a boolean flag controlling
 * divergent behavior) — the only difference is which processor runs.
 * A strategy map replaces the if/else branch.
 */
async function processOrder(order: ValidatedOrder, isUrgent: boolean): Promise<OrderResult> {
  const process = isUrgent ? processUrgent : processNormal;
  const result = await process(order);

  if (result.ok && order.needsShipping) {
    await ship(order);
  }

  return result;
}

/**
 * Orchestrates order handling: validates, processes, and returns
 * the result with a derived status.
 *
 * Design decisions:
 * - Guard-clause validation keeps nesting at 1 level
 * - Independent fetches (inventory, pricing) run in parallel
 * - Returns a new object instead of mutating `order`
 */
async function handleOrder(
  order: Order,
  isUrgent: boolean,
): Promise<OrderResult & { status: "completed" | "failed" }> {
  const validationError = validateOrder(order);
  if (validationError) {
    return { ...validationError, status: "failed" };
  }

  /* Parallelize independent I/O — no sequential waste */
  const [result, _inventory, _pricing] = await Promise.all([
    processOrder(order as ValidatedOrder, isUrgent),
    fetchInventory(order.warehouseId),
    fetchPricing(order.region),
  ]);

  const status = result.ok ? "completed" : "failed";

  return { ...result, status };
}
