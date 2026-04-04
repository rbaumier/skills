# Refactored TypeScript Module

## Issues found and fixed

| # | Issue | Rule violated |
|---|-------|---------------|
| 1 | `enum Status` | No `enum` — use `as const` + `typeof` |
| 2 | `export default class` | No `default export` — named exports only |
| 3 | `processUsers(users: any[]): any` | No `any` — use proper types |
| 4 | `throw new Error(...)` for expected failures | Errors are values — return `Result` |
| 5 | `index.ts` barrel file | No barrel files — import from source directly |
| 6 | `require('./config.json')` | ESM only — no CJS imports |
| 7 | `JSON.parse(await res.text()) as UserType` | No `as` cast — validate with type guard |
| 8 | `process.env.API_URL` inline | Use `@t3-oss/env-core` + Zod for env validation |
| 9 | JSDoc uses `@description`, `@param`, `@returns` | Plain block + `@example` only — types are the docs |
| 10 | `try/finally` for resource cleanup | Use `await using` (TS 5.2+) |
| 11 | Inline object param `{ name?: string, status?: Status }` | Declare param types as named types above the function |
| 12 | `Status` imported from `./status` AND defined in same file | Circular / dead import |
| 13 | `UserService` imports from `./index` (barrel) | Circular dep risk — import from source |
| 14 | Swallowed error in `catch (e)` | Silent failure hides bugs |

---

## Refactored code

### `types.ts`

```typescript
import { ok, err, type Result } from "better-result";

// -- Status ------------------------------------------------------------------

/** All valid user statuses. */
const STATUS = {
  Active: "active",
  Inactive: "inactive",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS];

// -- User --------------------------------------------------------------------

type User = {
  id: string;
  name: string;
  status: Status;
};

// -- UserUpdate --------------------------------------------------------------

type UserUpdate = {
  name?: string;
  status?: Status;
};

// -- Type guard --------------------------------------------------------------

function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.status === "string" &&
    Object.values(STATUS).includes(obj.status as Status)
  );
}

// -- Processed user ----------------------------------------------------------

type ProcessedUser = User & {
  displayName: string;
};

export { STATUS, isUser };
export type { Status, User, UserUpdate, ProcessedUser };
```

### `env.ts`

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Validated environment — fails loud at startup, not on first access.
 *
 * @example
 * env.API_URL; // => "https://api.example.com"
 */
const env = createEnv({
  server: {
    API_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});

export { env };
```

### `user-service.ts`

```typescript
import { ok, err, type Result } from "better-result";
import { env } from "./env";
import { STATUS, isUser } from "./types";
import type { User, UserUpdate, ProcessedUser } from "./types";
import type { DatabaseConnection } from "./db";

type GetUserError = "not-found" | "parse-error";
type UpdateUserError = "update-failed";

/**
 * Service for managing users.
 *
 * @example
 * const service = new UserService();
 * const result = await service.getUser("abc-123");
 * // => { ok: true, value: { id: "abc-123", name: "Alice", status: "active" } }
 */
class UserService {
  /** Fetch a single user by ID. */
  async getUser(id: string): Promise<Result<User, GetUserError>> {
    const res = await fetch(`${env.API_URL}/api/users/${id}`);
    if (!res.ok) return err("not-found");

    const data: unknown = await res.json();
    if (!isUser(data)) return err("parse-error");

    return ok(data);
  }

  /** Persist partial updates for a user. */
  async updateUser(
    id: string,
    updates: UserUpdate,
  ): Promise<Result<void, UpdateUserError>> {
    const res = await fetch(`${env.API_URL}/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!res.ok) return err("update-failed");
    return ok(undefined);
  }

  /** Keep only active users and attach a display name. */
  processUsers(users: ReadonlyArray<User>): ProcessedUser[] {
    return users
      .filter((u) => u.status === STATUS.Active)
      .map((u) => ({
        ...u,
        displayName: u.name.toUpperCase(),
      }));
  }

  /** Purge temporary users inside a transaction. */
  async cleanup(connection: DatabaseConnection): Promise<void> {
    // `await using` ensures deterministic release even on throw (TS 5.2+)
    await using _conn = {
      [Symbol.asyncDispose]: async () => {
        connection.release();
      },
    };

    await connection.beginTransaction();
    try {
      await connection.query("DELETE FROM temp_users");
      await connection.commit();
    } catch (e: unknown) {
      await connection.rollback();
      // Re-throw so callers know cleanup failed — silent swallow hides bugs
      throw e;
    }
    // connection.release() called automatically via Symbol.asyncDispose
  }
}

export { UserService };
```

### Deleted: `index.ts` (barrel file)

The barrel file is removed entirely. All consumers import directly from `types.ts` and `user-service.ts`.
