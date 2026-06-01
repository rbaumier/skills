# Grade — zod E1 iter4 (STRICT)

| # | id | verdict | citation / reason |
|---|----|---------|-------------------|
| 1 | no-any-unknown | PASS | No `z.any()` / `z.ZodType<any>` anywhere. `id` is `z.string().uuid(...)` (L6). `unknown` used only as TS param types (L80), not Zod schemas. |
| 2 | string-validations | PASS | `name` `.min(1)` (L7), `email` `.email()` (L8), `locale` `.min(2)` (L13). Validations at definition. |
| 3 | enum-fixed-values | PASS | `role: z.enum(['admin','user','guest'], ...)` (L10); also `theme` enum (L12). |
| 4 | coercion-form | PASS | `age: z.coerce.number()...` (L9, L26); form-bound `quantity`/`pageSize` use coerce too (L136, L178). |
| 5 | safeParse | PASS | `safeParseAsync` (L40), `safeParse` (L52, L81). No `try/catch` around `.parse()`. |
| 6 | handle-all-issues | PASS | `result.error.flatten()` for form (L43). |
| 7 | validate-boundaries | PASS | `JSON.parse(json)` piped through `apiResponseSchema.safeParse(parsed)` (L51-52); raw output not trusted. |
| 8 | infer-not-manual | PASS | `z.infer<typeof userSchema>` (L18) and others. `Category` interface (L62-65) is the standard typed-recursive pattern required by `z.ZodType<Category>`, not a manual replacement for infer. |
| 9 | brand-domain-ids | PASS | `userId` `.brand('UserId')` (L127), `orderId` `.brand('OrderId')` (L128). |
| 10 | strict-unknown-keys | PASS | All external-data schemas use `z.strictObject(...)` (L5, L11, L23, L29, L31, L68, L75, L116, L121, L135, L155, L176); `updateUserSchema` also `.strict()` (L27). |
| 11 | partial-updates | PARTIAL→FAIL? see below | `updateUserSchema` is re-declared as a fresh `z.strictObject` (L23-27), NOT derived via `userSchema.partial()`. Assertion explicitly: "partial() to derive update schemas from base" and trap "updateUserSchema duplicated instead of derived". Fields duplicated. FAIL. |
| 12 | discriminated-union | PASS | `z.discriminatedUnion('type', [...])` (L115). |
| 13 | lazy-recursive | PASS | `z.lazy(() => ...)` for `categorySchema` (L67). |
| 14 | refine-no-throw | PASS | `refine`/`superRefine` return booleans or use `ctx.addIssue` (L91-113, L143-147); no throws inside callbacks. |
| 15 | superRefine-multiple | PASS | `passwordSchema` uses `superRefine` emitting 3 independent issues (L91-113). |
| 16 | cache-schema | PASS | `productSchema` hoisted outside `ProductCard` component (L75-78 before L80). |
| 17 | export-schema-and-type | PASS | Schemas + inferred types exported together (e.g. L5/L18, L29/L36, L176/L182). |
| 18 | parseAsync-async-refine | PASS | `usernameSchema` async `refine` (L142-148) validated via `parseAsync` (L151). |
| 19 | pick-omit-variants | PASS | `userCardSchema = userProfileSchema.pick({...})` (L162-165), no duplication. |
| 20 | pipe-multi-stage | PASS | `dateFieldSchema = z.string().transform(...).pipe(z.date())` (L168-170). |
| 21 | default-catch | PASS | `settingsSchema` fields each `.catch(...).default(...)` (L177-179). |
| 22 | z-input-vs-infer | PASS | `DateField` = `z.infer` (output Date), `DateFieldInput` = `z.input` (input string) distinguished (L172-173); also `UserInput` L21. |
| 23 | custom-messages | PASS | `orderSchema` user-facing fields all custom messages: quantity, email, address (L135-139). Internal `eventSchema` coords left unmessaged (allowed by assertion). |

## Result
22 PASS / 23. FAIL: `partial-updates` — `updateUserSchema` is hand-written as a separate `z.strictObject` rather than derived from `userSchema` via `.partial()`/`.pick().partial()`. The duplication trap the assertion targets is not corrected.
