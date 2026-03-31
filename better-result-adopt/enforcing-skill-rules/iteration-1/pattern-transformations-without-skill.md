# Pattern Transformations - Without Skill

## Response to prompt

Here are the converted functions using better-result:

### Function 1: parseConfig

```typescript
function parseConfig(raw: string): Result<AppConfig, Error> {
  return Result.try({
    try: () => {
      const parsed = JSON.parse(raw);
      if (!parsed.version) throw new Error('Missing version');
      return parsed as AppConfig;
    },
    catch: (e) => new Error(`Config parse failed: ${e}`),
  });
}
```

### Function 2: loadUserProfile

```typescript
async function loadUserProfile(userId: string): Promise<Result<UserProfile, Error>> {
  try {
    const res = await fetch(`/api/profiles/${userId}`);
    if (!res.ok) return Result.err(new Error(`HTTP ${res.status}`));
    const data = await res.json();
    return Result.ok(data as UserProfile);
  } catch (e) {
    return Result.err(new Error(`Fetch failed: ${e}`));
  }
}
```

### Function 3: getActiveSession

```typescript
function getActiveSession(token: string): Session | undefined {
  const session = sessions.get(token);
  if (!session || session.expired) return undefined;
  return session;
}
```

Alternatively you could use an Option type or just keep null.

### Function 4: checkout

```typescript
async function checkout(cartId: string): Promise<Result<Order, Error>> {
  try {
    const cart = await loadCart(cartId);
    if (!cart) return Result.err(new Error('Cart not found'));
    const payment = await processPayment(cart.total);
    const order = await createOrder(cart, payment);
    return Result.ok(order);
  } catch (e) {
    if (e instanceof PaymentError) return Result.err(e);
    return Result.err(new Error(`Checkout failed: ${e}`));
  }
}
```

These conversions wrap the error-throwing code in Result types, giving you typed error handling throughout your codebase.
