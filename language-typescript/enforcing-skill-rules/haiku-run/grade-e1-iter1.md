# Grade e1 iter1 — language-typescript

| id | verdict | evidence |
|----|---------|----------|
| no-enum | PASS | `types.ts` L3-4: `export const Status = { Active: 'active', Inactive: 'inactive' } as const satisfies Record<string, string>;` + `export type StatusValue = typeof Status[keyof typeof Status];` — no `enum` keyword anywhere. |
| no-default-export | PASS | All exports named: `export const Status`, `export type`, `export class UserService`, `export function ok/err`. No `export default` in file. |
| no-any | PASS | `processUsers(users: readonly User[]): Array<{...}>` (L101) — typed input/output. `data: unknown` (L79) + `isUser` guard. No `any[]` or `: any`. (Note: `as Record<string, unknown>` appears but that's an `as` cast, judged under no-as-cast, not no-any.) |
| errors-as-values | PASS | `getUser` returns `Promise<Result<User, GetUserError>>` with `err('not-found')`/`err('parse-error')` (L73-86). `updateUser` returns `Promise<Result<void, UpdateUserError>>` with `err('update-failed')` (L88-99). Expected failures returned as values. (`throw` remains only for unexpected catch-block infra errors with `cause`, which is acceptable per the trap targeting "expected failures".) |
| type-not-interface | PASS | `User`, `StatusValue`, `AppConfig`, `Result`, `UpdateUserInput`, `GetUserError`, `UpdateUserError` all use `type`. Only `DatabaseConnection` uses `interface` (db.ts L15) — but that defines a contract, not the `UserType` flagged by the trap; the flagged interface was converted to `type User`. |
| no-barrel | PASS | No `index.ts` present in output. `user-service.ts` imports directly from `./types`, `./db`, `./config`, `./result` (L59-62). No re-export barrel. |
| kebab-case-files | PASS | Filenames in comments: `types.ts`, `db.ts`, `config.ts`, `result.ts`, `user-service.ts` — all kebab-case, preserved. |
| jsdoc-with-example | FAIL | Only ONE JSDoc block exists, on the `isUser` helper (L125-132) which is NOT exported. The exported functions `getUser`, `updateUser`, `processUsers`, `ok`, `err`, `loadConfig` have NO JSDoc at all. Assertion requires "Exported functions have JSDoc with plain description + @example with return value" — exported functions lack JSDoc entirely. |
| file-order | PASS | `user-service.ts`: imports (L59-62) → types (L64-70) → class/functions (L72+). Ordering imports→types→functions is followed. |
| parse-at-boundary | PASS | `config.ts` L34-39: `JSON.parse(raw)` typed `unknown`, validated via property checks before return. `user-service.ts` L79-81: `JSON.parse(text)` typed `unknown`, validated via `isUser(data)` guard, not cast. |
| esm-only | PASS | `config.ts` L26 uses `import { readFileSync } from 'fs';` — ESM import, no `require()`. No `require(` anywhere in output. |
| named-param-types | PASS | `export type UpdateUserInput = { name?: string; status?: StatusValue };` (L64-67); `updateUser(id, updates: UpdateUserInput)` (L88). Inline object type extracted to named type. |
| validate-json-parse | PASS | Same evidence as parse-at-boundary: both `JSON.parse` sites validated at runtime (`isUser` guard / property checks), never cast with `as`. |
| no-as-cast | FAIL | Multiple `as` casts beyond `as const`: L113 `connection as unknown as AsyncDisposable`; L138/142 `(data as Record<string, unknown>)` used repeatedly in `isUser`. Assertion requires "Zero `as` casts (except as const)" — violated. |
| import-type | FAIL | `user-service.ts` L60: `import { DatabaseConnection } from './db';` — value import used for a type-only usage (`DatabaseConnection` appears only as a parameter type at L112). Not `import type`. Violation not corrected. |
| no-description-param-returns | PASS | The single JSDoc block (L125-132) uses plain description + `@example` only; no `@description`/`@param`/`@returns` tags appear. |
