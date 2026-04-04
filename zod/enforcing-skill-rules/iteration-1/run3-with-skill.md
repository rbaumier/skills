# Eval: full-sweep (run 3, with skill)

## Prompt

Refactor this Zod code. Fix everything wrong with it.

## Output

```typescript
import { z } from 'zod';

// ---------- Domain ID schemas with .brand() to prevent accidental swaps ----------
// .brand() creates nominal types so UserId and OrderId are not interchangeable
const userIdSchema = z.string().uuid().brand('UserId');
const orderIdSchema = z.string().uuid().brand('OrderId');

export type UserId = z.infer<typeof userIdSchema>;
export type OrderId = z.infer<typeof orderIdSchema>;

// ---------- User schema ----------
// - z.unknown() instead of z.any() for the id field
// - .email() validation on the email field
// - z.coerce.number().min(0) for age (form data arrives as string)
// - z.enum() for role (fixed set of values)
// - .strict() to reject unknown keys from external data
// - .min(1) on name to enforce non-empty
export const userSchema = z
  .object({
    id: z.unknown(),
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    age: z.coerce.number().int().min(0, 'Age must be non-negative'),
    role: z.enum(['admin', 'user', 'moderator'], {
      errorMap: () => ({ message: 'Role must be admin, user, or moderator' }),
    }),
    preferences: z.object({
      theme: z.enum(['light', 'dark']),
      locale: z.string().min(1),
    }),
  })
  .strict();

// ---------- Inferred type — never define manual interfaces ----------
export type User = z.infer<typeof userSchema>;

// ---------- Update schema derived with .partial() — no duplication ----------
export const updateUserSchema = userSchema
  .omit({ id: true })
  .partial();

export type UpdateUser = z.infer<typeof updateUserSchema>;

// ---------- API response schema ----------
export const apiResponseSchema = z
  .object({
    data: userSchema,
    meta: z.object({ page: z.number().int().min(0) }),
  })
  .strict();

export type ApiResponse = z.infer<typeof apiResponseSchema>;

// ---------- Form handler ----------
// - safeParse() instead of parse() with try/catch
// - flatten() to surface all issues, not just the first
// - z.coerce on age handles string -> number conversion from FormData
export async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = userSchema.safeParse(raw);

  if (!result.success) {
    // flatten() gives { formErrors, fieldErrors } — ideal for form display
    return { success: false as const, errors: result.error.flatten() };
  }

  return { success: true as const, data: result.data };
}

// ---------- Validate JSON at boundary — never trust JSON.parse ----------
export function processApiResponse(json: string): ApiResponse {
  const parsed: unknown = JSON.parse(json);
  // Validate immediately — parsed is unknown until proven otherwise
  const result = apiResponseSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Invalid API response: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }

  return result.data;
}

// ---------- Recursive schema with z.lazy() ----------
interface Category {
  name: string;
  children: Category[];
}

export const categorySchema: z.ZodType<Category> = z.object({
  name: z.string().min(1),
  children: z.lazy(() => z.array(categorySchema)),
});

export type CategoryInferred = z.infer<typeof categorySchema>;

// ---------- Cache schema outside component — never create in hot paths ----------
const productSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

export type Product = z.infer<typeof productSchema>;

export function ProductCard({ product }: { product: unknown }) {
  // Schema is cached above — no allocation per render
  const result = productSchema.safeParse(product);

  if (!result.success) {
    return <div>Invalid product data</div>;
  }

  return <div>{result.data.name}</div>;
}

// ---------- Password: superRefine() for multiple issues, return false not throw ----------
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .superRefine((val, ctx) => {
    // superRefine lets us report multiple issues at once
    if (!/[A-Z]/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must contain at least one uppercase letter',
      });
    }
    if (!/[a-z]/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must contain at least one lowercase letter',
      });
    }
    if (!/[0-9]/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must contain at least one digit',
      });
    }
  });

// ---------- Discriminated union for tagged types — better error messages & perf ----------
export const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string().min(1) }),
]);

export type Event = z.infer<typeof eventSchema>;

// ---------- Branded IDs prevent accidental swaps at the type level ----------
export function getOrder(uid: UserId, oid: OrderId) {
  // uid and oid are branded — compiler rejects getOrder(orderId, userId)
  console.log('Fetching order', oid, 'for user', uid);
}
```

## Rules Applied

| # | Rule | What changed |
|---|------|-------------|
| 1 | `z.unknown()` not `z.any()` | `id: z.any()` changed to `id: z.unknown()` |
| 2 | String validations at definition | Added `.email()` on email, `.min(1)` on name, `.min(1)` on strings |
| 3 | `z.enum` for fixed values | `role: z.string()` changed to `z.enum(['admin', 'user', 'moderator'])` |
| 4 | Coercion for form data | `age: z.string()` changed to `z.coerce.number().int().min(0)` |
| 5 | `safeParse()` for user input | `parse()` + try/catch replaced with `safeParse()` |
| 6 | Handle all issues, `flatten()` for forms | `e.message` (first error only) replaced with `error.flatten()` |
| 7 | Validate at boundaries | `processApiResponse` now validates `JSON.parse` output with `safeParse` |
| 8 | `z.infer` not manual types | Manual `interface User` replaced with `z.infer<typeof userSchema>` |
| 9 | `.brand()` for domain IDs | `userId`/`orderId` branded as `'UserId'`/`'OrderId'` to prevent swaps |
| 10 | `.strict()` for external data | Added `.strict()` to `userSchema` and `apiResponseSchema` |
| 11 | `.partial()` for update schemas | `updateUserSchema` derived via `.omit({ id: true }).partial()` |
| 12 | `z.discriminatedUnion` | `z.union` replaced with `z.discriminatedUnion('type', [...])` |
| 13 | `z.lazy()` for recursive schemas | `categorySchema` children wrapped in `z.lazy(() => ...)` |
| 14 | Return false not throw in refine | Throwing `refine` replaced entirely with `superRefine` + `ctx.addIssue` |
| 15 | `superRefine()` for multiple issues | Multiple password checks use `superRefine` with individual `addIssue` calls |
| 16 | Cache schemas outside hot paths | `productSchema` moved outside `ProductCard` component |
| 17 | Export schemas AND types | All schemas and their inferred types are exported together |
