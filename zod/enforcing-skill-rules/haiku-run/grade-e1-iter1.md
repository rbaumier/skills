# Grade — e1 iter1

| id | PASS/FAIL | evidence |
|----|-----------|----------|
| no-any-unknown | FAIL | The `id` field is now `z.string().uuid()` (line 5), so the original `z.any()` trap on the id field is gone. But the rule "z.unknown() not z.any()" is violated elsewhere: `categorySchema: z.ZodType<any>` (line 44) reintroduces `any`. The fix changed the id type rather than using `z.unknown()`, and `any` is still present in the file. Strict reading: violation still present. |
| string-validations | PASS | Validations applied at definition: `name: z.string().trim().min(1)` (line 6), `email: z.string().email().optional()` (line 7), `address: z.string().trim().min(5)` (line 84), `avatar: z.url()` (line 103). |
| enum-fixed-values | PASS | `role: z.enum(['admin', 'user', 'guest'])` (line 8); also `theme: z.enum(['light', 'dark'])` (lines 11, 117). |
| coercion-form | FAIL | Aspirational/missing. `age` is `z.int()` (line 8), not `z.coerce.number()`. `handleForm` (lines 29-37) reads `Object.fromEntries(formData)` (all string values) and feeds them to `userSchema` which uses `z.int()` — no `z.coerce` anywhere in the file. Form/query string-to-number conversion is not handled. |
| safeParse | PASS | `handleForm` uses `userSchema.safeParse(raw)` with `if (!result.success)` handling (lines 31-35). User input path uses safeParse, not parse-with-try/catch. (Note: `processApiResponse` still uses `.parse()` but that is the boundary assertion, judged below.) |
| handle-all-issues | PASS | `handleForm` returns `result.error.flatten()` (line 33) rather than only `e.message` first error. |
| validate-boundaries | PASS | `processApiResponse` validates `JSON.parse` output: `const parsed = JSON.parse(json); return apiResponseSchema.parse(parsed)` (lines 40-41). The JSON.parse output is no longer trusted — it is run through `apiResponseSchema`. |
| infer-not-manual | PASS | `type User = z.infer<typeof userSchema>` (line 16); no manual `interface User`. |
| brand-domain-ids | PASS | `const userId = z.string().uuid().brand('UserId')` and `const orderId = z.string().uuid().brand('OrderId')` (lines 75-76), used as distinct types in `getOrder` (line 78). No longer swappable. |
| strict-unknown-keys | FAIL | No `.strict()` anywhere in the file. `userSchema`, `apiResponseSchema`, `userProfileSchema`, `orderSchema` all receive external data but use plain `z.object` without `.strict()`. Trap not corrected. |
| partial-updates | PASS | `updateUserSchema = userSchema.pick({...}).partial()` (lines 18-22) — derived from base, not duplicated. |
| discriminated-union | PASS | `eventSchema = z.discriminatedUnion('type', [...])` (lines 70-73). |
| lazy-recursive | PASS | `categorySchema = z.lazy(() => z.object({ ... children: z.array(categorySchema) ... }))` (lines 44-49) uses `z.lazy()`. |
| refine-no-throw | PASS | No `refine` callback throws. `passwordSchema` superRefine uses `ctx.addIssue` (lines 61-68); the date refine returns a boolean `!isNaN(...)` (line 113). No throw inside any refine. |
| superRefine-multiple | PASS | `passwordSchema` uses `superRefine` with `ctx.addIssue` (lines 61-68), the documented mechanism for multiple issues. |
| cache-schema | FAIL | `ProductCard` still creates the schema inside the component on every render: `const schema = z.object({...})` is declared inside the function body (lines 52-55). Not hoisted outside the hot path. Trap not corrected. |
| export-schema-and-type | FAIL | No `export` keyword anywhere in the file. The rule "Export schemas AND inferred types together" is not satisfied — nothing is exported. (Types like `DateFieldInput/Output` and `User` are declared but not exported, and schemas are not exported.) |
| parseAsync-async-refine | FAIL | `usernameSchema = z.string().min(1)` (line 89) has NO async refinement, and `validateUsername` still uses sync `.parse()` (line 92). The async check (`checkUsernameExists`) is done imperatively outside the schema and throws (lines 93-96). The trap (async validation not modeled as an async refine + parseAsync) is not fixed — it was sidestepped, no `.refine(async ...)` and no `parseAsync()`. |
| pick-omit-variants | PASS | `userCardSchema = userProfileSchema.pick({ name: true, avatar: true })` (lines 107-110) — derived via pick, not duplicated. |
| pipe-multi-stage | PASS | `parseAndValidateDate = z.string().transform(...).pipe(z.date().refine(...))` (lines 112-114) uses `.pipe()` for multi-stage. |
| default-catch | FAIL | `settingsSchema` adds `.default(...)` on all three fields (lines 117-119), fixing the missing-data half. But the rule explicitly requires `catch()` for fault-tolerant parsing ("default() for defaults; catch() for fault-tolerant parsing"), and there is NO `.catch()` anywhere. Bad-data tolerance (e.g. `pageSize: 'abc'`) still crashes. Half-fixed → FAIL under strict reading. |
| z-input-vs-infer | PASS | `dateFieldSchema` distinguishes both: `type DateFieldInput = z.input<typeof dateFieldSchema>` and `type DateFieldOutput = z.infer<typeof dateFieldSchema>` (lines 122-124). |
| custom-messages | FAIL | `orderSchema` fields still use default Zod messages: `quantity: z.int().positive()`, `email: z.email()`, `address: z.string().trim().min(5)` (lines 81-84) — no custom message strings. The `superRefine` is empty (comment only, line 86). Trap not corrected; default messages remain across the file. |
