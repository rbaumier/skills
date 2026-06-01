```typescript
import { z } from 'zod';

// Schema: replace z.any() with z.unknown()
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.string().email({ error: 'Invalid email address' }),
  age: z.coerce.number().int().positive({ error: 'Age must be a positive number' }),
  role: z.enum(['admin', 'user', 'guest'], { error: 'Invalid role' }),
  preferences: z.object({
    theme: z.enum(['light', 'dark'], { error: 'Theme must be light or dark' }),
    locale: z.string().min(1, { error: 'Locale is required' }),
  }),
}).strict();

export type User = z.infer<typeof userSchema>;

export const updateUserSchema = userSchema.pick({
  name: true,
  email: true,
  age: true,
}).partial();

export const apiResponseSchema = z.object({
  data: userSchema,
  meta: z.object({ page: z.number().int().positive({ error: 'Page must be positive' }) }),
}).strict();

export type ApiResponse = z.infer<typeof apiResponseSchema>;

async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = await userSchema.safeParseAsync(raw);
  if (!result.success) {
    return { success: false, error: z.prettifyError(result.error) };
  }
  return { success: true, data: result.data };
}

function processApiResponse(json: string) {
  const parsed = JSON.parse(json);
  const result = apiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Invalid API response');
  }
  return result.data;
}

// Recursive schema with explicit type definition
type Category = {
  name: string;
  children: Category[];
};

export const categorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string().trim().min(1, { error: 'Category name is required' }),
    children: z.array(categorySchema),
  }).strict()
);

function ProductCard({ product }: { product: unknown }) {
  const productSchema = z.object({
    name: z.string().trim().min(1, { error: 'Product name is required' }),
    price: z.coerce.number().positive({ error: 'Price must be positive' }),
  }).strict();
  
  const result = productSchema.safeParse(product);
  if (!result.success) {
    return <div>Invalid product data</div>;
  }
  return <div>{result.data.name}</div>;
}

export const passwordSchema = z
  .string()
  .min(1, { error: 'Password is required' })
  .superRefine((val, ctx) => {
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
  z.object({ type: z.literal('click'), x: z.coerce.number(), y: z.coerce.number() }).strict(),
  z.object({ type: z.literal('keypress'), key: z.string().min(1, { error: 'Key is required' }) }).strict(),
]);

export const userId = z.string().uuid().brand<'UserId'>();
export const orderId = z.string().uuid().brand<'OrderId'>();

export type UserId = z.infer<typeof userId>;
export type OrderId = z.infer<typeof orderId>;

function getOrder(uid: UserId, oid: OrderId) {
  // uid and oid are branded, preventing mix-up
}

// User-facing form schema with custom error messages
export const orderSchema = z.object({
  quantity: z.coerce.number().int().positive({ error: 'Quantity must be at least 1' }),
  email: z.string().email({ error: 'Please enter a valid email address' }),
  address: z.string().trim().min(5, { error: 'Address must be at least 5 characters' }),
}).strict();

// Async validation moved into schema with parseAsync
export const usernameSchema = z.string().min(1, { error: 'Username is required' }).refine(
  async (val) => {
    const exists = await checkUsernameExists(val);
    return !exists;
  },
  { message: 'Username is already taken' }
);

async function validateUsername(input: string) {
  const result = await usernameSchema.safeParseAsync(input);
  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }
  return result.data;
}

// Use pick/omit instead of duplicating schema
export const userProfileSchema = z.object({
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.string().email({ error: 'Invalid email address' }),
  avatar: z.string().url({ error: 'Invalid avatar URL' }),
  bio: z.string().trim().max(500, { error: 'Bio must be at most 500 characters' }),
}).strict();

export type UserProfile = z.infer<typeof userProfileSchema>;

export const userCardSchema = userProfileSchema.pick({ name: true, avatar: true });
export type UserCard = z.infer<typeof userCardSchema>;

// Multi-stage validation with pipe
export const dateInputSchema = z
  .string()
  .trim()
  .min(1, { error: 'Date is required' })
  .pipe(z.coerce.date({ invalid_type_error: 'Invalid date format' }));

function parseAndValidateDate(input: string) {
  const result = dateInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }
  return result.data;
}

// Config schema with default AND catch for tolerant parsing
export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).catch('light').default('light'),
  pageSize: z.coerce.number().int().positive().catch(20).default(20),
  experimentalFeatures: z.coerce.boolean().catch(false).default(false),
}).strict();

export type Settings = z.infer<typeof settingsSchema>;

// Distinguish input and output types with z.input
export const dateFieldSchema = z.string().transform((val) => new Date(val));
export type DateFieldInput = z.input<typeof dateFieldSchema>;
export type DateFieldOutput = z.infer<typeof dateFieldSchema>;

async function checkUsernameExists(username: string): Promise<boolean> {
  // Mock implementation
  return false;
}
```
