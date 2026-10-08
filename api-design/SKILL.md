---
name: api-design
description: API design specifics — wire error semantics and status codes, versioning and deprecation, pagination, idempotency, health checks, interface stability, progressive disclosure, API families. Use when designing REST/GraphQL endpoints, a public library interface, or any surface consumed by other systems.
---

Generic boundary rules (contract-first, Hyrum's Law, pit of success, vertical slices, return-type ladder, options object, big-step interfaces) live in `coding-standards:quality-bar` — this skill only adds what is specific to public APIs.

## One-Version Rule

Avoid forcing consumers to choose between multiple versions of the same dependency or API. Diamond dependencies arise when different consumers need different versions of the same thing. Design for a single-version world — **extend rather than fork**.

- Add optional fields instead of creating v2 types
- Use feature flags over parallel implementations
- When breaking changes are unavoidable, migrate all consumers in a single coordinated pass

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

**Deleting the old version is NOT deprecating it.** This is the #1 wrong "fix". When you encounter a deprecated or to-be-removed endpoint, the correct response is to *codify the deprecation*, never to silently delete it — deletion is the breaking change the protocol exists to prevent. Deprecation is something you implement in code, not a comment that says "deprecated":

```typescript
// WRONG — "fixing" deprecation by deleting the old endpoint.
// Every consumer of /v1 breaks the moment this ships.
app.get("/api/v2/orders", listOrders); // v1 route deleted

// RIGHT — old version still works, but every response announces its retirement.
app.get("/api/v1/orders", (req, res) => {
  res.set("Deprecation", "true");
  res.set("Sunset", "Wed, 01 Sep 2026 00:00:00 GMT"); // >= 3 months out
  res.set("Link", '</api/v2/orders>; rel="successor-version"'); // points to migration target
  return listOrders(req, res);
});
```

Rationale: consumers depend on the old surface (Hyrum's Law). The headers give every caller a machine-readable signal and a deadline so they can migrate before the surface disappears. Removing first and announcing later inverts the protocol — the breakage lands before anyone is warned.

Review checklist:
- A deprecated/old endpoint or type was *deleted* with no replacement bridge -> flag "this is a breaking change, not a deprecation — keep the old surface and add `Deprecation`/`Sunset` headers"
- A surface marked "deprecated" in a comment but emitting no `Deprecation`/`Sunset` header -> flag "deprecation must be coded as response headers, not described in a comment"
- A `Sunset` date less than 3 months out (or absent) on an external API -> flag "give consumers a real migration window"

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

**Always paginate list endpoints.** "We don't need pagination yet" is the rationalization. You will the moment someone has 100+ items. Clamp client `limit`/`pageSize` to a documented server maximum.

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

## Avoid "entity services" in distributed architectures

A service whose entire job is CRUD on entity X (`UserService`, `OrderService`, `LoanService` that just stores and returns the entity) is usually a misdesign. It treats the entity as if it has identity that requires a process to keep, when really the entity is **data** that flows between processes whose identity is the **task** they perform.

Better shape: task-shaped services (`Onboarding`, `Pricing`, `Fulfillment`) that *consume and produce* entity data, with one canonical store rather than one service per entity. Each task service does meaningful work; the data passes through.

Reviews: new microservice proposed as "the X service" with CRUD as its primary API -> flag "what task does this perform? if CRUD is the answer, this should be a table, not a service"

## Interface Stability Rules

1. **Add, never remove.** New fields are optional. Removed fields break consumers. A new enum value breaks exhaustive clients: add one only under a documented "enums may grow, handle unknown" contract.
2. **Never change field types.** `priority: string` becoming `priority: number` is a breaking change even if "nobody uses it" (Hyrum's Law: somebody does).
3. **Branded types for IDs.** `OrderId` and `UserId` are distinct types — prevents passing one where the other is expected.
4. **Sealed traits/interfaces** — prevent external implementation to allow adding methods without breaking changes. Use private module pattern (Rust) or private symbols (TS).
5. **Mutations return the old value** — setter methods return the previous value: `fn set_name(&mut self, name: String) -> String`. Enables undo without extra reads.

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

**Idempotency** — POST endpoints accept a client-generated `Idempotency-Key` (one per intent, reused across retries). Claim it atomically via a unique constraint; duplicate returns the cached response, same key with a different payload hash → 422, still in flight → 409 (or 202). Retain keys longer than the longest client retry path.

## Red Flags

- Endpoints returning different shapes depending on conditions
- Inconsistent error formats across endpoints
- List endpoints without pagination
- Verbs in REST URLs (`/api/createOrder` instead of `POST /api/orders`)
- Breaking changes to existing fields (type changes, removals)
- `PUT` where `PATCH` is what clients actually want
- Public API without documentation on any export
- Getting-started example requiring understanding of 10+ parameters (no progressive disclosure)
- Function family where members have inconsistent signatures
- `/health` returning 200 when a critical dependency is down
- Convenience wrapper that bundles many concepts behind one call but exposes no incremental layer — when the caller's needs diverge, they must learn every hidden concept at once (`create-react-app` → `eject` problem)
- Composability gap: an output type from one operation in the family can't be passed into another without conversion
- New layer that changes the semantics of the layer beneath — field becomes immutable when wrapped, mandatory becomes optional, sync becomes async — contradicting what callers learned at the prior step
