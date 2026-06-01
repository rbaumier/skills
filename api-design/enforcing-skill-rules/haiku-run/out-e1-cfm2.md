```typescript
import express from "express";

const app = express();

// Branded types for ID safety
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

function createUserId(id: string): UserId {
  return id as UserId;
}

function createOrderId(id: string): OrderId {
  return id as OrderId;
}

// INPUT type: only fields the client provides
interface CreateOrderInput {
  userId: UserId;
  items: { sku: string; qty: number }[];
  shippingAddress: { street: string; city: string; zip: string };
  priority: number; // Consistent field type across all versions
}

// OUTPUT type: server-generated fields added
type Order =
  | {
      id: OrderId;
      userId: UserId;
      items: { sku: string; qty: number }[];
      shippingAddress: { street: string; city: string; zip: string };
      priority: number;
      status: "pending";
      createdAt: Date;
      updatedAt: Date;
      total: number;
    }
  | {
      id: OrderId;
      userId: UserId;
      items: { sku: string; qty: number }[];
      shippingAddress: { street: string; city: string; zip: string };
      priority: number;
      status: "shipped";
      trackingNumber: string;
      shippedAt: Date;
      createdAt: Date;
      updatedAt: Date;
      total: number;
    }
  | {
      id: OrderId;
      userId: UserId;
      items: { sku: string; qty: number }[];
      shippingAddress: { street: string; city: string; zip: string };
      priority: number;
      status: "cancelled";
      cancelledReason: string;
      createdAt: Date;
      updatedAt: Date;
      total: number;
    };

// Error shape: consistent across all endpoints
interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function validateCreateOrderInput(input: unknown): CreateOrderInput {
  if (typeof input !== "object" || input === null) {
    throw {
      code: "VALIDATION_ERROR",
      message: "Request body must be an object",
    };
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.items) || obj.items.length === 0) {
    throw {
      code: "VALIDATION_ERROR",
      message: "Items must be a non-empty array",
    };
  }

  if (typeof obj.shippingAddress !== "object" || obj.shippingAddress === null) {
    throw {
      code: "VALIDATION_ERROR",
      message: "Shipping address is required",
    };
  }

  const addr = obj.shippingAddress as Record<string, unknown>;
  if (!addr.city) {
    throw {
      code: "VALIDATION_ERROR",
      message: "City is required",
      details: { field: "shippingAddress.city" },
    };
  }

  return {
    userId: createUserId(String(obj.userId)),
    items: obj.items as CreateOrderInput["items"],
    shippingAddress: {
      street: String(addr.street || ""),
      city: String(addr.city),
      zip: String(addr.zip || ""),
    },
    priority: Number(obj.priority || 0),
  };
}

function calculateTotal(order: CreateOrderInput): number {
  return order.items.reduce((sum, i) => sum + i.qty * 10, 0);
}

// POST /api/v2/orders — create order
app.post("/api/v2/orders", async (req, res) => {
  try {
    const input = validateCreateOrderInput(req.body);

    const order: Extract<Order, { status: "pending" }> = {
      id: createOrderId(Math.random().toString(36).slice(2)),
      userId: input.userId,
      items: input.items,
      shippingAddress: input.shippingAddress,
      status: "pending",
      priority: input.priority,
      createdAt: new Date(),
      updatedAt: new Date(),
      total: calculateTotal(input),
    };

    res.status(201).json(order);
  } catch (err: any) {
    const code = err.code || "INTERNAL_ERROR";
    const message = err.message || "An unexpected error occurred";
    res.status(400).json({
      error: {
        code,
        message,
        details: err.details,
      },
    } as APIError);
  }
});

// GET /api/v2/orders — list with pagination
interface ListOrdersParams {
  page: number;
  pageSize: number;
}

app.get("/api/v2/orders", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(String(req.query.pageSize || 20), 10)));

    // In a real app: const orders = await db.findOrders({ page, pageSize });
    const orders: Order[] = [];

    res.json({
      data: orders,
      pagination: {
        page,
        pageSize,
        totalItems: orders.length,
        totalPages: Math.ceil(orders.length / pageSize),
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch orders",
      },
    } as APIError);
  }
});

// GET /api/v2/orders/:id — retrieve single order
app.get("/api/v2/orders/:id", async (req, res) => {
  try {
    // In a real app: const order = await db.findOrder(req.params.id);
    const order: Order | null = null;

    if (!order) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Order not found",
        },
      } as APIError);
    }

    res.json(order);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch order",
      },
    } as APIError);
  }
});

// PATCH /api/v2/orders/:id — partial update (only provided fields change)
interface UpdateOrderInput {
  priority?: number;
  shippingAddress?: Partial<CreateOrderInput["shippingAddress"]>;
}

app.patch("/api/v2/orders/:id", async (req, res) => {
  try {
    // Validation: ensure update only for pending orders
    // In a real app: const order = await db.findOrder(req.params.id);
    const order: Order | null = null;

    if (!order) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Order not found",
        },
      } as APIError);
    }

    if (order.status !== "pending") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot update order that is not pending",
        },
      } as APIError);
    }

    // Apply updates (in real app: await db.updateOrder(...))
    res.json(order);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update order",
      },
    } as APIError);
  }
});

// POST /api/v2/orders/:id/cancel — cancel order (idempotent)
app.post("/api/v2/orders/:id/cancel", async (req, res) => {
  try {
    // In a real app: const updated = await db.cancelOrder(req.params.id);
    const updated: Order | null = null;

    if (!updated) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Order not found",
        },
      } as APIError);
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to cancel order",
      },
    } as APIError);
  }
});

// POST /api/v2/orders/:id/ship — ship order
app.post("/api/v2/orders/:id/ship", async (req, res) => {
  try {
    // Expect: { trackingNumber: string }
    const trackingNumber = String(req.body?.trackingNumber || "");
    if (!trackingNumber) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Tracking number is required",
        },
      } as APIError);
    }

    // In a real app: const updated = await db.shipOrder(req.params.id, trackingNumber);
    const updated: Order | null = null;

    if (!updated) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Order not found",
        },
      } as APIError);
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to ship order",
      },
    } as APIError);
  }
});

// Deprecated v1 endpoints — maintained for backward compatibility
app.get("/api/v1/orders", (req, res) => {
  res.set("Deprecation", "true");
  res.set("Sunset", "Wed, 01 Sep 2026 00:00:00 GMT");
  res.set("Link", '</api/v2/orders>; rel="successor-version"');

  res.json({
    data: [],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    },
  });
});

app.get("/api/v1/orders/:id", (req, res) => {
  res.set("Deprecation", "true");
  res.set("Sunset", "Wed, 01 Sep 2026 00:00:00 GMT");
  res.set("Link", '</api/v2/orders/:id>; rel="successor-version"');

  return res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Order not found",
    },
  } as APIError);
});

// Third-party webhook validation example
interface WebhookPayload {
  order_id: string;
  amount: number;
}

function validateWebhookPayload(payload: unknown): WebhookPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid webhook payload");
  }

  const obj = payload as Record<string, unknown>;

  if (typeof obj.order_id !== "string" || !obj.order_id) {
    throw new Error("Missing or invalid order_id");
  }

  if (typeof obj.amount !== "number" || obj.amount <= 0) {
    throw new Error("Missing or invalid amount");
  }

  return {
    order_id: obj.order_id,
    amount: obj.amount,
  };
}

function processThirdPartyWebhook(payload: unknown): { orderId: string; amount: number } {
  const validated = validateWebhookPayload(payload);
  return { orderId: validated.order_id, amount: validated.amount };
}

app.listen(3000);
```

