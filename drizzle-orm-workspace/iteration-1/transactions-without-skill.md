# Transactions & Data Integrity — Without Skill

## Prompt
I need to implement a money transfer between two user accounts in Drizzle ORM (PostgreSQL). Deduct from sender and credit to receiver. Also show me how to create a user and their initial profile in one atomic operation. What happens if something fails?

## Answer

```typescript
import { eq } from 'drizzle-orm';

// Money transfer
async function transferMoney(senderId: number, receiverId: number, amount: number) {
  await db.transaction(async (tx) => {
    // Get sender balance
    const [sender] = await tx.select().from(accounts).where(eq(accounts.userId, senderId));

    if (sender.balance < amount) {
      tx.rollback();
      return;
    }

    // Deduct from sender
    await tx.update(accounts)
      .set({ balance: sender.balance - amount })
      .where(eq(accounts.userId, senderId));

    // Credit receiver
    const [receiver] = await tx.select().from(accounts).where(eq(accounts.userId, receiverId));
    await tx.update(accounts)
      .set({ balance: receiver.balance + amount })
      .where(eq(accounts.userId, receiverId));
  });
}

// Create user + profile
async function createUserWithProfile(email: string, name: string, bio: string) {
  const user = await db.insert(users).values({ email, name }).returning();

  const profile = await db.insert(profiles).values({
    userId: user[0].id,
    bio,
  }).returning();

  return { user: user[0], profile: profile[0] };
}
```

If the transfer fails, the transaction will handle it. For the user+profile creation, if the profile insert fails, you'd need to manually clean up the user record.
