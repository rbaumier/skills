# With Skill - Run 1

## Output

Now I have the skill rules internalized and the prompt. Let me analyze all issues against the skill rules and produce the fixed code.

**Issues identified against the SKILL.md rules:**

1. **Leaking implementation details (Hyrum's Law):** `internalDbRowId`, `_sequelizeTimestamp` exposed in `Order`. Stack traces in error response.
2. **One-Version Rule violated:** `OrderV2` forks `Order` instead of extending. `priority: string` changed to `priority: number` (breaking type change).
3. **Contract-first violated:** No separation of input vs output types. No typed input/output schemas.
4. **Inconsistent error semantics:** Different error shapes (`{ message, stack }`, `{ msg }`, `{ success }`, `{ shipped }`). Mixed status codes.
5. **Verb in REST URL:** `/api/createOrder` instead of `POST /api/orders`.
6. **No pagination on list endpoint:** `GET /api/v1/orders` returns bare array. V2 pagination is incomplete (missing `totalItems`, `totalPages`, `hasMore`).
7. **`PUT` where `PATCH` is needed:** Full replacement semantics where partial update is wanted.
8. **`GET` for cancel:** Side-effecting operation using GET.
9. **Boolean param controls branching:** `?internal=true` on ship endpoint leaks internals conditionally.
10. **No boundary validation:** `processThirdPartyWebhook` trusts external payload without validation.
11. **Validate between internal functions:** `calculateTotal` calls `validateOrder` — validation between internal functions.
12. **IDs not branded:** `UserId` and `OrderId` are plain strings, not branded types.
13. **Nullable fields dependent on status:** `trackingNumber`, `cancelledReason`, `shippedAt` in V2 are nullable fields that "only exist when status is X" — should use discriminated unions.

Here is the fixed code:

```typescript
import express from "express";

const app = express();
app.use(express.json());

// --- Branded types for IDs (Interface Stability Rule #4) ---

type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

// --- Consistent error shape (Error Semantics) ---

interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function apiError(res: express.Response, status: number, code: string, message: string, details?: unknown) {
  const body: APIError = { error: { code, message, ...(details !== undefined && { details }) } };
  res.status(status).json(body);
}

// --- Money type (avoid raw number for currency) ---

interface Money {
  amount: number;
  currency: string;
}

// --- Discriminated union for order status (Interface Stability Rule #3) ---

type OrderState =
  | { status: "pending" }
  | { status: "shipped"; shippedAt: Date; trackingNumber: string }
  | { status: "cancelled"; cancelledReason: string };

// --- Contract-first: separate input from output ---

interface Address {
  street: string;
  city: string;
  zip: string;
}

interface OrderItem {
  sku: string;
  qty: number;
}

interface CreateOrderInput {
  userId: UserId;
  items: OrderItem[];
  shippingAddress: Address;
  priority?: string;
}

interface UpdateOrderInput {
  items?: OrderItem[];
  shippingAddress?: Address;
  priority?: string;
}

interface ShipOrderInput {
  trackingNumber: string;
}

interface CancelOrderInput {
  reason: string;
}

// --- Order output type: no internal/implementation details exposed ---

interface Order {
  id: OrderId;
  userId: UserId;
  items: OrderItem[];
  shippingAddress: Address;
  state: OrderState;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  total: Money;
}

// --- Cursor-based pagination (default per skill rules) ---

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// --- Boundary validation (validate where external input enters) ---

function validateCreateOrderInput(body: unknown): CreateOrderInput | APIError {
  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  if (!b.userId || typeof b.userId !== "string") errors.push("userId is required");
  if (!Array.isArray(b.items) || b.items.length === 0) errors.push("items must be a non-empty array");
  if (!b.shippingAddress || typeof b.shippingAddress !== "object") {
    errors.push("shippingAddress is required");
  } else {
    const addr = b.shippingAddress as Record<string, unknown>;
    if (!addr.city || typeof addr.city !== "string") errors.push("shippingAddress.city is required");
    if (!addr.street || typeof addr.street !== "string") errors.push("shippingAddress.street is required");
    if (!addr.zip || typeof addr.zip !== "string") errors.push("shippingAddress.zip is required");
  }

  if (errors.length > 0) {
    return { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: errors } };
  }

  return {
    userId: b.userId as UserId,
    items: b.items as OrderItem[],
    shippingAddress: b.shippingAddress as Address,
    ...(b.priority !== undefined && { priority: String(b.priority) }),
  };
}

function validateThirdPartyWebhook(payload: unknown): { orderId: string; amount: number } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.order_id !== "string" || typeof p.amount !== "number") return null;
  return { orderId: p.order_id, amount: p.amount };
}

function calculateTotal(items: OrderItem[]): Money {
  return {
    amount: items.reduce((sum, i) => sum + i.qty * 10, 0),
    currency: "USD",
  };
}

// --- Routes: all under /v1, consistent resource naming, proper HTTP verbs ---

// Create order: POST /v1/orders (no verbs in URL)
app.post("/api/v1/orders", async (req, res) => {
  const input = validateCreateOrderInput(req.body);
  if ("error" in input) {
    apiError(res, 400, input.error.code, input.error.message, input.error.details);
    return;
  }

  const order: Order = {
    id: Math.random().toString(36).slice(2) as OrderId,
    userId: input.userId,
    items: input.items,
    shippingAddress: input.shippingAddress,
    state: { status: "pending" },
    priority: input.priority ?? "normal",
    createdAt: new Date(),
    updatedAt: new Date(),
    total: calculateTotal(input.items),
  };

  res.status(201).json(order);
});

// List orders: cursor-based pagination (always paginate list endpoints)
app.get("/api/v1/orders", async (req, res) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  // Implementation would seek from cursor with limit
  const orders: Order[] = [];

  const result: PaginatedResult<Order> = {
    data: orders,
    pagination: {
      nextCursor: null,
      hasMore: false,
    },
  };

  res.json(result);
});

// Get single order
app.get("/api/v1/orders/:id", async (req, res) => {
  const order: Order | null = null; // would fetch by req.params.id

  if (!order) {
    apiError(res, 404, "NOT_FOUND", `Order ${req.params.id} not found`);
    return;
  }

  res.json(order);
});

// Partial update: PATCH, not PUT (clients send partial data)
app.patch("/api/v1/orders/:id", async (req, res) => {
  const order: Order | null = null; // would fetch by req.params.id

  if (!order) {
    apiError(res, 404, "NOT_FOUND", `Order ${req.params.id} not found`);
    return;
  }

  const updates = req.body as UpdateOrderInput;
  const updated: Order = {
    ...order,
    ...(updates.items && { items: updates.items }),
    ...(updates.shippingAddress && { shippingAddress: updates.shippingAddress }),
    ...(updates.priority !== undefined && { priority: updates.priority }),
    updatedAt: new Date(),
    total: updates.items ? calculateTotal(updates.items) : order.total,
  };

  res.json(updated);
});

// Cancel order: POST (side-effecting), not GET. Idempotent.
app.post("/api/v1/orders/:id/cancel", async (req, res) => {
  const order: Order | null = null; // would fetch by req.params.id

  if (!order) {
    apiError(res, 404, "NOT_FOUND", `Order ${req.params.id} not found`);
    return;
  }

  if (order.state.status === "cancelled") {
    // Idempotent: already cancelled, succeed silently
    res.status(204).send();
    return;
  }

  if (order.state.status === "shipped") {
    apiError(res, 409, "CONFLICT", "Cannot cancel a shipped order");
    return;
  }

  const body = req.body as CancelOrderInput;

  const cancelled: Order = {
    ...order,
    state: { status: "cancelled", cancelledReason: body.reason ?? "No reason provided" },
    updatedAt: new Date(),
  };

  res.json(cancelled);
});

// Ship order: POST (side-effecting), dedicated endpoint (no boolean branching)
app.post("/api/v1/orders/:id/ship", async (req, res) => {
  const order: Order | null = null; // would fetch by req.params.id

  if (!order) {
    apiError(res, 404, "NOT_FOUND", `Order ${req.params.id} not found`);
    return;
  }

  if (order.state.status !== "pending") {
    apiError(res, 409, "CONFLICT", `Cannot ship order in state "${order.state.status}"`);
    return;
  }

  const body = req.body as ShipOrderInput;

  const shipped: Order = {
    ...order,
    state: { status: "shipped", shippedAt: new Date(), trackingNumber: body.trackingNumber },
    updatedAt: new Date(),
  };

  res.json(shipped);
});

// Third-party webhook: validate at boundary
app.post("/api/v1/webhooks/third-party", async (req, res) => {
  const validated = validateThirdPartyWebhook(req.body);

  if (!validated) {
    apiError(res, 422, "UNPROCESSABLE", "Invalid webhook payload");
    return;
  }

  // Process validated.orderId and validated.amount
  res.status(204).send();
});

app.listen(3000);
```

**Summary of all fixes applied, mapped to SKILL.md rules:**

| # | Rule | Fix |
|---|------|-----|
| 1 | **Hyrum's Law: never leak implementation details** | Removed `internalDbRowId`, `_sequelizeTimestamp` from `Order`. Removed `queryPlan` and `internalDbRowId` from ship response. Removed `err.stack` from error responses. |
| 2 | **One-Version Rule: extend, never fork** | Eliminated `OrderV2`. Used discriminated union `OrderState` so shipped/cancelled fields live on their respective state variant. `priority` stays `string` (no breaking type change). `trackingNumber`/`shippedAt`/`cancelledReason` moved into discriminated union variants. |
| 3 | **Contract-first** | Defined `CreateOrderInput`, `UpdateOrderInput`, `ShipOrderInput`, `CancelOrderInput` as separate input types. `Order` is the output type with server-generated fields (`id`, `createdAt`, etc.). |
| 4 | **Consistent error semantics** | Single `APIError` shape used everywhere via `apiError()` helper. Proper HTTP status codes: 201 for creation, 204 for idempotent success, 400 for validation, 404 for not found, 409 for conflicts, 422 for invalid webhook. |
| 5 | **Red flag: verbs in URL** | `POST /api/createOrder` changed to `POST /api/v1/orders`. |
| 6 | **Always paginate list endpoints** | List endpoint uses cursor-based pagination with `PaginatedResult<T>` containing `nextCursor` and `hasMore`. Removed unpaginated v2 endpoint. |
| 7 | **Red flag: PUT where PATCH is wanted** | Changed `PUT` to `PATCH` for partial update with `UpdateOrderInput` (all fields optional). |
| 8 | **Red flag: GET for side-effecting cancel** | Changed `GET /orders/:id/cancel` to `POST /orders/:id/cancel`. Made it idempotent (succeeds if already cancelled). |
| 9 | **Red flag: boolean param controlling branching** | Removed `?internal=true` flag from ship endpoint. Ship endpoint now has a single consistent response shape. |
| 10 | **Validate at boundaries only** | Added `validateCreateOrderInput` and `validateThirdPartyWebhook` at API boundaries. Removed `validateOrder` call from `calculateTotal` (no validation between internal functions). |
| 11 | **Branded types for IDs** | `UserId` and `OrderId` are branded types (`string & { readonly __brand: "..." }`), preventing accidental interchange. |
| 12 | **Discriminated unions for variants** | `OrderState` is a discriminated union on `status`. No more nullable fields that "only exist when status is X". Each variant carries exactly its fields. |
| 13 | **Minimize observable surface** | `total` is now `Money` (structured type with `amount` + `currency`) instead of raw `number`. Response for creation returns 201 not 200. |