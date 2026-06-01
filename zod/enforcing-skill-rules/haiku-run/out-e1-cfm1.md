```typescript
import { z } from 'zod';

// ✅ All schemas at MODULE SCOPE
export const userSchema = z.object({
  id: z.string().uuid(),  // ✅ No z.any()
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.string().email({ error: 'Invalid email address' }),
  age: z.coerce.number().int().positive({ error: 'Age must be a positive number' }),  // ✅ z.coerce for form input
  role: z.enum(['admin', 'user', 'guest'], { error: 'Invalid role' }),  // ✅ z.enum for fixed values
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    locale: z.string(),
  }),
}).strict();  // ✅ .strict() for external data

// ✅ Export inferred type, no manual interface
export type User = z.infer<typeof userSchema>;

// ✅ Separate update schema with different semantics
export const updateUserSchema = userSchema.pick({
  name: true,
  email: true,
  age: true,
}).partial();  // ✅ Reuse canonical schema with .pick()

// ✅ API response schema with .strict() (external data)
export const apiResponseSchema = z.object({
  data: userSchema,
  meta: z.object({ page: z.number() }),
}).strict();

export type ApiResponse = z.infer<typeof apiResponseSchema>;

async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  // ✅ Use safeParse instead of try/catch
  const result = await userSchema.safeParseAsync(raw);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten(),
    };
  }
  return { success: true, data: result.data };
}

function processApiResponse(json: string) {
  // ✅ Validate JSON.parse output
  const parsed = JSON.parse(json);
  const result = apiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Invalid API response');
  }
  return result.data;
}

// ✅ Getter-based recursion (v4) instead of z.lazy()
const categorySchema: z.ZodType<{
  name: string;
  children: Category[];
}> = z.object({
  name: z.string(),
  get children() {
    return z.array(categorySchema);
  },
});

type Category = z.infer<typeof categorySchema>;

// ✅ Schema at MODULE SCOPE, not inside component
const productCardSchema = z.object({
  name: z.string().trim().min(1, { error: 'Product name is required' }),
  price: z.coerce.number().positive({ error: 'Price must be greater than 0' }),
});

function ProductCard({ product }: { product: unknown }) {
  // ✅ Reference schema by name, not recreate it
  const validated = productCardSchema.parse(product);
  return <div>{validated.name}</div>;
}

// ✅ Multi-check validation in ONE .superRefine()
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
  if (!/\d/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain at least one digit',
      path: [],
    });
  }
});

export const eventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal('keypress'),
    key: z.string(),
  }),
]);

// ✅ Export both schema and type; brand for domain IDs
export const userId = z.string().uuid().brand<'UserId'>();
export const orderId = z.string().uuid().brand<'OrderId'>();

export type UserId = z.infer<typeof userId>;
export type OrderId = z.infer<typeof orderId>;

function getOrder(uid: UserId, oid: OrderId) {
  // ✅ Types are branded, prevent accidental mixing
}

// ✅ User-facing validators with custom error messages
export const orderSchema = z.object({
  quantity: z.coerce.number().int().positive({ error: 'Quantity must be at least 1' }),
  email: z.string().email({ error: 'Please enter a valid email address' }),
  address: z.string().trim().min(5, { error: 'Address must be at least 5 characters' }),
});

// ✅ Async validation with .superRefine() + parseAsync()
export const usernameSchema = z.string().superRefine(async (val, ctx) => {
  const exists = await checkUsernameExists(val);
  if (exists) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Username is already taken',
    });
  }
});

async function validateUsername(input: string) {
  // ✅ Use parseAsync() when schema has async refine
  return await usernameSchema.parseAsync(input);
}

// ✅ Reuse canonical userProfileSchema; pick() for variant
export const userProfileSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  avatar: z.string().url(),
  bio: z.string().trim().max(500),
});

// ✅ Derive card schema from profile schema with .pick()
export const userCardSchema = userProfileSchema.pick({
  name: true,
  avatar: true,
});

// ✅ Multi-stage validation with .pipe()
export const dateSchema = z
  .string()
  .transform((val) => new Date(val))
  .pipe(z.date().refine((d) => !isNaN(d.getTime()), { error: 'Invalid date' }));

// ✅ .default() and .catch() as a PAIR for tolerant config
export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).catch('light').default('light'),
  pageSize: z.coerce.number().int().positive().catch(20).default(20),
  experimentalFeatures: z.boolean().catch(false).default(false),
});

export type Settings = z.infer<typeof settingsSchema>;

// ✅ Distinguish z.input<> (form) vs z.infer<> (output)
export const dateFieldSchema = z.string().transform((val) => new Date(val));

export type DateFieldInput = z.input<typeof dateFieldSchema>;   // string
export type DateFieldOutput = z.infer<typeof dateFieldSchema>;  // Date

// Helper for form defaults
function getDateFormDefault(date: Date): DateFieldInput {
  return date.toISOString().split('T')[0];
}

// Mock helper function
async function checkUsernameExists(username: string): Promise<boolean> {
  // Placeholder implementation
  return false;
}
```
