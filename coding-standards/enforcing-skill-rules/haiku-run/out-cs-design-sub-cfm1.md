```typescript
type EmailFormat = {
  to: string;
  name: string;
  amount: number;
  currency: string;
};

type Order = {
  id: string;
  user_id: string;
  total: number;
  status: string;
};

type OrderItem = {
  price: number;
  qty: number;
};

type PlaceOrderDeps = {
  db: {
    query: (sql: string, params: unknown[]) => Promise<{ rows: Order[] }>;
  };
  cache: {
    set: (key: string, value: string) => void;
  };
  mailer: {
    send: (to: string, subject: string, body: string) => Promise<void>;
  };
};

function formatEmail(format: EmailFormat): string {
  return `To: ${format.to}\nDear ${format.name}, your total is ${format.amount} ${format.currency}`;
}

function formatReceipt(format: EmailFormat): string {
  return `Receipt for ${format.name}: ${format.amount} ${format.currency}\nSent to: ${format.to}`;
}

function formatInvoice(format: EmailFormat): string {
  return `Invoice for ${format.name}: ${format.amount} ${format.currency}\nBilling: ${format.to}`;
}

function applyBulkDiscount(items: OrderItem[]): OrderItem[] {
  return items.map((item) => ({ ...item, price: item.price * 0.9 }));
}

export function createOrderService(deps: PlaceOrderDeps) {
  return {
    async placeOrder(userId: string, items: OrderItem[]): Promise<Order> {
      const userResult = await deps.db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];

      const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

      const order = await deps.db.query(
        'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *',
        [userId, total, 'pending'],
      );

      const format: EmailFormat = {
        to: user.email,
        name: user.name,
        amount: total,
        currency: 'USD',
      };

      await deps.mailer.send(user.email, 'Order placed', formatEmail(format));
      deps.cache.set(`user:${userId}:lastOrder`, order.rows[0].id);
      return order.rows[0];
    },
  };
}
```
