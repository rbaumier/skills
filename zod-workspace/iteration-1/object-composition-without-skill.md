# Zod Schema Review: Object Composition

## Issues Found: 4

---

### 1. Duplicated schemas for Create and Update variants

**Severity**: MEDIUM-HIGH
**Rule**: `object-partial-for-updates`, `object-pick-omit`

`CreateUserSchema` and `UpdateUserSchema` duplicate every field from `UserSchema` manually. When `UserSchema` changes, the variants will drift silently.

**Current code:**
```typescript
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.string().optional(),
});
```

**Recommended:**
```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.date(),
});

const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
const UpdateUserSchema = CreateUserSchema.partial();
```

Single source of truth. All three schemas stay in sync automatically.

---

### 2. `role` uses `z.string()` instead of `z.enum()`

**Severity**: CRITICAL
**Rule**: `schema-use-enums`

`role` is a fixed set of values, not a freeform string. Using `z.string()` accepts any value including typos (`"admni"`, `"superuser"`), bypassing validation entirely.

**Current code:**
```typescript
role: z.string()
```

**Recommended:**
```typescript
const Role = z.enum(['admin', 'user', 'guest']);
// ...
role: Role,
```

---

### 3. `ShapeSchema` should be a discriminated union

**Severity**: MEDIUM-HIGH
**Rule**: `object-discriminated-unions`, `schema-use-enums`

The current `ShapeSchema` accepts any combination of optional fields with a freeform `type` string. Nothing prevents `{ type: 'circle', base: 10 }` or `{ type: 'triangle' }` (missing required dimensions). The TypeScript `Shape` type is also unused.

**Current code:**
```typescript
type Shape = 'circle' | 'square' | 'triangle';
const ShapeSchema = z.object({
  type: z.string(),
  radius: z.number().optional(),
  side: z.number().optional(),
  base: z.number().optional(),
  height: z.number().optional(),
});
```

**Recommended:**
```typescript
const ShapeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circle'), radius: z.number().positive() }),
  z.object({ type: z.literal('square'), side: z.number().positive() }),
  z.object({
    type: z.literal('triangle'),
    base: z.number().positive(),
    height: z.number().positive(),
  }),
]);

type Shape = z.infer<typeof ShapeSchema>;
```

Each variant enforces exactly the fields it needs. TypeScript narrows automatically on `shape.type`, and Zod uses O(1) dispatch instead of trying each variant.

---

### 4. `ConfigSchema.parse()` silently strips unknown keys

**Severity**: MEDIUM-HIGH
**Rule**: `object-strict-vs-strip`

`debug: true` and `secret: 'leaked'` are silently stripped by the default `strip` behavior. Two problems:
- `debug` is likely a real config field missing from the schema -- a silent bug.
- `secret` passes through parsing unchecked -- if this were passed downstream before parsing, it leaks.

**Current code:**
```typescript
const ConfigSchema = z.object({ port: z.number(), host: z.string() });
const config = ConfigSchema.parse({ port: 3000, host: 'localhost', debug: true, secret: 'leaked' });
```

**Recommended:**
```typescript
const ConfigSchema = z.object({
  port: z.number(),
  host: z.string(),
}).strict();
```

Using `.strict()` would immediately surface the schema mismatch at parse time, forcing the developer to either add the missing fields to the schema or remove them from the input.

---

## Summary

| # | Issue | Severity | Rule |
|---|-------|----------|------|
| 1 | Duplicated Create/Update schemas | MEDIUM-HIGH | `object-partial-for-updates`, `object-pick-omit` |
| 2 | `role` as freeform string | CRITICAL | `schema-use-enums` |
| 3 | Shape as bag of optionals | MEDIUM-HIGH | `object-discriminated-unions` |
| 4 | Silent stripping of unknown config keys | MEDIUM-HIGH | `object-strict-vs-strip` |
