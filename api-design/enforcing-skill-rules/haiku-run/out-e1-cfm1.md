```typescript
import express from "express";

const app = express();

// Branded types to prevent passing UserId where OrderId expected
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

// Helper functions to create branded types safely
function brandUserId(id: string): UserId {
  return id as UserId;
}

function brandOrderId(id: string): OrderId {
  return id as OrderId;
}

// Discriminated union: each status variant carries exactly its own fields
type Order =
  | {
      id: OrderId;
      userId: UserId;
      items: { sku: string; qty: number }[];
      shippingAddress: { street: string; city: string; zip: string };
      status: "pending";
      priority: number;
      createdAt: Date;
      updatedAt: Date;
      total: number;
    }
  | {
      id: OrderId;
      userId: UserId;
      items: { sku: string; qty: number }[];
      shippingAddress: { street: string; city: string; zip: string };
      status: "shipped";
      priority: number;
      createdAt: Date;
      updatedAt: Date;
      total: number;
      trackingNumber: string;
      shippedAt: Date;
    }
  | {
      id: OrderId;
      userId: UserId;
      items: { sku: string; qty: number }[];
      shippingAddress: { street: string; city: string; zip: string };
      status: "cancelled";
      priority: number;
      createdAt: Date;
      updatedAt: Date;
      total: number;
      cancelledReason: string;
    };

// Input type: no server-generated fields
interface CreateOrderInput {
  userId: UserId;
  items: { sku: string; qty: number }[];
  shippingAddress: { street: string; city: string; zip: string };
  priority: number;
}

// Partial update input
interface UpdateOrderInput {
  items?: { sku: string; qty: number }[];
  shippingAddress?: { street: string; city: string; zip: string };
  priority?: number;
}

// Consistent error response shape
interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function validateCreateOrderInput(input: unknown): CreateOrderInput {
  if (typeof input !== "object" || !input) {
    throw { code: "BAD_REQUEST", message: "Request body must be an object" };
  }
  const body = input as Record<string, unknown>;

  if (!body.userId || typeof body.userId !== "string") {
    throw { code: "VALIDATION_ERROR", message: "userId is required and must be a string" };
  }
  if (!Array.isArray(body.items) || !body.items.length) {
    throw { code: "VALIDATION_ERROR", message: "items is required and must be non-empty" };
  }
  if (!body.shippingAddress || typeof body.shippingAddress !== "object") {
    throw { code: "VALIDATION_ERROR", message: "shippingAddress is required and must be an object" };
  }
  const addr = body.shippingAddress as Record<string, unknown>;
  if (!addr.city || typeof addr.city !== "string") {
    throw { code: "VALIDATION_ERROR", message: "shippingAddress.city is required" };
  }
  if (typeof body.priority !== "number") {
    throw { code: "VALIDATION_ERROR", message: "priority is required and must be a number" };
  }

  return {
    userId: brandUserId(body.userId),
    items: body.items as { sku: string; qty: number }[],
    shippingAddress: addr as { street: string; city: string; zip: string },
    priority: body.priority,
  };
}

function calculateTotal(items: { sku: string; qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.qty * 10, 0);
}

// Error handler: always returns consistent APIError shape
function sendError(res: any, statusCode: number, code: string, message: string, details?: unknown) {
  res.status(statusCode).json({
    error: { code, message, details },
  });
}

// POST /api/orders — create order (REST verb in method, not URL)
app.post("/api/orders", async (req, res) => {
  try {
    const input = validateCreateOrderInput(req.body);
    const order: Order = {
      id: brandOrderId(Math.random().toString(36).slice(2)),
      userId: input.userId,
      items: input.items,
      shippingAddress: input.shippingAddress,
      status: "pending",
      priority: input.priority,
      createdAt: new Date(),
      updatedAt: new Date(),
      total: calculateTotal(input.items),
    };
    // 201 Created, not 200 OK
    res.status(201).json(order);
  } catch (err: any) {
    const code = err.code || "INTERNAL_ERROR";
    const message = err.message || "Internal server error";
    // Never expose stack traces or internal details
    sendError(res, err.code === "BAD_REQUEST" ? 400 : 422, code, message);
  }
});

// GET /api/orders — list with cursor-based pagination
app.get("/api/orders", async (req, res) => {
  try {
    const cursor = (req.query.cursor as string) || null;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    // In real implementation, fetch from DB using cursor
    const orders: Order[] = [];
    const nextCursor = null; // Computed from DB query

    res.json({
      data: orders,
      pagination: {
        nextCursor,
        hasMore: false,
      },
    });
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", "Failed to list orders");
  }
});

// GET /api/orders/:id — get single order
app.get("/api/orders/:id", async (req, res) => {
  try {
    const id = brandOrderId(req.params.id);
    const order: Order | null = null; // Fetch from DB
    if (!order) {
      // Consistent error format with correct status code
      sendError(res, 404, "NOT_FOUND", "Order not found");
      return;
    }
    res.json(order);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch order");
  }
});

// PATCH /api/orders/:id — partial update (not PUT, which implies full replacement)
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const id = brandOrderId(req.params.id);
    const input = req.body as UpdateOrderInput;

    // In real implementation: fetch existing order, validate partial input, merge, save
    const order: Order | null = null; // Fetch from DB
    if (!order) {
      sendError(res, 404, "NOT_FOUND", "Order not found");
      return;
    }

    res.json(order);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", "Failed to update order");
  }
});

// POST /api/orders/:id/cancel — mutation as POST, not GET
app.post("/api/orders/:id/cancel", async (req, res) => {
  try {
    const id = brandOrderId(req.params.id);
    const reason = (req.body?.reason as string) || "User requested cancellation";

    // In real implementation: fetch order, validate state, transition to cancelled
    const cancelledOrder: Order | null = null; // Return cancelled variant
    if (!cancelledOrder) {
      sendError(res, 404, "NOT_FOUND", "Order not found");
      return;
    }

    res.json(cancelledOrder);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", "Failed to cancel order");
  }
});

// POST /api/orders/:id/ship — mutation as POST, no internal details exposed
app.post("/api/orders/:id/ship", async (req, res) => {
  try {
    const id = brandOrderId(req.params.id);
    const trackingNumber = (req.body?.trackingNumber as string) || "";
    if (!trackingNumber) {
      sendError(res, 422, "VALIDATION_ERROR", "trackingNumber is required");
      return;
    }

    // In real implementation: fetch order, validate state, transition to shipped
    const shippedOrder: Order | null = null; // Return shipped variant
    if (!shippedOrder) {
      sendError(res, 404, "NOT_FOUND", "Order not found");
      return;
    }

    // Never expose internal details like internalDbRowId or queryPlan
    res.json(shippedOrder);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", "Failed to ship order");
  }
});

// Validate third-party webhook payload at boundary
interface WebhookPayload {
  orderId: string;
  amount: number;
}

function validateWebhookPayload(payload: unknown): WebhookPayload {
  if (typeof payload !== "object" || !payload) {
    throw new Error("Webhook payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.order_id !== "string") {
    throw new Error("order_id is required and must be a string");
  }
  if (typeof p.amount !== "number") {
    throw new Error("amount is required and must be a number");
  }
  return {
    orderId: p.order_id,
    amount: p.amount,
  };
}

function processThirdPartyWebhook(payload: unknown) {
  const validated = validateWebhookPayload(payload);
  return { orderId: brandOrderId(validated.orderId), amount: validated.amount };
}

app.listen(3000);
```
