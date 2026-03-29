# Compiler Performance

## Explicit Return Types on Exports

**Impact: 30-50% faster declaration emit.** Compiler skips full function body inference.

```typescript
// BAD: compiler infers anonymous type from entire body
export function fetchUser(id: string) {
  return fetch(`/api/users/${id}`)
    .then(r => r.json())
    .then(d => ({ id: d.id as string, name: d.name as string }))
}

// GOOD: named type, computed once
type UserProfile { id: string; name: string }

export function fetchUser(id: string): Promise<UserProfile> {
  return fetch(`/api/users/${id}`)
    .then(r => r.json())
    .then(d => ({ id: d.id, name: d.name }))
}
```

## Interfaces Over Type Intersections

**Impact: 2-5x faster type resolution.** Interfaces create a single flat type; intersections recompute on every reference.

```typescript
// BAD: recursive merge on every usage
type UserWithPerms = User & Permissions & AuditInfo

// GOOD: single flat type, computed once
interface UserWithPerms extends User, Permissions, AuditInfo {}
```

Use intersections only for function types, primitives, or one-off combinations.

## Avoid Large Union Types

**Impact: O(n^2) pairwise comparison.** 200 members = 40,000 comparisons per usage.

```typescript
// BAD: 200+ string literal union
type Event = 'page_view' | 'button_click' | /* ... 200 more */

// GOOD: branded type with runtime validation
type Event = string & { readonly __brand: 'Event' }

const VALID = new Set(['page_view', 'button_click', /* ... */])
function createEvent(name: string): Event {
  if (!VALID.has(name)) throw new Error(`Unknown: ${name}`)
  return name as Event
}
```

For 20-50 members, group into discriminated unions by category. Under 20 is fine.

For large object unions, prefer a base interface with generics over a flat union:

```typescript
// BAD: 50+ object literal union members
type Endpoint = { path: "/users"; method: "GET" } | { path: "/orders"; method: "GET" } | /* ... */

// GOOD: base interface + lookup map
interface ApiEndpoint<P extends string, M extends string, R> { path: P; method: M; response: R }
interface EndpointMap {
  "GET /users": ApiEndpoint<"/users", "GET", User[]>
}
```

## Limit Generic Recursion Depth

**Impact: prevents exponential type expansion and OOM.** Add depth counters.

```typescript
// BAD: unbounded recursion
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// GOOD: bounded at depth 5
type DeepPartial<T, D extends number[] = []> = D['length'] extends 5
  ? T
  : { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P], [...D, 1]> : T[P] }
```

Prefer built-in `Partial` for shallow cases. Use libraries (ts-toolbelt) for complex recursive types.

## Simplify Mapped Types

**Impact: 50-80% reduction in type computation.** Break monolithic mapped types into composed utilities.

```typescript
// BAD: deeply nested conditionals evaluated per property
type Transform<T> = {
  [K in keyof T]: T[K] extends Function ? T[K]
    : T[K] extends Array<infer U> ? U extends object ? Transform<U>[] : T[K]
    : T[K] extends Date ? string : T[K] extends number ? string : T[K]
}

// GOOD: decomposed, each utility cached independently
type TransformValue<T> = T extends Date ? string : T extends number ? string : T
type TransformProp<T> = T extends Function ? T
  : T extends Array<infer U> ? (U extends object ? TransformObj<U>[] : T)
  : T extends object ? TransformObj<T> : TransformValue<T>
type TransformObj<T> = { [K in keyof T]: TransformProp<T[K]> }
```

## Variance Annotations (`in`/`out`)

**Impact: 10-30% faster type-checking on generic-heavy interfaces.** Compiler skips structural verification.

```typescript
// BAD: compiler must structurally verify variance on every comparison
interface Producer<T> { produce(): T }
interface Consumer<T> { consume(item: T): void }

// GOOD: explicit variance, compiler trusts annotations
interface Producer<out T> { produce(): T }
interface Consumer<in T> { consume(item: T): void }
interface Transformer<in TInput, out TOutput> { transform(input: TInput): TOutput }
```

Misuse is caught at compile time -- adding a method that violates declared variance produces an error.

## Diagnosing Slow Builds with `--generateTrace`

When builds are slow, generate a trace to identify bottleneck types:

```bash
tsc --generateTrace ./trace-output
# Open trace-output/trace.json in chrome://tracing or edge://tracing
# Look for: checkExpression, structuredTypeRelatedTo, isTypeAssignableTo
```

Focus on types that appear repeatedly in the longest spans.
