# Transactions & Data Integrity — With Skill

## Prompt
I need to implement a money transfer between two user accounts in Drizzle ORM (PostgreSQL). Deduct from sender and credit to receiver. Also show me how to create a user and their initial profile in one atomic operation. What happens if something fails?

## Answer

```typescript
import { eq, sql } from 'drizzle-orm';
import { db } from './db/client';
import { users, profiles, accounts } from './db/schema';

// Money transfer — wrapped in db.transaction() for atomicity
async function transferMoney(senderId: number, receiverId: number, amount: number) {
  await db.transaction(async (tx) => {
    // Deduct from sender
    const [sender] = await tx
      .select({ balance: accounts.balance })
      .from(accounts)
      .where(eq(accounts.userId, senderId))
      .for('update'); // Lock row to prevent race conditions

    if (sender.balance < amount) {
      throw new Error('Insufficient funds');
      // Throwing inside the transaction triggers automatic rollback
    }

    await tx
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${amount}` })
      .where(eq(accounts.userId, senderId));

    // Credit receiver
    await tx
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${amount}` })
      .where(eq(accounts.userId, receiverId));
  });
}

// Create user + profile atomically
async function createUserWithProfile(data: {
  email: string;
  name: string;
  bio: string;
}) {
  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: data.email, name: data.name })
      .returning();

    const [profile] = await tx
      .insert(profiles)
      .values({ userId: user.id, bio: data.bio })
      .returning();

    return { user, profile };
  });
}
```

**What happens if something fails?**

`db.transaction()` auto-rolls back on error. If any query inside the callback throws (including the explicit `throw new Error('Insufficient funds')`), the entire transaction is rolled back — no partial writes occur. The sender won't be debited without the receiver being credited.
