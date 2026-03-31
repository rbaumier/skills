# Review: TypeScript Project Setup

## 1. Environment Variables — Use `@t3-oss/env-core` + Zod

The current `env.ts` has three problems:
- `process.env.API_URL!` — the non-null assertion lies to the compiler; if the var is missing, you get `undefined` at runtime with no error.
- `as string` on `SECRET` — same issue, silently passes `undefined` as a `string`.
- `parseInt(process.env.PORT || '3000')` — no validation that PORT is actually numeric.

All three fail silently on first access rather than failing loud at startup.

**Replace with `@t3-oss/env-core` + Zod:**

```typescript
// env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_URL: z.string().url(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    SECRET: z.string().min(1),
  },
  runtimeEnv: process.env,
});
```

This validates every variable at startup. If `SECRET` is missing, the process crashes immediately with a clear message — not minutes later on the first request that touches it.

## 2. API Client — Use `openapi-fetch` Instead of Axios

You have an OpenAPI spec at `./openapi.yaml` that already defines the `/api/users/{id}` endpoint. Manually writing axios calls duplicates that contract and drifts over time.

**Generate a type-safe client from the spec:**

```bash
# Install
bun add openapi-fetch
bun add -d openapi-typescript

# Generate types from your OpenAPI spec
bunx openapi-typescript ./openapi.yaml -o ./src/api-types.ts
```

```typescript
// api-client.ts
import createClient from "openapi-fetch";
import type { paths } from "./api-types";

export const api = createClient<paths>({ baseUrl: import.meta.env.API_URL });

// Usage — path, method, and response type are all inferred from the spec
const { data, error } = await api.GET("/api/users/{id}", {
  params: { path: { id: userId } },
});
```

Benefits:
- Path parameters, request bodies, and response shapes are derived from the OpenAPI spec — no manual `type User` that can drift.
- If the spec changes, `openapi-typescript` regenerates types and the compiler catches every broken callsite.
- No `axios` dependency (uses `fetch` internally).

## 3. Branded `UserId` — Use Zod `.brand()`

A plain `type UserId = string` is structurally identical to `string` — the compiler will happily let you pass a `PostId` where a `UserId` is expected. You asked for type-level distinguishability; that requires branding.

```typescript
// user-id.ts
import { z } from "zod";

export const UserIdSchema = z.string().uuid().brand<"UserId">();
export type UserId = z.infer<typeof UserIdSchema>;
```

Parse at boundaries (API handlers, route params), trust inside:

```typescript
// At the boundary
const userId = UserIdSchema.parse(req.params.id); // UserId (branded)

// Deep inside — compiler prevents mixing branded types
function fetchUser(id: UserId) { /* ... */ }
fetchUser(userId);          // OK
fetchUser("raw-string");    // Compile error
fetchUser(postId);          // Compile error — PostId !== UserId
```

Note: the brand is lost on serialization (e.g., JSON). Call `.parse()` again when deserializing to restore it.

## 4. Typecheck Script — Use `tsgo`

`tsc --noEmit` works but is slow on larger codebases. The Go-based TypeScript compiler is significantly faster for type-checking.

```json
{
  "scripts": {
    "typecheck": "tsgo --noEmit",
    "build": "tsc"
  }
}
```

Keep `tsc` for the build (it emits JS). Use `tsgo` for the fast feedback loop during development.

## 5. Minor Issues

- **No `default export`** — the current code uses `export { API_URL, PORT, SECRET }` which is fine (named exports). Keep this pattern.
- **`type` vs `interface`** — the `User` type is correctly declared with `type` since it is not being extended. Keep using `type` by default; reserve `interface` for when you need declaration merging or measurable compiler performance gains on large object hierarchies.

## Summary of Changes

| Before | After | Why |
|--------|-------|-----|
| `process.env.X!` / `as string` | `@t3-oss/env-core` + Zod | Fail at startup, not on first access |
| Manual axios + hand-written types | `openapi-fetch` + generated types | Single source of truth from OpenAPI spec |
| `type UserId = string` | `z.string().uuid().brand<"UserId">()` | Compile-time distinction between ID types |
| `tsc --noEmit` | `tsgo --noEmit` | Faster type-checking feedback loop |
