# Review: User Schema & Endpoint

## Original Code

```typescript
import { z } from 'zod';
const UserSchema = z.object({ name: z.any(), email: z.string(), age: z.string(), role: z.string(), bio: z.string().optional().optional().optional() });
interface User { name: any; email: string; age: string; role: string; bio?: string; }

app.post('/api/users', (req, res) => {
  try {
    const data = UserSchema.parse(req.body);
    const age = parseInt(data.age);
    if (isNaN(age)) return res.status(400).json({ error: 'Invalid age' });
    if (!['admin', 'user', 'guest'].includes(data.role)) return res.status(400).json({ error: 'Invalid role' });
    createUser({ ...data, age });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

## Violations Found

### CRITICAL Priority

| # | Rule | Violation | Fix |
|---|------|-----------|-----|
| 1 | `schema-use-unknown-not-any` | `name: z.any()` bypasses type safety entirely. Infers to `any`, disabling TypeScript checks on the `name` field. | Use `z.string().min(1)` since names are strings, or `z.unknown()` if the shape is truly unknown. |
| 2 | `schema-use-primitives-correctly` | `age: z.string()` uses the wrong primitive. Age is a number, not a string. This forces a manual `parseInt` + `isNaN` check downstream -- double validation that Zod should handle. | Use `z.number().int().positive()` or `z.coerce.number().int().positive()` if input may arrive as a string. |
| 3 | `schema-use-enums` | `role: z.string()` accepts any string for a field with a fixed set of values (`'admin' | 'user' | 'guest'`). The manual `.includes()` check downstream duplicates what Zod should enforce at the schema level. | Use `z.enum(['admin', 'user', 'guest'])`. |
| 4 | `schema-string-validations` | `email: z.string()` has no format validation. Any string passes, including empty strings and non-email values. `name: z.any()` has no constraints at all. | Use `z.string().email('Invalid email address')` for email, `z.string().min(1)` for name. |
| 5 | `schema-avoid-optional-abuse` | `bio: z.string().optional().optional().optional()` chains `.optional()` three times. Only one is needed; the extras are dead code that signals confusion about the API. | Use `z.string().optional()` once. |
| 6 | `parse-use-safeparse` | `UserSchema.parse(req.body)` throws on invalid input. The `try/catch` around it catches the exception, but `safeParse()` is the idiomatic pattern for user input -- it returns a result object, avoids exception-driven control flow, and gives structured access to all validation issues. | Use `UserSchema.safeParse(req.body)` and check `result.success`. |
| 7 | `parse-avoid-double-validation` | After Zod parses, the handler manually validates `age` with `parseInt`/`isNaN` and `role` with `.includes()`. This is double validation -- Zod should enforce these constraints at the schema level so downstream code can trust the parsed data. | Move `age` and `role` validation into the schema (see fixes above). Remove manual checks. |

### HIGH Priority

| # | Rule | Violation | Fix |
|---|------|-----------|-----|
| 8 | `type-use-z-infer` | A manual `interface User` is defined separately from `UserSchema`. These will drift apart over time (they already disagree: the schema has `age: z.string()` while a correct schema would have `z.number()`). | Delete the manual interface. Use `type User = z.infer<typeof UserSchema>`. |
| 9 | `error-custom-messages` | No custom error messages on any field. Users see Zod's default technical messages like `"Expected string, received number"` instead of actionable messages like `"Email is required"`. | Add custom messages: `z.string({ required_error: 'Name is required' }).min(1, 'Name cannot be empty')`, etc. |

## Refactored Code

```typescript
import { z } from 'zod';

const Role = z.enum(['admin', 'user', 'guest']);

const UserSchema = z.object({
  name: z.string({
    required_error: 'Name is required',
  }).min(1, 'Name cannot be empty'),

  email: z.string({
    required_error: 'Email is required',
  }).email('Please enter a valid email address'),

  age: z.coerce
    .number({ invalid_type_error: 'Age must be a number' })
    .int('Age must be a whole number')
    .positive('Age must be positive'),

  role: Role,

  bio: z.string().optional(),
});

type User = z.infer<typeof UserSchema>;

app.post('/api/users', (req, res) => {
  const result = UserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: result.error.issues,
    });
  }

  createUser(result.data);
  res.json({ success: true });
});
```

## Summary

| Priority | Violations | Rules |
|----------|-----------|-------|
| CRITICAL | 7 | `schema-use-unknown-not-any`, `schema-use-primitives-correctly`, `schema-use-enums`, `schema-string-validations`, `schema-avoid-optional-abuse`, `parse-use-safeparse`, `parse-avoid-double-validation` |
| HIGH | 2 | `type-use-z-infer`, `error-custom-messages` |
| **Total** | **9** | |

### Key Changes

- **Schema is now the single source of truth.** All validation (type, format, enum) lives in the schema. No manual checks downstream.
- **`z.coerce.number()`** handles string-to-number conversion for `age`, eliminating `parseInt`/`isNaN`.
- **`z.enum()`** for `role` replaces the manual `.includes()` check.
- **`safeParse()`** replaces `parse()` + `try/catch` for idiomatic error handling.
- **`z.infer`** replaces the manual `User` interface, eliminating type drift.
- **Custom error messages** on every field for actionable user feedback.
- **Triple `.optional()`** collapsed to single `.optional()`.
- **`z.any()`** replaced with `z.string().min(1)` for proper type safety on `name`.
