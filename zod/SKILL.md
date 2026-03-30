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

### Parsing
- safeParse() for user input; parseAsync for async refinements
- Handle all issues not just first; validate at boundaries
- Never trust JSON.parse output; avoid double validation

### Type Inference
- z.infer not manual types; distinguish z.input from z.infer for transforms
- Export schemas AND types; enable strict mode
- `.brand()` for domain IDs: `z.string().uuid().brand('UserId')` prevents mixing UserId/OrderId

### Error Handling
- Custom error messages; flatten() for form display
- issue.path for nested errors; return false not throw in refine

### Object Schemas
- strict() vs strip() for unknown keys; partial() for updates
- pick()/omit() for variants; discriminated unions for narrowing

### Composition
- Extract shared schemas; z.lazy() for recursive; pipe() for multi-stage

### Refinements & Transforms
- refine() for simple bool, superRefine() for multiple issues
- Distinguish transform/refine/coerce; default() for defaults; catch() for fault-tolerant

### Performance
- Cache schema instances; avoid dynamic creation in hot paths
- zod-mini for bundle-sensitive apps
