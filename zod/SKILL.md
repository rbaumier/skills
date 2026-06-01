---
name: zod
description: Use when writing Zod schemas or validation — z.object, z.string, safeParse, z.infer, transforms, discriminated unions, error handling.
---

# Zod Best Practices

## PRE-OUTPUT CHECKLIST (run before you emit any code)

- [ ] **Every `z.*` schema is declared at MODULE scope.** ACTION: if you see `const xSchema = z.*(...)` on a line that sits INSIDE a function / component / hook / loop / request handler body, MOVE that whole line OUT, to module scope ABOVE the function — then reference it by name from inside. A schema in a component body = rebuilt on every render = FAIL. Before: `function ProductCard() { const schema = z.object({...}); schema.parse(p); }`. After: `const schema = z.object({...}); function ProductCard() { schema.parse(p); }`.
- [ ] **No `any` anywhere** — not `z.any()`, not `z.ZodType<any>`, not `: any`. Use a concrete schema or `z.unknown()`.
- [ ] **Several related checks on one schema → one `.superRefine()`**, not stacked single `.refine()` calls.
- [ ] **Every user-facing validator (form/API input) has a custom `{ error: '...' }` message.**

## Rules

### Schema Definition
- **Use correct primitives; z.unknown() not z.any().** ZERO `any` in a Zod file. WHY: `any` disables all type-checking on parsed data, defeating Zod's purpose. If you see `any` ANYWHERE — including inside a generic like `z.ZodType<any>`, `z.array(z.any())`, or a recursive-schema annotation — replace it. `z.ZodType<any>` is NOT a valid fix: use `z.unknown()` for unknown shapes, or the explicit schema type for typed recursion (e.g. `z.ZodType<Category>`). Review checklist: grep the result for `any` — any hit is a FAIL.
- Avoid overusing optional; apply string validations at definition
- Use z.enum for fixed values.
- **Form/query data is ALWAYS strings — use z.coerce for non-string fields.** Trigger: data from `FormData`, `Object.fromEntries(formData)`, `URLSearchParams`, or `req.query`. Every value is a string, so a plain `z.number()`/`z.int()`/`z.date()` will REJECT valid input like `"42"`. If a schema validates form/query input, each numeric field MUST be `z.coerce.number()` and each date `z.coerce.date()`. Before: `age: z.int()` (rejects `"42"`). After: `age: z.coerce.number().int()`. Review checklist: schema fed by a form + a bare `z.number()`/`z.int()`/`z.date()` field -> FAIL, wrap in `z.coerce`.
- v4: top-level format functions -- `z.email()`, `z.url()`, `z.uuid()` instead of `z.string().email()`. WHY: shorter, faster, tree-shakeable
- v4: `z.int()` instead of `z.number().int()`; `z.float32()`, `z.int32()` for fixed-width numbers
- v4: `z.iso.date()`, `z.iso.datetime()`, `z.iso.time()` for ISO date/time validation instead of `z.string().datetime()`
- v4: `z.record(keySchema, valueSchema)` requires two args -- single-arg form removed
- v4: `z.number()` rejects `Infinity` by default; `z.number().safe()` equals `z.int()` (no floats)
- v4: `z.file()` for File instance validation (type, size constraints)
- v4: `z.templateLiteral([...])` for template literal type validation (e.g., `user_${uuid}`)
- v4: `z.nullish()` for fields that can be both null and undefined; distinguish `.optional()` (undefined), `.nullable()` (null), `.nullish()` (both)
- Always `.trim()` user text input before validation: `z.string().trim().min(1)` -- prevents whitespace-only bypassing `.min()`
- Empty strings pass `z.string()` -- always add `.min(1)` for required text fields
- `.optional()` permits `undefined`, not empty strings; for HTML forms preprocess: `z.string().transform(v => v === '' ? undefined : v).optional()`
- Use `z.multipleOf(0.01)` for currency precision validation on number fields

### Parsing
- safeParse() for user input.
- **Model async checks (uniqueness, "does it exist?", remote lookups) INSIDE the schema as `.refine(async ...)` + `parseAsync()` — not as imperative code around a sync `.parse()`.** Trigger: validation needs an `await` (DB query, API call). Doing the `await` outside the schema and then `throw`-ing is NOT a fix — the check belongs in the schema so errors surface through normal Zod issues. Before: `schema.parse(x); if (await exists(x.name)) throw new Error(...)`. After: `const schema = base.refine(async (v) => !(await exists(v.name)), { error: 'already taken' }); await schema.parseAsync(x);`. Note: a schema with an async refine REQUIRES `parseAsync`/`safeParseAsync` — sync `.parse()` throws. Review checklist: an `await` validating a field outside the schema, or a sync `.parse()` where the rule is async -> FAIL.
- Handle all issues not just first; validate at boundaries
- Never trust JSON.parse output; avoid double validation
- Validate at system boundaries only -- not inside business logic. Treat Zod-parsed data as trusted downstream
- Validate environment variables at startup: `envSchema.parse(process.env)` -- fail fast on missing config
- Use `z.preprocess()` when input types are unpredictable (e.g., gray-matter parses YAML dates as Date objects)
- Use `safeParse()` in tests instead of `parse()` -- returns `{ success, data, error }`, clearer assertions
- Avoid silent coercion (`z.coerce.*`) for critical financial/compliance values -- use explicit transforms with validation
- Use `z.coerce.date()` for form/query date inputs; `z.coerce.number()` for numeric string inputs from HTML forms
- v4: `z.stringbool()` for string-to-boolean parsing -- avoids `z.coerce.boolean()` gotcha where `"false"` coerces to `true`

