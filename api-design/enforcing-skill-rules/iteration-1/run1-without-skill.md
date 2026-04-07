# Without Skill - Run 1

## Output



Here is the fixed code:

```typescript
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

// --- Branded types for IDs ---
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

// --- Consistent error shape ---
interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function errorResponse(
  res: express.Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  const body: APIError = { error: { code, message, ...(details && { details }) } };
  res.status(status).json(body);
}

// --- Single Order type (no v1/v2 split — extend, don't fork) ---
interface OrderItem {
  sku: string;
  qty: number;
}

interface Address {
  street: string;
  city: string;
  zip: string;
}

type OrderStatus = "pending" | "shipped" | "cancelled";

interface Order {
  id: OrderId;
  userId: UserId;
  items: OrderItem[];
  shippingAddress: Address;
  status: OrderStatus;
  priority: string;
  createdAt: string;   // ISO 8601 — Date objects don't serialize predictably
  updatedAt: string;
  total: number;
  // Additive optional fields (v2 additions — no separate type needed)
  trackingNumber?: string | null;
  cancelledReason?: string | null;
  shippedAt?: string | null;
}

// --- Input types (separate from output — no internal fields) ---
interface CreateOrderInput {
  userId: string;
  items: OrderItem[];
  shippingAddress: Address;
  priority?: string;
}

interface UpdateOrderInput {
  items?: OrderItem[];
  shippingAddress?: Address;
  priority?: string;
}

// --- Validation at the boundary only ---
function validateCreateOrderInput(body: unknown): CreateOrderInput {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object") throw new Error("Request body required");
  if (!b.userId || typeof b.userId !== "string") throw new Error("userId is required");

  const items = b.items as OrderItem[] | undefined;
  if (!Array.isArray(items) || items.length === 0) throw new Error("At least one item is required");

  const addr = b.shippingAddress as Address | undefined;
  if (!addr || typeof addr !== "object") throw new Error("shippingAddress is required");
  if (!addr.city) throw new Error("shippingAddress.city is required");
  if (!addr.street) throw new Error("shippingAddress.street is required");
  if (!addr.zip) throw new Error("shippingAddress.zip is required");

  return {
    userId: b.userId as string,
    items,
    shippingAddress: addr,
    priority: typeof b.priority === "string" ? b.priority : undefined,
  };
}

function calculateTotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.qty * 10, 0);
}

// --- Validate third-party webhook input (never trust external data) ---
interface WebhookPayload {
  orderId: string;
  amount: number;
}

function processThirdPartyWebhook(payload: unknown): WebhookPayload {
  const p = payload as Record<string, unknown>;
  if (!p || typeof p !== "object") throw new Error("Invalid webhook payload");

  const orderId = p.order_id;
  const amount = p.amount;
  if (typeof orderId !== "string") throw new Error("order_id must be a string");
  if (typeof amount !== "number" || isNaN(amount)) throw new Error("amount must be a number");

  return { orderId, amount };
}

// --- Routes: RESTful nouns, consistent versioning, consistent errors ---

// POST /api/v1/orders  (not /api/createOrder — no verbs in REST URLs)
app.post("/api/v1/orders", async (req, res) => {
  try {
    const input = validateCreateOrderInput(req.body);
    const now = new Date().toISOString();
    const order: Order = {
      id: crypto.randomUUID() as OrderId,
      userId: input.userId as UserId,
      items: input.items,
      shippingAddress: input.shippingAddress,
      status: "pending",
      priority: input.priority ?? "normal",
      createdAt: now,
      updatedAt: now,
      total: calculateTotal(input.items),
      // No internalDbRowId, no _sequelizeTimestamp — never leak internals
    };
    res.status(201).json(order); // 201 Created, not 200
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    // Never expose stack traces to clients
    errorResponse(res, 400, "VALIDATION_ERROR", message);
  }
});

// GET /api/v1/orders — always paginated
app.get("/api/v1/orders", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

  const orders: Order[] = []; // placeholder for DB query
  const totalItems = 0;       // placeholder for DB count

  res.json({
    data: orders,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  });
});

// GET /api/v1/orders/:id
app.get("/api/v1/orders/:id", async (req, res) => {
  const order = null; // placeholder for DB lookup
  if (!order) {
    // Consistent error shape — not { msg: "not found" }
    errorResponse(res, 404, "NOT_FOUND", `Order ${req.params.id} not found`);
    return;
  }
  res.json(order);
});

// PATCH /api/v1/orders/:id  (PATCH for partial update, not PUT which implies full replace)
app.patch("/api/v1/orders/:id", async (req, res) => {
  const order = null; // placeholder for DB lookup
  if (!order) {
    errorResponse(res, 404, "NOT_FOUND", `Order ${req.params.id} not found`);
    return;
  }
  // Would merge req.body fields into existing order, revalidate, save
  res.json(order);
});

// POST /api/v1/orders/:id/cancel  (POST for state mutation, not GET — GET must be safe/idempotent)
app.post("/api/v1/orders/:id/cancel", async (req, res) => {
  const order = null; // placeholder for DB lookup
  if (!order) {
    errorResponse(res, 404, "NOT_FOUND", `Order ${req.params.id} not found`);
    return;
  }
  // Idempotent — succeeds even if already cancelled
  res.status(204).send();
});

// POST /api/v1/orders/:id/ship  (no boolean query param branching — removed internal data leak)
app.post("/api/v1/orders/:id/ship", async (req, res) => {
  const order = null; // placeholder for DB lookup
  if (!order) {
    errorResponse(res, 404, "NOT_FOUND", `Order ${req.params.id} not found`);
    return;
  }
  // Never expose internalDbRowId or queryPlan — Hyrum's Law
  res.json({ status: "shipped" });
});

app.listen(3000);
```

