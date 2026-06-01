# Grade — e1 iter1

| id | PASS/FAIL | evidence |
|---|---|---|
| minimize-observable-surface | PASS | `Order` (lines 23-33) exposes only id, userId, items, shippingAddress, status, priority, createdAt, updatedAt, total. No `internalDbRowId`, no `_sequelizeTimestamp`. `toOrderDTO` (67-79) returns exactly this shape. |
| never-leak-implementation-details | PASS | Every catch returns only `{ error: { code, message } }` (lines 100-102, 120-122, 138-140, 158-160, 169-171, 180-182). No `err.stack`, no `queryPlan`, no `internalDbRowId` in any response. |
| plan-deprecation-at-design-time | FAIL | Rule requires `Deprecation`/`Sunset` response headers "before removing anything". No `res.set`/`res.header` for `Deprecation` or `Sunset` anywhere in the file. No deprecation mechanism is codified; trap resolved only by deleting v2, not by demonstrating the rule. |
| one-version-extend-not-fork | PASS | No `OrderV2` type exists. Single `Order` interface (23-33); only v1 routes present. |
| contract-first | PASS | Input contracts `CreateOrderInput` (10-15) and `UpdateOrderInput` (17-20) are separate from output contract `Order` (23-33). Server-generated fields (id, createdAt, updatedAt, total) appear only in `Order`, not in inputs. Handler validates `req.body` into a typed input (line 84). |
| consistent-error-shape | PASS | `APIError` shape `{ error: { code, message, details? } }` (36-42) used uniformly: 100-102, 120-122, 131-133, 138-140, 149-151, 158-160, 169-171, 180-182. No `{message,stack}` or `{msg}`. |
| correct-http-status-codes | PASS | createOrder returns `res.status(201)` (96); validation errors map to 422 (`err.code === "VALIDATION_ERROR" ? 422 : 500`, line 100); unexpected → 500; not-found → 404 (131, 149). |
| no-mixed-error-patterns | PASS | Every handler uses the same try/catch + `res.status().json({error:...})` pattern (82-104, 107-124, 127-142, 145-162, 165-173, 176-184). No success-boolean-as-error, no unhandled throws in handlers, no mixed JSON-vs-throw across endpoints. |
| url-versioning-default | PASS | All routes use `/api/v1/` prefix: `/api/v1/orders` (82, 107), `/api/v1/orders/:id` (127, 145), `/api/v1/orders/:id/cancel` (165), `/api/v1/orders/:id/ship` (176). |
| always-paginate-lists | PASS | `GET /api/v1/orders` returns `{ data, pagination: { nextCursor, hasMore } }` (112-118) with cursor + limit parsing (109-110). No raw array. |
| pagination-response-shape | PASS | Uses cursor-based pagination with `data` collection key (112-117). Rule's totalItems/totalPages requirement is conditional on offset pagination; code legitimately uses cursor pagination, and the consistency requirement ('data' key) is satisfied. |
| add-never-remove-fields | PASS | No v2 type forks/removes fields; single `Order` interface, no field removal across versions. |
| never-change-field-types | PASS | `priority` is `number` in `Order` (32), `CreateOrderInput` (14) and `UpdateOrderInput` (18) — consistent single type; no string→number divergence. |
| discriminated-unions-for-variants | FAIL | `Order` (23-33) is a single flat object with `status: "pending"|"shipped"|"cancelled"` and NO per-status fields. The nullable trackingNumber/cancelledReason/shippedAt were simply deleted, not modeled as a discriminated union. The rule ("each state carries exactly the fields it needs") is not implemented — no `type Order = {status:"shipped", trackingNumber...} | {status:"cancelled", cancelledReason...} | ...`. |
| branded-types-for-ids | PASS | `type UserId = string & { readonly __brand: "UserId" }` and `type OrderId = string & { readonly __brand: "OrderId" }` (6-7); used distinctly in `Order` and inputs. |
| validate-at-boundaries-only | PASS | `calculateTotal` (63-65) only does a reduce; no call to any validator. Validation lives solely in `validateCreateOrderInput` invoked at the handler boundary (line 84). |
| no-verbs-in-rest-urls | PASS | Creation is `POST /api/v1/orders` (82); no `/api/createOrder`. Resource nouns + HTTP methods throughout. |
| no-get-for-mutations | PASS | Cancel is `app.post("/api/v1/orders/:id/cancel", ...)` (165), not GET. |
| patch-not-put-for-partial | PASS | `app.patch("/api/v1/orders/:id", ...)` (145) with `Partial<UpdateOrderInput>` (147); no PUT handler. |
| no-boolean-branching-params | PASS | Ship handler (176-184) reads no `?internal` query param and does not branch response shape. |
| validate-third-party-responses | PASS | `processThirdPartyWebhook` (186-198) validates `order_id` (string) and `amount` (number) at the boundary before returning, throwing VALIDATION_ERROR otherwise. |
| endpoint-consistent-response-shape | PASS | Ship handler always returns `{ shipped: true }` (178) — single stable shape, no conditional branch. |

## Summary
20 PASS / 22, 2 FAIL: `plan-deprecation-at-design-time` (no Deprecation/Sunset headers coded), `discriminated-unions-for-variants` (flat status union, variant fields deleted rather than modeled as a discriminated union).