### Type Inference
- z.infer not manual types; distinguish z.input from z.infer for transforms
- **Export BOTH the schema and its inferred type — add `export` to each.** A schema with no `export` can't be reused, so consumers re-declare it and drift. Every top-level schema and its `z.infer` type get `export`. Before: `const userSchema = z.object({...}); type User = z.infer<typeof userSchema>;`. After: `export const userSchema = z.object({...}); export type User = z.infer<typeof userSchema>;`. Review checklist: a top-level schema or its inferred type missing `export` -> FAIL. Also: enable strict mode in tsconfig.
- `.brand()` for domain IDs: `z.string().uuid().brand('UserId')` prevents mixing UserId/OrderId
- Use `z.input<typeof schema>` for form default values and field types; use `z.infer<typeof schema>` (or `z.output<>`) for what the handler receives after transforms

### Error Handling
- **Give user-facing validators a custom message via the v4 `error` key — don't ship Zod's default English strings to end users (unless a global locale is configured, see below).** Defaults like `"Invalid input"` / `"Number must be greater than 0"` are useless in a form. Each validator on a user-input field takes `{ error: "..." }`. Before: `quantity: z.number().positive()` (default msg). After: `quantity: z.number().positive({ error: 'Quantity must be at least 1' })`. Likewise, an empty/comment-only `.superRefine()` is a FAIL — either implement the cross-field rule with `ctx.addIssue({ code: 'custom', error: '...', path: [...] })` or remove it. Review checklist: validator on user input with no `error` (and no global locale) -> FAIL; empty superRefine -> FAIL.
- flatten() for form display.
- issue.path for nested errors; return false not throw in refine
- v4: unified `{ error: "message" }` or `{ error: (issue) => "message" }` for error customization; `required_error`, `invalid_type_error`, `errorMap` deprecated
- v4: the message-customization key is `error`, NOT `message`. `message` is the v3 key. Reviews: do NOT flag `.regex(/.../, { error: "..." })` / `.min(8, { error: "..." })` as wrong syntax — that IS correct v4. Only `{ message: "..." }` is the outdated form
- v4: `z.prettifyError(err)` for human-readable output, `z.treeifyError(err)` for structured trees; `.format()`, `.flatten()` deprecated
- v4: `z.config(z.locales.en())` for internationalized error messages
- Use `z.ZodIssueCode.custom` as the code in `ctx.addIssue()` within `.superRefine()` for consistent error handling
- v4: per-field error codes for i18n with `.check()`: `z.string().check({ kind: 'min', value: 8, error(iss) { iss.params = { errorCode: 'VALIDATION.PASSWORD.TOO_SHORT' } } })`
- Error messages must not leak sensitive info (schema structure, internal types) to end users -- map to user-friendly messages at the API boundary
- **Don't override messages when the locale already handles them** -- once `z.config(z.locales.fr())` (or any locale) is set globally, never add manual `message: "..."` to schema-level validators (`.min()`, `.max()`, `.email()`, `.uuid()`, `.regex()`, etc.). The locale's translations already cover them. Custom messages are only acceptable inside `.refine()` / `.superRefine()` callbacks — business rules the locale cannot translate. Reviews: `.min(8, { error: "..." })` in a locale-configured project -> flag "remove, let the locale handle it" (the issue is the override, NOT the key — `error` is correct v4 syntax)

### Object Schemas
- **Schemas fed by external data MUST reject unknown keys — add `.strict()` (v4: `z.strictObject({...})`).** Trigger: the object validates anything from outside your code — an HTTP body, a form, an API response, parsed JSON, query params. Plain `z.object({...})` silently STRIPS unknown keys; that hides typos and lets attackers smuggle extra fields. Before: `z.object({ name: z.string() })`. After: `z.object({ name: z.string() }).strict()`. Review checklist: object validating external input WITHOUT `.strict()`/`z.strictObject` -> FAIL.
- partial() for updates
- pick()/omit() for variants; discriminated unions for narrowing
- v4: `z.strictObject({})` / `z.looseObject({})` constructors instead of `.strict()` / `.passthrough()`
- v4: `.extend()` for schema composition instead of `.merge()` -- `.merge()` does not preserve strict object behavior
- Don't rely on `.partial()` alone for update schemas if constraints differ between create and update -- define distinct schemas
- Use `z.discriminatedUnion()` instead of `.refine()` when validation depends on a discriminator field -- better errors and performance

