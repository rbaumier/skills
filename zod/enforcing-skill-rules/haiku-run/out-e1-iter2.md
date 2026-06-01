```typescript
import { z } from 'zod';

export const userSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.string().email({ error: 'Invalid email address' }).optional(),
  age: z.coerce.number().int().positive({ error: 'Age must be a positive number' }),
  role: z.enum(['admin', 'user', 'guest'], { error: 'Invalid role' }),
  preferences: z.strictObject({
    theme: z.enum(['light', 'dark'], { error: 'Theme must be light or dark' }),
    locale: z.string().min(1, { error: 'Locale is required' }),
  }),
});

export type User = z.infer<typeof userSchema>;

export const updateUserSchema = userSchema.pick({
  name: true,
  email: true,
  age: true,
}).partial();

export const apiResponseSchema = z.strictObject({
  data: userSchema,
  meta: z.strictObject({ page: z.int().positive({ error: 'Page must be positive' }) }),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = await userSchema.safeParseAsync(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const flattened = z.prettifyError(result.error);
  return { success: false, error: flattened };
}

function processApiResponse(json: string) {
  const parsed = JSON.parse(json);
  const result = apiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid API response: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export type Category = {
  name: string;
  children?: Category[];
};

export const categorySchema: z.ZodType<Category> = z.strictObject({
  name: z.string().trim().min(1, { error: 'Category name is required' }),
  children: z.array(z.lazy(() => categorySchema)).optional(),
});

function ProductCard({ product }: { product: unknown }) {
  const productSchema = z.strictObject({
    name: z.string().trim().min(1, { error: 'Product name is required' }),
    price: z.number().positive({ error: 'Price must be positive' }),
  });
  const validated = productSchema.parse(product);
  return <div>{validated.name}</div>;
}

export const passwordSchema = z.string().min(8, { error: 'Password must be at least 8 characters' })
  .refine((val) => /[A-Z]/.test(val), { message: 'Password must contain uppercase letter' });

export const eventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.strictObject({ type: z.literal('keypress'), key: z.string().min(1, { error: 'Key is required' }) }),
]);

export const userId = z.string().uuid().brand<'UserId'>();
export const orderId = z.string().uuid().brand<'OrderId'>();

export type UserId = z.infer<typeof userId>;
export type OrderId = z.infer<typeof orderId>;

function getOrder(uid: UserId, oid: OrderId) {}

export const orderSchema = z.strictObject({
  quantity: z.coerce.number().int().positive({ error: 'Quantity must be at least 1' }),
  email: z.string().email({ error: 'Please enter a valid email' }),
  address: z.string().trim().min(5, { error: 'Address must be at least 5 characters' }),
});

async function checkUsernameExists(val: string): Promise<boolean> {
  // Mock implementation
  return false;
}

export const usernameSchema = z.string().trim().min(1, { error: 'Username is required' })
  .refine(async (val) => !(await checkUsernameExists(val)), { message: 'Username already taken' });

async function validateUsername(input: string) {
  const result = await usernameSchema.safeParseAsync(input);
  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }
  return result.data;
}

export const userProfileSchema = z.strictObject({
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.string().email({ error: 'Invalid email' }),
  avatar: z.string().url({ error: 'Avatar must be a valid URL' }),
  bio: z.string().trim().max(500, { error: 'Bio must be 500 characters or less' }),
});

export const userCardSchema = userProfileSchema.pick({
  name: true,
  avatar: true,
});

export type UserCard = z.infer<typeof userCardSchema>;

export const dateFieldSchema = z.string().pipe(z.coerce.date());
export type DateField = z.infer<typeof dateFieldSchema>;
export type DateFieldInput = z.input<typeof dateFieldSchema>;

export const settingsSchema = z.strictObject({
  theme: z.enum(['light', 'dark'], { error: 'Invalid theme' }).default('light').catch('light'),
  pageSize: z.number().int().positive({ error: 'Page size must be positive' }).default(20).catch(20),
  experimentalFeatures: z.boolean().default(false).catch(false),
});

export type Settings = z.infer<typeof settingsSchema>;
```
