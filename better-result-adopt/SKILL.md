---
name: better-result-adopt
description: Migrate codebase from try/catch or Promise-based error handling to better-result. Use when adopting Result types, converting thrown exceptions to typed errors, or refactoring existing error handling to railway-oriented programming.
---

# better-result Adoption

Migrate existing error handling (try/catch, Promise rejections, thrown exceptions) to typed Result-based error handling with better-result.

## When to Use

- Adopting better-result in existing codebase
- Converting try/catch blocks to Result types
- Replacing thrown exceptions with typed errors
- Migrating Promise-based code to Result.tryPromise
- Introducing railway-oriented programming patterns

## Rules

- Use Result.gen with yield* for composing multiple Result-returning operations - enables railway-oriented programming
- Use Result.await to yield Promise<Result> in async generators - required for async operations inside Result.gen
- Extend TaggedError(\"YourError\") for discriminated error types - creates errors with _tag for exhaustive matching
- Return Result.ok() or Result.err() at the end of Result.gen blocks - generators must return a Result
- Use Result.try with catch handler to convert exceptions to typed errors - wrap throwing functions safely
- Use Result.tryPromise for async ops with optional retry - supports times, delayMs, backoff, shouldRetry options
- For async retry decisions, enrich error in catch handler (can be async) then use shouldRetry synchronously
- Use .match({ ok, err }) for exhaustive handling of both Result variants - forces explicit error handling
- Use matchError for exhaustive pattern matching on TaggedError unions - compiler enforces all error variants
- Prefer unwrapOr over unwrap to provide fallback values - unwrap throws on Err
- All combinators support dual API: fn(result, arg) and fn(arg)(result) - both data-first and pipeable styles
- Chain .mapError() on Result.gen() output to normalize multiple error types into a single unified error type


## API Reference

### Result

| Method                                  | Description                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Result.ok(value)`                      | Create success                                                                           |
| `Result.err(error)`                     | Create error                                                                             |
| `Result.try(fn)`                        | Wrap throwing function                                                                   |
| `Result.tryPromise(fn, config?)`        | Wrap async function with optional retry                                                  |
| `Result.isOk(result)`                   | Type guard for Ok                                                                        |
| `Result.isError(result)`                | Type guard for Err                                                                       |
| `Result.gen(fn)`                        | Generator composition                                                                    |
| `Result.tryRecover(result, fn)`         | Recover error into same success type                                                     |
| `Result.tryRecoverAsync(result, fn)`    | Async recover error into same success type                                               |
| `Result.tap(result, fn)`                | Run side effect on success and return original result                                    |
| `Result.tapAsync(result, fn)`           | Run async side effect on success and return original result                              |
| `Result.tapError(result, fn)`           | Run side effect on error and return original result                                      |
| `Result.tapErrorAsync(result, fn)`      | Run async side effect on error and return original result                                |
| `Result.tapBoth(result, handlers)`      | Run side effect on either branch and return original result                              |
| `Result.tapBothAsync(result, handlers)` | Run async side effect on either branch and return original result                        |
| `Result.await(promise)`                 | Wrap Promise<Result> for generators                                                      |
| `Result.serialize(result)`              | Convert Result to plain object                                                           |
| `Result.deserialize(value)`             | Rehydrate serialized Result (returns `Err<ResultDeserializationError>` on invalid input) |
| `Result.partition(results)`             | Split array into [okValues, errValues]                                                   |
| `Result.flatten(result)`                | Flatten nested Result                                                                    |

### Instance Methods

| Method                    | Description                                |
| ------------------------- | ------------------------------------------ |
| `.isOk()`                 | Type guard, narrows to Ok                  |
| `.isErr()`                | Type guard, narrows to Err                 |
| `.map(fn)`                | Transform success value                    |
| `.mapError(fn)`           | Transform error value                      |
| `.tryRecover(fn)`         | Recover error into same success type       |
| `.tryRecoverAsync(fn)`    | Async recover error into same success type |
| `.andThen(fn)`            | Chain Result-returning function            |
| `.andThenAsync(fn)`       | Chain async Result-returning function      |
| `.match({ ok, err })`     | Pattern match                              |
| `.unwrap(message?)`       | Extract value or throw                     |
| `.unwrapOr(fallback)`     | Extract value or return fallback           |
| `.tap(fn)`                | Side effect on success                     |
| `.tapAsync(fn)`           | Async side effect on success               |
| `.tapError(fn)`           | Side effect on error                       |
| `.tapErrorAsync(fn)`      | Async side effect on error                 |
| `.tapBoth(handlers)`      | Side effect on either branch               |
| `.tapBothAsync(handlers)` | Async side effect on either branch         |

### TaggedError

| Method                                 | Description                        |
| -------------------------------------- | ---------------------------------- |
| `TaggedError(tag)<Props>()`            | Factory for tagged error class     |
| `TaggedError.is(value)`                | Type guard for any TaggedError     |
| `matchError(err, handlers)`            | Exhaustive pattern match by `_tag` |
| `matchErrorPartial(err, handlers, fb)` | Partial match with fallback        |
| `isTaggedError(value)`                 | Type guard (standalone function)   |
| `panic(message, cause?)`               | Throw unrecoverable Panic          |
| `isPanic(value)`                       | Type guard for Panic               |

### Type Helpers

| Type                     | Description                  |
| ------------------------ | ---------------------------- |
| `InferOk<R>`             | Extract Ok type from Result  |
| `InferErr<R>`            | Extract Err type from Result |
| `SerializedResult<T, E>` | Plain object form of Result  |
| `SerializedOk<T>`        | Plain object form of Ok      |
| `SerializedErr<E>`       | Plain object form of Err     |


## Pattern Transformations

### Try/Catch to Result.try

```typescript
// BEFORE
function parseConfig(json: string): Config {
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new ParseError(e);
  }
}

