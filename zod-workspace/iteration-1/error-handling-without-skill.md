# Zod Review: Order Validation Error Handling

## High-Severity Issues

### 1. Only First Validation Error Returned to Client
**Severity: HIGH**
**Rule violated: `parse-handle-all-issues` - Handle all validation issues, not just first**

The handler picks `result.error.issues[0]` and discards the rest. If a user submits an order with an invalid shipping address AND invalid item quantities, they see only one error, fix it, resubmit, see the next, fix it, resubmit -- a painful fix-submit-fix loop.

```typescript
// Current - only first error
const firstError = result.error.issues[0];
return res.status(400).json({ error: firstError.message });
```

**Fix:** Return all errors, keyed by field path using `flatten()`:
```typescript
if (!result.success) {
  const { fieldErrors, formErrors } = result.error.flatten();
  return res.status(400).json({ errors: fieldErrors });
}
```

### 2. No Custom Error Messages on Schema Fields
**Severity: HIGH**
**Rule violated: `error-custom-messages` - Provide custom error messages**

Every validator uses Zod defaults: `quantity: z.number().min(1)` produces `"Number must be greater than or equal to 1"`. Users see technical jargon with no field context. For an order form, messages like `"Quantity must be at least 1"` are immediately actionable.

**Fix:** Add custom messages to each constraint:
```typescript
items: z.array(z.object({
  productId: z.string({ required_error: 'Product is required' }),
  quantity: z.number({ invalid_type_error: 'Quantity must be a number' }).min(1, 'Quantity must be at least 1'),
  price: z.number({ invalid_type_error: 'Price must be a number' }).positive('Price must be greater than zero'),
})),
shippingAddress: z.object({
  street: z.string({ required_error: 'Street is required' }).min(1, 'Street cannot be empty'),
  city: z.string({ required_error: 'City is required' }).min(1, 'City cannot be empty'),
  zip: z.string({ required_error: 'ZIP code is required' }).min(1, 'ZIP code cannot be empty'),
}),
```

### 3. Throwing Inside Refine Hides Concurrent Errors
**Severity: HIGH**
**Rule violated: `error-avoid-throwing-in-refine` - Return false instead of throwing in refine**

`PasswordSchema` throws `new Error()` inside `.refine()`. Throwing short-circuits validation -- if the password is both too short and missing an uppercase letter, only `"Too short"` is ever surfaced. The user never sees both issues at once.

```typescript
// Current - throws, stops validation on first failure
const PasswordSchema = z.string().refine((val) => {
  if (val.length < 8) throw new Error('Too short');
  if (!/[A-Z]/.test(val)) throw new Error('Need uppercase');
  return true;
});
```

**Fix:** Use `superRefine` and `ctx.addIssue` to report all failures simultaneously:
```typescript
const PasswordSchema = z.string().superRefine((val, ctx) => {
  if (val.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must be at least 8 characters',
    });
  }
  if (!/[A-Z]/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain an uppercase letter',
    });
  }
});
```

## Medium-Severity Issues

### 4. No Path Information in Error Response
**Severity: MEDIUM**
**Rule violated: `error-path-for-nested` - Use issue.path for nested error location**

The response is `{ error: "some message" }` with no indication of which field failed. For nested structures like `items[0].quantity` or `shippingAddress.zip`, the client has no way to highlight the correct field. Using `flatten()` (as suggested in issue #1) solves this automatically by keying errors to their field paths.

### 5. No Use of flatten() or format() for Structured Errors
**Severity: MEDIUM**
**Rule violated: `error-use-flatten` - Use flatten() for form error display**

The raw `issues[0].message` string is manually extracted. Zod provides `flatten()` and `format()` specifically to produce field-keyed error objects suitable for API responses and form display, without manual path parsing.

## Summary

| # | Issue | Severity | Rule |
|---|---|---|---|
| 1 | Only first error returned | HIGH | `parse-handle-all-issues` |
| 2 | No custom error messages | HIGH | `error-custom-messages` |
| 3 | Throwing inside refine | HIGH | `error-avoid-throwing-in-refine` |
| 4 | No path in error response | MEDIUM | `error-path-for-nested` |
| 5 | No structured error output | MEDIUM | `error-use-flatten` |

**Verdict:** The error handling defeats Zod's main advantage -- collecting all validation issues at once. The combination of showing only the first error, using default messages, and throwing in refine creates a poor user experience where each submission reveals at most one problem. All three HIGH issues should be fixed together since they are interconnected.
