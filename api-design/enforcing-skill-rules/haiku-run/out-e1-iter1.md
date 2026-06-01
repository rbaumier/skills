```typescript
import express from "express";

const app = express();

type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

// Input contract — what clients send
interface CreateOrderInput {
  userId: UserId;
  items: { sku: string; qty: number }[];
  shippingAddress: { street: string; city: string; zip: string };
  priority?: number;
}

interface UpdateOrderInput {
  priority?: number;
  shippingAddress?: { street: string; city: string; zip: string };
}

// Output contract — what server returns
interface Order {
  id: OrderId;
  userId: UserId;
  items: { sku: string; qty: number }[];
  shippingAddress: { street: string; city: string; zip: string };
  status: "pending" | "shipped" | "cancelled";
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  total: number;
}

// Consistent error shape
interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function validateCreateOrderInput(body: unknown): CreateOrderInput {
  const order = body as any;
  if (!order.userId || typeof order.userId !== "string") {
    throw { code: "VALIDATION_ERROR", message: "userId is required" };
  }
  if (!Array.isArray(order.items) || !order.items.length) {
    throw { code: "VALIDATION_ERROR", message: "items must be non-empty array" };
  }
  if (!order.shippingAddress || !order.shippingAddress.city) {
    throw { code: "VALIDATION_ERROR", message: "shippingAddress.city is required" };
  }
  return {
    userId: order.userId as UserId,
    items: order.items,
    shippingAddress: order.shippingAddress,
    priority: order.priority ?? 0,
  };
}

function calculateTotal(order: CreateOrderInput): number {
  return order.items.reduce((sum, i) => sum + i.qty * 10, 0);
}

function toOrderDTO(data: {
  id: OrderId;
  userId: UserId;
  items: { sku: string; qty: number }[];
  shippingAddress: { street: string; city: string; zip: string };
  status: "pending" | "shipped" | "cancelled";
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  total: number;
}): Order {
  return data;
}

// POST /api/v1/orders — create order
app.post("/api/v1/orders", async (req, res) => {
  try {
    const input = validateCreateOrderInput(req.body);
    const order: Order = {
      id: Math.random().toString(36).slice(2) as OrderId,
      userId: input.userId,
      items: input.items,
      shippingAddress: input.shippingAddress,
      status: "pending",
      priority: input.priority,
      createdAt: new Date(),
      updatedAt: new Date(),
      total: calculateTotal(input),
    };
    res.status(201).json(toOrderDTO(order));
  } catch (err: any) {
    const code = err.code || "INTERNAL_ERROR";
    const message = err.message || "An error occurred";
    res.status(err.code === "VALIDATION_ERROR" ? 422 : 500).json({
      error: { code, message },
    });
  }
});

// GET /api/v1/orders — list orders with pagination
app.get("/api/v1/orders", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const orders: Order[] = [];
    res.json({
      data: orders,
      pagination: {
        nextCursor: cursor ? "next_cursor_value" : null,
        hasMore: false,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to list orders" },
    });
  }
});

// GET /api/v1/orders/:id — get single order
app.get("/api/v1/orders/:id", async (req, res) => {
  try {
    const order: Order | null = null;
    if (!order) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
      return;
    }
    res.json(toOrderDTO(order));
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch order" },
    });
  }
});

// PATCH /api/v1/orders/:id — update order
app.patch("/api/v1/orders/:id", async (req, res) => {
  try {
    const input = req.body as Partial<UpdateOrderInput>;
    const order: Order | null = null;
    if (!order) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
      return;
    }
    res.json(toOrderDTO(order));
  } catch (err: any) {
    const code = err.code || "INTERNAL_ERROR";
    res.status(code === "VALIDATION_ERROR" ? 422 : 500).json({
      error: { code, message: err.message },
    });
  }
});

// POST /api/v1/orders/:id/cancel — cancel order (idempotent)
app.post("/api/v1/orders/:id/cancel", async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to cancel order" },
    });
  }
});

// POST /api/v1/orders/:id/ship — ship order
app.post("/api/v1/orders/:id/ship", async (req, res) => {
  try {
    res.json({ shipped: true });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to ship order" },
    });
  }
});

function processThirdPartyWebhook(payload: unknown): {
  orderId: string;
  amount: number;
} {
  const data = payload as any;
  if (!data.order_id || typeof data.order_id !== "string") {
    throw { code: "VALIDATION_ERROR", message: "order_id is required" };
  }
  if (typeof data.amount !== "number") {
    throw { code: "VALIDATION_ERROR", message: "amount must be a number" };
  }
  return { orderId: data.order_id, amount: data.amount };
}

app.listen(3000);
```
