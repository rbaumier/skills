# Project Structure Analysis

## Current Structure (Layer-Based)

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

**Problem**: This groups files by technical role (all controllers together, all services together, etc.). To work on the "user" feature, you touch 5+ directories. As the codebase grows, every folder becomes a dumping ground. Coupling is hidden because everything can import everything.

## Proposed Structure (Feature-Based)

```
src/
  features/
    user/
      user.controller.ts
      user.service.ts
      user.model.ts
      user.types.ts
      user.controller.test.ts
      user.service.test.ts
    order/
      order.controller.ts
      order.service.ts
      order.model.ts
      order.types.ts
      order.controller.test.ts
      order.service.test.ts
    product/
      product.controller.ts
      product.service.ts
      product.model.ts
      product.types.ts
  shared/
    db.ts
    validation.ts
    crypto.ts
  config.ts
```

## Why This Is Better

- **Colocation**: Everything about "user" lives in `features/user/`. One folder to find, move, or delete.
- **Tests next to source**: No mental mapping between `tests/userService.test.ts` and `services/userService.ts`. The test file sits beside the code it tests.
- **Clear boundaries**: Feature folders expose what they own. Cross-feature imports become visible and intentional.
- **Scales linearly**: Adding a feature = adding one folder. Layer-based structures add one file to every existing folder.
- **Deletability**: Removing a feature is `rm -rf features/order/`, not a scavenger hunt across 5 directories.

## What Changed

| Before | After | Reason |
|---|---|---|
| `controllers/`, `services/`, `models/`, `types/` | `features/<name>/` | Colocate by domain, not by layer |
| `tests/` (top-level) | `*.test.ts` beside source | Tests are documentation for the adjacent file |
| `utils/helpers.ts`, `utils/common.ts`, `utils/shared.ts` | `shared/db.ts`, `shared/validation.ts`, `shared/crypto.ts` | Name files by what they do, not by vague labels |

---

## `userService.ts` File Layout Problems

### 1. Hardcoded database connection (tight coupling)

```typescript
const pool = new Pool();
```

The `Pool` is instantiated at module scope. Every function is permanently bound to this one connection. You cannot test `createUser` without hitting a real database. The pool should be injected (constructor parameter or function argument).

### 2. Mixed responsibilities

The file contains three unrelated concerns:

- **Validation** (`validateEmail`) -- belongs in `shared/validation.ts`
- **Cryptography** (`hashPassword`) -- belongs in `shared/crypto.ts`
- **Data access** (`pool.query`) -- the actual service responsibility

When email validation logic changes, you are editing a file called "userService". When hashing strategy changes (SHA-256 is not suitable for passwords -- use bcrypt/argon2), you are editing this same file. These concerns should live in dedicated, testable modules.

### 3. No dependency injection

Functions directly call `pool.query`, `validateEmail`, and `hashPassword` internally. This makes unit testing impossible without mocking module internals. Pass dependencies in:

```typescript
// After: injectable, testable
export function createUserService(deps: { db: Pool; hash: (pw: string) => string }) {
  return {
    async createUser(input: CreateUserInput): Promise<UserType> { ... }
  };
}
```

### 4. SHA-256 for passwords

`hashPassword` uses SHA-256, which is a fast hash -- the opposite of what you want for passwords. Use bcrypt, scrypt, or argon2id. This is a security bug, not just a style issue.

### 5. Missing `createHash` import

`hashPassword` calls `createHash` but never imports it from `node:crypto`. The file does not compile.

### 6. Vague error messages

`throw new Error('bad email')` gives the caller nothing actionable. Use structured errors with codes or at minimum a clear message like `"Invalid email format"`.

### Summary

The file violates Single Responsibility Principle by mixing validation, cryptography, and data access. It has a hard dependency on the database pool, uses an insecure hashing algorithm, and is missing an import. Extracting these concerns into `shared/` modules and injecting the database connection fixes all structural issues.
