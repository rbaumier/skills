# Pattern Transformations - With Skill

## Response to prompt

Here are the four functions converted to better-result, each using the appropriate pattern.

### Function 1: parseConfig - Try/Catch → Result.try

Sync try/catch converts to `Result.try` with a `catch` mapper that preserves error context:

```typescript
class ParseError extends TaggedError {
  readonly _tag = "ParseError";
}

class MissingVersionError extends TaggedError {
  readonly _tag = "MissingVersionError";
}

function parseConfig(raw: string): Result<AppConfig, ParseError | MissingVersionError> {
  return Result.try({
    try: () => {
      const parsed = JSON.parse(raw);
      if (!parsed.version) throw new MissingVersionError({ message: "Missing version field" });
      return parsed as AppConfig;
    },
    catch: (e) =>
      e instanceof MissingVersionError
        ? e
        : new ParseError({ cause: e, message: `Config parse failed: ${e}` }),
  });
}
```

### Function 2: loadUserProfile - Async/Await → Result.tryPromise

Async functions convert to `Result.tryPromise`. Domain errors (HTTP status) use TaggedError with context:

```typescript
class ApiError extends TaggedError {
  readonly _tag = "ApiError";
}

class UnhandledException extends TaggedError {
  readonly _tag = "UnhandledException";
}

async function loadUserProfile(
  userId: string
): Promise<Result<UserProfile, ApiError | UnhandledException>> {
  return Result.tryPromise({
    try: async () => {
      const res = await fetch(`/api/profiles/${userId}`);
      if (!res.ok) throw new ApiError({ status: res.status, message: `HTTP ${res.status}` });
      return (await res.json()) as UserProfile;
    },
    catch: (e) =>
      e instanceof ApiError ? e : new UnhandledException({ cause: e, message: `Fetch failed: ${e}` }),
  });
}
```

### Function 3: getActiveSession - Null Check → Result.ok/Result.err

Null-returning functions convert to `Result.ok` / `Result.err` with a typed error:

```typescript
class SessionNotFoundError extends TaggedError {
  readonly _tag = "SessionNotFoundError";
}

class SessionExpiredError extends TaggedError {
  readonly _tag = "SessionExpiredError";
}

function getActiveSession(token: string): Result<Session, SessionNotFoundError | SessionExpiredError> {
  const session = sessions.get(token);
  if (!session) return Result.err(new SessionNotFoundError({ token, message: `No session for token` }));
  if (session.expired) return Result.err(new SessionExpiredError({ token, message: `Session expired` }));
  return Result.ok(session);
}
```

Callers use `yield* getActiveSession(token)` in `Result.gen`, or `.match()`.

### Function 4: checkout - Callback Hell → Result.gen

Nested try/catch with multiple error types converts to `Result.gen` with `yield*`. The error type is the union of all yielded errors:

```typescript
class CartNotFoundError extends TaggedError {
  readonly _tag = "CartNotFoundError";
}

// Assuming loadCart, processPayment, createOrder already return Results:
// loadCart: Result<Cart, CartNotFoundError>
// processPayment: Result<Payment, PaymentError>
// createOrder: Result<Order, OrderError>

type CheckoutError = CartNotFoundError | PaymentError | OrderError;

async function checkout(cartId: string): Promise<Result<Order, CheckoutError>> {
  return Result.gen(async function* () {
    const cart = yield* Result.await(loadCart(cartId));
    const payment = yield* Result.await(processPayment(cart.total));
    const order = yield* Result.await(createOrder(cart, payment));
    return Result.ok(order);
  });
}
```

No nested try/catch, no manual error type checking. Each `yield*` short-circuits on error and the error type is automatically the union of all possible errors.
