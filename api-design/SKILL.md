---
name: api-design
description: API design principles — contract-first, error semantics, versioning, pagination, Hyrum's Law, interface stability. Use when designing REST/GraphQL endpoints, TypeScript interfaces, module boundaries, or any public surface between systems.
---

## Public vs private dependencies

A dependency is **public** if any of its types appear in your module's parameter signatures or return types — to call your function, the consumer must import that other module's types. It is **private** if you only use it internally; the consumer never knows it exists.

```typescript
// Public dependency on `zod` — every caller now needs zod in scope
export function validate(schema: z.ZodSchema, input: unknown) { ... }

// Private dependency on `zod` — caller sees only `Result`
export function validate(input: unknown): Result<User, ValidationError> {
  const parsed = userSchema.safeParse(input);  // zod used internally
  // ...
}
```

Audit every export: "to call this, what types from other modules must the user import?" Each one is a transitively-imposed cost on every consumer, every dependency-graph traversal, every future migration. Private dependencies are cheap (swap them out anytime); public dependencies are forever (Hyrum's Law). Reviews: function exposing a third-party type when a domain wrapper would do -> flag "wrap at the boundary, keep the dependency private"

## Hyrum's Law

> With a sufficient number of users, all observable behaviors of your system will be depended on by somebody.

Every public behavior — undocumented quirks, error message text, field ordering, timing — becomes a de facto contract. Design implications:

- **Minimize observable surface.** Every field, header, and side effect you expose is a commitment you cannot safely remove. Default to `private`/`pub(crate)`/`internal` — `public` only by deliberate intention.
- **Three levels of visibility**: public (stable API contract), shared (internal utilities), internal (maintainers only with instability warning). Mark each export explicitly.
- **Never leak implementation details.** Internal IDs, database column names, stack traces, query plans — if users can see it, they will depend on it.
- **Plan deprecation at design time.** If you can't remove it later, don't expose it now.
- **Tests are insufficient.** Contract tests verify intent, but real users depend on undocumented behavior. Treat every observable behavior as permanent.

## One-Version Rule

Avoid forcing consumers to choose between multiple versions of the same dependency or API. Diamond dependencies arise when different consumers need different versions of the same thing. Design for a single-version world — **extend rather than fork**.

- Add optional fields instead of creating v2 types
- Use feature flags over parallel implementations
- When breaking changes are unavoidable, migrate all consumers in a single coordinated pass

## Contract First

Define the TypeScript interface before writing any implementation. The contract is the spec — implementation follows.

```typescript
// 1. Define the contract FIRST — this is the design artifact
interface OrderAPI {
  // Creates an order, returns it with server-generated fields
  createOrder(input: CreateOrderInput): Promise<Order>;
  // Returns paginated orders matching filters
  listOrders(params: ListOrdersParams): Promise<PaginatedResult<Order>>;
  // Returns a single order or a NOT_FOUND error
  getOrder(id: OrderId): Promise<Result<Order, NotFoundError>>;
  // Partial update — only provided fields change
  updateOrder(id: OrderId, input: UpdateOrderInput): Promise<Order>;
  // Idempotent — succeeds even if already cancelled
  cancelOrder(id: OrderId): Promise<void>;
}

// 2. Separate input from output — server-generated fields only in output
interface CreateOrderInput {
  items: OrderItem[];
  shippingAddress: Address;
  note?: string; // Optional from day one
}

interface Order extends CreateOrderInput {
  id: OrderId;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  total: Money;
}
```

**Every endpoint gets typed input and output schemas before the handler exists.** No handler without a contract.

**Separate public API from implementation** — for libraries/frameworks, the public API (types, interfaces, traits) lives in a dedicated package, the implementation in another. Consumers never import from the implementation package directly.

## Vertical Slice Structure

Each API operation lives in a single file that owns its full vertical: route handler, business logic, DB query, input/output types — everything that changes together.

```
src/features/orders/
  createOrder.ts    ← handler + logic + DB + types for this operation
  updateOrder.ts
  cancelOrder.ts
  shared/           ← extracted only when a second operation genuinely needs it
```

```typescript
// createOrder.ts — one file owns the full operation
export async function createOrderHandler(req: Request): Promise<Response> {
  const input = parseCreateOrderInput(req.body);         // validated at boundary
  const order = await createOrder(input, { db: req.db }); // business logic below
  return json(toOrderDTO(order));
}

async function createOrder(
  input: CreateOrderInput,
  deps: { db: Database }
): Promise<Order> {
  // call other domain's public API, never its internal DB queries
  const available = await inventoryPublicApi.checkAvailability(input.items);
  // ...
}

function parseCreateOrderInput(body: unknown): CreateOrderInput { /* ... */ }
function toOrderDTO(order: Order): OrderDTO { /* ... */ }
```

**Cross-domain rules:**
- Import only from another domain's public index (`features/inventory/index.ts`), never its internal files or DB tables directly
- 1-2 external domains touched: direct import of their public use case
- 3+ domains react to the same operation: emit a domain event (`OrderCreated`), let each domain handle it independently — direct coupling at this scale becomes a coordination nightmare

## Consistent Error Semantics

One error shape, everywhere. No endpoint returns a different structure.

```typescript
// Every error response follows this shape — no exceptions
interface APIError {
  error: {
    code: string;        // Machine-readable: "VALIDATION_ERROR", "NOT_FOUND"
    message: string;     // Human-readable: "Email is required"
    details?: unknown;   // Validation errors, conflicting fields, etc.
  };
}
```

**HTTP status code mapping** — memorize this, apply it consistently:

| Status | Meaning | When to use |
|--------|---------|-------------|
| 400 | Bad Request | Malformed JSON, missing required fields |
| 401 | Unauthorized | No credentials or expired token |
| 403 | Forbidden | Authenticated but lacks permission |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate key, version mismatch, state conflict |
| 422 | Unprocessable | Syntactically valid but semantically wrong |
| 500 | Server Error | Never expose internal details to client |

**Never mix patterns.** If some endpoints throw, others return null, others return `{ error }` — the consumer cannot predict behavior. Pick one strategy, enforce it everywhere.

## API Versioning

**Decision criteria: URL path vs Accept header**

| Factor | URL versioning (`/v1/orders`) | Header versioning (`Accept: application/vnd.api+json;version=1`) |
|--------|-------------------------------|------------------------------------------------------------------|
| Discoverability | High — visible in URL | Low — hidden in headers |
| Cacheability | Easy — URL is cache key | Harder — Vary header needed |
| Client simplicity | Simpler — just change URL | More complex — must set headers |
| Granularity | Per-API | Per-resource possible |

**Default to URL versioning** (`/v1/`) unless you need per-resource granularity. Simpler for 90% of cases.

**Deprecation protocol:**
- Add `Deprecation: true` and `Sunset: <date>` response headers before removing anything
- Minimum 3-month sunset period for external APIs
- Log usage of deprecated endpoints — migrate consumers before removal
- New fields are always additive and optional (Hyrum's Law: removing a field breaks someone)
- **Backward compat via re-export** — when renaming a type or endpoint, maintain a deprecated re-export/redirect from the old name. Migration cost is borne by the maintainer, not the consumer

## Pagination

**Decision table: cursor vs offset**

| Factor | Cursor-based | Offset-based |
|--------|-------------|--------------|
| Consistency | Stable — no skipped/duplicated rows on insert | Unstable — inserts shift pages |
| Performance | O(1) — seeks from cursor | O(n) — skips rows |
| Jumping to page N | Not possible | Possible |
| Use when | Real-time feeds, large datasets, event streams | Admin tables, small datasets, page-number UI |

**Cursor-based** (default for most APIs):
```typescript
// Request
GET /api/orders?cursor=eyJpZCI6MTIzfQ&limit=20

// Response
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6MTQzfQ",  // null when no more pages
    "hasMore": true
  }
}
```

**Offset-based** (when page jumping is required):
```typescript
// Request
GET /api/orders?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc

// Response
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

**Always paginate list endpoints.** "We don't need pagination yet" is the rationalization. You will the moment someone has 100+ items.

## Removability over maintainability

Maintainability is the default goal: "easy to change for a long time". But for new, uncertain, evolving systems, the better goal is **removability** — design so each piece can be **deleted cleanly** when the bet behind it turns out to be wrong. Greg Young: *"One of the beautiful things about deleting code is that it allows you to change your mind."*

A removable module has:
- **No incoming dependencies you don't control** — only your own callers depend on it, and you can flip them in one change
- **No outgoing dependencies it brought into the codebase** — when you delete it, no third-party package becomes orphaned and stays around "just in case"
- **No persisted state schema other modules read** — its tables, queues, events, files are private to it
- **A killable feature flag or a single import-removal that takes it offline** — the deletion is a diff, not a project

Vertical slices align naturally with this goal: each slice is born as a removable bet. CQRS-style slices, feature-folder layouts, and event-driven contracts all minimize the cost of being wrong.

**When to optimize for maintainability instead:** stable, well-understood core domains where the bet has already paid off and the cost of change comes from breadth of consumers (e.g. the auth subsystem, the billing engine, the data model after 5 years of validation). Don't optimize new exploratory code for maintainability — you'll calcify the wrong design.

**Removability check before merging a new module:** "if this turns out to be the wrong design, what does the deletion diff look like?" If the answer is "we'd never delete it, we'd refactor it forever", the module is locking in a bet that hasn't proven itself yet — reduce its coupling before merging, or accept that you're past the experimentation phase. Reviews: new feature module with state schema read by 3+ other modules on day one -> flag "this isn't removable; either it's core or it's premature shared state"

## Open for modification, not extension (for non-boundary code)

The "Open/Closed Principle" tells you to make code open for extension and closed for modification. **This is true at system boundaries only.** For internal code that you fully control, the better goal is **easy modification** — keep the design lean enough that changing it is cheap, instead of pre-building extension hooks that imagine future needs.

Extensibility hooks (strategy patterns, plugin slots, callback registries, configuration parameters with no current second user) are bets on future shape. Most bets are wrong; the cost is paid daily by readers navigating the indirection. Internal code that's easy to modify wins over internal code that's hard to modify but easy to extend in directions nobody asked for.

Reviews: internal abstraction (strategy/plugin/extension point) with zero consumers outside its module -> flag "inline back; extensibility unearned"

## Avoid "entity services" in distributed architectures

A service whose entire job is CRUD on entity X (`UserService`, `OrderService`, `LoanService` that just stores and returns the entity) is usually a misdesign. It treats the entity as if it has identity that requires a process to keep, when really the entity is **data** that flows between processes whose identity is the **task** they perform.

Better shape: task-shaped services (`Onboarding`, `Pricing`, `Fulfillment`) that *consume and produce* entity data, with one canonical store rather than one service per entity. Each task service does meaningful work; the data passes through.

Reviews: new microservice proposed as "the X service" with CRUD as its primary API -> flag "what task does this perform? if CRUD is the answer, this should be a table, not a service"

## Always pass options explicitly at call sites

Don't rely on a library's default arguments — pass them explicitly at every call site. This pins behavior at the call site rather than at the library boundary, surviving library upgrades that change defaults.

```typescript
// Bad: behavior depends on what `fetch` decides today
await fetch(url);

// Good: behavior pinned at this call, library upgrades cannot silently change it
await fetch(url, {
  method: 'GET',
  redirect: 'error',
  credentials: 'omit',
  signal: AbortSignal.timeout(5_000),
});
```

The cost is verbosity; the benefit is that no library upgrade silently changes your security posture. Especially important for: HTTP clients, crypto APIs, ORM query builders, auth middleware, file system operations. Reviews: hot-path I/O call relying on library defaults for safety-relevant behavior (redirects, credentials, timeouts, retries) -> flag "pass options explicitly"

## Big-step interfaces over small-step

When decomposing an interface into smaller internal handles makes it easier to **test** but harder to **use**, you've designed for the test harness, not the user. Compilers are tested with `compile(source) -> output`, not with separate `tokenize`/`parse`/`type-check`/`codegen` handles — even though the small-step decomposition would unit-test more granularly. The user-facing shape stays big-step; granular testing happens inside, hidden.

Ask of every interface: "is this shape the user wants, or the test wants?" If a small-step decomposition leaks to callers solely to enable isolated testing, fold it back. Test through the big-step interface; the internal seams can still be tested via per-layer integration tests (see `testing` skill). Reviews: public API decomposed into a chain of internal handles the user must wire together for any single use case -> flag "expose the big-step operation; keep the small steps internal"

## Interface Stability Rules

1. **Add, never remove.** New fields are optional. Removed fields break consumers.
2. **Never change field types.** `priority: string` becoming `priority: number` is a breaking change even if "nobody uses it" (Hyrum's Law: somebody does).
3. **Discriminated unions for variants.** Each state carries exactly the fields it needs — no nullable fields that "only exist when status is X".
4. **Branded types for IDs.** `OrderId` and `UserId` are distinct types — prevents passing one where the other is expected.
5. **Validate at boundaries only.** Trust internal code. Validate where external input enters: API handlers, form submissions, third-party responses, env vars. Never between internal functions sharing type contracts.
6. **Sealed traits/interfaces** — prevent external implementation to allow adding methods without breaking changes. Use private module pattern (Rust) or private symbols (TS).
7. **Mutations return the old value** — setter methods return the previous value: `fn set_name(&mut self, name: String) -> String`. Enables undo without extra reads.
8. **Backward compat via re-export** — when renaming a type/function, maintain a `@deprecated` re-export from the old name for at least one major version. The re-export is the minimal migration bridge.

## Progressive Disclosure

API in layers of increasing complexity. The user discovers complexity only when they need it.

- **Level 1 (getting started):** 2-3 concepts for the common case. Zero-config defaults. Works out of the box.
- **Level 2 (configuration):** Optional config object for customization. Additive — doesn't change level 1 behavior.
- **Level 3 (advanced):** Escape hatches, custom implementations, plugin system. Power users only.

```typescript
// Level 1 — works immediately
const app = createApp();

// Level 2 — optional config
const app = createApp({ port: 4000, cors: true });

// Level 3 — full control
const app = createApp({
  port: 4000,
  middleware: [customAuth(), rateLimit({ max: 100 })],
  errorHandler: (err, req, res) => { /* ... */ },
});
```

Reviews: getting-started example requiring understanding of 10+ parameters -> flag "add progressive disclosure"

## Pit of Success Design

The correct usage is the easiest path. Incorrect usage requires explicit, visible effort.

- **Secure defaults.** Authentication enabled, validation on, CORS restricted, timeouts set.
- **Danger behind explicit namespace.** Bypassing safety requires calling `.dangerous()`, prefixing `unsafe_`, or using a dedicated namespace — never a boolean buried in options.
- **Opaque types with accessors.** Don't expose internal representation. `Url` not `string`, `OrderId` not `number`.
- **Impossible to misuse.** `fn connect(url: &Url)` not `fn connect(url: &str)` — validation at construction, not at use.

```typescript
// Pit of success: dangerous operations are explicitly named
db.query(sql);                       // safe, parameterized
db.dangerous().rawQuery(unsafeStr);  // explicit, visible in review

// NOT pit of success: danger hidden in boolean
db.query(sql, { raw: true });        // easy to miss in review
```

## Consistent API Families

Functions in the same family share exactly the same signature pattern. Symmetric pairs are complete (`encode`/`decode`, `serialize`/`deserialize`). Same operations carry the same names across all modules.

- All HTTP decorators accept `(path?: string | string[])`
- All CRUD operations follow `create(input)`, `findOne(id)`, `findMany(params)`, `update(id, input)`, `delete(id)`
- Method overloads across a family have identical parameter shapes

Reviews: `@Get(path)` accepts string but `@Post(path)` accepts object for the same purpose -> flag "inconsistent API family"

## Closure property

```typescript
"ape".replace("e", "i").toUpperCase(); // string -> string -> string
```

An API has the **closure property** when operations accept and return types from a small shared set, so outputs chain directly into the next call. String libraries are the canonical case — five primitives cover a thousand use cases because every operation takes strings and returns strings.

When inputs and outputs travel on different rails, callers paper over the gap with one-off glue code for every combination. When they share a rail, the family composes, and experts unlock the long tail of problems the designer never wrote out. Closure is aspirational — few domains behave as cleanly as strings — but each closed-over operation expands the reach of the API without new endpoints, which is why flexible APIs feel like they "let you do what you want" without ever saying that explicitly.

Practical instances:
- Query builders where every method returns the same `Query<T>` so any can chain
- Iterator/stream operators (`.map`, `.filter`, `.take`) all returning iterators
- `Result`-returning functions that lift back into `Result<T, E>` instead of unwrapping at each hop

Reviews: operation that returns a one-off shape callers must convert before passing into the next operation in the family -> flag "close over a shared type so the family composes"

## Single Object Parameter

Public functions with 3+ parameters use a single options object. Enables adding options without breaking changes. Calls become self-documenting.

```typescript
// WRONG — positional args, easy to swap, hard to extend
createUser('john', 'admin', true, 30);

// RIGHT — single object, self-documenting, extensible
createUser({ name: 'john', role: 'admin', verified: true, quotaLimit: 30 });
```

Also use objects when 2+ consecutive params share the same type — positional same-type args compile even when swapped silently.

## Interface-introduction triage

Before adding any new `interface` / `trait` / `abstract class`, classify it. Only the last category justifies the interface; the first three are workarounds masquerading as abstractions.

| Case | Real intent | Right tool |
|---|---|---|
| Single-method "callback" interface | Missing function type | Use a function type: `(event: Event) => void` |
| Sum of variants disguised as interface | Missing discriminated union | Use a discriminated union: `type Result = Ok \| Err` |
| Interface with exactly one implementation | Premature abstraction | Inline the concrete type, delete the interface |
| Interface with N implementations selected at runtime, owned outside this module | Real polymorphism over open variants | Keep the interface |

Reviews: interface with 0 or 1 implementations -> flag "remove or replace with discriminated union"; interface with a single method and all implementations inside the codebase -> flag "use function type"

## Return-type dimensionality ladder

Every step UP this ladder forces a new branch at every call site. Prefer the simplest type that does the job — and when forced higher, do it deliberately.

```
void  <  bool  <  T  <  Option<T>  <  Result<T, E>
```

- **`void`**: callers can't branch on the result at all (best for pure side effects with diagnostic-complete errors via Result on the error path).
- **`bool`**: one bit of state, two branches. Use only when the two states are genuinely symmetric (success/failure of equal interest).
- **`T`**: a value, no absence to handle. Use when the function never reasonably "doesn't have a value".
- **`Option<T>`**: value or normal absence. Caller must consider both.
- **`Result<T, E>`**: value or failure with diagnostic info. Caller must consider success path AND each error variant.

Reviews: function returning `Result<T, E>` where the error variants are never observed and absence would suffice -> flag "downgrade to `Option<T>`"; function returning `Option<T>` where `T | null` could not occur and the function is total -> flag "downgrade to `T`".

## Interface/Trait Design for Extensibility

When designing interfaces meant to be implemented by third parties:

- **90%+ methods have defaults.** Only 2-3 methods are required to implement.
- **Extension traits separate base from convenience.** Base trait has the minimal required surface. Extension trait adds derived operations with default implementations.
- **Systematic variants for closure APIs:** `base()`, `base_with(opts)`, `try_base()` pattern.

```typescript
// Good — minimal implementation surface
interface CacheAdapter {
  get(key: string): Promise<string | null>;        // required
  set(key: string, value: string): Promise<void>;  // required
  delete?(key: string): Promise<void>;             // optional, default no-op
  clear?(): Promise<void>;                         // optional, default no-op
  onConnect?(): Promise<void>;                     // lifecycle, optional
}
```

Reviews: interface with 15 required methods for third-party implementors -> flag "add defaults, reduce required surface"

## Adapter Interface with Optional Lifecycle

Lifecycle methods (`init`, `destroy`, `connect`, `disconnect`) are always optional with default no-ops. Only business methods are required. Avoids empty implementations in simple adapters.

## Health and Idempotency

Operational patterns as first-class API citizens:

**Health check** — granular per external dependency, not a single boolean:
```json
GET /health → { "db": "ok", "cache": "degraded", "queue": "ok", "status": "degraded" }
```

**Idempotency** — POST endpoints accept an `Idempotency-Key` header. Duplicate requests return the cached response. Prevents double-charges, double-creates on network retries.

## Mirroring Pattern (SDK / REST)

When a system exposes both SDK and HTTP API, each HTTP endpoint parses parameters and delegates to the corresponding SDK operation. Zero logic duplication between the two paths.

```typescript
// HTTP handler — parse + delegate only (max ~50 lines)
async function createOrderHandler(req: Request) {
  const input = parseCreateOrderInput(req.body);
  const order = await createOrder(input, { db: req.db });
  return json(toOrderDTO(order));
}

// SDK operation — ALL business logic lives here
async function createOrder(input: CreateOrderInput, deps: Deps): Promise<Order> { /* ... */ }
```

Reviews: business logic duplicated in HTTP handler when SDK operation exists -> flag "delegate to SDK operation"

## Red Flags

- Endpoints returning different shapes depending on conditions
- Inconsistent error formats across endpoints
- List endpoints without pagination
- Verbs in REST URLs (`/api/createOrder` instead of `POST /api/orders`)
- Breaking changes to existing fields (type changes, removals)
- Third-party API responses used without validation
- Boolean params that control branching — split into named endpoints
- `PUT` where `PATCH` is what clients actually want
- Public API without documentation on any export
- Interface with a single implementation (unjustified abstraction)
- Getting-started example requiring understanding of 10+ parameters (no progressive disclosure)
- Dangerous operation easier to call than the safe path (inverted pit of success)
- Function family where members have inconsistent signatures
- `/health` returning 200 when a critical dependency is down
- Convenience wrapper that bundles many concepts behind one call but exposes no incremental layer — when the caller's needs diverge, they must learn every hidden concept at once (`create-react-app` → `eject` problem)
- Composability gap: an output type from one operation in the family can't be passed into another without conversion
- New layer that changes the semantics of the layer beneath — field becomes immutable when wrapped, mandatory becomes optional, sync becomes async — contradicting what callers learned at the prior step
