```typescript
import { z } from 'zod';

// Schema definitions at module scope with exports
export const userSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.string().email({ error: 'Invalid email address' }).optional(),
  age: z.coerce.number().int().positive({ error: 'Age must be a positive number' }),
  role: z.enum(['admin', 'user', 'guest'], { error: 'Invalid role' }),
  preferences: z.strictObject({
    theme: z.enum(['light', 'dark'], { error: 'Theme must be light or dark' }),
    locale: z.string().trim().min(1, { error: 'Locale is required' }),
  }),
});

export type User = z.infer<typeof userSchema>;

export const updateUserSchema = userSchema.partial();

export const apiResponseSchema = z.strictObject({
  data: userSchema,
  meta: z.strictObject({ page: z.int().positive({ error: 'Page must be positive' }) }),
});

async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = await userSchema.safeParseAsync(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.flatten() };
}

function processApiResponse(json: string) {
  const parsed = JSON.parse(json);
  const result = apiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid API response: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const categorySchema: z.ZodType<{ name: string; children: Category[] }> = z.lazy(() =>
  z.strictObject({
    name: z.string().trim().min(1, { error: 'Category name is required' }),
    children: z.array(categorySchema),
  })
);

type Category = z.infer<typeof categorySchema>;

const productSchema = z.strictObject({
  name: z.string().trim().min(1, { error: 'Product name is required' }),
  price: z.number().positive({ error: 'Price must be positive' }),
});

function ProductCard({ product }: { product: unknown }) {
  const result = productSchema.safeParse(product);
  if (!result.success) {
    return <div>Invalid product data</div>;
  }
  return <div>{result.data.name}</div>;
}

export const passwordSchema = z.string().superRefine((val, ctx) => {
  if (val.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must be at least 8 characters',
      path: [],
    });
  }
  if (!/[A-Z]/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain at least one uppercase letter',
      path: [],
    });
  }
});

export const eventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.strictObject({ type: z.literal('keypress'), key: z.string().trim().min(1) }),
]);

export const userIdSchema = z.string().uuid().brand<'UserId'>();
export const orderIdSchema = z.string().uuid().brand<'OrderId'>();

export type UserId = z.infer<typeof userIdSchema>;
export type OrderId = z.infer<typeof orderIdSchema>;

function getOrder(uid: UserId, oid: OrderId) {
  // uid and oid are now branded types, preventing accidental mixing
}

// User-facing validator with custom messages
export const orderSchema = z.strictObject({
  quantity: z.int().positive({ error: 'Quantity must be at least 1' }),
  email: z.string().email({ error: 'Please provide a valid email address' }),
  address: z.string().trim().min(5, { error: 'Address must be at least 5 characters' }),
});

// Async validation with parseAsync
async function checkUsernameExists(val: string): Promise<boolean> {
  // Mock function
  return false;
}

export const usernameSchema = z.string().trim().min(1, { error: 'Username is required' })
  .refine(
    async (val) => {
      const exists = await checkUsernameExists(val);
      return !exists;
    },
    { error: 'Username already taken' }
  );

async function validateUsername(input: string) {
  return await usernameSchema.parseAsync(input);
}

// Reuse canonical schema with pick instead of redeclaring
export const userCardSchema = userProfileSchema.pick({ name: true, avatar: true });

export const userProfileSchema = z.strictObject({
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.string().email({ error: 'Invalid email' }),
  avatar: z.string().url({ error: 'Avatar must be a valid URL' }),
  bio: z.string().trim().max(500, { error: 'Bio must be under 500 characters' }).optional(),
});

// Multi-stage validation with pipe
export const dateFieldSchema = z.string()
  .trim()
  .transform((val) => new Date(val))
  .pipe(z.date({ error: 'Invalid date' }));

export type DateFieldInput = z.input<typeof dateFieldSchema>;
export type DateField = z.output<typeof dateFieldSchema>;

// Tolerant config schema with default and catch
export const settingsSchema = z.strictObject({
  theme: z.enum(['light', 'dark'], { error: 'Invalid theme' }).catch('light').default('light'),
  pageSize: z.number().int().positive({ error: 'Page size must be positive' }).catch(20).default(20),
  experimentalFeatures: z.boolean().catch(false).default(false),
});
```
