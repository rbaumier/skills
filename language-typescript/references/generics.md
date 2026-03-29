# TypeScript Generics & Advanced Types

Quick-reference for writing production TypeScript. Each section: pattern + code.

---

## 1. Generics Fundamentals

### Constraints — require only what you use

```typescript
// BAD: over-constrained to a specific type
function getDisplayName<T extends User>(entity: T): string {
  return entity.name;
}

// GOOD: minimal interface constraint
function getDisplayName<T extends { name: string }>(entity: T): string {
  return entity.name;
}
```

### Defaults (see also "Custom utility" in section 4 for full usage)

```typescript
type WrapFunction<TFunc extends (...args: any) => any, TAdditional = {}> =
  (...args: Parameters<TFunc>) => Promise<Awaited<ReturnType<TFunc>> & TAdditional>;
```

### Inference — the generic must appear in arguments

```typescript
// BAD: TConfig not used in args → defaults to unknown
const create = <TConfig>(config: Record<string, string>) => { /* ... */ };

// GOOD: TConfig IS the argument type → inferred from call site
const create = <TConfig extends Record<string, string>>(config: TConfig) => {
  return (variant: keyof TConfig) => config[variant];
};
```

**Rule**: Let TypeScript infer generics. Annotate only when inference widens unexpectedly or spans module boundaries. Prefer `as const` / `satisfies` over explicit generic annotations.

### `keyof` with generics — type-safe property access

```typescript
function getProperty<TObj, TKey extends keyof TObj>(obj: TObj, key: TKey): TObj[TKey] {
  return obj[key];
}
```

---

## 2. Conditional Types + `infer`

### Conditional basics

```typescript
type Conditional = SomeType extends OtherType ? TrueType : FalseType;
```

### `infer` — pattern matching for types

```typescript
// Extract array element
type ArrayElement<T> = T extends (infer U)[] ? U : never;

// Extract promise value
type PromiseValue<T> = T extends Promise<infer U> ? U : never;

// Deep unwrap
type DeepAwaited<T> = T extends Promise<infer U> ? DeepAwaited<U> : T;
```

### Template literal extraction

```typescript
type RemovePrefix<T> = T extends `maps:${infer Rest}` ? Rest : T;

// Route param extraction — see modern-features.md "Template Literal Types" for full example
```

### Function type extraction

```typescript
type FirstArg<T> = T extends (first: infer F, ...rest: any[]) => any ? F : never;
type ConstructorParams<T> = T extends new (...args: infer P) => any ? P : never;
```

### Constrained `infer` (TS 4.7+)

```typescript
type ExtractString<T> = T extends { value: infer V extends string } ? V : never;
```

---

## 3. Mapped Types

### Key remapping with `as`

```typescript
// Add prefix
type Prefixed<T, P extends string> = {
  [K in keyof T as K extends string ? `${P}${K}` : never]: T[K];
};

// Filter by value type
type PickByType<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

// Generate getters/setters
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

// Event handlers from state shape
type EventHandlers<T> = {
  [K in keyof T as `on${Capitalize<string & K>}Change`]: (value: T[K]) => void;
};
```

### Modifier manipulation

```typescript
type Mutable<T>    = { -readonly [K in keyof T]: T[K] };
type MyRequired<T> = { [K in keyof T]-?: T[K] };
```

### Deep recursive types

```typescript
// Bounded version — limit recursion depth for compiler performance
// (see compiler-performance.md for unbounded recursion costs)
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

type DeepReadonly<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;
```

### Key filtering

```typescript
// Works correctly with exactOptionalPropertyTypes
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];
```

**Gotcha**: Template literal keys require `K extends string` guard — symbol/number keys cause errors.

---

## 4. Utility Types

### Built-in essentials

| Utility | Pattern |
|---------|---------|
| `Parameters<T>` | Wrap/proxy functions |
| `ReturnType<T>` | Extract return when not exported |
| `Awaited<ReturnType<T>>` | Unwrap async function result |
| `Record<K, V>` | Object with constrained keys |
| `Partial<T>` | Update/patch payloads |
| `Required<T>` | Ensure all config provided |
| `Omit<T, K>` / `Pick<T, K>` | Shape subsets |
| `Extract<T, U>` / `Exclude<T, U>` | Filter unions |
| `NonNullable<T>` | Strip null/undefined after validation |

### Wrapping external library functions

```typescript
import { fetchUser } from "external-lib";

type FetchUserResult = Awaited<ReturnType<typeof fetchUser>>;

export const fetchUserWithMeta = async (
  ...args: Parameters<typeof fetchUser>
): Promise<FetchUserResult & { meta: { fetchedAt: Date } }> => {
  const user = await fetchUser(...args);
  return { ...user, meta: { fetchedAt: new Date() } };
};
```

### Custom utility: reusable function wrapper

Reuse `WrapFunction` from section 1 (Defaults). **Gotcha**: `ReturnType` on async functions gives `Promise<T>` — always combine with `Awaited`. Always use `typeof` for runtime values.

---

## 5. Type Narrowing

### Discriminated unions — the preferred pattern