### Composition
- Extract shared schemas; z.lazy() for recursive; pipe() for multi-stage
- v4: getter-based recursion instead of `z.lazy()` -- retains object methods and type inference
- v4: `.meta({ description, examples })` on schema fields for JSON Schema generation; `z.toJSONSchema()` for conversion
- v4: `z.registry()` and `z.globalRegistry` for typed schema registries -- register once, reference by name
- Co-locate schemas with consumers (component/route); extract to shared module only when reused by 2+ consumers
- For recursive schemas in v4, define the base TypeScript type explicitly -- deep recursion causes 'Type instantiation is excessively deep' errors
- drizzle-zod: `InsertSchema` and `UpdateSchema` reflect table columns -- don't manually duplicate. Use `.omit()` for server-defaulted columns
- Share the same Zod schema between client and server validation -- single source of truth prevents validation drift
- Use separate schemas where semantics differ -- don't over-reuse one schema across UI, API, DB, and provider layers
- **Reuse the canonical schema, never re-declare a subset** -- if `OrganizationSelectSchema` exists, never re-declare `z.object({ id, name, slug })` to represent a subset of it. Don't `.pick({ ... })` to project columns either — column projection is a query-time concern, not a schema concern. Compose with `.extend(...)` when genuinely adding fields. The only acceptable subset is one that strictly cannot be derived (e.g. an input that drops auto-generated columns via `.omit({ id: true, createdAt: true })`). Drift between picked subsets and the canonical schema breaks consumers silently. Reviews: redeclared narrower variant of an existing schema -> flag "reuse the canonical schema"

### Refinements & Transforms
- **Multiple related checks on one value → ONE `.superRefine()`, never stack them in a single `.refine()` or split into several `.refine()` calls.** A single `.refine()` returns one boolean, so it can only ever report ONE failure — cramming several conditions in it (or chaining `.refine()`s) hides all but the first error and is a FAIL. WHY: `.superRefine((val, ctx) => ...)` can `ctx.addIssue()` once per failing rule, surfacing every problem in one pass. Trigger: a field needs 2+ independent validations (e.g. password: min length AND uppercase AND digit). Before: `.refine(v => v.length >= 8 && /[A-Z]/.test(v))` (one merged check) or splitting length into `.min()` + uppercase into `.refine()`. After: `.superRefine((v, ctx) => { if (v.length < 8) ctx.addIssue({ code: 'custom', error: '...' }); if (!/[A-Z]/.test(v)) ctx.addIssue({ code: 'custom', error: '...' }); })`. Review checklist: a value with 2+ related checks not consolidated into a single `.superRefine()` -> FAIL.
- refine() for simple bool, superRefine() for multiple issues
- Distinguish transform/refine/coerce.
- **`.default()` and `.catch()` are a PAIR for tolerant config/settings — `.default()` handles MISSING input, `.catch()` handles INVALID input.** `.default()` alone still crashes on bad data (e.g. `pageSize: "abc"`); `.catch(fallback)` makes the field survive garbage by falling back. If you reach for `.default()` on a settings/config schema, add a matching `.catch()` unless invalid data should hard-fail. Before: `pageSize: z.number().default(20)`. After: `pageSize: z.number().catch(20).default(20)`. Review checklist: `.default()` on a tolerant schema with no `.catch()` -> FAIL.
- v4: `.default()` applies AFTER validation and must match output type; use `.prefault()` for pre-validation defaults
- v4: `.overwrite()` instead of `.transform()` for same-type mutations -- introspectable, doesn't change output type
- v4: `.refine(fn, (val) => ({ message }))` function-as-second-arg overload removed; use `.superRefine()` for dynamic messages
- Always provide `path` in `.refine()` / `.superRefine()` for cross-field validations -- without it, error won't attach to correct form field
- Use `.pipe()` after `.transform()` to validate transformed value: `z.string().transform(s => parseInt(s)).pipe(z.number().positive())`
- Chained `.refine()` calls are sequential: each runs only if previous passes. Use `.superRefine()` with `ctx.addIssue()` for multiple independent errors in one pass
- Use `.refine()` only when built-ins can't express the constraint; prefer `.email()`, `.url()`, `.min()`, `.regex()` over equivalent refinements

### Performance
- **Declare every schema ONCE at module scope — never inside a component body, render, hook, loop, or request handler.** A schema created inside a React component is rebuilt on every render; inside a handler, on every request. Hoist it to the top level of the module (co-location means same FILE, not same FUNCTION). Before: `function ProductCard() { const schema = z.object({...}); ... }`. After: `const productSchema = z.object({...}); function ProductCard() { ... }`. Review checklist: `z.object(`/`z.array(` etc. inside a function body -> FAIL, hoist it out.
- zod-mini for bundle-sensitive apps
