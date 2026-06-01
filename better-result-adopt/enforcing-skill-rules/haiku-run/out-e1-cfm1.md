```typescript
// Pure utility - no error handling needed
function add(a: number, b: number): number {
  return a + b;
}

// Pure utility - returns boolean, no Result wrapper needed
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Define TaggedError classes for domain errors
class InvalidEmailError extends TaggedError("InvalidEmail")<{
  email: string;
  message: string;
}> {}

class EmailTakenError extends TaggedError("EmailTaken")<{
  email: string;
  message: string;
}> {}

class DbInsertError extends TaggedError("DbInsertError")<{
  cause: unknown;
  message: string;
}> {}

class UserNotFoundError extends TaggedError("UserNotFound")<{
  userId: string;
  message: string;
}> {}

class CartNotFoundError extends TaggedError("CartNotFound")<{
  cartId: string;
  message: string;
}> {}

class InvalidCartError extends TaggedError("InvalidCart")<{
  error: string;
  message: string;
}> {}

class PaymentFailedError extends TaggedError("PaymentFailed")<{
  cause: unknown;
  message: string;
}> {}

// Migrate createUser to return Result
function createUser(
  name: string,
  email: string
): Promise<Result<User, InvalidEmailError | EmailTakenError | DbInsertError>> {
  return Result.gen(async function* () {
    // Validate email input
    if (!validateEmail(email)) {
      return Result.err(
        new InvalidEmailError({
          email,
          message: `Invalid email: ${email}`,
        })
      );
    }

    // Check if email already exists
    const existing = yield* Result.await(
      Result.tryPromise({
        try: () =>
          db.query("SELECT id FROM users WHERE email = $1", [email]),
        catch: (e) =>
          new DbInsertError({
            cause: e,
            message: `Query failed: ${e}`,
          }),
      })
    );

    if (existing.rows[0]) {
      return Result.err(
        new EmailTakenError({
          email,
          message: `Email ${email} already taken`,
        })
      );
    }

    // Insert new user
    const result = yield* Result.await(
      Result.tryPromise({
        try: () =>
          db.query("INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *", [
            name,
            email,
          ]),
        catch: (e) =>
          new DbInsertError({
            cause: e,
            message: `DB insert failed: ${e}`,
          }),
      })
    );

    return Result.ok(result.rows[0]);
  });
}

// Migrate getUserProfile to return Result
function getUserProfile(
  userId: string
): Promise<Result<{ user: User; orders: Order[] }, UserNotFoundError | DbInsertError>> {
  return Result.gen(async function* () {
    const userResult = yield* Result.await(
      Result.tryPromise({
        try: () => db.query("SELECT * FROM users WHERE id = $1", [userId]),
        catch: (e) =>
          new DbInsertError({
            cause: e,
            message: `Query failed: ${e}`,
          }),
      })
    );

    if (!userResult.rows[0]) {
      return Result.err(
        new UserNotFoundError({
          userId,
          message: `User ${userId} not found`,
        })
      );
    }

    const ordersResult = yield* Result.await(
      Result.tryPromise({
        try: () =>
          db.query("SELECT * FROM orders WHERE user_id = $1", [userId]),
        catch: (e) =>
          new DbInsertError({
            cause: e,
            message: `Query failed: ${e}`,
          }),
      })
    );

    return Result.ok({
      user: userResult.rows[0],
      orders: ordersResult.rows,
    });
  });
}

// Migrate processCheckout to return Result and compose multiple Results
function processCheckout(
  userId: string,
  cartId: string
): Promise<
  Result<
    Receipt,
    UserNotFoundError | DbInsertError | CartNotFoundError | InvalidCartError | PaymentFailedError
  >
> {
  return Result.gen(async function* () {
    // Compose multiple async operations with automatic short-circuit
    const profile = yield* getUserProfile(userId);
    const cart = yield* Result.await(loadCart(cartId));

    if (!cart) {
      return Result.err(
        new CartNotFoundError({
          cartId,
          message: `Cart ${cartId} not found`,
        })
      );
    }

    const validated = yield* validateCart(cart);

    // Charge payment and create order
    const payment = yield* Result.await(
      Result.tryPromise({
        try: () => chargePayment(cart.total),
        catch: (e) =>
          new PaymentFailedError({
            cause: e,
            message: `Payment failed: ${e}`,
          }),
      })
    );

    const order = yield* Result.await(
      createOrder(profile.user, cart, payment)
    );

    const receipt = yield* Result.await(createReceipt(order));

    return Result.ok(receipt);
  });
}

// Migrate controller to handle Result with exhaustive matching
async function handleCreateUser(req, res) {
  const result = await createUser(req.body.name, req.body.email);

  result.match({
    ok: (user) => {
      res.json(user);
    },
    err: (error) => {
      matchError(error, {
        InvalidEmail: (err) => {
          res.status(400).json({ error: err.message });
        },
        EmailTaken: (err) => {
          res.status(409).json({ error: err.message });
        },
        DbInsertError: (err) => {
          res.status(500).json({ error: "Internal error" });
        },
      });
    },
  });
}
```