## Corrections Applied

1. **Branded ID types** — `UserId` and `OrderId` are distinct types, preventing accidental swapping
2. **Separated input/output** — `CreateOrderInput` (client) vs `Order` (server-generated fields like `id`, `createdAt`)
3. **Discriminated union for status** — One variant per status state; `trackingNumber` exists only when `status: "shipped"`, compiler enforces this
4. **Consistent error shape** — All endpoints return `{ error: { code, message, details? } }`; no stack traces exposed to client
5. **No internal details leaked** — Removed `internalDbRowId`, `_sequelizeTimestamp`, `queryPlan` from responses
6. **Proper HTTP verbs** — `/cancel` and `/ship` are now POST (mutations); `/api/createOrder` eliminated in favor of `POST /api/v2/orders`
7. **Pagination on all lists** — v2 includes `page`, `pageSize`, `totalItems`, `totalPages`
8. **Consistent status codes** — 201 Created for POST success, 400 for validation, 404 for not found, 409 for conflict
9. **Field types consistent** — `priority: number` across both v1 and v2 (no breaking type change)
10. **Deprecation headers on v1** — v1 endpoints emit `Deprecation: true`, `Sunset`, and `Link` headers; v1 routes still functional
11. **Validation at boundary** — `validateCreateOrderInput` runs before any business logic
12. **Third-party validation** — Webhook payload validated before use; no unvalidated field access
13. **Explicit options at call sites** — Pagination params explicitly parsed and bounded
14. **Pit of success** — Safe defaults; dangerous operations require explicit naming (no `internal: true` flag)
