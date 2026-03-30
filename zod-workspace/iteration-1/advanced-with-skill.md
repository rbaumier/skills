# Review: Advanced Zod Patterns

## Issue 1: Unvalidated JSON response (`parse-never-trust-json`)

```typescript
const rawData = await fetch('/api/data').then(r => r.json());
const data = rawData as ApiResponse;
```

`r.json()` returns `any`. Casting with `as` provides zero runtime safety -- it silences TypeScript while leaving the door open to type confusion, crashes, and malformed data propagating through the system.

**Fix:** Define an `ApiResponseSchema` and parse the response through it:

```typescript
const ApiResponseSchema = z.object({
  // define expected shape
});

const rawData = await fetch('/api/data').then(r => r.json());
const data = ApiResponseSchema.parse(rawData);
```

For user-facing code, prefer `safeParse()` to avoid throwing on invalid responses.

---

## Issue 2: Dynamic schema creation in render (`perf-avoid-dynamic-creation`)

```typescript
function ValidatedForm({ fields }: { fields: Field[] }) {
  const schema = z.object(
    Object.fromEntries(fields.map(f => [f.name, f.required ? z.string().min(1) : z.string().optional()]))
  );
  return <Form schema={schema} />;
}
```

This creates a new Zod schema on every render. Zod 4 uses JIT compilation, making initial schema creation ~0.15ms each time. In a React component this adds up quickly and defeats JIT caching since each schema instance is new.

**Fix:** Memoize the schema so it is only recreated when `fields` actually changes:

```typescript
function ValidatedForm({ fields }: { fields: Field[] }) {
  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          fields.map(f => [f.name, f.required ? z.string().min(1) : z.string().optional()])
        )
      ),
    [fields]
  );
  return <Form schema={schema} />;
}
```

If `fields` is stable across the app, hoist the schema outside the component entirely.

---

## Issue 3: Wrong inferred type for transform schema (`type-input-vs-output`)

```typescript
const DateSchema = z.string().transform((s) => new Date(s));
type DateInput = z.infer<typeof DateSchema>;
```

`z.infer` (alias for `z.output`) resolves to `Date` here -- the post-transform type. But the variable is named `DateInput`, suggesting the intent is to capture the pre-transform type (`string`). This mismatch will cause TypeScript errors when the type is used for function parameters that accept raw input.

**Fix:** Use `z.input` for the pre-transform type and `z.infer`/`z.output` for the post-transform type:

```typescript
const DateSchema = z.string().transform((s) => new Date(s));
type DateInput = z.input<typeof DateSchema>;   // string
type DateOutput = z.infer<typeof DateSchema>;  // Date
```

---

## Issue 4: Self-referencing schema without `z.lazy()` (`compose-lazy-recursive`)

```typescript
interface TreeNode { value: string; children: TreeNode[]; }
const TreeSchema: z.ZodType<TreeNode> = z.object({
  value: z.string(),
  children: z.array(TreeSchema),
});
```

`TreeSchema` is referenced inside its own definition before the `const` assignment completes. This causes a `ReferenceError` at runtime: "Cannot access 'TreeSchema' before initialization."

**Fix:** Wrap the self-reference in `z.lazy()` to defer evaluation:

```typescript
interface TreeNode { value: string; children: TreeNode[]; }
const TreeSchema: z.ZodType<TreeNode> = z.object({
  value: z.string(),
  children: z.lazy(() => z.array(TreeSchema)),
});
```

`z.lazy()` has minimal overhead -- the inner function is called once and the result is cached.

---

## Summary

| # | Rule | Severity | Issue |
|---|------|----------|-------|
| 1 | `parse-never-trust-json` | CRITICAL | JSON response cast with `as` instead of validated with a schema |
| 2 | `perf-avoid-dynamic-creation` | LOW-MEDIUM | Schema recreated on every React render instead of memoized |
| 3 | `type-input-vs-output` | HIGH | `z.infer` used where `z.input` is needed for a transform schema |
| 4 | `compose-lazy-recursive` | MEDIUM | Direct self-reference causes ReferenceError; needs `z.lazy()` |