**Issues fixed:**

1. **Verb in URL**: `POST /api/createOrder` changed to `POST /api/v1/orders` — REST uses nouns.
2. **Leaking internals**: Removed `internalDbRowId` and `_sequelizeTimestamp` from `Order` — never expose implementation details (Hyrum's Law).
3. **Stack trace exposure**: Error handler was returning `err.stack` to clients. Now uses a consistent `APIError` shape with machine-readable codes, no internals.
4. **Inconsistent error shapes**: `{ msg: "not found" }` vs `{ message, stack }` vs `{ success: true }` — unified to a single `APIError` format everywhere.
5. **Two Order types (One-Version Rule violation)**: Merged `Order` and `OrderV2` into one type with additive optional fields instead of forking. `priority` kept as `string` (changing to `number` in v2 was a breaking type change).
6. **GET for cancel (unsafe)**: `GET /api/v1/orders/:id/cancel` changed to `POST` — GET must be safe and idempotent, cancellation is a state mutation.
7. **PUT for partial update**: Changed to `PATCH` — `PUT` implies full replacement, `PATCH` is for partial updates.
8. **Boolean query param branching**: Removed `?internal=true` from ship endpoint that leaked `internalDbRowId` and `queryPlan`. Split behavior into clean response only.
9. **Missing pagination on list endpoint**: Added `pagination` object with `page`, `pageSize`, `totalItems`, `totalPages`.
10. **No input validation at boundary**: Added `validateCreateOrderInput` with proper type checking. Moved validation to the API boundary instead of deep in business logic.
11. **Unvalidated third-party webhook**: `processThirdPartyWebhook` now validates the `unknown` payload instead of blindly trusting `any`.
12. **`200` for creation**: Changed to `201 Created` for `POST /orders`.
13. **`Math.random()` for IDs**: Replaced with `crypto.randomUUID()` — predictable IDs are a security risk.
14. **`Date` in response type**: Changed to ISO 8601 strings — `Date` objects serialize inconsistently across frameworks.
15. **Missing `express.json()` middleware**: Added so `req.body` actually parses.