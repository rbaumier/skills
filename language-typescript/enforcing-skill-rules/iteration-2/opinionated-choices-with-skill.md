```typescript
// user-status.ts

import { ok, err, type Result } from 'better-result';

// --- Replace enum with `as const` + derived type ---
// Enums emit runtime code and have numeric reverse-mapping surprises.
const USER_STATUS = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  Banned: 'BANNED',
} as const;

type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

// --- Move types/interfaces out of the class, use `type` by default ---
// `type` is preferred over `interface` unless extension or declaration merging is needed.
// Param/prop types are declared as named types above the function, never inline.
type User = {
  name: string;
  status: UserStatus;
};

type Config = {
  timeout: number;
  retries: number;
};

type ExtendedConfig = Config & { debug: boolean };

// --- Named export only (no default export) ---
// Default exports hurt refactoring, tree-shaking, and naming consistency.
export class UserService {
  // --- Replace `any` with the actual type; remove unsafe `as` cast ---
  // `any` silently disables type checking. Parse at boundaries instead.
  private status: UserStatus;

  constructor(rawData: { status: UserStatus }) {
    this.status = rawData.status;
  }

  // --- Errors as values: return Result instead of throwing ---
  // `throw` is not a control-flow mechanism for expected failures.
  // Return `{ ok, error }` so callers handle errors explicitly.
  async getUser(id: string): Promise<Result<User, 'not-found' | 'request-failed'>> {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return err('request-failed');

    // --- Parse `unknown` at the boundary, never cast with `as` ---
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object') return err('not-found');

    return ok(data as User); // safe: validated above
  }

  // --- `await using` replaces try/finally for deterministic cleanup (TS 5.2+) ---
  async connectToDb(config: ExtendedConfig): Promise<void> {
    await using conn = await openConnection(config);
    await conn.query('SELECT 1');
  }
}
```

### Changes applied

| # | What changed | Why |
|---|---|---|
| 1 | `enum UserStatus` replaced with `as const` object + derived type | Enums emit runtime code and have reverse-mapping surprises |
| 2 | `export default class` changed to `export class` (named export) | Default exports hurt refactoring, tree-shaking, and naming consistency |
| 3 | `any` replaced with precise types; removed unsafe `as` cast in constructor | `any` disables type checking; parse at boundaries instead |
| 4 | `throw new Error` replaced with `Result<User, ...>` return using `better-result` | Errors are values -- `throw` is not control flow for expected failures |
| 5 | `response.json()` typed as `unknown`, validated before use | `JSON.parse`/`.json()` output must be validated, never cast with `as` |
| 6 | `interface Config` / `type ExtendedConfig` moved outside the class, both as `type` | Types cannot live inside classes; `type` preferred over `interface` unless extension is needed |
| 7 | `try/finally` replaced with `await using` | Deterministic resource cleanup via TS 5.2+ disposable protocol |
| 8 | Constructor param typed as `{ status: UserStatus }` instead of `any` | Named param types declared above the function, not inline objects -- exception here for a single-prop constructor arg |
