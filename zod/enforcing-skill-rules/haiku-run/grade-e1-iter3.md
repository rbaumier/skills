# Grade — zod — e1 — iter3 (STRICT)

Code graded: `out-e1-iter3.md`. Verdict per assertion: PASS only if the trap is clearly fixed in the real code.

| # | id | Verdict | Evidence / Reasoning |
|---|----|---------|----------------------|
| 1 | no-any-unknown | PASS | No `z.any()` / `z.ZodType<any>` anywhere. `id: z.string().uuid()` (L6); dynamic boundaries use `unknown` (`product: unknown` L63, JSON.parse output validated). |
| 2 | string-validations | PASS | `name: z.string().trim().min(1, ...)` (L7), `email: z.string().email(...)` (L8), `locale: z.string().min(1, ...)` (L13). Validations applied at definition. |
| 3 | enum-fixed-values | PASS | `role: z.enum(['admin','user','guest'], ...)` (L10); also `theme: z.enum(['light','dark'])` (L12). |
| 4 | coercion-form | PASS | `age: z.coerce.number().int().positive(...)` (L9); `handleForm` reads `FormData` via `Object.fromEntries` (L32-33) and parses with the coercing schema. |
| 5 | safeParse | PASS | `userSchema.safeParseAsync(raw)` (L34), `apiResponseSchema.safeParse(parsed)` (L43). No `parse()` wrapped in try/catch for user input. |
| 6 | handle-all-issues | PASS | `z.prettifyError(result.error)` (L36) renders all issues, not just `e.message`. Same pattern reused throughout (L131, L159). |
| 7 | validate-boundaries | PASS | `const parsed = JSON.parse(json)` then `apiResponseSchema.safeParse(parsed)` (L42-43) — output validated, not trusted. |
| 8 | infer-not-manual | PASS | All public types via `z.infer<typeof ...>` (L17, L30, L143, L170). The lone manual `type Category` (L51-54) is the required typing for the `z.lazy` recursive schema, not a hand-rolled `interface User`. |
| 9 | brand-domain-ids | PASS | `userId = z.string().uuid().brand<'UserId'>()` (L101), `orderId = ...brand<'OrderId'>()` (L102); `getOrder(uid: UserId, oid: OrderId)` (L107) — no longer swappable. |
| 10 | strict-unknown-keys | PASS | `.strict()` on every external-data schema: userSchema (L15), apiResponseSchema (L28), categorySchema (L60), productSchema (L67), eventSchema variants (L97-98), orderSchema (L116), userProfileSchema (L141), settingsSchema (L168). |
| 11 | partial-updates | PASS | `updateUserSchema = userSchema.pick({...}).partial()` (L19-23) — derived, not duplicated. |
| 12 | discriminated-union | PASS | `eventSchema = z.discriminatedUnion('type', [...])` (L96). |
| 13 | lazy-recursive | PASS | `categorySchema: z.ZodType<Category> = z.lazy(() => z.object({ ..., children: z.array(categorySchema) }))` (L56-61). |
| 14 | refine-no-throw | PASS | superRefine uses `ctx.addIssue` only (L81-92); `usernameSchema` async refine returns `!exists` boolean (L120-124). No `throw` inside any refine callback. |
| 15 | superRefine-multiple | PASS | `passwordSchema.superRefine` emits two distinct issues (length L81-86, uppercase L87-92) instead of cramming into one `refine`. |
| 16 | cache-schema | **FAIL** | The exact trap is still present: `productSchema` is created **inside** `ProductCard` on every render (L64-67: `function ProductCard(...) { const productSchema = z.object({...}).strict(); ... }`). It was not hoisted to module scope. Not fixed. |
| 17 | export-schema-and-type | PASS | Schema + inferred type exported together for every schema: User (L17), ApiResponse (L30), UserId/OrderId (L104-105), UserProfile/UserCard (L143/146), Settings (L170), DateField in/out (L174-175). |
| 18 | parseAsync-async-refine | PASS | `usernameSchema` has an async `refine` (L119-125); `validateUsername` calls `await usernameSchema.safeParseAsync(input)` (L128). No sync `.parse()` on the async schema. |
| 19 | pick-omit-variants | PASS | `userCardSchema = userProfileSchema.pick({ name: true, avatar: true })` (L145) — derived from base, not duplicated. |
| 20 | pipe-multi-stage | PASS | `dateInputSchema = z.string().trim().min(1,...).pipe(z.coerce.date(...))` (L149-153) — single piped chain, no manual parse-then-`new Date`. |
| 21 | default-catch | PASS | settingsSchema fields use both: `z.enum(['light','dark']).catch('light').default('light')` (L165), `pageSize ...catch(20).default(20)` (L166), `experimentalFeatures ...catch(false).default(false)` (L167). |
| 22 | z-input-vs-infer | PASS | `dateFieldSchema = z.string().transform(...)` (L173); `DateFieldInput = z.input<typeof ...>` (L174) and `DateFieldOutput = z.infer<typeof ...>` (L175) distinguished. |
| 23 | custom-messages | PASS | orderSchema (user-facing) fields all carry friendly custom messages: quantity (L113), email 'Please enter a valid email address' (L114), address (L115). Internal eventSchema coords left unmessaged, which the assertion explicitly permits. |

## Summary
- Passed: 22 / 23
- Failed: 1 (cache-schema)

The single failure is genuine and load-bearing: the React component re-creates its Zod schema on every render instead of hoisting it to module scope (the assertion's exact trap). Every other trap is clearly and concretely corrected in the real code, not aspirationally or via comments.
