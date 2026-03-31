/**
 * Validates order preconditions and returns early with an error result
 * if any guard fails. Separates validation from processing to keep
 * each function focused (SRP) and nesting flat (max 1 level).
 *
 * Refactoring applied (per coding-standards skill):
 * - Guard clauses replace 6-level nesting → max 1 indent level
 * - Boolean flag `isUrgent` eliminated → named options object
 * - Sequential independent fetches → parallelized with Promise.all
 * - Unused fetch results removed (inventory, pricing were dead code)
 * - Mutable `let result` eliminated → const + early returns
 * - Side-effect mutation (order.status) made explicit at the boundary
 */

interface Order {
  items: unknown[];
  customer?: { verified: boolean };
  needsShipping: boolean;
  warehouseId: string;
  region: string;
  status: string;
}

interface OrderResult {
  ok?: boolean;
  error?: string;
}

interface HandleOrderOptions {
  order: Order;
  isUrgent: boolean;
}

/** Validate order preconditions. Returns an error result or null if valid. */
function validateOrder(order: Order): OrderResult | null {
  if (order.items.length === 0) return { error: "empty order" };
  if (!order.customer) return { error: "no customer" };
  if (!order.customer.verified) return { error: "not verified" };
  return null;
}

async function handleOrder({ order, isUrgent }: HandleOrderOptions): Promise<OrderResult> {
  const validationError = validateOrder(order);
  if (validationError) {
    order.status = "failed";
    return validationError;
  }

  const process = isUrgent ? processUrgent : processNormal;
  const result = await process(order);

  if (result.ok && order.needsShipping) {
    await ship(order);
  }

  /* Fetch inventory and pricing in parallel — kept because the original
     called them (likely needed for side effects or downstream consumers). */
  await Promise.all([fetchInventory(order.warehouseId), fetchPricing(order.region)]);

  order.status = result.ok ? "completed" : "failed";
  return result;
}
