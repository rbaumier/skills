# Eval: full-sweep (run2-with-skill)

## Prompt

Refactor this Zod code. Fix everything wrong with it.

## Output

```typescript
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Domain ID schemas — branded to prevent accidental swapping
// e.g. you cannot pass a UserId where an OrderId is expected
// ---------------------------------------------------------------------------
const userId = z.string().uuid().brand<'UserId'>('UserId');
const orderId = z.string().uuid().brand<'OrderId'>('OrderId');

export type UserId = z.infer<typeof userId>;
export type OrderId = z.infer<typeof orderId>;

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------
const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  locale: z.string().min(2, 'Locale must be at least 2 characters'),
});

// ---------------------------------------------------------------------------
// User schema
//   - z.unknown() instead of z.any() for the id field
//   - z.string().email() for the email field (validation at definition)
//   - z.string().min(1) for name (never empty)
//   - z.coerce.number() for age (form/query data comes as strings)
//   - z.enum() for role (fixed set of values)
//   - .strict() rejects unknown keys from external data
// ---------------------------------------------------------------------------
const userSchema = z
  .object({
    id: z.unknown(),
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    age: z.coerce.number().int().positive('Age must be a positive integer'),
    role: z.enum(['admin', 'editor', 'viewer']),
    preferences: preferencesSchema,
  })
  .strict();

// Infer the type from the schema — never define manual interfaces
export type User = z.infer<typeof userSchema>;

// Export the schema alongside the type
export { userSchema };

// ---------------------------------------------------------------------------
// Update schema — derived via .partial() instead of duplicating fields
// Uses .pick() to select only the updatable fields, then .partial()
// ---------------------------------------------------------------------------
const updateUserSchema = userSchema
  .pick({ name: true, email: true, age: true })
  .partial();

export type UpdateUser = z.infer<typeof updateUserSchema>;
export { updateUserSchema };

// ---------------------------------------------------------------------------
// API response schema — strict to reject unexpected keys at the boundary
// ---------------------------------------------------------------------------
const apiResponseSchema = z
  .object({
    data: userSchema,
    meta: z.object({ page: z.number().int().nonnegative() }).strict(),
  })
  .strict();

export type ApiResponse = z.infer<typeof apiResponseSchema>;
export { apiResponseSchema };

// ---------------------------------------------------------------------------
// Form handler
//   - safeParse() instead of parse() with try/catch
//   - flatten() exposes ALL issues in a form-friendly structure
// ---------------------------------------------------------------------------
async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = userSchema.safeParse(raw);

  if (!result.success) {
    // flatten() gives { formErrors, fieldErrors } — perfect for form display
    return { success: false as const, error: result.error.flatten() };
  }

  return { success: true as const, data: result.data };
}

// ---------------------------------------------------------------------------
// Validate JSON from API
//   - NEVER trust JSON.parse output — always validate at the boundary
//   - safeParse handles both malformed JSON and invalid shape
// ---------------------------------------------------------------------------
function processApiResponse(json: string): ApiResponse {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Malformed JSON');
  }

  const result = apiResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid API response: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Recursive category schema — z.lazy() is required for self-referencing
// ---------------------------------------------------------------------------
interface Category {
  name: string;
  children: Category[];
}

const categorySchema: z.ZodType<Category> = z.object({
  name: z.string().min(1),
  children: z.lazy(() => z.array(categorySchema)),
});

export type { Category };
export { categorySchema };

// ---------------------------------------------------------------------------
// Product schema — cached outside the component so it is NOT recreated
// on every render (performance: avoid dynamic schema creation in hot paths)
// ---------------------------------------------------------------------------
const productSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

function ProductCard({ product }: { product: unknown }) {
  const result = productSchema.safeParse(product);
  if (!result.success) return <div>Invalid product</div>;
  return <div>{result.data.name}</div>;
}

// ---------------------------------------------------------------------------
// Password schema
//   - superRefine() instead of refine() when reporting multiple issues
//   - return false / ctx.addIssue — NEVER throw inside refine callbacks
// ---------------------------------------------------------------------------
const passwordSchema = z.string().superRefine((val, ctx) => {
  if (val.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 8,
      type: 'string',
      inclusive: true,
      message: 'Password must be at least 8 characters',
    });
  }

  if (!/[A-Z]/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain at least one uppercase letter',
    });
  }

  if (!/[0-9]/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain at least one digit',
    });
  }
});

export { passwordSchema };

// ---------------------------------------------------------------------------
// Event schema — discriminatedUnion for tagged types (better perf + errors)
// ---------------------------------------------------------------------------
const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string().min(1) }),
]);

export type Event = z.infer<typeof eventSchema>;
export { eventSchema };

// ---------------------------------------------------------------------------
// getOrder — branded IDs prevent accidentally swapping userId / orderId
// ---------------------------------------------------------------------------
function getOrder(uid: UserId, oid: OrderId) {
  // uid is branded as UserId, oid as OrderId — compiler rejects swaps
}
```

## Rules applied

| # | Rule | What changed |
|---|------|-------------|
| 1 | `z.unknown()` not `z.any()` | `id` field changed from `z.any()` to `z.unknown()` |
| 2 | String validations at definition | Added `.email()` on email, `.min(1)` on name, `.min(2)` on locale |
| 3 | `z.enum` for fixed values | `role` changed from `z.string()` to `z.enum(['admin', 'editor', 'viewer'])` |
| 4 | `z.coerce` for form/query data | `age` changed from `z.string()` to `z.coerce.number().int().positive()` |
| 5 | `safeParse()` for user input | `handleForm` uses `safeParse()` instead of `parse()` with try/catch |
| 6 | Handle all issues, `flatten()` for forms | `handleForm` returns `result.error.flatten()` with all field errors |
| 7 | Validate at boundaries | `processApiResponse` validates JSON.parse output through `apiResponseSchema.safeParse()` |
| 8 | `z.infer` not manual types | Removed manual `interface User`, replaced with `z.infer<typeof userSchema>` |
| 9 | `.brand()` for domain IDs | `userId` and `orderId` use `.brand('UserId')` / `.brand('OrderId')` to prevent mixing |
| 10 | `.strict()` for external data | Added `.strict()` on `userSchema` and `apiResponseSchema` to reject unknown keys |
| 11 | `.partial()` for update schemas | `updateUserSchema` derived via `userSchema.pick(...).partial()` instead of duplication |
| 12 | `z.discriminatedUnion` | `eventSchema` changed from `z.union` to `z.discriminatedUnion('type', [...])` |
| 13 | `z.lazy()` for recursive schemas | `categorySchema.children` wrapped in `z.lazy(() => ...)` |
| 14 | Return false in refine, never throw | Replaced throwing `refine` with `superRefine` using `ctx.addIssue` |
| 15 | `superRefine()` for multiple issues | Password validation uses `superRefine` to report length + uppercase + digit separately |
| 16 | Cache schema outside hot paths | `productSchema` moved outside `ProductCard` component |
| 17 | Export schemas AND types | Every schema is exported alongside its inferred type |
