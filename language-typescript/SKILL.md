---
name: language-typescript
description: "Use when writing, reviewing, or refactoring TypeScript/JavaScript. Use when hitting type errors, configuring tsconfig, designing generics, choosing type vs interface, or structuring async flows. Node.js, Bun, Deno."
---

## When to use
- Any TypeScript/JavaScript work
- Not needed for shell scripts, Python, or non-TS languages

## Opinionated Choices

These override Claude's defaults — the reason this skill exists.

| Rule | Use instead | Why |
|------|-------------|-----|
| No `enum` | `as const satisfies` + discriminated unions | Emits runtime code, numeric reverse-mapping surprises. Use `const ROUTES = { home: '/home' } as const satisfies Record<string, string>` for config objects (literal types + validation). For tagged data, use discriminated unions with a `type`/`kind` field + `assertNever(x: never)` in switch default to catch unhandled variants at compile time |
| No `default export` | Named exports only | Refactoring, tree-shaking, naming consistency |
| No `any`/`as` | `unknown`, type guards, `satisfies` | Exceptions: utility type constraints, branded factories, `as const`. **Never double-cast via `as unknown as T`** — it hides misaligned types. Fix the interface instead. |
| No function overloads | Union params or generic signatures | Overload signatures don't enforce implementation correctness. Use overloads only for fundamentally different return types based on input |
| Errors are values | `better-result` Result type | **Never `throw` for expected failures.** `throw` is NOT a fix — return `{ ok, error }`. Null = normal absence; typed error = problem |
| Types by default | `interface` only for extension/perf | See compiler-performance.md |
| `using`/`await using` | Over try/finally (TS 5.2+) | Deterministic resource cleanup |
| No barrel files | Import from source directly | `index.ts` with only re-exports = indirection, circular dep risk, slower bundling |

### Errors as values — before/after

```typescript
// WRONG — throw for expected failure
async function getUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error('User not found'); // ← NO
  return res.json() as Promise<User>;
}

// RIGHT — return Result
async function getUser(id: string): Promise<Result<User, 'not-found' | 'parse-error'>> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) return err('not-found');
  const data: unknown = await res.json();
  const parsed = UserSchema.safeParse(data);
  if (!parsed.success) return err('parse-error');
  return ok(parsed.data);
}
```

### Error cause chaining

When catching and re-throwing under a different type, always pass the original via `cause`. Preserves the full causal chain for debugging. Never swallow an error silently.

```typescript
// WRONG — original error lost
try { await loadConfig(path); }
catch (e) { throw new AppError("config failed"); }

// RIGHT — cause preserved
try { await loadConfig(path); }
catch (e) { throw new AppError("config failed", { cause: e }); }
```

Reviews: `catch (e) { throw new SomeError("msg") }` without `{ cause: e }` -> flag "preserve error cause"

### Typed error classes per domain

Each domain has its own error variants as typed classes — never `throw new Error("string")`. Catch handlers use `instanceof`, never string matching. Name by business problem (`OrderNotFound`), not technical cause (`HashMapKeyError`).

```typescript
class OrderError extends AppError { readonly code = "ORDER_ERROR" as const; }
class OrderNotFound extends OrderError { constructor(public readonly orderId: string) { super(`Order ${orderId} not found`); } }
class InsufficientStock extends OrderError { constructor(public readonly itemId: string) { super(`Insufficient stock for ${itemId}`); } }
```

### Error visibility control

4xx errors are public (user can correct). 5xx errors are internal (logged server-side, generic message to client). Encode this distinction in the type system:

```typescript
class PublicError extends AppError { readonly isPublic = true; status: number; }
class InternalError extends AppError { readonly isPublic = false; }
// Middleware: if (error.isPublic) respond(error.message) else respond("Internal server error")
```

Reviews: stack trace or internal detail exposed to client -> P0 blocker

## Tool Choices

| Tool | Purpose |
|------|---------|
| `@t3-oss/env-core` + Zod | Env validation at startup. Fail loud, not on first access |
| `tsgo --noEmit` | Fast typechecking (Go-based TS compiler) |
| `openapi-fetch` | Type-safe API clients from OpenAPI specs |
| Zod `.brand()` | Branded types — brand lost on serialization, `.parse()` restores it. For manual branding without Zod: `type Email = string & { __brand: "Email" }` — validate once at boundary, trust downstream |
| `oxlint` + `oxfmt` | Linting + formatting for new projects. Rust-based, 100x faster than ESLint+Prettier. `oxlint --fix` + `oxfmt .` replaces both |

## Strict tsconfig

Beyond `strict: true`, enable these flags — they catch real bugs `strict` misses:
- `noUncheckedIndexedAccess` — array/object index returns `T | undefined`, prevents out-of-bounds assumptions
- `exactOptionalPropertyTypes` — distinguishes `undefined` from missing, catches accidental `prop: undefined` assignments
- `verbatimModuleSyntax` — enforces `import type` for type-only imports, prevents runtime import of types

## Style

