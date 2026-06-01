```typescript
import { z } from 'zod';

// Base schema — exported for reuse
export const userSchema = z.strictObject({
  id: z.string().uuid({ error: 'Invalid user ID' }),
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.string().email({ error: 'Invalid email address' }).optional(),
  age: z.coerce.number().int().positive({ error: 'Age must be a positive number' }),
  role: z.enum(['admin', 'user', 'guest'], { error: 'Invalid role' }),
  preferences: z.strictObject({
    theme: z.enum(['light', 'dark'], { error: 'Theme must be light or dark' }),
    locale: z.string().min(2, { error: 'Locale code required' }),
  }),
});

// Inferred type — exported for reuse
export type User = z.infer<typeof userSchema>;

// Input type for form defaults
export type UserInput = z.input<typeof userSchema>;

export const updateUserSchema = z.strictObject({
  name: z.string().trim().min(1, { error: 'Name is required' }).optional(),
  email: z.string().email({ error: 'Invalid email address' }).optional(),
  age: z.coerce.number().int().positive({ error: 'Age must be a positive number' }).optional(),
}).strict();

export const apiResponseSchema = z.strictObject({
  data: userSchema,
  meta: z.strictObject({
    page: z.number().int().positive({ error: 'Page must be positive' }),
  }),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = await userSchema.safeParseAsync(raw);
  
  if (!result.success) {
    const formatted = result.error.flatten();
    return { success: false, error: formatted };
  }
  
  return { success: true, data: result.data };
}

function processApiResponse(json: string) {
  const parsed = JSON.parse(json);
  const result = apiResponseSchema.safeParse(parsed);
  
  if (!result.success) {
    throw new Error('Invalid API response structure');
  }
  
  return result.data;
}

// Recursive schema with proper typing
interface Category {
  name: string;
  children: Category[];
}

export const categorySchema: z.ZodType<Category> = z.lazy(() =>
  z.strictObject({
    name: z.string().min(1, { error: 'Category name required' }),
    children: z.array(categorySchema),
  })
);

// Hoist schema out of component
const productSchema = z.strictObject({
  name: z.string().trim().min(1, { error: 'Product name required' }),
  price: z.number().positive({ error: 'Price must be positive' }),
});

function ProductCard({ product }: { product: unknown }) {
  const result = productSchema.safeParse(product);
  
  if (!result.success) {
    return <div>Invalid product data</div>;
  }
  
  return <div>{result.data.name}</div>;
}

// Password: multiple independent validations → superRefine
const passwordSchema = z.string().superRefine((val, ctx) => {
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
      message: 'Password must contain an uppercase letter',
      path: [],
    });
  }
  if (!/\d/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain a digit',
      path: [],
    });
  }
});

export const eventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('click'),
    x: z.number().int(),
    y: z.number().int(),
  }),
  z.strictObject({
    type: z.literal('keypress'),
    key: z.string().min(1, { error: 'Key required' }),
  }),
]);

export const userId = z.string().uuid({ error: 'Invalid user ID format' }).brand('UserId');
export const orderId = z.string().uuid({ error: 'Invalid order ID format' }).brand('OrderId');

function getOrder(uid: z.infer<typeof userId>, oid: z.infer<typeof orderId>) {
  // uid and oid are now branded types — cannot be mixed
}

// User-facing form schema with custom messages
export const orderSchema = z.strictObject({
  quantity: z.coerce.number().int().positive({ error: 'Quantity must be at least 1' }),
  email: z.string().email({ error: 'Please enter a valid email address' }),
  address: z.string().trim().min(5, { error: 'Address must be at least 5 characters' }),
});

// Async validation in schema with parseAsync
const usernameSchema = z.string().min(3).refine(
  async (val) => {
    const exists = await checkUsernameExists(val);
    return !exists;
  },
  { message: 'Username is already taken' }
);

async function validateUsername(input: string) {
  return await usernameSchema.parseAsync(input);
}

// Reuse canonical schema, never re-declare
export const userProfileSchema = z.strictObject({
  name: z.string().trim().min(1, { error: 'Name required' }),
  email: z.string().email({ error: 'Invalid email' }),
  avatar: z.string().url({ error: 'Invalid avatar URL' }),
  bio: z.string().trim(),
});

export const userCardSchema = userProfileSchema.pick({
  name: true,
  avatar: true,
});

// Multi-stage validation with pipe
export const dateFieldSchema = z.string()
  .transform((val) => new Date(val))
  .pipe(z.date());

export type DateField = z.infer<typeof dateFieldSchema>; // Date (output)
export type DateFieldInput = z.input<typeof dateFieldSchema>; // string (input)

// Tolerant config schema with default + catch pair
export const settingsSchema = z.strictObject({
  theme: z.enum(['light', 'dark']).catch('light').default('light'),
  pageSize: z.coerce.number().int().positive().catch(20).default(20),
  experimentalFeatures: z.boolean().catch(false).default(false),
});

export type Settings = z.infer<typeof settingsSchema>;

// Helper function (not exported)
async function checkUsernameExists(username: string): Promise<boolean> {
  // DB lookup
  return false;
}
```
