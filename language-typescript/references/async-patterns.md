# Async Patterns

## Never Await in Loops

Sequential `await` in loops creates N round trips. Use `Promise.all` with `map`.

```typescript
// BAD: N sequential requests
const results: User[] = []
for (const id of userIds) {
  const user = await fetchUser(id)     // 10 users x 100ms = 1000ms
  results.push(user)
}

// GOOD: parallel execution
const results = await Promise.all(
  userIds.map((id) => fetchUser(id))   // 10 users = 100ms total
)
```

Use `Promise.allSettled` when partial failure is acceptable. For rate-limited APIs, chunk into batches:

```typescript
for (let i = 0; i < ids.length; i += BATCH_SIZE) {
  const batch = ids.slice(i, i + BATCH_SIZE)
  results.push(...await Promise.all(batch.map(fetchUser)))
}
```

## Avoid Unnecessary Async Wrappers

If a function only returns a promise with no control flow, drop `async`. **Caveat**: keep `async` if the callee could throw synchronously — `async` guarantees all throws become rejections.

```typescript
// BAD: async adds nothing when callee never throws synchronously
async function getUser(id: string): Promise<User> {
  return userRepo.findById(id)
}

// GOOD: return promise directly (only when callee is guaranteed async)
function getUser(id: string): Promise<User> {
  return userRepo.findById(id)
}
```

**Exception** -- keep `async` + `return await` inside try/catch so rejections are caught:

```typescript
async function getUser(id: string): Promise<User> {
  try {
    return await userRepo.findById(id)
  } catch (e) {
    throw new UserNotFoundError(id)
  }
}
```

## Explicit Return Types for all Functions

Annotate with `Promise<T>` -- prevents silent `Promise<any>` from `response.json()`.

```typescript
// BAD: inferred as Promise<any>
async function fetchOrders(userId: string) {
  const res = await fetch(`/api/orders/${userId}`)
  return res.json()
}

// GOOD: explicit contract — parse at boundary
async function fetchOrders(userId: string): Promise<Order[]> {
  const res = await fetch(`/api/orders/${userId}`)
  const data: unknown = await res.json()
  return OrderArraySchema.parse(data) // Zod schema validates shape
}
```

## AbortController for Cancellation

Attach an `AbortSignal` to cancel in-flight requests on timeout or user navigation.

```typescript
// BAD: no cancellation, request outlives caller
async function fetchData(url: string): Promise<Data> {
  const res = await fetch(url)
  return res.json()
}

// GOOD: caller controls cancellation
async function fetchData(url: string, signal?: AbortSignal): Promise<Data> {
  const res = await fetch(url, { signal })
  const data: unknown = await res.json()
  return DataSchema.parse(data)
}

// Usage with AbortSignal.timeout (simpler than manual setTimeout + abort)
const data = await fetchData('/api/slow', AbortSignal.timeout(5000))

// Compose multiple signals with AbortSignal.any
const userCancel = new AbortController()
const data = await fetchData('/api/slow', AbortSignal.any([
  AbortSignal.timeout(5000),
  userCancel.signal,
]))
```

## `Promise.withResolvers` (ES2024)

Replaces the deferred promise constructor pattern. Available in Node 22+, Bun, Deno.

```typescript
// BAD: manual deferred promise
function createDeferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// GOOD: native API
const { promise, resolve, reject } = Promise.withResolvers<User>()

// Practical: expose resolve/reject to external events
socket.on("user:loaded", resolve)
socket.on("error", reject)
const user = await promise
```

## `structuredClone` for Deep Copy

Native deep clone — replaces `JSON.parse(JSON.stringify(x))` and lodash `cloneDeep`.

```typescript
// BAD: loses Date, undefined, Map, Set, RegExp
const copy = JSON.parse(JSON.stringify(original))

// GOOD: preserves all structured-cloneable types
const copy = structuredClone(original)
```

**Limitations** — cannot clone: functions, DOM nodes, `Error` objects, symbols, `WeakMap`/`WeakSet`. Throws `DataCloneError` on these.