- Files: kebab-case.ts
- JSDoc on every **exported** function: a plain block description + an `@example` showing a real call AND the expected return as `// => value`. No `@description` tag, no `@param`/`@returns` (types are the docs). Internal (non-exported) helpers don't need JSDoc.
```typescript
/**
 * Fetches a user by id.
 * @example
 * await getUser('u_1') // => { ok: true, value: { id: 'u_1', name: 'Ada' } }
 */
export async function getUser(id: string): Promise<Result<User, GetUserError>> { /* ... */ }
```
- File order: imports → types/interfaces → constants → functions
- Parse at boundaries (`unknown` in, typed out), trust inside. Use assertion functions (`function assertDefined<T>(val: T | undefined): asserts val is T`) for native TS narrowing at internal boundaries where Zod is overkill
- Prefer `Readonly<T>` for function parameters that should not be mutated, `readonly T[]` for returned arrays, `as const` for deep immutability. Default to immutable; opt into mutation explicitly
- Narrow with `'prop' in obj` for unions without a discriminant field. Use custom type predicates (`function isUser(x: unknown): x is User`) for complex narrowing. Never use `as` to narrow. TS 5.5+ auto-infers type predicates for `.filter(x => x !== null)` — manual `x is T` annotations are no longer needed for simple null/undefined filters
- **Never `as X`** — the only allowed assertions are `as const` and (rarely) `as unknown` at a single trusted boundary. **Never the double-cast `as unknown as T`** — it silences the compiler and hides misaligned types; fix the type instead. Inside a type guard, narrow with `in` + `typeof`, never `as`. The guard parameter stays `unknown`; once you have checked `'id' in data`, TS narrows `data` so `typeof data.id === 'string'` works with NO cast:
```typescript
// WRONG — `as` inside the guard defeats its purpose
function isUser(data: unknown): data is User {
  return typeof (data as Record<string, unknown>).id === 'string'; // ← NO
}
// RIGHT — `in` narrows, then property access is cast-free
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null
    && 'id' in data && typeof data.id === 'string'
    && 'name' in data && typeof data.name === 'string';
}
```
- **`import type` for type-only imports** — if an import is used only in type positions (parameter/return/field annotations), write `import type { Foo } from './foo'`, never a value `import { Foo }`. Mixed: `import { makeFoo, type Foo } from './foo'`. A value import of a type loads the module at runtime for nothing and `verbatimModuleSyntax` will error. Trigger: any `import { X }` where `X` appears only after a `:` -> change to `import type`
- **Narrowing lost across closures** -- narrowing doesn't survive closure boundaries (`setTimeout`, `.then`, event handlers). Capture the narrowed value in a `const` before passing to callbacks: `const name = user.name; setTimeout(() => log(name))` — not `setTimeout(() => log(user.name))` where `user` may be re-assigned
- Template literal types for string-typed APIs — `type Route = /`/api/${string}/`` constrains string shapes at compile time. Use for API paths, CSS units (`${number}px`), event names
- ESM only: `"type": "module"` in package.json. Never mix CJS imports (`require`) with ESM modules
- Declare param/prop types as named types above the function, not inline objects — **exception: React component props, which should be inlined at the function signature** unless genuinely reused (see `react` skill)
- `Set.has()` over `Array.includes()` for repeated lookups in loops/hot paths
- Validate `JSON.parse` output with type guards — never cast with `as` (`JSON.parse` returns `unknown` in spirit)
- **JSON serialization type erosion** -- `Date` becomes `string`, `Map`/`Set` become `{}`, functions are stripped, `undefined` values disappear. Define a `Serialized<T>` type or use Zod to parse the deserialized shape at API boundaries. Never trust that `JSON.parse(JSON.stringify(x))` round-trips correctly
- **Explicit return types on exports, inference for internals** -- exported/public functions get explicit return types (API contract, prevents accidental changes). Internal helpers use inference (less noise, stays in sync). Reviews: exported function without return type annotation -> flag
- **Never mix sync/async returns** -- a function must not conditionally return `T` or `Promise<T>`. Mark it `async` so all paths return `Promise<T>`. Mixing forces callers to handle both cases and hides control flow

## Discriminated Unions

Model mutually exclusive variants as tagged unions with a `type`/`kind` discriminant field. Exhaustive switch with `assertNever` in the default branch catches unhandled variants at compile time. Covers events, states, results, commands.

```typescript
// Tagged union — each variant carries exactly the fields it needs
type PaymentEvent =
  | { type: 'charged'; amount: number; receiptId: string }
  | { type: 'refunded'; amount: number; reason: string }
  | { type: 'failed'; error: PaymentError };

function handle(event: PaymentEvent) {
  switch (event.type) {
    case 'charged': return processReceipt(event.receiptId);
    case 'refunded': return issueCredit(event.amount);
    case 'failed': return notifySupport(event.error);
    default: assertNever(event); // compile error if variant added but not handled
  }
}

function assertNever(x: never): never { throw new Error(`Unexpected: ${JSON.stringify(x)}`); }
```

Reviews: type with optional fields that are mutually exclusive -> flag "use discriminated union"; switch on discriminant without `assertNever`/exhaustive check -> flag "add exhaustive default"