```typescript
type Result<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: { code: string; message: string } };

function handle<T>(result: Result<T>) {
  switch (result.status) {
    case "success": return result.data;
    case "error":   throw new Error(result.error.message);
  }
}
```

### Exhaustiveness checking

```typescript
default:
  const _exhaustive: never = shape;
  throw new Error(`Unhandled: ${_exhaustive}`);
```

### Type predicates

```typescript
function isNotNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

const clean = items.filter(isNotNull); // T[] not (T | null)[]
```

### Assertion functions

```typescript
// MUST use function declaration — arrow functions do not work with asserts
function assertIsUser(value: unknown): asserts value is User {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    throw new Error("Invalid user");
  }
}
```

### Narrowing limitations

- Does **not** persist across callbacks (`setTimeout`, `.then`)
- Does **not** narrow from boolean variables — must inline the type guard call
- `in` operator narrows; bare property access does not

---

## 6. Branded/Opaque Types

Prevent mixing structurally identical but semantically different values.

### Preferred: unique symbol brand

```typescript
declare const brand: unique symbol;
type Brand<T, TBrand> = T & { [brand]: TBrand };

type UserId = Brand<string, "UserId">;
type PostId = Brand<string, "PostId">;
```

### Simple alternative (less robust)

```typescript
type Opaque<T, TBrand> = T & { __brand: TBrand };
```

### Validation entry points

```typescript
// Type predicate — caller controls flow
function isValidEmail(email: string): email is Brand<string, "ValidEmail"> {
  return email.includes("@") && email.includes(".");
}

// Assertion function — throws on invalid
function assertValidEmail(email: string): asserts email is Brand<string, "ValidEmail"> {
  if (!email.includes("@")) throw new Error("Invalid email");
}
```

**Complement**: For runtime validation, pair with Zod `.brand()` which produces compatible branded types. Define the brand type here, validate with Zod schema, and the branded output flows through the type system.

**Gotcha**: `as UserId` casts bypass safety — always funnel through a validation function.

---

## 7. Builder Pattern

Compile-time enforcement of required fields via generic accumulation.

```typescript
class ConfigBuilder<TSet extends Partial<Record<"host" | "port", true>>> {
  private config: Partial<ServerConfig> = {};

  host(v: string): ConfigBuilder<TSet & { host: true }> {
    this.config.host = v;
    return this as any;
  }

  port(v: number): ConfigBuilder<TSet & { port: true }> {
    this.config.port = v;
    return this as any;
  }

  // Only callable when required fields are set
  build(this: ConfigBuilder<{ host: true; port: true }>): ServerConfig {
    return this.config as ServerConfig;
  }
}

new ConfigBuilder().host("localhost").port(3000).build(); // OK
new ConfigBuilder().host("localhost").build();            // Type error: port missing
```

### Key techniques

1. **Literal ID capture**: `<Id extends string>` infers `"matt"` not `string`
2. **Intersection accumulation**: `TState & { field: true }` preserves prior state
3. **`this` parameter constraint on terminal method**: restricts when `.build()` is callable
4. **Cast in terminal method**: runtime shape doesn't match compile-time — cast at the boundary

---

## 8. Function Overloads

Use when **return type depends on input type**. Otherwise prefer unions or generics.

```typescript
// Overload signatures (what callers see) — specific first
function nonNullQuerySelector<K extends keyof HTMLElementTagNameMap>(
  tag: K
): HTMLElementTagNameMap[K];
function nonNullQuerySelector(tag: string): Element;

// Implementation (not visible to callers)
function nonNullQuerySelector(tag: string): Element {
  const el = document.querySelector(tag);
  if (!el) throw new Error(`Not found: ${tag}`);
  return el;
}

nonNullQuerySelector("body"); // HTMLBodyElement
nonNullQuerySelector(".cls"); // Element
```

### When to use overloads vs alternatives

| Scenario | Use |
|----------|-----|
| Return type varies by input type | Overloads |
| Same return type for all inputs | Union parameter |
| Wrapping a function that has overloads | Mirror its overloads |
| Complex type mapping | Single generic signature |

### Rules

- Specific overloads **before** general ones (resolution is top-down)
- Implementation signature is **not** visible to callers
- Implementation must be compatible with **all** overload signatures

---

## 9. Error Diagnosis

### Read errors bottom-up

```
Type '{ name: string }' is not assignable to type 'User'.
  Types of property 'email' are incompatible.
    Type 'undefined' is not assignable to type 'string'.
                                              ^^^^^^ <-- start here
```

### Debugging workflow

1. **Simplify**: Break method chains into intermediate variables with explicit annotations
2. **Test types**: `type Step1 = SomeComplex<Input>; type Step2 = Step1[keyof Input];` — hover each
3. **`@ts-expect-error`**: Confirm your mental model — if unused, the code is valid
4. **Check source defs**: Go-to-definition on library types to see overloads and constraints

### Common fixes

| Error | Fix |
|-------|-----|
| `string` not assignable to `"active" \| "inactive"` | `as const` on the value |
| Property does not exist on `unknown` | Add type guard / assertion |
| `string` can't index type `T` | Constrain key: `K extends keyof T` |
| `T` doesn't satisfy constraint | Add `extends` to generic declaration |
| Massive type diff | Look at the **last** line — it names the missing/wrong property |

