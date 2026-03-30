# Review: Error Handling

## Code Under Review

```typescript
import { z } from 'zod';
const OrderSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().min(1), price: z.number().positive() })),
  shippingAddress: z.object({ street: z.string(), city: z.string(), zip: z.string() }),
  coupon: z.string().optional(),
});

app.post('/api/orders', (req, res) => {
  const result = OrderSchema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return res.status(400).json({ error: firstError.message });
  }
  processOrder(result.data);
});

const PasswordSchema = z.string().refine((val) => {
  if (val.length < 8) throw new Error('Too short');
  if (!/[A-Z]/.test(val)) throw new Error('Need uppercase');
  return true;
});
```

## Issues Found

### 1. `parse-handle-all-issues` -- FAIL

**Location:** `const firstError = result.error.issues[0]`

Only the first validation issue is returned to the client. Zod collects all failures, but this code discards every issue after the first. The user must fix one error, resubmit, discover the next error, resubmit again -- a terrible experience.

**Fix:** Return all issues using `flatten()` or iterate over `result.error.issues`.

```typescript
if (!result.success) {
  const { fieldErrors } = result.error.flatten();
  return res.status(400).json({ errors: fieldErrors });
}
```

### 2. `error-custom-messages` -- FAIL

**Location:** `z.number().min(1)`, `z.number().positive()`, `z.string()` (all fields)

No custom error messages on any field. Default Zod messages like `"Number must be greater than or equal to 1"` or `"Expected string, received undefined"` are technical and meaningless to API consumers. Every user-facing field should have a human-readable message.

**Fix:** Add custom messages to each validator.

```typescript
const OrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string({ required_error: 'Product ID is required' }),
    quantity: z.number({ required_error: 'Quantity is required' }).min(1, 'Quantity must be at least 1'),
    price: z.number({ required_error: 'Price is required' }).positive('Price must be a positive number'),
  })),
  shippingAddress: z.object({
    street: z.string({ required_error: 'Street is required' }).min(1, 'Street cannot be empty'),
    city: z.string({ required_error: 'City is required' }).min(1, 'City cannot be empty'),
    zip: z.string({ required_error: 'ZIP code is required' }).min(1, 'ZIP code cannot be empty'),
  }),
  coupon: z.string().optional(),
});
```

### 3. `error-avoid-throwing-in-refine` -- FAIL

**Location:** `PasswordSchema` refine callback

The refine callback throws `Error` objects instead of returning `false`. Throwing inside `.refine()` stops validation immediately, preventing Zod from collecting other issues. If the password is both too short and missing uppercase, only `"Too short"` is reported -- the uppercase error is hidden.

**Fix:** Use `.superRefine()` with `ctx.addIssue()` to report all password failures at once.

```typescript
const PasswordSchema = z.string().superRefine((password, ctx) => {
  if (password.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must be at least 8 characters',
    });
  }
  if (!/[A-Z]/.test(password)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain an uppercase letter',
    });
  }
});
```

### 4. `error-path-for-nested` -- FAIL

**Location:** `return res.status(400).json({ error: firstError.message })`

Even if all issues were returned, the response drops `issue.path` -- the client has no way to know *which* nested field failed. For an order with multiple items, `"Number must be greater than or equal to 1"` is useless without knowing it refers to `items.2.quantity`.

**Fix:** Already addressed by switching to `flatten()` (issue #1), which keys errors by field path. If building a custom response, include path:

```typescript
result.error.issues.map(issue => ({
  path: issue.path.join('.'),
  message: issue.message,
}));
```

### 5. `error-use-flatten` -- FAIL

**Location:** Error response construction

The code manually indexes into `result.error.issues[0]` instead of using `flatten()` or `format()`. For an API with nested objects like `shippingAddress` and arrays like `items`, `flatten()` provides field-keyed errors ready for client consumption without manual path joining.

**Fix:** See issue #1.

## Summary

| Rule | Status | Evidence |
|---|---|---|
| `error-custom-messages` | FAIL | No custom messages on any field; defaults like "Expected string, received number" |
| `error-use-flatten` | FAIL | Manual `issues[0]` access instead of `flatten()` |
| `error-path-for-nested` | FAIL | Path information discarded in error response |
| `error-i18n` | N/A | No i18n requirement in this context |
| `error-avoid-throwing-in-refine` | FAIL | `PasswordSchema` throws `Error` inside `.refine()` callback |
| `parse-handle-all-issues` | FAIL | Only first issue returned: `result.error.issues[0]` |

**Result: 0/5 applicable rules passed.**