## Register Pattern for Type Augmentation

For globally configurable types in a library (error type, metadata, config), expose an empty `Register` interface that users augment via module augmentation. Customizes types without modifying lib source.

```typescript
// Library exposes:
export interface Register {}
type ResolvedError = Register extends { error: infer E } ? E : DefaultError;

// Consumer augments:
declare module 'mylib' { interface Register { error: MyCustomError } }
// Now ResolvedError = MyCustomError everywhere
```

## DTOs as Pure Data Structures

Transfer types (Request, Response, Event, DTO) are plain objects with typed fields and zero business logic methods. Construction and consumption logic lives in the functions that manipulate them, not inside the type.

```typescript
// DTO — pure data, no methods
type CreateUserRequest = { name: string; email: string; role?: UserRole };
type UserResponse = { id: UserId; name: string; email: string; createdAt: string };

// Validation lives in the handler, not the DTO
function parseCreateUser(body: unknown): Result<CreateUserRequest, ValidationError> { /* ... */ }
```

Reviews: DTO with `validate()` or `transform()` methods -> flag "move logic to handler"

## Fail Fast at Boot

Every configuration error must be detected and reported at startup, not at runtime. `@t3-oss/env-core` + Zod validates at import time. Builders return `Result`, never panic. Validation happens in `build()`, not during chaining.

Reviews: config error that only surfaces when a specific request arrives -> flag "validate at boot"

## Cancellation via AbortController

Every long-running async operation accepts an `AbortSignal` parameter. Propagate through the entire call chain. Check `signal.aborted` at each async boundary.

```typescript
async function fetchAll(urls: string[], signal?: AbortSignal): Promise<Result<Response[], 'cancelled'>> {
  const results = await Promise.all(urls.map(url => fetch(url, { signal })));
  if (signal?.aborted) return err('cancelled');
  return ok(results);
}
```

Reviews: long async operation without `signal`/`AbortController` support -> flag "add cancellation"

## Bundle/Export Validation

For published npm packages, validate in CI:
- `publint --strict` — catches export map issues
- `attw --pack` — verifies TypeScript type resolution for consumers
- `size-limit` — budget per entrypoint
- Subpath exports with `server`/`client` conditions for tree-shaking

## Derive Types, Don't Duplicate

Reach for `Pick`, `Omit`, `Parameters`, `ReturnType`, `Awaited`, `typeof` before writing a new interface. DB schema → server → client should share types, not restate them.

```typescript
// Don't — manual interface drifts when source changes
type UserSummary = { id: string; email: string };

// Do — derive from the source of truth
type User = Awaited<ReturnType<typeof db.query.users.findFirst>>;
function renderUser(u: Pick<NonNullable<User>, "id" | "email">) { /* ... */ }
```

Use whatever end-to-end type tool the project already has (tRPC, oRPC, Elysia, TanStack Start). Reviews: manually duplicated interface that could be derived from an existing type -> flag "derive with Pick/Omit/ReturnType"

## Generics & Type-Level Gotchas

- **Use `NoInfer<T>`** (TS 5.4+) to prevent a generic parameter from being inferred from a specific argument — forces the caller to provide it explicitly or infer from another site. Common use: default values that shouldn't widen the type: `function create<T>(value: T, fallback: NoInfer<T>)`
- **Tail-recursive generics with accumulator** -- when a recursive type hits "excessively deep" errors, move the result into a type parameter (tail position): `type Flatten<T, Acc extends any[] = []> = T extends [infer H, ...infer R] ? Flatten<R, [...Acc, H]> : Acc`. TS optimizes tail-position recursion
- **No generic in return-position only** -- a generic type parameter must have at least one inference site via a parameter. `function parse<T>(): T` forces callers to write `parse<User>()`. Fix: add an inference site via param, currying, or factory: `function parse<T>(schema: Schema<T>): T`
- **`string & {}` for autocomplete-preserving unions** -- `type Color = 'red' | 'blue' | string` collapses to `string` and kills IDE suggestions. Use `type Color = 'red' | 'blue' | (string & {})` to preserve autocomplete while allowing arbitrary strings

## Post-Modification Audit

**MANDATORY: After ANY modification to TypeScript/JavaScript files, run the audit before considering your work done.** No exceptions -- not for "small changes," not for "I'll run it later."

```bash
/Users/rbaumier/www/comply/target/release/comply --working-tree
```

Fix all errors before committing. Modes: `--working-tree`, `--last-commit`, `--commit <sha>`, `--staged`, or no flag for full scan.

## References

| Need | File |
|------|------|
| tsconfig strict/perf/modern flags | `references/tsconfig.md` |
| `using`, `const` type params, `NoInfer`, `satisfies`, template literals | `references/modern-features.md` |
| Generics, `infer`, mapped types, builder, narrowing, `declare module`, type testing, decorators | `references/generics.md` |
| Parallel promises, deferred await, AbortController, `Promise.withResolvers` | `references/async-patterns.md` |
| Barrel files, `import type`, circular deps | `references/module-organization.md` |
| Return types, interfaces vs intersections, variance annotations | `references/compiler-performance.md` |
