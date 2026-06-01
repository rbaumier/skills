```typescript
import { db } from './db';
import { cache } from './cache';
import { mailer } from './mailer';

type EmailContent = {
  to: string;
  name: string;
  amount: number;
  currency: string;
};

const BULK_DISCOUNT_RATE = 0.9;

function formatEmailContent(type: 'email' | 'receipt' | 'invoice', content: EmailContent): string {
  const { to, name, amount, currency } = content;
  
  switch (type) {
    case 'email':
      return `To: ${to}\nDear ${name}, your total is ${amount} ${currency}`;
    case 'receipt':
      return `Receipt for ${name}: ${amount} ${currency}\nSent to: ${to}`;
    case 'invoice':
      return `Invoice for ${name}: ${amount} ${currency}\nBilling: ${to}`;
  }
}

function getShippingLabel(order: { customer: { address: { street: string; city: string; zip: string } } }): string {
  const { street, city, zip } = order.customer.address;
  return `${street}, ${city}, ${zip}`;
}

type Order = {
  id: string;
  user_id: string;
  total: number;
  status: string;
};

export async function placeOrder(userId: string, items: Array<{ price: number; qty: number }>) {
  if (!userId || userId.trim() === '') {
    throw new Error('Invalid userId');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Items cannot be empty');
  }

  const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];

  if (!user) {
    throw new Error('User not found');
  }

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const orderResult = await db.query(
    'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *',
    [userId, total, 'pending'],
  );

  const order: Order = orderResult.rows[0];

  await mailer.send(
    user.email,
    'Order placed',
    formatEmailContent('email', { to: user.email, name: user.name, amount: total, currency: 'USD' }),
  );

  cache.set(`user:${userId}:lastOrder`, order.id);
  return order;
}

export function applyBulkDiscount(items: Array<{ price: number; qty: number }>): Array<{ price: number; qty: number }> {
  return items.map((item) => ({ ...item, price: item.price * BULK_DISCOUNT_RATE }));
}
```
