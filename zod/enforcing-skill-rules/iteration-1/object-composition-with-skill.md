# Review: Object Composition

## Code Under Review

```typescript
import { z } from 'zod';
const UserSchema = z.object({ id: z.string().uuid(), name: z.string().min(1), email: z.string().email(), password: z.string().min(8), role: z.string(), createdAt: z.date() });
const CreateUserSchema = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8), role: z.string() });
const UpdateUserSchema = z.object({ name: z.string().min(1).optional(), email: z.string().email().optional(), password: z.string().min(8).optional(), role: z.string().optional() });

type Shape = 'circle' | 'square' | 'triangle';
const ShapeSchema = z.object({ type: z.string(), radius: z.number().optional(), side: z.number().optional(), base: z.number().optional(), height: z.number().optional() });

const ConfigSchema = z.object({ port: z.number(), host: z.string() });
const config = ConfigSchema.parse({ port: 3000, host: 'localhost', debug: true, secret: 'leaked' });
```

## Issues Found

### 1. `object-pick-omit` -- FAIL

`CreateUserSchema` manually duplicates fields from `UserSchema` instead of deriving via `.omit()`. If a validation rule changes on `UserSchema` (e.g., `name` gets `.max(100)`), `CreateUserSchema` will silently drift.

**Fix:** Derive `CreateUserSchema` from `UserSchema` using `.omit()`:

```typescript
const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
```

### 2. `object-partial-for-updates` -- FAIL

`UpdateUserSchema` manually re-declares every field with `.optional()` appended. This is the textbook case for `.partial()`. It duplicates validation rules and will drift from `UserSchema` when fields are added or constraints change.

**Fix:** Derive `UpdateUserSchema` from the create schema (or base schema) using `.partial()`:

```typescript
const UpdateUserSchema = UserSchema.omit({ id: true, createdAt: true }).partial();
```

### 3. `schema-use-enums` -- FAIL

`role` is declared as `z.string()` in `UserSchema`, `CreateUserSchema`, and `UpdateUserSchema`. If role is a fixed set of values (e.g., `'admin' | 'user' | 'editor'`), `z.string()` accepts any string including typos. This is a CRITICAL-impact rule.

Similarly, `ShapeSchema.type` uses `z.string()` when the `Shape` type clearly defines a fixed set: `'circle' | 'square' | 'triangle'`.

**Fix:**

```typescript
const Role = z.enum(['admin', 'user', 'editor']);

// In UserSchema:
role: Role,

// For ShapeSchema:
type: z.enum(['circle', 'square', 'triangle']),
```

### 4. `object-discriminated-unions` -- FAIL

`ShapeSchema` uses a single object with optional fields for all shape variants. This means a "circle" can have `side`, `base`, and `height` set -- there is no structural enforcement. The `Shape` type union (`'circle' | 'square' | 'triangle'`) is a clear discriminator candidate.

**Fix:** Use `z.discriminatedUnion()` to enforce shape-specific fields:

```typescript
const ShapeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circle'), radius: z.number() }),
  z.object({ type: z.literal('square'), side: z.number() }),
  z.object({ type: z.literal('triangle'), base: z.number(), height: z.number() }),
]);
```

### 5. `object-strict-vs-strip` -- FAIL

`ConfigSchema.parse({ port: 3000, host: 'localhost', debug: true, secret: 'leaked' })` silently strips `debug` and `secret`. The `secret: 'leaked'` field being silently discarded is particularly dangerous -- it could indicate a schema mismatch where sensitive data is being passed to the wrong handler. At minimum, `.strict()` would surface this mismatch immediately.

**Fix:**

```typescript
const ConfigSchema = z.object({ port: z.number(), host: z.string() }).strict();
// Now throws: ZodError: Unrecognized key(s) in object: 'debug', 'secret'
```

### 6. `type-use-z-infer` -- FAIL

The `Shape` type is manually declared as `type Shape = 'circle' | 'square' | 'triangle'` and is completely disconnected from `ShapeSchema`. No `z.infer` types are exported for any schema. When schemas change, any manual types will drift.

**Fix:**

```typescript
const ShapeSchema = z.discriminatedUnion('type', [/* ... */]);
type Shape = z.infer<typeof ShapeSchema>;

type User = z.infer<typeof UserSchema>;
type CreateUser = z.infer<typeof CreateUserSchema>;
type UpdateUser = z.infer<typeof UpdateUserSchema>;
```

### 7. `compose-shared-schemas` -- FAIL

The `role` field definition (`z.string()`, which should be `z.enum(...)`) is duplicated across three schemas. If `UserSchema` used `.omit()` and `.partial()` as recommended above, this duplication would be eliminated automatically. Still worth noting: shared primitives like `Role` should be extracted and reused.

## Summary

| Rule | Status | Impact |
|---|---|---|
| `object-pick-omit` | FAIL | MEDIUM-HIGH |
| `object-partial-for-updates` | FAIL | MEDIUM-HIGH |
| `schema-use-enums` | FAIL | CRITICAL |
| `object-discriminated-unions` | FAIL | MEDIUM-HIGH |
| `object-strict-vs-strip` | FAIL | MEDIUM-HIGH |
| `type-use-z-infer` | FAIL | HIGH |
| `compose-shared-schemas` | FAIL | MEDIUM |

**Result: 0/7 applicable rules followed.**

## Recommended Refactor

```typescript
import { z } from 'zod';

const Role = z.enum(['admin', 'user', 'editor']);

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: Role,
  createdAt: z.date(),
});

type User = z.infer<typeof UserSchema>;

const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
type CreateUser = z.infer<typeof CreateUserSchema>;

const UpdateUserSchema = CreateUserSchema.partial();
type UpdateUser = z.infer<typeof UpdateUserSchema>;

const ShapeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circle'), radius: z.number() }),
  z.object({ type: z.literal('square'), side: z.number() }),
  z.object({ type: z.literal('triangle'), base: z.number(), height: z.number() }),
]);

type Shape = z.infer<typeof ShapeSchema>;

const ConfigSchema = z.object({
  port: z.number(),
  host: z.string(),
}).strict();

const config = ConfigSchema.parse({ port: 3000, host: 'localhost' });
```
