---
name: api-design
description: API design principles — contract-first, error semantics, versioning, pagination, Hyrum's Law, interface stability. Use when designing REST/GraphQL endpoints, TypeScript interfaces, module boundaries, or any public surface between systems.
---

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

## Single Object Parameter

Public functions with 3+ parameters use a single options object. Enables adding options without breaking changes. Calls become self-documenting.

```typescript
// WRONG — positional args, easy to swap, hard to extend
createUser('john', 'admin', true, 30);

// RIGHT — single object, self-documenting, extensible
createUser({ name: 'john', role: 'admin', verified: true, quotaLimit: 30 });
```

Also use objects when 2+ consecutive params share the same type — positional same-type args compile even when swapped silently.

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
