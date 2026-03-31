# Review: Zod Schema & Parsing

## Issues Found

### 1. `z.any()` on `name` — use `z.string()` with validation

`z.any()` bypasses TypeScript's type system entirely. The `name` field accepts numbers, objects, arrays — anything.

```typescript
// Bad
name: z.any()

// Good
name: z.string().min(1, "Name is required")
```

### 2. `age` is `z.string()` with manual `parseInt` — use `z.coerce.number()`

The schema accepts age as a string, then manually parses it with `parseInt` and checks `isNaN`. This is double validation. Zod's coercion handles this in one step.

```typescript
// Bad
age: z.string()
// ...later...
const age = parseInt(data.age);
if (isNaN(age)) return res.status(400).json({ error: 'Invalid age' });

// Good
age: z.coerce.number().int().min(0).max(150)
```

### 3. `role` is `z.string()` with manual `.includes()` check — use `z.enum()`

The valid roles are checked manually after parsing. This duplicates validation logic that belongs in the schema and loses autocomplete/type narrowing.

```typescript
// Bad
role: z.string()
// ...later...
if (!['admin', 'user', 'guest'].includes(data.role))

// Good
role: z.enum(['admin', 'user', 'guest'])
```

### 4. `email` has no `.email()` validation

`z.string()` alone accepts any string including empty strings and non-email values.

```typescript
// Bad
email: z.string()

// Good
email: z.string().email("Invalid email address")
```

### 5. `.optional().optional().optional()` on `bio`

Chaining `.optional()` multiple times is redundant. One is sufficient.

```typescript
// Bad
bio: z.string().optional().optional().optional()

// Good
bio: z.string().max(500).optional()
```

### 6. `parse()` instead of `safeParse()` for user input

`parse()` throws on invalid data. In an HTTP handler, this means relying on try/catch for control flow, exposing raw Zod error internals, and only surfacing the first error.

```typescript
// Bad
try {
  const data = UserSchema.parse(req.body);
} catch (e) {
  res.status(400).json({ error: e.message });
}

// Good
const result = UserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.flatten().fieldErrors });
}
const data = result.data;
```

### 7. Manual `User` interface instead of `z.infer`

The `User` interface is manually written and will drift from the schema over time. Any schema change requires updating two locations.

```typescript
// Bad
interface User { name: any; email: string; age: string; role: string; bio?: string; }

// Good
type User = z.infer<typeof UserSchema>;
```

### 8. No custom error messages

Default Zod messages like "Expected string, received number" are not user-friendly. Each field should have a human-readable message.

### 9. Raw `e.message` instead of `flatten()` for error response

`e.message` dumps Zod's internal error format. `flatten()` provides structured field-level errors suitable for API responses and form display.

## Refactored Code

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  age: z.coerce.number({ invalid_type_error: "Age must be a number" }).int().min(0).max(150),
  role: z.enum(['admin', 'user', 'guest'], { message: "Role must be admin, user, or guest" }),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
});

type User = z.infer<typeof UserSchema>;

app.post('/api/users', (req, res) => {
  const result = UserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }
  createUser(result.data);
  res.json({ success: true });
});
```

## Summary

| # | Rule | Severity |
|---|------|----------|
| 1 | `schema-use-unknown-not-any` — `z.any()` on name | CRITICAL |
| 2 | `schema-coercion-for-form-data` + `parse-avoid-double-validation` — manual parseInt | CRITICAL |
| 3 | `schema-use-enums` — manual role check | CRITICAL |
| 4 | `schema-string-validations` — no email validation | CRITICAL |
| 5 | `schema-avoid-optional-abuse` — triple .optional() | CRITICAL |
| 6 | `parse-use-safeparse` — parse() throws on user input | CRITICAL |
| 7 | `type-use-z-infer` — manual interface | HIGH |
| 8 | `error-custom-messages` — no custom messages | HIGH |
| 9 | `error-use-flatten` — raw e.message in response | HIGH |
