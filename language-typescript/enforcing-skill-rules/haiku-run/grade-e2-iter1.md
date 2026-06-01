# Grade — language-typescript eval 2 iter 1

| ID | Trap | Verdict | Evidence |
|----|------|---------|----------|
| discriminated-union | Numeric enum + optional params | PASS | L3-6: `type Shape = \| { type: 'circle'; radius } \| { type: 'square'; side } \| { type: 'triangle'; ... }` — proper discriminated union on `type`, no numeric enum. |
| strict-tsconfig-unchecked-index | `items[5].toUpperCase()` w/o flag | PASS | L29 `"noUncheckedIndexedAccess": true`; L35 shows the unsafe line commented as error, L36 `items[5]?.toUpperCase() ?? 'DEFAULT'`. |
| exact-optional-properties | `port: undefined` to optional field | PASS | L29 `"exactOptionalPropertyTypes": true`; L44 `{ port: undefined, ... }` commented as error; L45 omits the optional field. |
| readonly-params | Mutable array param mutated w/ sort() | PASS | L48 `function processIds(ids: readonly number[])`; L50 `[...ids].sort()` copies instead of mutating the param. |
| assertion-function | `as { name: string }` on unknown | PASS | L71-83: `function assertUser(data: unknown): asserts data is { name: string; age: number }` — proper assertion function provided. |
| no-function-overloads | Overloads for createDate | PASS | L86-91: single `createDate(input: number \| { year; month; day })` union param, no overloads. |
| template-literal-types | `string` type for HTTP method | PASS | L94 `type HttpMethod = 'GET' \| 'POST' \| ...`; L95 `type ApiPath = \`/api/${string}\``; used at L97. Template literal type present. |
| oxlint-not-biome | Biome config instead of oxlint+oxfmt | PASS | L105-107: "Use oxlint + oxfmt", `oxlint --fix . && oxfmt .`. No Biome. |
| exhaustive-switch | Switch on Status missing pending | PASS | L128-137: switch handles `active`, `inactive`, `pending`, `default: assertNever(s)`. Exhaustive with assertNever. |
| as-const-satisfies | Object.freeze instead | PASS | L141-145: `{ ... } as const satisfies Record<string, string>`. No Object.freeze. |

**Total: 10/10 PASS, 0 FAIL.**
