```typescript
import { z } from 'zod';

// ✅ Module-scope schemas, no `any`, strict parsing
export const userSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  email: z.string().email({ error: 'Invalid email address' }).optional(),
  age: z.coerce.number().int().positive({ error: 'Age must be at least 1' }),
  role: z.enum(['admin', 'user', 'guest'], { error: 'Invalid role' }),
  preferences: z.strictObject({
    theme: z.enum(['light', 'dark']),
    locale: z.string().min(2),
  }),
});

export type User = z.infer<typeof userSchema>;

const updateUserSchema = userSchema.pick({
  name: true,
  email: true,
  age: true,
}).partial();

export type UpdateUser = z.infer<typeof updateUserSchema>;

const apiResponseSchema = z.strictObject({
  data: userSchema,
  meta: z.strictObject({ page: z.int().positive() }),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

// ✅ Form data validation with coerce for numeric fields
async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = await userSchema.safeParseAsync(raw);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errors = z.prettifyError(result.error);
    return { success: false, error: errors };
  }
}

// ✅ Validate JSON.parse output
function processApiResponse(json: string) {
  const parsed = JSON.parse(json);
  const result = apiResponseSchema.safeParse(parsed);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Invalid API response: ${z.prettifyError(result.error)}`);
}

// ✅ Recursive schema with proper typing (v4 getter-based)
export const categorySchema: z.ZodType<Category> = z.lazy(() =>
  z.strictObject({
    name: z.string().trim().min(1),
    children: z.array(categorySchema).default([]),
  })
);

interface Category {
  name: string;
  children: Category[];
}

export type CategoryType = z.infer<typeof categorySchema>;

// ✅ Schema hoisted OUT of component
const productSchema = z.strictObject({
  name: z.string().trim().min(1, { error: 'Product name is required' }),
  price: z.coerce.number().positive({ error: 'Price must be greater than 0' }),
});

function ProductCard({ product }: { product: unknown }) {
  const result = productSchema.safeParse(product);
  if (!result.success) {
    return <div>Invalid product data</div>;
  }
  return <div>{result.data.name}</div>;
}

// ✅ Multiple related checks consolidated in .superRefine()
export const passwordSchema = z.string().superRefine((val, ctx) => {
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
  if (!/[0-9]/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain a digit',
    });
  }
});

// ✅ Discriminated union for type narrowing
const eventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('click'), x: z.int(), y: z.int() }),
  z.strictObject({ type: z.literal('keypress'), key: z.string().min(1) }),
]);

export type Event = z.infer<typeof eventSchema>;

// ✅ Branded types to prevent mixing IDs
export const userId = z.string().uuid().brand('UserId');
export type UserId = z.infer<typeof userId>;

export const orderId = z.string().uuid().brand('OrderId');
export type OrderId = z.infer<typeof orderId>;

function getOrder(uid: UserId, oid: OrderId) {
  // Types are now distinct; mixing them is a compile error
}

// ✅ Custom error messages on user-facing validators
export const orderSchema = z.strictObject({
  quantity: z.coerce.number().int().positive({ error: 'Quantity must be at least 1' }),
  email: z.string().email({ error: 'Please enter a valid email address' }),
  address: z.string().trim().min(5, { error: 'Address must be at least 5 characters' }),
});

export type Order = z.infer<typeof orderSchema>;

// ✅ Async validation with parseAsync
export const usernameSchema = z.string().trim().min(3).superRefine(async (val, ctx) => {
  const exists = await checkUsernameExists(val);
  if (exists) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Username already taken',
    });
  }
});

async function validateUsername(input: string) {
  const result = await usernameSchema.safeParseAsync(input);
  return result.success ? result.data : null;
}

async function checkUsernameExists(username: string): Promise<boolean> {
  // Database lookup
  return false;
}

// ✅ Reuse canonical schema with .pick() instead of redeclaring
export const userProfileSchema = z.strictObject({
  name: z.string().trim().min(1),
  email: z.string().email(),
  avatar: z.string().url(),
  bio: z.string().trim().max(500),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

// Subset derived from canonical schema via .pick()
export const userCardSchema = userProfileSchema.pick({
  name: true,
  avatar: true,
});

export type UserCard = z.infer<typeof userCardSchema>;

// ✅ Multi-stage validation with .pipe()
const dateFieldSchema = z.string().transform((val) => new Date(val)).pipe(
  z.date().refine((d) => !isNaN(d.getTime()), {
    error: 'Invalid date',
  })
);

export type DateField = z.infer<typeof dateFieldSchema>;
export type DateFieldInput = z.input<typeof dateFieldSchema>;

// ✅ .default() paired with .catch() for tolerant config
export const settingsSchema = z.strictObject({
  theme: z.enum(['light', 'dark']).catch('light').default('light'),
  pageSize: z.coerce.number().int().positive().catch(20).default(20),
  experimentalFeatures: z.boolean().catch(false).default(false),
});

export type Settings = z.infer<typeof settingsSchema>;
```
