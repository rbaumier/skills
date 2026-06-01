# Grade: e1-iter1

| id | PASS/FAIL | evidence |
|----|-----------|----------|
| try-catch-to-result-try | PASS | DB insert (lines 74-87) wrapped in `Result.tryPromise({ try: async () => db.query("INSERT ...", ...), catch: (e) => new DBInsertError(...) })`. No try/catch. |
| async-to-tryPromise | PASS | Every `db.query` call wrapped: SELECT existing (56-66), INSERT (74-87), SELECT user (97-103), SELECT orders (114-120) all use `Result.tryPromise`. No raw `Promise<User>` returns. |
| null-to-result | PASS | `if (existing.rows[0]) return Result.err(new EmailTakenError(...))` (68-71); `if (!user.rows[0]) return Result.err(new UserNotFoundError(...))` (105-112); `if (!cart) return Result.err(new CartNotFoundError(...))` (139-146). None throw. |
| tagged-errors | PASS | Domain errors are TaggedError subclasses: `InvalidEmailError`, `EmailTakenError`, `UserNotFoundError`, `CartNotFoundError`, `InvalidCartError`, `PaymentFailedError` (lines 5-31). No `throw new Error('Invalid email'/'Email taken'/'User not found')`. |
| preserve-error-info | PASS | DB insert catch keeps original: `catch: (e) => new DBInsertError({ cause: e, message: "DB insert failed" })` (81-85). Other catches also carry `cause: e`. |
| result-return-types | PASS | `createUser: Promise<Result<User, ...>>` (46-48); `getUserProfile: Promise<Result<{ user; orders }, ...>>` (93-95); `processCheckout: Promise<Result<Receipt, ...>>` (129-134). |
| gen-over-manual | PASS | `processCheckout` body is `Result.gen(async function* () { ... })` (135) chaining getUserProfile/loadCart/chargePayment/createOrder via `yield*`; no manual `if (isErr)` propagation. |
| yield-star | PASS | Each async Result call uses `yield* Result.await(...)`: getUserProfile (136), loadCart (138), chargePayment (158), createOrder (166-168). |
| no-over-wrapping | PASS | `function add(a, b): number { return a + b }` (34-36) and `function validateEmail(email): boolean` (38-40) return raw values, not Result. |
| no-mixed-paradigms | PASS | `handleCreateUser` uses `result.match({ ok, err })` + `matchError(e, {...})` (178-187). No try/catch and no `e.message` string matching for control flow. |
| no-rewrap | PASS | Propagation done via `yield*` (e.g. `yield* getUserProfile(userId)` line 136). No `return Result.err(result.error)` rewrap anywhere; the only `Result.err(...)` calls construct fresh tagged errors. |
| no-catch-panic | PASS | No broad `catch (e)` swallowing exceptions. Payment failure handled explicitly via `Result.await(chargePayment(cart.total)).mapError((e) => new PaymentFailedError(...))` (158-164). |
| start-at-boundaries | PASS | I/O wrapped: `db.query` (Result.tryPromise) and `chargePayment` (mapError) are the migration points; pure utils `add`/`validateEmail` left unwrapped (33-40). |
