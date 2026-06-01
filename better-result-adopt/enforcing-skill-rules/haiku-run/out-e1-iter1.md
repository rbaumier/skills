```typescript
import { Result, TaggedError, matchError } from "better-result";

// Domain errors
class InvalidEmailError extends TaggedError("InvalidEmailError")<{
  email: string;
}> {}

class EmailTakenError extends TaggedError("EmailTakenError")<{
  email: string;
}> {}

class DBInsertError extends TaggedError("DBInsertError")<{
  cause: unknown;
}> {}

class UserNotFoundError extends TaggedError("UserNotFoundError")<{
  userId: string;
}> {}

class CartNotFoundError extends TaggedError("CartNotFoundError")<{
  cartId: string;
}> {}

class InvalidCartError extends TaggedError("InvalidCartError")<{
  error: string;
}> {}

class PaymentFailedError extends TaggedError("PaymentFailedError")<{
  cause: unknown;
}> {}

// Pure utilities - no Result needed
function add(a: number, b: number): number {
  return a + b;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Migrated functions returning Result
async function createUser(
  name: string,
  email: string
): Promise<
  Result<User, InvalidEmailError | EmailTakenError | DBInsertError>
> {
  return Result.gen(async function* () {
    if (!validateEmail(email)) {
      return Result.err(
        new InvalidEmailError({ email, message: "Invalid email" })
      );
    }

    const existing = yield* Result.await(
      Result.tryPromise({
        try: async () =>
          db.query("SELECT id FROM users WHERE email = $1", [email]),
        catch: (e) =>
          new DBInsertError({
            cause: e,
            message: "Failed to check existing email",
          }),
      })
    );

    if (existing.rows[0]) {
      return Result.err(
        new EmailTakenError({ email, message: "Email taken" })
      );
    }

    const result = yield* Result.await(
      Result.tryPromise({
        try: async () =>
          db.query(
            "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
            [name, email]
          ),
        catch: (e) =>
          new DBInsertError({
            cause: e,
            message: "DB insert failed",
          }),
      })
    );

    return Result.ok(result.rows[0]);
  });
}

async function getUserProfile(
  userId: string
): Promise<Result<{ user: User; orders: Order[] }, UserNotFoundError>> {
  return Result.gen(async function* () {
    const user = yield* Result.await(
      Result.tryPromise({
        try: async () =>
          db.query("SELECT * FROM users WHERE id = $1", [userId]),
        catch: (e) => new UserNotFoundError({ userId, cause: e }),
      })
    );

    if (!user.rows[0]) {
      return Result.err(
        new UserNotFoundError({
          userId,
          message: `User ${userId} not found`,
        })
      );
    }

    const orders = yield* Result.await(
      Result.tryPromise({
        try: async () =>
          db.query("SELECT * FROM orders WHERE user_id = $1", [userId]),
        catch: (e) => new UserNotFoundError({ userId, cause: e }),
      })
    );

    return Result.ok({ user: user.rows[0], orders: orders.rows });
  });
}

async function processCheckout(
  userId: string,
  cartId: string
): Promise<
  Result<
    Receipt,
    CartNotFoundError | InvalidCartError | PaymentFailedError
  >
> {
  return Result.gen(async function* () {
    const userProfile = yield* getUserProfile(userId);

    const cart = yield* Result.await(loadCart(cartId));
    if (!cart) {
      return Result.err(
        new CartNotFoundError({
          cartId,
          message: "Cart not found",
        })
      );
    }

    const validated = validateCart(cart);
    if (!validated.ok) {
      return Result.err(
        new InvalidCartError({
          error: validated.error,
          message: validated.error,
        })
      );
    }

    const payment = yield* Result.await(chargePayment(cart.total)).mapError(
      (e) =>
        new PaymentFailedError({
          cause: e,
          message: "Payment failed",
        })
    );

    const order = yield* Result.await(
      createOrder(userProfile.user, cart, payment)
    );

    return Result.ok(createReceipt(order));
  });
}

// Controller
async function handleCreateUser(req, res) {
  const result = await createUser(req.body.name, req.body.email);

  result.match({
    ok: (user) => res.json(user),
    err: (e) =>
      matchError(e, {
        InvalidEmailError: () =>
          res.status(400).json({ error: "Invalid email" }),
        EmailTakenError: () =>
          res.status(409).json({ error: "Email taken" }),
      }),
  });
}
```
