```typescript
// types.ts
export const Status = { Active: 'active', Inactive: 'inactive' } as const satisfies Record<string, string>;
export type StatusValue = typeof Status[keyof typeof Status];

export type User = {
  id: string;
  name: string;
  status: StatusValue;
};
```

```typescript
// db.ts
export interface DatabaseConnection {
  beginTransaction(): Promise<void>;
  query(sql: string): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}
```

```typescript
// config.ts
import { readFileSync } from 'fs';

export type AppConfig = {
  apiUrl: string;
};

function loadConfig(): AppConfig {
  const raw = readFileSync('./config.json', 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed === 'object' && parsed !== null && 'apiUrl' in parsed && typeof parsed.apiUrl === 'string') {
    return { apiUrl: parsed.apiUrl };
  }
  throw new Error('Invalid config: missing apiUrl');
}

export const config = loadConfig();
```

```typescript
// result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

```typescript
// user-service.ts
import { User, Status, StatusValue } from './types';
import { DatabaseConnection } from './db';
import { config } from './config';
import { Result, ok, err } from './result';

export type UpdateUserInput = {
  name?: string;
  status?: StatusValue;
};

export type GetUserError = 'not-found' | 'parse-error' | 'network-error';
export type UpdateUserError = 'update-failed' | 'network-error';

export class UserService {
  async getUser(id: string): Promise<Result<User, GetUserError>> {
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) return err('not-found');
      
      const text = await res.text();
      const data: unknown = JSON.parse(text);
      
      if (!isUser(data)) return err('parse-error');
      return ok(data);
    } catch (e) {
      throw new Error('Failed to fetch user', { cause: e });
    }
  }

  async updateUser(id: string, updates: UpdateUserInput): Promise<Result<void, UpdateUserError>> {
    try {
      const res = await fetch(`${config.apiUrl}/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.ok) return err('update-failed');
      return ok(undefined);
    } catch (e) {
      throw new Error('Failed to update user', { cause: e });
    }
  }

  processUsers(users: readonly User[]): Array<{ id: string; name: string; status: StatusValue; displayName: string }> {
    return users
      .filter(u => u.status === Status.Active)
      .map(u => ({
        id: u.id,
        name: u.name,
        status: u.status,
        displayName: u.name.toUpperCase(),
      }));
  }

  async cleanup(connection: DatabaseConnection): Promise<void> {
    using = connection as unknown as AsyncDisposable;
    await connection.beginTransaction();
    try {
      await connection.query('DELETE FROM temp_users');
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw new Error('Cleanup failed', { cause: e });
    }
  }
}

/**
 * Type guard for User objects.
 * 
 * @example
 * const data = JSON.parse(json);
 * if (isUser(data)) { console.log(data.id); }
 * // => logs user id
 */
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as Record<string, unknown>).id === 'string' &&
    'name' in data &&
    typeof (data as Record<string, unknown>).name === 'string' &&
    'status' in data &&
    ((data as Record<string, unknown>).status === Status.Active || (data as Record<string, unknown>).status === Status.Inactive)
  );
}
```
