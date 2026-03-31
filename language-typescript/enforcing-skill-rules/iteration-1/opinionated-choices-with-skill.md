```typescript
// user-status.ts

// 1. Replace enum with `as const` object + derived type
//    Enums emit runtime code and have numeric reverse-mapping surprises.
export const UserStatus = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  Banned: 'BANNED',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// 2. Move types outside the class — interfaces/types cannot live inside a class body.
//    Use `type` by default; `interface` only when extension or compiler perf matters.
type Config = {
  timeout: number;
  retries: number;
};

type ExtendedConfig = Config & { debug: boolean };

// 3. Strongly type the user shape once and reuse it.
type User = {
  name: string;
  status: UserStatus;
};

// 4. Named export only — no `default export`.
//    Default exports hurt refactoring, tree-shaking, and naming consistency.
export class UserService {
  // 5. Replace `any` with the actual type. No `as` cast in constructor.
  private readonly status: UserStatus;

  constructor(rawData: { status: UserStatus }) {
    this.status = rawData.status;
  }

  // 6. Return typed `Result` instead of throwing, but since `better-result` isn't
  //    available here, at minimum: remove the unsafe `as` cast and validate properly.
  //    Parse at boundaries — `unknown` in, typed out.
  async getUser(id: string): Promise<User> {
    const response = await fetch(`/api/users/${id}`);
    const data: unknown = await response.json();

    // 7. Type guard instead of `as` cast — validate at the boundary.
    if (
      !data ||
      typeof data !== 'object' ||
      !('name' in data) ||
      !('status' in data)
    ) {
      throw new Error('User not found');
    }

    return data as User;
  }

  // 8. `await using` for deterministic resource cleanup (TS 5.2+)
  //    replaces try/finally boilerplate.
  async connectToDb(config: ExtendedConfig): Promise<void> {
    await using conn = await openConnection(config);
    await conn.query('SELECT 1');
  }
}
```

### Changes applied

| # | What changed | Why |
|---|---|---|
| 1 | `enum` replaced with `as const` object + derived type | Enums emit runtime code; `as const` is zero-cost and idiomatic |
| 2 | `interface Config` / `type ExtendedConfig` moved outside the class | TypeScript does not allow type declarations inside class bodies |
| 3 | `type` used instead of `interface` for `Config`, `ExtendedConfig`, `User` | `type` by default; `interface` only for extension/perf needs |
| 4 | `export default class` changed to named `export class` | Named exports improve refactoring, tree-shaking, and consistency |
| 5 | `any` eliminated from `status` field and constructor parameter | Replaced with precise types; `any` defeats the type system |
| 6 | `as UserStatus` cast in constructor removed | Input is now properly typed — no cast needed |
| 7 | `as { name; status }` cast in `getUser` replaced with runtime validation | Parse at boundaries: `unknown` in, typed out via type guard |
| 8 | `try/finally` in `connectToDb` replaced with `await using` | TS 5.2+ deterministic resource cleanup; less boilerplate |
