# File Structure Analysis

## Part 1: Project Reorganization

### Current Structure (Group by Type — Anti-pattern)

```
src/
  controllers/
  models/
  services/
  types/
  tests/
  utils/
  config.ts
```

### Problems

1. **Grouped by type, not by feature.** To understand or modify "users", you touch 5+ directories. This violates **Locality of Behavior** — related logic should live close together.
2. **Tests separated from source.** Colocation rule violated: tests belong next to the code they test.
3. **`utils/helpers.ts`, `common.ts`, `shared.ts`** — grab-bag modules. The skill explicitly forbids `common`/`shared` grab-bag modules. These are entropy magnets with no cohesion. Every function in them belongs to a specific feature or should be a standalone utility with a clear name.
4. **Types separated from their feature.** `userTypes.ts` living in `types/` means modifying the User feature requires jumping across directories.

### Proposed Structure (Group by Feature — Vertical Slices)

```
src/
  features/
    user/
      user.schema.ts        # Zod schemas, branded types — parse at boundary
      user.errors.ts         # Domain errors (Result types, not exceptions)
      user.repository.ts     # DB queries only — pure data access
      user.service.ts        # Business logic — pure functions, no I/O
      user.routes.ts         # HTTP layer — controller + validation
      user.test.ts           # Colocated tests
      index.ts               # Public API of this feature module
    order/
      order.schema.ts
      order.errors.ts
      order.repository.ts
      order.service.ts
      order.routes.ts
      order.test.ts
      index.ts
    product/
      product.schema.ts
      product.errors.ts
      product.repository.ts
      product.service.ts
      product.routes.ts
      product.test.ts
      index.ts
  infra/
    db.ts                    # Pool creation, connection config
  config.ts                  # Externalized constants
```

### Why This Structure

| Principle | Before | After |
|---|---|---|
| **Locality of Behavior** | Touch 5 dirs to change "user" | Touch 1 folder |
| **Colocation** | Tests in separate tree | Tests next to source |
| **No grab-bags** | `utils/helpers.ts`, `common.ts`, `shared.ts` | Eliminated — each function moves to its feature |
| **Feature module pattern** | N/A | `schema → errors → repository → service → routes → index` |
| **Deletability** | Delete "user" = hunt across 5 dirs | Delete `features/user/` — done |
| **Explicit contracts** | Everything imports everything | Each feature exposes only its `index.ts` |

---

## Part 2: `userService.ts` — What's Wrong

### Issue 1: Side effects in module scope (Functional Core, Imperative Shell violation)

```typescript
const pool = new Pool(); // Side effect at import time
```

The database connection is created when the module loads. This is untestable, uncontrollable, and violates **Functional Core, Imperative Shell**. The pool should be injected via a factory function.

**Fix:** DI via factory function.

```typescript
export function createUserService(pool: Pool) {
  return { createUser, getUser, updateUser };
}
```

### Issue 2: Mixed concerns (SRP violation)

The file contains three unrelated responsibilities:

1. **Email validation** (`validateEmail`) — belongs in `user.schema.ts` as a Zod refinement
2. **Password hashing** (`hashPassword`) — belongs in an `auth` or `crypto` infrastructure module
3. **Database queries** — belongs in `user.repository.ts`
4. **Business orchestration** — the actual service logic

A service file should orchestrate; it should not own validation, hashing, or raw SQL.

### Issue 3: Validate, don't parse (Parse, Don't Validate violation)

```typescript
if (!validateEmail(input.email)) throw new Error('bad email');
```

This checks data but doesn't transform it into a trusted type. After this line, `input.email` is still a `string` — the compiler has no proof it's valid. Use Zod to parse into a branded `Email` type at the boundary. By the time it reaches the service, it's already trusted.

### Issue 4: Throwing generic errors (Error Handling violation)

```typescript
throw new Error('bad email');
```

- Generic `Error` with no structured code — callers can't pattern-match.
- No Result type — uses exceptions for expected validation failures.
- Message `'bad email'` is useless for API consumers.

**Fix:** Define domain errors and return `Result<UserType, UserError>`.

### Issue 5: Newspaper metaphor violated

The file reads bottom-up: private helpers at top, public API at bottom. The **Newspaper metaphor** says high-level (exports) go at the top, implementation details sink to the bottom. A reader should see `createUser`, `getUser`, `updateUser` first, then scroll down for helpers.

### Issue 6: `updateUser` is 80 lines (Function length violation)

The skill mandates max 30 lines per function. An 80-line function signals multiple responsibilities that should be decomposed:

- Parse/validate input
- Diff changes
- Execute query
- Return result

Each of these is a separate function.

### Issue 7: Missing import

```typescript
function hashPassword(pw: string): string {
  return createHash('sha256').update(pw).digest('hex');
}
```

`createHash` is used but never imported from `node:crypto`. Also, `pw` violates naming rules — use `password`, not abbreviations.

### Issue 8: SHA-256 for password hashing (Security)

SHA-256 is not a password hashing algorithm. Use `bcrypt`, `scrypt`, or `argon2` — algorithms designed to be slow and salted. This is a security vulnerability, not just a code quality issue.

---

## Summary

The two core violations are:

1. **Group by type** structure forces developers to scatter-gather across directories for every feature change. Reorganize into **feature folders** with colocated tests.
2. **Mixed concerns** in `userService.ts` — validation, hashing, SQL, and orchestration all in one file with module-level side effects. Apply **Functional Core / Imperative Shell**: inject dependencies, parse at boundaries, separate repository from service, use Result types.
