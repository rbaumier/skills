```typescript
import { Result, TaggedError, matchError } from 'better-result';

// Define domain errors with exhaustive matching
const InvalidEmailError = TaggedError('InvalidEmailError')<{ email: string }>();
const EmailTakenError = TaggedError('EmailTakenError')<{ email: string }>();
const DbInsertError = TaggedError('DbInsertError')<{ cause: unknown }>();
const UserNotFoundError = TaggedError('UserNotFoundError')<{ userId: string }>();
const CartNotFoundError = TaggedError('CartNotFoundError')<{ cartId: string }>();
const InvalidCartError = TaggedError('InvalidCartError')<{ error: string }>();
const PaymentFailedError = TaggedError('PaymentFailedError')<{ cause: unknown }>();

type UserCreationError = ReturnType<typeof InvalidEmailError> | 
                        ReturnType<typeof EmailTakenError> | 
                        ReturnType<typeof DbInsertError>;

type UserProfileError = ReturnType<typeof UserNotFoundError>;

type CheckoutError = ReturnType<typeof UserNotFoundError> | 
                    ReturnType<typeof CartNotFoundError> | 
                    ReturnType<typeof InvalidCartError> | 
                    ReturnType<typeof PaymentFailedError>;

// Pure utility - no Result needed
function add(a: number, b: number): number {
  return a + b;
}

// Pure utility - no Result needed
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createUser(name: string, email: string): Promise<Result<User, UserCreationError>> {
  return Result.gen(async function* () {
    // Validate email first (pure check)
    if (!validateEmail(email)) {
      return yield* Result.err(InvalidEmailError({ email }));
    }

    // Check if email exists
    const existingResult = yield* Result.await(
      Result.tryPromise({
        try: () => db.query('SELECT id FROM users WHERE email = $1', [email]),
        catch: (e) => DbInsertError({ cause: e }),
      })
    );
    
    if (existingResult.rows[0]) {
      return yield* Result.err(EmailTakenError({ email }));
    }

    // Insert user
    const insertResult = yield* Result.await(
      Result.tryPromise({
        try: () => db.query('INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *', [name, email]),
        catch: (e) => DbInsertError({ cause: e }),
      })
    );

    return Result.ok(insertResult.rows[0]);
  });
}

async function getUserProfile(userId: string): Promise<Result<{ user: User; orders: Order[] }, UserProfileError>> {
  return Result.gen(async function* () {
    const userResult = yield* Result.await(
      Result.tryPromise({
        try: () => db.query('SELECT * FROM users WHERE id = $1', [userId]),
        catch: (e) => UserNotFoundError({ userId }),
      })
    );

    if (!userResult.rows[0]) {
      return yield* Result.err(UserNotFoundError({ userId }));
    }

    const ordersResult = yield* Result.await(
      Result.tryPromise({
        try: () => db.query('SELECT * FROM orders WHERE user_id = $1', [userId]),
        catch: (e) => UserNotFoundError({ userId }),
      })
    );

    return Result.ok({
      user: userResult.rows[0],
      orders: ordersResult.rows,
    });
  });
}

async function processCheckout(userId: string, cartId: string): Promise<Result<Receipt, CheckoutError>> {
  return Result.gen(async function* () {
    const userProfile = yield* getUserProfile(userId);

    const cart = yield* Result.await(
      Result.tryPromise({
        try: () => loadCart(cartId),
        catch: (e) => CartNotFoundError({ cartId }),
      })
    );

    if (!cart) {
      return yield* Result.err(CartNotFoundError({ cartId }));
    }

    const validated = yield* validateCart(cart);

    const payment = yield* Result.await(
      Result.tryPromise({
        try: () => chargePayment(cart.total),
        catch: (e) => PaymentFailedError({ cause: e }),
      })
    );

    const order = yield* Result.await(
      Result.tryPromise({
        try: () => createOrder(userProfile.user, cart, payment),
        catch: (e) => PaymentFailedError({ cause: e }),
      })
    );

    const receipt = yield* Result.await(
      Result.tryPromise({
        try: () => createReceipt(order),
        catch: (e) => PaymentFailedError({ cause: e }),
      })
    );

    return Result.ok(receipt);
  });
}

// Controller with exhaustive error matching
async function handleCreateUser(req, res) {
  const result = await createUser(req.body.name, req.body.email);

  result.match({
    ok: (user) => res.json(user),
    err: (err) => matchError(err, {
      InvalidEmailError: () => res.status(400).json({ error: 'Invalid email format' }),
      EmailTakenError: () => res.status(409).json({ error: 'Email already registered' }),
      DbInsertError: () => res.status(500).json({ error: 'Database error' }),
    }),
  });
}
```

## Key Changes Applied

### 1. **Define Domain Errors** (TaggedError)
- Created specific error types: `InvalidEmailError`, `EmailTakenError`, `DbInsertError`, `UserNotFoundError`, `CartNotFoundError`, `InvalidCartError`, `PaymentFailedError`
- Each error is a TaggedError factory with discriminated union support for exhaustive matching

### 2. **Wrapped Pure Logic Correctly**
- Left `add()` and `validateEmail()` untouched—they're pure functions, no Result needed
- Email validation is inlined in `createUser` before database calls

### 3. **Replaced Try/Catch with Result.gen**
- `createUser`: Uses Result.gen + Result.await for 2+ async operations
- `getUserProfile`: Wrapped DB queries with Result.tryPromise, checks result value after await
- `processCheckout`: Chains 5+ async operations with Result.gen—no manual error propagation

### 4. **Boundary Wrapping**
- `Result.tryPromise` wraps database and payment calls at I/O boundaries
- Each promise is wrapped with its appropriate error handler (catch fn converts exceptions to TaggedErrors)

### 5. **Exhaustive Error Handling**
- `handleCreateUser`: Uses `.match()` + `matchError()` for 100% coverage of error variants
- Compiler enforces all error branches handled—no silent failures

### 6. **Short-Circuit with yield***
- When a Result fails in Result.gen, execution stops immediately (like Rust's `?`)
- No manual `if (result.isErr())` propagation needed

### 7. **Type Safety**
- Function signatures now declare exact error types: `Promise<Result<T, SpecificError>>`
- Callers know exactly what errors to expect

### 8. **No Over-Wrapping**
- Single-operation functions stay Result-free if they don't need error handling
- Only wrapping at decision points and boundaries
