# Workflow & Pitfalls - With Skill

## Response to prompt

First, I'd recommend checking if there's an `opensrc/` directory in the project - if present, read the better-result source code for implementation details.

Your code has several issues. Let me review each one:

### 1. Over-wrapping: `add()` should NOT use Result

```typescript
// BAD - over-wrapping pure arithmetic
function add(a: number, b: number): Result<number, MathError> {
  return Result.try({
    try: () => a + b,
    catch: (e) => new MathError({ cause: e }),
  });
}
```

**Problem**: Don't wrap every function in Result. `a + b` cannot fail - this is pure arithmetic with no error case. Start at I/O boundaries (API calls, DB queries, file ops) and propagate inward. Only functions that can genuinely fail need Result.

**Fix**: Just use a plain function:
```typescript
function add(a: number, b: number): number {
  return a + b;
}
```

### 2. UserNotFound extends Error instead of TaggedError

```typescript
// BAD - plain Error, no cause/context
class UserNotFound extends Error {
  constructor(id: string) {
    super(`User ${id} not found`);
  }
}
```

**Problem**: Domain errors should extend `TaggedError`, not plain `Error`. Also, there's no `cause` or structured context - you're losing error information.

**Fix**:
```typescript
class UserNotFound extends TaggedError {
  readonly _tag = "UserNotFound";
  // TaggedError constructor accepts { message, cause, ...context }
  // Usage: new UserNotFound({ id, message: `User ${id} not found` })
}
```

### 3. Catching Panic in the catch handler

```typescript
// BAD - catches Panic
catch: (e) => {
  if (e instanceof UserNotFound) return e;
  // Catch the panic too, just in case
  return new UserNotFound('unknown');
}
```

**Problem**: When a non-domain error (e.g., null dereference, type error) is thrown inside a Result callback, it becomes a `Panic`. You should NEVER catch Panic. The comment "just in case" reveals this is masking bugs. If the DB query throws a connection error, you'd silently convert it to "UserNotFound" - hiding the real problem.

**Fix**: Let non-domain errors propagate as Panic. Fix the underlying bugs instead:
```typescript
catch: (e) => {
  if (e instanceof UserNotFound) return e;
  // Infrastructure errors get their own TaggedError
  return new DatabaseError({ cause: e, message: `DB query failed: ${e}` });
}
```

### 4. Controller mixes try/catch with Result

```typescript
// BAD - mixing paradigms
async function handleGetUser(req, res) {
  try {  // <-- try/catch around Result-returning function
    const result = await getUser(req.params.id);
    ...
  } catch (e) { ... }
}
```

**Problem**: Once a module returns Result, callers should use Result too (or explicitly `.unwrap()`). Mixing try/catch with Result defeats the purpose - you get both paradigms without the benefits of either.

**Fix**: The controller should handle the Result directly. If you need a safety net at the Express level, use middleware:
```typescript
async function handleGetUser(req, res) {
  const result = await getUser(req.params.id);
  result.match({
    ok: (user) => res.json(user),
    err: (error) => {
      switch (error._tag) {
        case "UserNotFound":
          return res.status(404).json({ error: error.message });
        case "DatabaseError":
          return res.status(500).json({ error: "Internal error" });
      }
    },
  });
}

// Safety net as Express error middleware, not inline try/catch
```

### Summary of issues

| Issue | Problem | Fix |
|-------|---------|-----|
| `add()` wrapped in Result | Over-wrapping pure function | Remove Result, return plain number |
| `UserNotFound extends Error` | Should use TaggedError | Extend TaggedError with _tag |
| No cause/context in errors | Losing error information | Include cause and context in constructor |
| Catching Panic | Masking bugs | Let Panic throw, use specific TaggedError for infra errors |
| Controller uses try/catch | Mixing paradigms | Use .match() or Result pattern in controller |
