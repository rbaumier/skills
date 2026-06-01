```typescript
import { Result, TaggedError } from 'better-result';

// Domain errors - use TaggedError for exhaustive pattern matching
class InvalidEmailError extends TaggedError('InvalidEmail')<{ email: string }> {}
class EmailTakenError extends TaggedError('EmailTaken')<{ email: string }> {}
class DbInsertError extends TaggedError('DbInsert')<{ cause: unknown }> {}
class UserNotFoundError extends TaggedError('UserNotFound')<{ userId: string }> {}
class CartNotFoundError extends TaggedError('CartNotFound')<{ cartId: string }> {}
class CartValidationError extends TaggedError('CartValidation')<{ error: string }> {}
class PaymentFailedError extends TaggedError('PaymentFailed')<{ cause: unknown }> {}
class CreateOrderError extends TaggedError('CreateOrder')<{ cause: unknown }> {}

// Pure utilities remain unchanged - no error handling needed
function add(a: number, b: number): number {
  return a + b;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Single Result operation - use .map() or .andThen()
function createUser(name: string, email: string): Promise<Result<User, InvalidEmailError | EmailTakenError | DbInsertError>> {
  return Result.tryPromise({
    try: async () => {
      // Inline validation without wrapping in Result since it's synchronous
      if (!validateEmail(email)) {
        throw new InvalidEmailError({ email, message: `Invalid email: ${email}` });
      }

      // Check for existing email
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows[0]) {
        throw new EmailTakenError({ email, message: `Email ${email} already taken` });
      }

      // Insert user
      const result = await db.query('INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *', [name, email]);
      return result.rows[0] as User;
    },
    catch: (e) => {
      if (e instanceof InvalidEmailError) return e;
      if (e instanceof EmailTakenError) return e;
      return new DbInsertError({ cause: e, message: 'DB insert failed' });
    },
  });
}

// Multiple async operations - use Result.gen with yield*
async function getUserProfile(userId: string): Promise<Result<{ user: User; orders: Order[] }, UserNotFoundError>> {
  return Result.gen(async function* () {
    const userResult = yield* Result.await(
      Result.tryPromise({
        try: async () => {
          const res = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
          if (!res.rows[0]) {
            throw new UserNotFoundError({ userId, message: `User ${userId} not found` });
          }
          return res.rows[0] as User;
        },
        catch: (e) => {
          if (e instanceof UserNotFoundError) return e;
          throw e;
        },
      })
    );

    const ordersResult = await db.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
    return Result.ok({ user: userResult, orders: ordersResult.rows as Order[] });
  });
}

// Multiple operations with dependent Results - use Result.gen
async function processCheckout(userId: string, cartId: string): Promise<Result<Receipt, CartNotFoundError | CartValidationError | PaymentFailedError | CreateOrderError>> {
  return Result.gen(async function* () {
    // Load user profile (returns Result<{ user; orders }>)
    const profile = yield* Result.await(getUserProfile(userId));

    // Load cart
    const cartResult = yield* Result.await(
      Result.tryPromise({
        try: async () => {
          const cart = await loadCart(cartId);
          if (!cart) {
            throw new CartNotFoundError({ cartId, message: `Cart ${cartId} not found` });
          }
          return cart;
        },
        catch: (e) => {
          if (e instanceof CartNotFoundError) return e;
          throw e;
        },
      })
    );

    // Validate cart
    const validatedCart = yield* Result.await(
      Result.tryPromise({
        try: async () => {
          const validated = validateCart(cartResult);
          if (!validated.ok) {
            throw new CartValidationError({ error: validated.error, message: `Cart validation failed: ${validated.error}` });
          }
          return validated;
        },
        catch: (e) => {
          if (e instanceof CartValidationError) return e;
          throw e;
        },
      })
    );

    // Process payment
    const payment = yield* Result.await(
      Result.tryPromise({
        try: async () => chargePayment(cartResult.total),
        catch: (e) => new PaymentFailedError({ cause: e, message: 'Payment processing failed' }),
      })
    );

    // Create order
    const order = yield* Result.await(
      Result.tryPromise({
        try: async () => createOrder(profile.user, cartResult, payment),
        catch: (e) => new CreateOrderError({ cause: e, message: 'Order creation failed' }),
      })
    );

    // Return receipt
    return Result.ok(createReceipt(order));
  });
}

// Controller - exhaustive error handling with .match()
async function handleCreateUser(req: any, res: any): Promise<void> {
  const result = await createUser(req.body.name, req.body.email);

  result.match({
    ok: (user) => {
      res.json(user);
    },
    err: (error) => {
      if (error._tag === 'InvalidEmail') {
        res.status(400).json({ error: error.message });
      } else if (error._tag === 'EmailTaken') {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal error' });
      }
    },
  });
}
```