---

## 10. Distributive Conditional Type Gotchas

Conditional types **distribute** over naked type parameters in unions:

```typescript
type ToArray<T> = T extends any ? T[] : never;
type R = ToArray<string | number>; // string[] | number[]  (NOT (string | number)[])
```

### Disable distribution with tuple wrapper

```typescript
type ToArray<T> = [T] extends [any] ? T[] : never;
type R = ToArray<string | number>; // (string | number)[]
```

### Practical trap

```typescript
// BAD: distributes, produces boolean (true | false)
type IsArray<T> = T extends unknown[] ? true : false;
type R = IsArray<string | number[]>; // boolean

// GOOD: checks the union as a whole
type IsArray<T> = [T] extends [unknown[]] ? true : false;
type R = IsArray<string | number[]>; // false
```

**Rule**: When writing a conditional type that should treat a union as one unit (not member-by-member), wrap both sides of `extends` in `[brackets]`.

---

## 11. Declaration Files and `declare module`

### When to write `.d.ts` files

- Typing an untyped JS library with no `@types/*` package
- Augmenting an existing module (adding fields to Express `Request`, etc.)
- Declaring global types (`Window`, `process.env`)

### Ambient module declarations

```typescript
// BAD: suppress the error, lose all type safety
// @ts-ignore
import stuff from "untyped-lib";

// GOOD: src/types/untyped-lib.d.ts — minimal ambient declaration
declare module "untyped-lib" {
  export function doThing(input: string): number;
}
```

### Module augmentation

```typescript
// types/express.d.ts — add `user` to Express Request
import "express";

declare module "express" {
  interface Request {
    user?: { id: string; role: string };
  }
}
```

### Extending globals

```typescript
// types/global.d.ts
declare global {
  interface Window {
    analytics: { track(event: string, data?: unknown): void };
  }
}
export {}; // file must be a module
```

**Rules**:
- One `.d.ts` per concern, colocated in `src/types/`
- Never use `@ts-ignore` on an untyped import — write a minimal `.d.ts` instead
- `export {}` is required in `declare global` files to make them modules

---

## 12. Type Testing

### Why test types

Type regressions silently break consumers of shared types, library APIs, and complex generics. Type tests catch them at compile time.

### `expectTypeOf` (Vitest)

```typescript
// BAD: no type test — regression goes unnoticed
const result = merge(a, b);

// GOOD: explicit type assertion
import { expectTypeOf } from "vitest";

test("merge returns intersection", () => {
  const result = merge({ a: 1 }, { b: "x" });
  expectTypeOf(result).toEqualTypeOf<{ a: number; b: string }>();
});
```

### `@ts-expect-error` as type test

```typescript
// Confirm that invalid usage IS a compile error
// @ts-expect-error — string not assignable to number
const bad: number = "hello";
```

If the `@ts-expect-error` is "unused" (no error), your assumption is wrong — the code compiles when it shouldn't.

### Compile-time equality helper

```typescript
type Equals<A, B> =
  [A] extends [B] ? [B] extends [A] ? true : false : false;

// Usage — zero runtime cost
type _Assert1 = Equals<ReturnType<typeof parse>, Config> extends true
  ? true
  : never; // never = compile error if types diverge
```

### When to use type tests

- Library authors: public API surface
- Shared type utilities (`DeepPartial`, branded types)
- Complex generics where inference is non-obvious

---

## 13. Decorators (TS 5.0 Standard vs Legacy)

### Two incompatible systems

| System | tsconfig flag | Ecosystem |
|--------|--------------|-----------|
| Legacy | `"experimentalDecorators": true` | NestJS, TypeORM, Angular |
| Standard (TC39 stage 3) | No flag needed (TS 5.0+) | New code, future default |

```typescript
// BAD: mixing both systems — silent bugs, decorators may not fire
// tsconfig has experimentalDecorators: true but code uses standard syntax

// GOOD: pick one, set tsconfig explicitly
// For new code: remove experimentalDecorators entirely
// For NestJS/TypeORM: keep experimentalDecorators: true
```

### Standard class decorator

```typescript
function logged<T extends new (...args: any[]) => any>(
  target: T,
  _context: ClassDecoratorContext
) {
  return class extends target {
    constructor(...args: any[]) {
      console.log(`Creating ${target.name}`);
      super(...args);
    }
  };
}

@logged
class UserService {}
```

### Standard method decorator

```typescript
function measure<T>(
  target: T,
  context: ClassMethodDecoratorContext
) {
  return function (this: any, ...args: any[]) {
    const start = performance.now();
    const result = (target as Function).apply(this, args);
    console.log(`${String(context.name)}: ${performance.now() - start}ms`);
    return result;
  };
}
```

### Decision guide

- **New projects**: Use standard decorators. No tsconfig flag needed
- **NestJS / TypeORM / Angular**: Use legacy (`experimentalDecorators: true`) — frameworks require it
- **Never mix both** in the same project — decorator signatures are incompatible
