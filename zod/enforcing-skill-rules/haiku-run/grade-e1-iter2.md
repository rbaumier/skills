# Grade — out-e1-iter2.md

Strict grading. PASS only if the violation is clearly corrected in real code (with citation). Otherwise FAIL.

| # | id | verdict | evidence / reason |
|---|----|---------|-------------------|
| 1 | no-any-unknown | **FAIL** | The assertion requires `z.unknown()` not `z.any()` for the id field. The `id` field is `z.string().uuid()` (line 5), which is *neither* `z.any()` nor `z.unknown()`. While `z.any()` is correctly absent everywhere, the trap target (id) was not resolved with `z.unknown()` as the description prescribes. Strictly, the prescribed remedy (`z.unknown()`) does not appear in code. The only `unknown` is a TS type annotation `product: unknown` (line 60), not a Zod `z.unknown()` schema. Hesitation → FAIL. |
| 2 | string-validations | **PASS** | String fields carry validations at definition: `name: z.string().trim().min(1, ...)` (line 6), `email: z.string().email(...)` (line 7), `avatar: z.string().url(...)` (line 110), `bio: ...max(500)` (line 111). Email/min/url all applied. |
| 3 | enum-fixed-values | **PASS** | `role: z.enum(['admin', 'user', 'guest'], ...)` (line 9); also `theme`/`locale` and `settings.theme` use `z.enum`. Role is an enum, not a string. |
| 4 | coercion-form | **PASS** | Form/query conversion uses coercion: `age: z.coerce.number()` (line 8), `quantity: z.coerce.number()` (line 86), and `handleForm` consumes `Object.fromEntries(formData)` (line 32) into `userSchema` which coerces age. |
| 5 | safeParse | **PASS** | User input uses `safeParse`/`safeParseAsync`, no try/catch around parse: `userSchema.safeParseAsync(raw)` (line 33), `apiResponseSchema.safeParse(parsed)` (line 43), `usernameSchema.safeParseAsync(input)` (line 100). |
| 6 | handle-all-issues | **PASS** | All issues handled, not just first: `z.prettifyError(result.error)` (lines 37, 45, 103) formats the entire error tree (all issues), replacing `e.message`. |
| 7 | validate-boundaries | **PASS** | `JSON.parse` output is validated before use: `const parsed = JSON.parse(json)` then `apiResponseSchema.safeParse(parsed)` (lines 42-43), throwing on failure before returning `result.data`. JSON.parse output is never trusted directly. |
| 8 | infer-not-manual | **PASS** | Types derived via `z.infer`: `User` (line 16), `ApiResponse` (line 29), `UserCard` (119), `Settings` (131), etc. No manual interface duplicating a schema's shape. (The `Category` type is a deliberate recursive-typing helper for `z.lazy`, the documented pattern, not a manual-instead-of-infer violation.) |
| 9 | brand-domain-ids | **PASS** | `userId = z.string().uuid().brand<'UserId'>()` (line 77) and `orderId = ...brand<'OrderId'>()` (line 78). They are no longer swappable; `getOrder(uid: UserId, oid: OrderId)` (line 83) enforces distinct types. |
| 10 | strict-unknown-keys | **PASS** | External-data schemas reject unknown keys via `z.strictObject(...)` throughout: `userSchema` (line 4), `apiResponseSchema` (24), `orderSchema` (85), `userProfileSchema` (107), `eventSchema` members (73-74), etc. |
| 11 | partial-updates | **PASS** | `updateUserSchema = userSchema.pick({...}).partial()` (lines 18-22) — derived from base, not duplicated. |
| 12 | discriminated-union | **PASS** | `eventSchema = z.discriminatedUnion('type', [...])` (line 72) with `z.literal('click')` / `z.literal('keypress')` discriminants — not `z.union`. |
| 13 | lazy-recursive | **PASS** | `children: z.array(z.lazy(() => categorySchema)).optional()` (line 57) — recursion via `z.lazy`, no direct self-reference. |
| 14 | refine-no-throw | **PASS** | Refine callbacks return booleans, never throw: `passwordSchema` refine `(val) => /[A-Z]/.test(val)` (line 70); `usernameSchema` refine returns `!(await checkUsernameExists(val))` (line 97). |
| 15 | superRefine-multiple | **FAIL** | Assertion requires `superRefine()` for schemas with multiple validation issues. There is **no `superRefine`** anywhere in the file. `passwordSchema` (lines 69-70) has only a single `.refine()` for the uppercase rule; the multiple-check scenario was not modeled with `superRefine`. Prescribed remedy absent → FAIL. |
| 16 | cache-schema | **FAIL** | The trap is a schema created inside a component on every render. `ProductCard` still defines `const productSchema = z.strictObject({...})` **inside** the component body (lines 61-64), so it is recreated on every render. Not hoisted outside the hot path. Violation still present → FAIL. |
| 17 | export-schema-and-type | **PASS** | Schemas and their inferred types are exported together: `userSchema`+`User` (4,16), `apiResponseSchema`+`ApiResponse` (24,29), `userCardSchema`+`UserCard` (114,119), `settingsSchema`+`Settings` (125,131), `dateFieldSchema`+`DateField`/`DateFieldInput` (121-123). |
| 18 | parseAsync-async-refine | **PASS** | `usernameSchema` has an async refine (line 97) and is consumed with `safeParseAsync` (line 100), not sync `.parse()`. Async-capable parsing used. |
| 19 | pick-omit-variants | **PASS** | `userCardSchema = userProfileSchema.pick({ name: true, avatar: true })` (lines 114-117) — derived via `.pick()`, not duplicating fields. |
| 20 | pipe-multi-stage | **PASS** | `dateFieldSchema = z.string().pipe(z.coerce.date())` (line 121) — multi-stage validation via `.pipe()`, not manual `new Date(parse(...))`. |
| 21 | default-catch | **PASS** | `settingsSchema` fields use both: `.default('light').catch('light')` (line 126), `.default(20).catch(20)` (127), `.default(false).catch(false)` (128). Fault-tolerant + defaulted. |
| 22 | z-input-vs-infer | **PASS** | Transform schema distinguishes input from output: `dateFieldSchema` has `DateField = z.infer<...>` (line 122, post-transform Date) and `DateFieldInput = z.input<...>` (line 123, pre-transform string). |
| 23 | custom-messages | **FAIL** | Assertion: custom user-friendly messages on **all** validations, never default Zod messages. The `eventSchema` `click` member uses bare `x: z.number(), y: z.number()` with **no custom message** (line 73), falling back to default Zod messages. The `id: z.string().uuid()` (line 5) also has no custom message on the uuid check. `apiResponseSchema` meta `page: z.int().positive(...)` has a message but `data: userSchema` inherits; still, the unmessaged `z.number()` in eventSchema is a clear default-message violation. "All" not met → FAIL. |

## Summary

PASS: 19 — string-validations, enum-fixed-values, coercion-form, safeParse, handle-all-issues, validate-boundaries, infer-not-manual, brand-domain-ids, strict-unknown-keys, partial-updates, discriminated-union, lazy-recursive, refine-no-throw, export-schema-and-type, parseAsync-async-refine, pick-omit-variants, pipe-multi-stage, default-catch, z-input-vs-infer

FAIL: 4 — no-any-unknown, superRefine-multiple, cache-schema, custom-messages

Total = 23.
