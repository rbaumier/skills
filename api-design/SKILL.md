---
name: api-design
description: API design principles — contract-first, error semantics, versioning, pagination, Hyrum's Law, interface stability. Use when designing REST/GraphQL endpoints, TypeScript interfaces, module boundaries, or any public surface between systems.
---

## Hyrum's Law

> With a sufficient number of users, all observable behaviors of your system will be depended on by somebody.

Every public behavior — undocumented quirks, error message text, field ordering, timing — becomes a de facto contract. Design implications:

- **Minimize observable surface.** Every field, header, and side effect you expose is a commitment you cannot safely remove.
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

## Red Flags

- Endpoints returning different shapes depending on conditions
- Inconsistent error formats across endpoints
- List endpoints without pagination
- Verbs in REST URLs (`/api/createOrder` instead of `POST /api/orders`)
- Breaking changes to existing fields (type changes, removals)
- Third-party API responses used without validation
- Boolean params that control branching — split into named endpoints
- `PUT` where `PATCH` is what clients actually want
