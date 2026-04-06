---
name: zod
description: Zod schema validation best practices. Trigger on z.object, z.string, safeParse, z.infer.
---

# Zod Best Practices

## Rules

### Schema Definition
- Use correct primitives; z.unknown() not z.any()
- Avoid overusing optional; apply string validations at definition
- Use z.enum for fixed values; coercion for form/query data
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
- safeParse() for user input; parseAsync for async refinements
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
- Export schemas AND types; enable strict mode
- `.brand()` for domain IDs: `z.string().uuid().brand('UserId')` prevents mixing UserId/OrderId
- Use `z.input<typeof schema>` for form default values and field types; use `z.infer<typeof schema>` (or `z.output<>`) for what the handler receives after transforms

### Error Handling
- Custom error messages; flatten() for form display
- issue.path for nested errors; return false not throw in refine
- v4: unified `{ error: "message" }` or `{ error: (issue) => "message" }` for error customization; `required_error`, `invalid_type_error`, `errorMap` deprecated
- v4: `z.prettifyError(err)` for human-readable output, `z.treeifyError(err)` for structured trees; `.format()`, `.flatten()` deprecated
- v4: `z.config(z.locales.en())` for internationalized error messages
- Use `z.ZodIssueCode.custom` as the code in `ctx.addIssue()` within `.superRefine()` for consistent error handling
- v4: per-field error codes for i18n with `.check()`: `z.string().check({ kind: 'min', value: 8, error(iss) { iss.params = { errorCode: 'VALIDATION.PASSWORD.TOO_SHORT' } } })`
- Error messages must not leak sensitive info (schema structure, internal types) to end users -- map to user-friendly messages at the API boundary

### Object Schemas
- strict() vs strip() for unknown keys; partial() for updates
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

### Refinements & Transforms
- refine() for simple bool, superRefine() for multiple issues
- Distinguish transform/refine/coerce; default() for defaults; catch() for fault-tolerant
- v4: `.default()` applies AFTER validation and must match output type; use `.prefault()` for pre-validation defaults
- v4: `.overwrite()` instead of `.transform()` for same-type mutations -- introspectable, doesn't change output type
- v4: `.refine(fn, (val) => ({ message }))` function-as-second-arg overload removed; use `.superRefine()` for dynamic messages
- Always provide `path` in `.refine()` / `.superRefine()` for cross-field validations -- without it, error won't attach to correct form field
- Use `.pipe()` after `.transform()` to validate transformed value: `z.string().transform(s => parseInt(s)).pipe(z.number().positive())`
- Chained `.refine()` calls are sequential: each runs only if previous passes. Use `.superRefine()` with `ctx.addIssue()` for multiple independent errors in one pass
- Use `.refine()` only when built-ins can't express the constraint; prefer `.email()`, `.url()`, `.min()`, `.regex()` over equivalent refinements

### Performance
- Cache schema instances; avoid dynamic creation in hot paths
- zod-mini for bundle-sensitive apps
