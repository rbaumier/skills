# Refactored TypeScript Module

## Issues Fixed

| # | Issue | Rule violated |
|---|-------|---------------|
| 1 | Barrel file `index.ts` | No barrel files -- import from source directly |
| 2 | `enum Status` | No enum -- use `as const` + `typeof` |
| 3 | `export default class` | No default export -- named exports only |
| 4 | `any` in `processUsers` | No `any` -- use proper types |
| 5 | `as UserType` cast on response | No `as` -- validate with type guard |
| 6 | `throw` for expected failures (`getUser`, `updateUser`) | Errors are values -- return Result `{ ok, error }` |
| 7 | `require('./config.json')` | ESM only -- never mix CJS imports |
| 8 | `import from './index'` | Circular dep via barrel -- import from source |
| 9 | `try/finally` for DB cleanup | Use `using`/`await using` (TS 5.2+) |
| 10 | JSDoc with `@description`, `@param`, `@returns` | Plain block + `@example` only |
| 11 | `Status` import conflict in types.ts | Dead import of non-existent `./status` |
| 12 | Inline object type in `updateUser` | Declare param types as named types above the function |
| 13 | `interface UserType` | Types by default -- `interface` only for extension/perf |
| 14 | `process.env.API_URL` accessed inline | Use `@t3-oss/env-core` + Zod -- fail loud at startup |

## Refactored Code

### `env.ts`

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

### `types.ts`

```typescript
export const Status = {
  Active: "active",
  Inactive: "inactive",
} as const;

export type Status = (typeof Status)[keyof typeof Status];

export type User = {
  id: string;
  name: string;
  status: Status;
};

export type UserUpdates = {
  name?: string;
  status?: Status;
};

/**
 * Processed user with a computed display name.
 */
export type ProcessedUser = User & {
  displayName: string;
};
```

### `user-schema.ts`

```typescript
import { z } from "zod";
import { Status } from "./types";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum([Status.Active, Status.Inactive]),
});
```

### `user-service.ts`

```typescript
import { ok, err, type Result } from "better-result";
import { env } from "./env";
import { Status } from "./types";
import type { User, UserUpdates, ProcessedUser } from "./types";
import { UserSchema } from "./user-schema";
import type { DatabaseConnection } from "./db";

/**
 * Fetch a single user by ID.
 *
 * @example
 * const result = await getUser("u_123");
 * // => { ok: true, value: { id: "u_123", name: "Alice", status: "active" } }
 */
export async function getUser(
  id: string,
): Promise<Result<User, "not-found" | "parse-error">> {
  const res = await fetch(`${env.API_URL}/api/users/${id}`);
  if (!res.ok) return err("not-found");

  const data: unknown = await res.json();
  const parsed = UserSchema.safeParse(data);
  if (!parsed.success) return err("parse-error");

  return ok(parsed.data);
}

/**
 * Update a user's name or status.
 *
 * @example
 * const result = await updateUser("u_123", { name: "Bob" });
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
export function processActiveUsers(users: readonly User[]): ProcessedUser[] {
  return users
    .filter((user) => user.status === Status.Active)
    .map((user) => ({
      ...user,
      displayName: user.name.toUpperCase(),
    }));
}

/**
 * Delete temporary users inside a transaction.
 * Uses `await using` for deterministic connection release.
 *
 * @example
 * await cleanupTempUsers(connection);
 * // => { ok: true, value: undefined }
 */
export async function cleanupTempUsers(
  connection: DatabaseConnection,
): Promise<Result<void, "cleanup-failed">> {
  await using conn = connection;

  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM temp_users");
    await conn.commit();
    return ok(undefined);
  } catch {
    await conn.rollback();
    return err("cleanup-failed");
  }
}
```

### Deleted

- **`index.ts`** -- barrel file removed. All consumers import from `./types`, `./user-service`, etc. directly.
