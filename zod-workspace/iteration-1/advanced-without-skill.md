# Zod Advanced Review (Without Skill)

## Code Under Review

```typescript
import { z } from 'zod';

const rawData = await fetch('/api/data').then(r => r.json());
const data = rawData as ApiResponse;

function ValidatedForm({ fields }: { fields: Field[] }) {
  const schema = z.object(Object.fromEntries(fields.map(f => [f.name, f.required ? z.string().min(1) : z.string().optional()])));
  return <Form schema={schema} />;
}

const DateSchema = z.string().transform((s) => new Date(s));
type DateInput = z.infer<typeof DateSchema>;

interface TreeNode { value: string; children: TreeNode[]; }
const TreeSchema: z.ZodType<TreeNode> = z.object({ value: z.string(), children: z.array(TreeSchema) });
```

## Issues Found

### 1. Fetch result cast with `as` instead of Zod validation (CRITICAL)

**Rules violated:** `parse-never-trust-json`, `parse-validate-early`

```typescript
// PROBLEM: `as` is a lie to the compiler. No runtime validation.
const rawData = await fetch('/api/data').then(r => r.json());
const data = rawData as ApiResponse;
```

`response.json()` returns `any`. The `as ApiResponse` cast provides zero runtime safety -- it silences TypeScript without checking the data. Corrupt, missing, or mistyped fields will propagate silently and crash far from the source.

```typescript
// FIX: Define a schema, validate at the boundary.
const ApiResponseSchema = z.object({
  /* fields matching ApiResponse */
});

const rawData = await fetch('/api/data').then(r => r.json());
const result = ApiResponseSchema.safeParse(rawData);
if (!result.success) {
  // handle error at the boundary, not downstream
  throw new Error('Invalid API response');
}
const data = result.data; // fully typed, runtime-validated
```

---

### 2. Dynamic schema creation inside a React component (MEDIUM)

**Rule violated:** `perf-avoid-dynamic-creation`

```typescript
// PROBLEM: Schema rebuilt on every render.
function ValidatedForm({ fields }: { fields: Field[] }) {
  const schema = z.object(Object.fromEntries(
    fields.map(f => [f.name, f.required ? z.string().min(1) : z.string().optional()])
  ));
  return <Form schema={schema} />;
}
```

`z.object()` is called on every render. With Zod 4's JIT compilation, schema creation is ~0.15ms per call, and it also breaks referential equality, causing unnecessary re-renders of `<Form>`.

```typescript
// FIX: Memoize or hoist with useMemo.
function ValidatedForm({ fields }: { fields: Field[] }) {
  const schema = useMemo(
    () => z.object(Object.fromEntries(
      fields.map(f => [f.name, f.required ? z.string().min(1) : z.string().optional()])
    )),
    [fields]
  );
  return <Form schema={schema} />;
}
```

Note: if `fields` is a new array reference every render, `useMemo` won't help -- stabilize the reference upstream or use a cache keyed on field content.

---

### 3. Wrong inferred type for transform schema (HIGH)

**Rule violated:** `type-input-vs-output`

```typescript
const DateSchema = z.string().transform((s) => new Date(s));
type DateInput = z.infer<typeof DateSchema>;
// DateInput = Date (post-transform), NOT string (pre-transform)
```

The name `DateInput` suggests the pre-transform type (what you pass *in* to `.parse()`), but `z.infer` returns the post-transform type (`Date`). This creates a misleading type alias that will cause confusion and TypeScript errors when used as a function parameter type.

```typescript
// FIX: Use z.input for pre-transform, z.infer/z.output for post-transform.
const DateSchema = z.string().transform((s) => new Date(s));
type DateInput = z.input<typeof DateSchema>;   // string (what parse accepts)
type DateOutput = z.infer<typeof DateSchema>;   // Date   (what parse returns)
```

---

### 4. Recursive schema without `z.lazy()` (MEDIUM)

**Rule violated:** `compose-lazy-recursive`

```typescript
const TreeSchema: z.ZodType<TreeNode> = z.object({
  value: z.string(),
  children: z.array(TreeSchema)  // direct self-reference
});
```

`TreeSchema` is referenced inside its own initializer. This works at runtime only because `z.array()` captures the reference lazily in some Zod versions, but it is fragile and undocumented. It will fail with "used before declaration" in strict configurations or future Zod versions.

```typescript
// FIX: Use z.lazy() for the recursive reference.
interface TreeNode { value: string; children: TreeNode[]; }

const TreeSchema: z.ZodType<TreeNode> = z.object({
  value: z.string(),
  children: z.lazy(() => z.array(TreeSchema)),
});
```

---

## Summary

| # | Issue | Rule(s) | Severity |
|---|-------|---------|----------|
| 1 | `as` cast on fetch response bypasses validation | `parse-never-trust-json`, `parse-validate-early` | CRITICAL |
| 2 | Schema created inside component body on every render | `perf-avoid-dynamic-creation` | MEDIUM |
| 3 | `z.infer` used where `z.input` needed (transform) | `type-input-vs-output` | HIGH |
| 4 | Recursive schema without `z.lazy()` | `compose-lazy-recursive` | MEDIUM |
