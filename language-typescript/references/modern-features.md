# Modern TypeScript Features Reference

## `using` / `await using` — Resource Cleanup (TS 5.2)

Guarantees `[Symbol.dispose]()` runs when variable leaves scope. Eliminates try/finally leaks.

```typescript
// BAD: leak on early return
function process(path: string) {
  const handle = openFile(path)
  const data = handle.read()
  if (!data) return null // handle.close() never called
  handle.close()
  return parse(data)
}

// GOOD: automatic cleanup
function process(path: string) {
  using handle = openFile(path) // disposed at end of scope, even on early return
  const data = handle.read()
  if (!data) return null
  return parse(data)
}

// Implement Disposable
function openFile(path: string): Disposable & FileHandle {
  const fd = fs.openSync(path, "r")
  return {
    read: () => fs.readFileSync(fd, "utf-8"),
    [Symbol.dispose]() { fs.closeSync(fd) },
  }
}
```

Use `await using` with `Symbol.asyncDispose` for async cleanup (DB connections, streams).

---

## `const` Type Parameters — Literal Inference (TS 5.0)

Infers literal/tuple types automatically. Replaces `as const` at call sites.

```typescript
// BAD: callers must remember `as const`
function createRoute<T extends readonly string[]>(methods: T) { return methods }
createRoute(["GET", "POST"])           // string[]
createRoute(["GET", "POST"] as const)  // readonly ["GET", "POST"]

// GOOD: const type parameter
function createRoute<const T extends readonly string[]>(methods: T) { return methods }
createRoute(["GET", "POST"])           // readonly ["GET", "POST"] — automatic
```

Works for deep objects too — preserves literal types through nested structures:

```typescript
const createTheme = <const T extends Record<string, string>>(theme: T) => theme
const theme = createTheme({ primary: "#0066cc" })
// theme.primary is "#0066cc", not string
```

---

## `NoInfer<T>` — Inference Control (TS 5.4)

Prevents a type parameter position from contributing to inference. Use when inference should come from one specific parameter.

```typescript
// BAD: T widens from both params
function createSignal<T>(initial: T, fallback: T): T { return initial ?? fallback }
createSignal("active", "unknown") // T = "active" | "unknown"

// GOOD: inference only from `initial`
function createSignal<T>(initial: T, fallback: NoInfer<T>): T { return initial ?? fallback }
createSignal("active", "unknown") // Error: "unknown" not assignable to "active"
```

---

## `satisfies` — Deep Patterns (TS 4.9)

Validates structure conformance while preserving literal types. Annotation widens; `satisfies` doesn't.

```typescript
// BAD: annotation widens
const routes: Record<string, { method: "GET" | "POST" }> = {
  "/users": { method: "GET" },
}
routes["/users"].method // "GET" | "POST"

// GOOD: satisfies preserves
const routes = {
  "/users": { method: "GET" },
} satisfies Record<string, { method: "GET" | "POST" }>
routes["/users"].method // "GET"
```

Key advantage: known keys get autocomplete, unknown keys error at compile time.

---

## `accessor` Keyword (TS 5.0)

Auto-generates private backing field + getter/setter. Enables decorator interception without boilerplate.

```typescript
// BAD: manual get/set
class FormField {
  private _value = ""
  get value() { return this._value }
  set value(v: string) { this._value = v; this.notify() }
}

// GOOD: accessor + decorator
function tracked<T>(
  target: ClassAccessorDecoratorTarget<unknown, T>,
  ctx: ClassAccessorDecoratorContext
) {
  return {
    set(this: unknown, value: T) {
      target.set.call(this, value)
      console.log(`${String(ctx.name)} changed`)
    },
  } satisfies ClassAccessorDecoratorResult<unknown, T>
}

class FormField {
  @tracked accessor value = ""
}
```

Skip if no interception logic needed — plain fields are simpler.

---

## Template Literal Types (TS 4.1)

Encode string patterns in the type system. Distribute over unions.

### CamelCase conversion

```typescript
type CamelCase<S extends string> =
  S extends `${infer P1}-${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>

type T = CamelCase<"background-color"> // "backgroundColor"
```

### Route parameter extraction

```typescript
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<`/${Rest}`>
    : T extends `${string}:${infer Param}` ? Param : never

type P = ExtractParams<"/users/:userId/posts/:postId"> // "userId" | "postId"
type RouteParams<T extends string> = { [K in ExtractParams<T>]: string }
```

### Event name generation

```typescript
type EventHandler<T extends string> = `on${Capitalize<T>}`
type Mouse = "click" | "mousedown" | "mouseup"
type Handlers = EventHandler<Mouse> // "onClick" | "onMousedown" | "onMouseup"
```

### Key remapping (snake_case to camelCase)

```typescript
type SnakeToCamel<S extends string> =
  S extends `${infer P1}_${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${SnakeToCamel<P3>}`
    : S

type CamelizeKeys<T> = {
  [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K]
}
// { user_id: string } -> { userId: string }
```

### Pattern validation

```typescript
type CssUnit = `${number}${"px" | "rem" | "em" | "%"}`
type ValidUrl = `${"http" | "https"}://${string}`
```

Built-in utilities: `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`.

---

## `as const` + `typeof` — Deriving Types from Values (TS 3.4+)

Single source of truth: runtime value defines the type. No duplication.

### Extract union from object values

```typescript
const STATUS = { OK: 200, NOT_FOUND: 404, ERROR: 500 } as const
type Status = typeof STATUS[keyof typeof STATUS] // 200 | 404 | 500
```

### Extract union from array

```typescript
const ROLES = ["admin", "editor", "viewer"] as const
type Role = typeof ROLES[number] // "admin" | "editor" | "viewer"
```

### Subset selection

```typescript
const MODES = { GROUP: "group", SOLO: "solo", PAIR: "pair" } as const
type SoloModes = typeof MODES["SOLO" | "PAIR"] // "solo" | "pair"
```

### Enum replacement pattern

```typescript
const Direction = { Up: 0, Down: 1, Left: 2, Right: 3 } as const
type Direction = typeof Direction[keyof typeof Direction] // 0 | 1 | 2 | 3
// Use: function move(dir: Direction) { ... }
// Call: move(Direction.Up)
```

`as const` makes values `readonly`. Use `const` type parameters (TS 5.0) to avoid requiring `as const` at call sites.
