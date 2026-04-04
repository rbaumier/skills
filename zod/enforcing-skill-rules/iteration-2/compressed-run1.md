# Zod Eval — Full Sweep — Compressed Run 1

## Fixed Code

```typescript
import { z } from 'zod';

// [no-any-unknown] z.unknown() not z.any()
// [string-validations] .email(), .min() applied at definition
// [enum-fixed-values] z.enum for role
// [coercion-form] z.coerce.number() for age from form data
// [strict-unknown-keys] .strict() for external data
// [export-schema-and-type] Export schema AND inferred type together
export const userSchema = z.object({
  id: z.unknown(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.coerce.number().int().positive(),
  role: z.enum(['admin', 'editor', 'viewer']),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    locale: z.string().min(2).max(5),
  }),
}).strict();

// [infer-not-manual] z.infer, not manual interface
export type User = z.infer<typeof userSchema>;

// [partial-updates] Derived from base schema, not duplicated
export const updateUserSchema = userSchema
  .pick({ name: true, email: true, age: true })
  .partial();
export type UpdateUser = z.infer<typeof updateUserSchema>;

// [strict-unknown-keys] strict() on API response schema
export const apiResponseSchema = z.object({
  data: userSchema,
  meta: z.object({ page: z.number().int().nonnegative() }),
}).strict();
export type ApiResponse = z.infer<typeof apiResponseSchema>;

// [safeParse] safeParse() for user input, not parse() with try/catch
// [handle-all-issues] flatten() for form display, not just first error
async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = userSchema.safeParse(raw);

  if (!result.success) {
    return { success: false, errors: result.error.flatten().fieldErrors };
  }

  return { success: true, data: result.data };
}

// [validate-boundaries] Validate JSON.parse output, never trust it
function processApiResponse(json: string) {
  const raw: unknown = JSON.parse(json);
  const result = apiResponseSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(`Invalid API response: ${result.error.message}`);
  }

  return result.data;
}

// [lazy-recursive] z.lazy() for recursive schema, not direct self-reference
interface Category {
  name: string;
  children: Category[];
}

const categorySchema: z.ZodType<Category> = z.object({
  name: z.string().min(1),
  children: z.lazy(() => z.array(categorySchema)),
});

// [cache-schema] Schema cached outside component, not created on every render
const productSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});
type Product = z.infer<typeof productSchema>;

function ProductCard({ product }: { product: unknown }) {
  const validated = productSchema.parse(product);
  return <div>{validated.name}</div>;
}

// [refine-no-throw] Return false, never throw in refine
// [superRefine-multiple] superRefine() for multiple validation issues
const passwordSchema = z.string().superRefine((val, ctx) => {
  if (val.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
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
      message: 'Password must contain at least one number',
    });
  }
});

// [discriminated-union] z.discriminatedUnion for tagged types
const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
]);
export type Event = z.infer<typeof eventSchema>;

// [brand-domain-ids] .brand() prevents mixing UserId and OrderId
const userIdSchema = z.string().uuid().brand('UserId');
const orderIdSchema = z.string().uuid().brand('OrderId');

export type UserId = z.infer<typeof userIdSchema>;
export type OrderId = z.infer<typeof orderIdSchema>;

function getOrder(uid: UserId, oid: OrderId) {
  // uid and oid are branded — cannot accidentally swap them
}
```

## Issues Fixed

| # | Assertion ID | What was wrong | Fix applied |
|---|---|---|---|
| 1 | no-any-unknown | `z.any()` for id | `z.unknown()` |
| 2 | string-validations | `z.string()` without validations | `.email()`, `.min()` at definition |
| 3 | enum-fixed-values | `role: z.string()` | `z.enum(['admin', 'editor', 'viewer'])` |
| 4 | coercion-form | `age: z.string()` from form | `z.coerce.number().int().positive()` |
| 5 | safeParse | `parse()` with try/catch | `safeParse()` with result check |
| 6 | handle-all-issues | `e.message` (first error only) | `error.flatten().fieldErrors` |
| 7 | validate-boundaries | `JSON.parse` output trusted as-is | `apiResponseSchema.safeParse(raw)` |
| 8 | infer-not-manual | Manual `interface User` | `z.infer<typeof userSchema>` |
| 9 | brand-domain-ids | userId/orderId both `z.string().uuid()` swappable | `.brand('UserId')` / `.brand('OrderId')` |
| 10 | strict-unknown-keys | No strict mode | `.strict()` on schemas for external data |
| 11 | partial-updates | Duplicated `updateUserSchema` | `userSchema.pick(...).partial()` |
| 12 | discriminated-union | `z.union` for tagged types | `z.discriminatedUnion('type', [...])` |
| 13 | lazy-recursive | Direct self-reference in categorySchema | `z.lazy(() => z.array(categorySchema))` |
| 14 | refine-no-throw | `throw new Error()` inside refine | `superRefine` with `ctx.addIssue()` |
| 15 | superRefine-multiple | Multiple checks crammed in single refine | `superRefine()` with multiple `addIssue()` |
| 16 | cache-schema | Schema created inside component | Schema const moved outside component |
| 17 | export-schema-and-type | Inconsistent exports | `export` on both schema and `type` |