// AFTER
function parseConfig(json: string): Result<Config, ParseError> {
  return Result.try({
    try: () => JSON.parse(json) as Config,
    catch: (e) => new ParseError({ cause: e, message: `Parse failed: ${e}` }),
  });
}
```

### Async/Await to Result.tryPromise

```typescript
// BEFORE
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}

// AFTER
async function fetchUser(id: string): Promise<Result<User, ApiError | UnhandledException>> {
  return Result.tryPromise({
    try: async () => {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new ApiError({ status: res.status, message: `API ${res.status}` });
      return res.json() as Promise<User>;
    },
    catch: (e) => (e instanceof ApiError ? e : new UnhandledException({ cause: e })),
  });
}
```

### Null Checks to Result

```typescript
// BEFORE
function findUser(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}
// Caller must check: if (user === null) ...

// AFTER
function findUser(id: string): Result<User, NotFoundError> {
  const user = users.find((u) => u.id === id);
  return user
    ? Result.ok(user)
    : Result.err(new NotFoundError({ id, message: `User ${id} not found` }));
}
// Caller: yield* findUser(id) in Result.gen, or .match()
```

### Callback Hell to Generator

```typescript
// BEFORE
async function processOrder(orderId: string) {
  try {
    const order = await fetchOrder(orderId);
    if (!order) throw new NotFoundError(orderId);
    const validated = validateOrder(order);
    if (!validated.ok) throw new ValidationError(validated.errors);
    const result = await submitOrder(validated.data);
    return result;
  } catch (e) {
    if (e instanceof NotFoundError) return { error: "not_found" };
    if (e instanceof ValidationError) return { error: "invalid" };
    throw e;
  }
}

// AFTER
async function processOrder(orderId: string): Promise<Result<OrderResult, OrderError>> {
  return Result.gen(async function* () {
    const order = yield* Result.await(fetchOrder(orderId));
    const validated = yield* validateOrder(order);
    const result = yield* Result.await(submitOrder(validated));
    return Result.ok(result);
  });
}
// Error type is union of all yielded errors
```

## Defining TaggedErrors

See [references/tagged-errors.md](references/tagged-errors.md) for TaggedError patterns.

## Workflow

1. **Check for source reference**: Look for `opensrc/` directory - if present, read the better-result source code for implementation details and patterns
2. **Audit**: Find try/catch, Promise.catch, thrown errors in target module
3. **Define errors**: Create TaggedError classes for domain errors
4. **Wrap boundaries**: Use Result.try/tryPromise at I/O points
5. **Chain operations**: Convert if/else error checks to .andThen or Result.gen
6. **Update signatures**: Change return types to Result<T, E>
7. **Update callers**: Propagate Result handling up call stack
8. **Test**: Verify error paths with .match or type narrowing

## Rules

- **2+ Results = use Result.gen with yield\*** -- never manually propagate. Use `yield*` for automatic short-circuit, like Rust's `?`
- **Single Result transform = `.map()` / `.andThen()`** -- `fetchUser(id).map(u => u.name)` not `Result.gen` for one Result. Reserve `Result.gen` for 2+ Results. If you must check manually, `return result` not `return Result.err(result.error)` — don't re-wrap

## Common Pitfalls

- **Manual propagation**: `if (r.isErr()) return Result.err(r.error)` repeated = use Result.gen instead
- **Over-wrapping**: Don't wrap every function. Start at boundaries, propagate inward.
- **Losing error info**: Always include cause/context in TaggedError constructors.
- **Mixing paradigms**: Once a module returns Result, callers should too (or explicitly .unwrap).
- **Ignoring Panic**: Callbacks that throw become Panic. Fix the bug, don't catch Panic.

## References

- [TaggedError Patterns](references/tagged-errors.md) - Defining and matching typed errors
- `opensrc/` directory (if present) - Full better-result source code for deeper context
