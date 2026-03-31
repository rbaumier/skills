# TypeScript Project Review

## 1. `env.ts` — Unsafe Environment Parsing

**Problems:**
- `process.env.API_URL!` — non-null assertion silently produces `undefined` at runtime if the var is missing.
- `process.env.SECRET as string` — same issue, type-cast hides a potential `undefined`.
- No validation at startup. Failures surface late, deep in business logic.

**Fix: Validate eagerly at startup with a schema.**

```typescript
// env.ts
import { z } from 'zod';

const envSchema = z.object({
  API_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

This fails fast with a clear error message on startup instead of producing silent `undefined` bugs at runtime.

---

## 2. `api-client.ts` — Branded Types and Code Generation

### 2a. `UserId` is just an alias, not a distinct type

`type UserId = string` offers zero type-safety — any `string` is assignable to it. Use a branded type to make it structurally incompatible with plain strings:

```typescript
type UserId = string & { readonly __brand: unique symbol };

// Factory function — single entry point for creating UserIds
function UserId(id: string): UserId {
  return id as UserId;
}
```

Now `fetchUser("raw-string")` is a compile error; callers must go through `UserId()`.

### 2b. Hand-written API types drift from the OpenAPI spec

Since the project has an `openapi.yaml`, generate the types and client instead of maintaining them by hand.

**Add `openapi-typescript` for types:**

```bash
npm install -D openapi-typescript
```

```json
{
  "scripts": {
    "generate:api": "openapi-typescript ./openapi.yaml -o ./src/api-types.gen.ts",
    "typecheck": "npm run generate:api && tsc --noEmit",
    "build": "npm run generate:api && tsc"
  }
}
```

Then consume the generated types:

```typescript
// api-client.ts
import type { paths } from './api-types.gen';
import axios from 'axios';

type User = paths['/api/users/{id}']['get']['responses']['200']['content']['application/json'];

async function fetchUser(id: UserId): Promise<User> {
  const { data } = await axios.get<User>(`/api/users/${id}`);
  return data;
}
```

Types now stay in sync with the spec automatically. No manual drift.

### 2c. Consider `openapi-fetch` to replace raw axios

For even tighter spec alignment, replace hand-built URLs with a type-safe client:

```typescript
import createClient from 'openapi-fetch';
import type { paths } from './api-types.gen';

const client = createClient<paths>({ baseUrl: env.API_URL });

async function fetchUser(id: UserId) {
  const { data, error } = await client.GET('/api/users/{id}', {
    params: { path: { id } },
  });
  if (error) throw error;
  return data; // fully typed from the spec, no manual annotation
}
```

Path typos and wrong parameter shapes become compile errors.

---

## 3. `package.json` — Missing Scripts

**Add lint, codegen, and dev scripts.** The current setup has no linting, no pre-build codegen step, and no way to run in dev mode.

```json
{
  "scripts": {
    "generate:api": "openapi-typescript ./openapi.yaml -o ./src/api-types.gen.ts",
    "typecheck": "npm run generate:api && tsc --noEmit",
    "build": "npm run generate:api && tsc",
    "lint": "eslint . --ext .ts",
    "dev": "tsx watch src/index.ts"
  }
}
```

Also add a `"prebuild"` or CI step that runs `typecheck` before `build` to catch errors early.

---

## 4. `tsconfig.json` — Recommended Strictness

Not shown, but ensure these are enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

`noUncheckedIndexedAccess` alone would have caught the `process.env` issues since `process.env[key]` returns `string | undefined`.

---

## Summary of Changes

| Area | Problem | Fix |
|---|---|---|
| `env.ts` | Silent `undefined` at runtime | Zod schema, fail-fast at startup |
| `UserId` | Alias offers no safety | Branded type |
| `User` type | Manual, drifts from spec | Generate from `openapi.yaml` |
| API client | Hand-built URLs, no validation | `openapi-fetch` type-safe client |
| Scripts | No codegen, no lint | Add `generate:api`, `lint`, `dev` |
| `tsconfig` | Unknown strictness | Enable `strict` + `noUncheckedIndexedAccess` |
