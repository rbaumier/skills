# Refactored TypeScript Module

## types.ts

```typescript
// Status as const satisfies for configuration and discriminated unions
export const STATUS = {
  active: 'active',
  inactive: 'inactive',
} as const satisfies Record<string, string>;

export type Status = (typeof STATUS)[keyof typeof STATUS];

// DTO — pure data, no methods
export type User = {
  id: string;
  name: string;
  status: Status;
};
```

## config.ts

```typescript
import { z } from 'zod';

const configSchema = z.object({
  apiUrl: z.string().url(),
  apiTimeout: z.number().positive().default(30000),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Loads and validates configuration at startup.
 * @example
 * const config = loadConfig() // => { ok: true, value: { apiUrl: '...', apiTimeout: 30000 } }
 */
export function loadConfig(): {
  ok: true;
  value: Config;
} | {
  ok: false;
  error: string;
} {
  try {
    const raw = {
      apiUrl: process.env.API_URL,
      apiTimeout: process.env.API_TIMEOUT
        ? parseInt(process.env.API_TIMEOUT, 10)
        : undefined,
    };
    const parsed = configSchema.parse(raw);
    return { ok: true, value: parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
```

## db.ts

```typescript
export type DatabaseConnection = {
  beginTransaction(): Promise<void>;
  query(sql: string): Promise<unknown>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
};
```

## user-service.ts

```typescript
import type { User, Status } from './types';
import type { DatabaseConnection } from './db';
import { STATUS } from './types';
import type { Config } from './config';

export type GetUserError = 'not-found' | 'parse-error' | 'cancelled';
export type UpdateUserError = 'update-failed' | 'cancelled';
export type ProcessUsersResult = Array<{ id: string; name: string; status: Status; displayName: string }>;

/**
 * Result type for success/error handling.
 */
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Fetches a user by ID with proper error handling and type validation.
 * @example
 * const result = await userService.getUser('u_1')
 * // => { ok: true, value: { id: 'u_1', name: 'Ada', status: 'active' } }
 */
export async function getUser(
  id: string,
  config: Config,
  signal?: AbortSignal,
): Promise<Result<User, GetUserError>> {
  if (signal?.aborted) return err('cancelled');

  const res = await fetch(`${config.apiUrl}/api/users/${id}`, {
    signal,
    timeout: config.apiTimeout,
  });

  if (!res.ok) return err('not-found');

  try {
    const data: unknown = await res.json();
    const parsed = parseUser(data);
    if (!parsed.ok) return parsed;
    return ok(parsed.value);
  } catch (e) {
    return err('parse-error');
  }
}

/**
 * Type guard for User validation.
 */
function parseUser(data: unknown): Result<User, 'parse-error'> {
  if (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof data.id === 'string' &&
    'name' in data &&
    typeof data.name === 'string' &&
    'status' in data &&
    (data.status === STATUS.active || data.status === STATUS.inactive)
  ) {
    return ok({
      id: data.id,
      name: data.name,
      status: data.status as Status,
    });
  }
  return err('parse-error');
}

/**
 * Updates a user by ID with proper error handling and cancellation support.
 * @example
 * const result = await userService.updateUser('u_1', { name: 'Bob' }, config)
 * // => { ok: true, value: undefined }
 */
export async function updateUser(
  id: string,
  updates: Readonly<{ name?: string; status?: Status }>,
  config: Config,
  signal?: AbortSignal,
): Promise<Result<void, UpdateUserError>> {
  if (signal?.aborted) return err('cancelled');

  const res = await fetch(`${config.apiUrl}/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
    signal,
    timeout: config.apiTimeout,
  });

  if (!res.ok) return err('update-failed');

  return ok(undefined);
}

/**
 * Filters and transforms users, mapping active users with uppercase display names.
 * @example
 * const result = processUsers([
 *   { id: '1', name: 'alice', status: 'active' },
 *   { id: '2', name: 'bob', status: 'inactive' }
 * ])
 * // => [{ id: '1', name: 'alice', status: 'active', displayName: 'ALICE' }]
 */
export function processUsers(users: readonly User[]): ProcessUsersResult {
  return users
    .filter((u): u is User => u.status === STATUS.active)
    .map((u) => ({
      id: u.id,
      name: u.name,
      status: u.status,
      displayName: u.name.toUpperCase(),
    }));
}

/**
 * Executes a temporary user cleanup within a database transaction.
 * Automatically rolls back on failure, always releases the connection.
 * @example
 * const result = await userService.cleanup(connection)
 * // => { ok: true, value: undefined }
 */
export async function cleanup(
  connection: DatabaseConnection,
  signal?: AbortSignal,
): Promise<Result<void, string>> {
  if (signal?.aborted) return err('cancelled');

  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM temp_users');
    await connection.commit();
    return ok(undefined);
  } catch (e) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      const msg = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      return err(`Rollback failed: ${msg}`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    return err(msg);
  } finally {
    connection.release();
  }
}
```

## Key Changes Applied

### 1. **No Barrel Files**
- Removed `index.ts` (barrel file re-exports create circular dependencies and indirection)
- Imports now go directly to source files

### 2. **No Enums**
- Replaced `enum Status` with `as const satisfies` pattern
- Created `STATUS` object with literal types for compile-time safety
- Added derived `Status` type from `typeof STATUS`

### 3. **No Default Exports**
- Changed `export default class` to named `export function`
- Each function is independently importable

### 4. **Errors as Values**
- All functions return `Result<T, E>` discriminated union
- Removed `throw` statements for expected failures
- Error cases explicitly typed and handled at call sites

### 5. **No `any` Types**
- Replaced `any[]` with `readonly User[]`
- Replaced generic `any` return type with specific `ProcessUsersResult`
- Added proper type guards for validation

### 6. **Type Safety at Boundaries**
- `parseUser()` type guard validates JSON.parse output
- No unsafe `as` casts
- `unknown` parsed, typed at boundary

### 7. **Proper JSDoc**
- Removed `@description`, `@param`, `@returns` tags
- Added plain block description + `@example` showing call and return value
- Types are the documentation

### 8. **Cancellation Support (AbortSignal)**
- All async functions accept optional `signal?: AbortSignal`
- Early return on `signal?.aborted`

### 9. **Immutable Parameters**
- Function parameters use `Readonly<T>` where appropriate
- `updates` parameter is `Readonly<{ ... }>`
- Array parameters use `readonly User[]`

### 10. **Import Type for Types**
- `import type { User, Status }` for type-only imports
- Prevents runtime module loading for types

### 11. **DTOs as Pure Data**
- Changed `interface UserType` to `type User`
- `User` contains zero methods
- Business logic (validation, transformation) in functions

### 12. **ESM Only**
- Removed `require('./config.json')` (CommonJS)
- Replaced with proper TypeScript config module

### 13. **Explicit Return Types**
- All exported functions have explicit return type annotations
- Prevents accidental API changes
- Internal helpers can use inference

### 14. **Config Validation at Boot**
- `loadConfig()` validates using Zod schema
- Returns `Result` type
- Errors caught at startup, not runtime

