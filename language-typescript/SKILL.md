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

## Tool Choices

| Tool | Purpose |
|------|---------|
| `@t3-oss/env-core` + Zod | Env validation at startup. Fail loud, not on first access |
| `tsgo --noEmit` | Fast typechecking (Go-based TS compiler) |
| `openapi-fetch` | Type-safe API clients from OpenAPI specs |
| Zod `.brand()` | Branded types — brand lost on serialization, `.parse()` restores it |
| `oxlint` + `oxfmt` | Linting + formatting for new projects. Rust-based, 100x faster than ESLint+Prettier. `oxlint --fix` + `oxfmt .` replaces both |

## Strict tsconfig

Beyond `strict: true`, enable these flags — they catch real bugs `strict` misses:
- `noUncheckedIndexedAccess` — array/object index returns `T | undefined`, prevents out-of-bounds assumptions
- `exactOptionalPropertyTypes` — distinguishes `undefined` from missing, catches accidental `prop: undefined` assignments
- `verbatimModuleSyntax` — enforces `import type` for type-only imports, prevents runtime import of types

## Style

- Files: kebab-case.ts
- JSDoc: plain block description + `@example` (with function call AND expected return `// => value`) — no `@description` tag, no `@param`/`@returns` (types are the docs)
- File order: imports → types/interfaces → constants → functions
- Parse at boundaries (`unknown` in, typed out), trust inside. Use assertion functions (`function assertDefined<T>(val: T | undefined): asserts val is T`) for native TS narrowing at internal boundaries where Zod is overkill
- Prefer `Readonly<T>` for function parameters that should not be mutated, `readonly T[]` for returned arrays, `as const` for deep immutability. Default to immutable; opt into mutation explicitly
- Narrow with `'prop' in obj` for unions without a discriminant field. Use custom type predicates (`function isUser(x: unknown): x is User`) for complex narrowing. Never use `as` to narrow. TS 5.5+ auto-infers type predicates for `.filter(x => x !== null)` — manual `x is T` annotations are no longer needed for simple null/undefined filters
- **Narrowing lost across closures** -- narrowing doesn't survive closure boundaries (`setTimeout`, `.then`, event handlers). Capture the narrowed value in a `const` before passing to callbacks: `const name = user.name; setTimeout(() => log(name))` — not `setTimeout(() => log(user.name))` where `user` may be re-assigned
- Template literal types for string-typed APIs — `type Route = \`/api/${string}\`` constrains string shapes at compile time. Use for API paths, CSS units (`${number}px`), event names
- ESM only: `"type": "module"` in package.json. Never mix CJS imports (`require`) with ESM modules
- Declare param/prop types as named types above the function, not inline objects
- `Set.has()` over `Array.includes()` for repeated lookups in loops/hot paths
- Validate `JSON.parse` output with type guards — never cast with `as` (`JSON.parse` returns `unknown` in spirit)
- **JSON serialization type erosion** -- `Date` becomes `string`, `Map`/`Set` become `{}`, functions are stripped, `undefined` values disappear. Define a `Serialized<T>` type or use Zod to parse the deserialized shape at API boundaries. Never trust that `JSON.parse(JSON.stringify(x))` round-trips correctly
- **Explicit return types on exports, inference for internals** -- exported/public functions get explicit return types (API contract, prevents accidental changes). Internal helpers use inference (less noise, stays in sync). Reviews: exported function without return type annotation -> flag
- **Never mix sync/async returns** -- a function must not conditionally return `T` or `Promise<T>`. Mark it `async` so all paths return `Promise<T>`. Mixing forces callers to handle both cases and hides control flow

## Generics & Type-Level Gotchas

- **Use `NoInfer<T>`** (TS 5.4+) to prevent a generic parameter from being inferred from a specific argument — forces the caller to provide it explicitly or infer from another site. Common use: default values that shouldn't widen the type: `function create<T>(value: T, fallback: NoInfer<T>)`
- **Tail-recursive generics with accumulator** -- when a recursive type hits "excessively deep" errors, move the result into a type parameter (tail position): `type Flatten<T, Acc extends any[] = []> = T extends [infer H, ...infer R] ? Flatten<R, [...Acc, H]> : Acc`. TS optimizes tail-position recursion
- **No generic in return-position only** -- a generic type parameter must have at least one inference site via a parameter. `function parse<T>(): T` forces callers to write `parse<User>()`. Fix: add an inference site via param, currying, or factory: `function parse<T>(schema: Schema<T>): T`
- **`string & {}` for autocomplete-preserving unions** -- `type Color = 'red' | 'blue' | string` collapses to `string` and kills IDE suggestions. Use `type Color = 'red' | 'blue' | (string & {})` to preserve autocomplete while allowing arbitrary strings

## Post-Modification Audit

**MANDATORY: After ANY modification to TypeScript/JavaScript files, run the audit before considering your work done.** No exceptions -- not for "small changes," not for "I'll run it later."

```bash
comply --working-tree
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
