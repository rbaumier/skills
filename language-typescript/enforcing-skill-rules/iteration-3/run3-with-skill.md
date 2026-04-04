# Refactored TypeScript Module

## Issues Found & Fixed

| # | Issue | Rule Violated |
|---|-------|---------------|
| 1 | `index.ts` is a barrel file (re-exports only) | No barrel files |
| 2 | `enum Status` | No `enum` — use `as const` + `typeof` |
| 3 | `default export` on `UserService` | Named exports only |
| 4 | `require('./config.json')` — CJS in ESM | ESM only |
| 5 | `any[]` / `any` return in `processUsers` | No `any` — use `unknown`, type guards, proper types |
| 6 | `throw new Error(...)` for expected failures | Errors are values — return `Result` |
| 7 | `as UserType` cast on `JSON.parse` | Validate `JSON.parse` with type guards, never cast |
| 8 | `try/finally` for resource cleanup | Use `await using` (TS 5.2+) |
| 9 | JSDoc uses `@description`, `@param`, `@returns` | Plain block + `@example` only — types are the docs |
| 10 | Inline object param `{ name?: string, status?: Status }` | Declare param types as named types above function |
| 11 | `process.env.API_URL` read at call-time, no validation | Use `@t3-oss/env-core` + Zod, fail at startup |
| 12 | Circular import: `user-service.ts` imports from `./index` | Import from source directly |
| 13 | `Status` imported from `./status` AND declared in same file | Duplicate/conflicting import+declaration |
| 14 | Unused import `DatabaseConnection` from `./db` | Cleanup moves to `await using` pattern |
| 15 | `interface UserType` | Types by default (use `type`, not `interface`) |

---

## Refactored Code

### `types.ts`

```typescript
/**
 * User account status.
 *
 * @example
 * const s: Status = "active"; // => "active"
 */
export const STATUS = {
  Active: "active",
  Inactive: "inactive",
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

type UserUpdates = {
  name?: string;
  status?: Status;
};

type User = {
  id: string;
  name: string;
  status: Status;
};

/**
 * Processed user with computed display name.
 *
 * @example
 * const u: ProcessedUser = { id: "1", name: "alice", status: "active", displayName: "ALICE" };
 */
type ProcessedUser = User & {
  displayName: string;
};

export type { User, UserUpdates, ProcessedUser };
```

### `env.ts`

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Validated environment — fails at startup if API_URL is missing.
 *
 * @example
 * env.API_URL; // => "https://api.example.com"
 */
export const env = createEnv({
  server: {
    API_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

### `user-schema.ts`

```typescript
import { z } from "zod";
import { STATUS } from "./types";

/**
 * Zod schema for validating raw user data from the API.
 *
 * @example
 * UserSchema.parse({ id: "1", name: "Alice", status: "active" });
 * // => { id: "1", name: "Alice", status: "active" }
 */
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum([STATUS.Active, STATUS.Inactive]),
});
```

### `user-service.ts`

```typescript
import { ok, err } from "better-result";
import type { Result } from "better-result";
import type { User, UserUpdates, ProcessedUser } from "./types";
import { STATUS } from "./types";
import { env } from "./env";
import { UserSchema } from "./user-schema";

/**
 * Fetch a user by ID.
 *
 * @example
 * const result = await getUser("123");
 * // => { ok: true, value: { id: "123", name: "Alice", status: "active" } }
 */
export async function getUser(
  id: string,
): Promise<Result<User, "not-found" | "parse-error">> {
  const res = await fetch(`${env.API_URL}/api/users/${id}`);
  if (!res.ok) return err("not-found");

  const raw: unknown = await res.json();
  const parsed = UserSchema.safeParse(raw);
  if (!parsed.success) return err("parse-error");

  return ok(parsed.data);
}

/**
 * Update a user's fields.
 *
 * @example
 * const result = await updateUser("123", { name: "Bob" });
 * // => { ok: true, value: undefined }
 */
export async function updateUser(
  id: string,
  updates: UserUpdates,
): Promise<Result<void, "update-failed">> {
  const res = await fetch(`${env.API_URL}/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return err("update-failed");

  return ok(undefined);
}

/**
 * Filter active users and compute display names.
 *
 * @example
 * processActiveUsers([{ id: "1", name: "alice", status: "active" }]);
 * // => [{ id: "1", name: "alice", status: "active", displayName: "ALICE" }]
 */
export function processActiveUsers(users: ReadonlyArray<User>): ProcessedUser[] {
  return users
    .filter((u) => u.status === STATUS.Active)
    .map((u) => ({
      ...u,
      displayName: u.name.toUpperCase(),
    }));
}

/**
 * Delete temporary users inside a transaction with deterministic cleanup.
 *
 * @example
 * await cleanupTempUsers(connectionPool);
 */
export async function cleanupTempUsers(
  pool: DatabasePool,
): Promise<Result<void, "cleanup-failed">> {
  await using connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    await connection.query("DELETE FROM temp_users");
    await connection.commit();
    return ok(undefined);
  } catch {
    await connection.rollback();
    return err("cleanup-failed");
  }
}
```

### `db.ts` (type definition for `await using` support)

```typescript
/**
 * A database connection that supports deterministic disposal via `await using`.
 */
export type DatabaseConnection = {
  beginTransaction(): Promise<void>;
  query(sql: string): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

/**
 * Connection pool that hands out disposable connections.
 */
export type DatabasePool = {
  getConnection(): Promise<DatabaseConnection>;
};
```

---

## Summary of Changes

1. **Deleted `index.ts`** — barrel file removed; all imports go to source modules directly.
2. **`enum Status`** replaced with `as const` object + derived union type.
3. **`default export class`** replaced with named standalone functions (no class needed — stateless).
4. **`any`** replaced with `User[]` input and `ProcessedUser[]` return.
5. **`throw`** replaced with `Result<T, E>` returns via `better-result` for all expected failures.
6. **`as UserType` cast** replaced with Zod schema validation (`UserSchema.safeParse`).
7. **`try/finally` + `connection.release()`** replaced with `await using` + `Symbol.asyncDispose`.
8. **`require('./config.json')`** removed — runtime config via `@t3-oss/env-core` + Zod.
9. **`process.env.API_URL`** moved to validated `env.ts` — fails at startup, not at call-time.
10. **JSDoc** cleaned: no `@description`/`@param`/`@returns`, plain block + `@example` with expected return.
11. **Inline param object** extracted to named `UserUpdates` type.
12. **`interface`** replaced with `type` (no extension needed).
13. **Missing `Content-Type` header** added to `updateUser` fetch call.
14. **Circular import** (`user-service.ts` -> `./index` -> `./user-service.ts`) eliminated.
