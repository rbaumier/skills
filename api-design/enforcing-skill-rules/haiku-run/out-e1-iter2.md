```typescript
import express from "express";

// Branded types to distinguish IDs
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

// Input/output separation: what the client sends
interface CreateOrderInput {
  userId: UserId;
  items: { sku: string; qty: number }[];
  shippingAddress: { street: string; city: string; zip: string };
  priority: number;
}

// Output: discriminated union for different states
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

// Consistent error shape
interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
  };
}

const app = express();

function validateCreateOrderInput(input: unknown): CreateOrderInput {
  if (!input || typeof input !== "object") throw new Error("Invalid input");
  const obj = input as any;
  
  if (!obj.userId || typeof obj.userId !== "string")
    throw new Error("userId is required");
  if (!Array.isArray(obj.items) || obj.items.length === 0)
    throw new Error("Items required");
  if (!obj.shippingAddress || !obj.shippingAddress.city)
    throw new Error("City required");
  if (typeof obj.priority !== "number")
    throw new Error("priority must be a number");

  return {
    userId: obj.userId as UserId,
    items: obj.items,
    shippingAddress: obj.shippingAddress,
    priority: obj.priority,
  };
}

function calculateTotal(items: { sku: string; qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.qty * 10, 0);
}

async function createOrder(input: CreateOrderInput): Promise<Order> {
  const order: Order = {
    id: Math.random().toString(36).slice(2) as OrderId,
    userId: input.userId,
    items: input.items,
    shippingAddress: input.shippingAddress,
    status: "pending",
    priority: input.priority,
    createdAt: new Date(),
    updatedAt: new Date(),
    total: calculateTotal(input.items),
  };
  return order;
}

app.post("/api/v1/orders", async (req, res) => {
  try {
    const input = validateCreateOrderInput(req.body);
    const order = await createOrder(input);
    res.status(201).json(order);
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
      },
    } as APIError);
  }
});

app.get("/api/v1/orders", async (req, res) => {
  const cursor = (req.query.cursor as string) || undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const orders: Order[] = [];
  const result: PaginatedResult<Order> = {
    data: orders,
    pagination: {
      cursor: undefined,
      hasMore: false,
    },
  };
  res.json(result);
});

app.get("/api/v1/orders/:id", async (req, res) => {
  const order: Order | null = null;
  if (!order) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Order not found",
      },
    } as APIError);
    return;
  }
  res.json(order);
});

app.patch("/api/v1/orders/:id", async (req, res) => {
  try {
    const input = validateCreateOrderInput(req.body);
    const order = await createOrder(input);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
      },
    } as APIError);
  }
});

app.post("/api/v1/orders/:id/cancel", async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    } as APIError);
  }
});

app.post("/api/v1/orders/:id/ship", async (req, res) => {
  try {
    res.json({ shipped: true });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    } as APIError);
  }
});

interface WebhookPayload {
  order_id?: string;
  amount?: number;
}

function validateWebhookPayload(payload: unknown): WebhookPayload {
  if (!payload || typeof payload !== "object") throw new Error("Invalid payload");
  const obj = payload as any;
  if (typeof obj.order_id !== "string") throw new Error("order_id required");
  if (typeof obj.amount !== "number") throw new Error("amount required");
  return { order_id: obj.order_id, amount: obj.amount };
}

function processThirdPartyWebhook(payload: unknown) {
  const validated = validateWebhookPayload(payload);
  return {
    orderId: validated.order_id,
    amount: validated.amount,
  };
}

app.listen(3000);
```
