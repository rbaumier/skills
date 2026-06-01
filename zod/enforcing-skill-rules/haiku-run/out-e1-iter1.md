```typescript
import { z } from 'zod';

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  email: z.string().email().optional(),
  age: z.int(),
  role: z.enum(['admin', 'user', 'guest']),
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    locale: z.string().min(1),
  }),
});

type User = z.infer<typeof userSchema>;

const updateUserSchema = userSchema.pick({
  name: true,
  email: true,
  age: true,
}).partial();

const apiResponseSchema = z.object({
  data: userSchema,
  meta: z.object({ page: z.int() }),
});

async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = userSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.flatten();
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

function processApiResponse(json: string) {
  const parsed = JSON.parse(json);
  return apiResponseSchema.parse(parsed);
}

const categorySchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string().trim().min(1),
    children: z.array(categorySchema).default([]),
  })
);

function ProductCard({ product }: { product: unknown }) {
  const schema = z.object({
    name: z.string().trim().min(1),
    price: z.number().positive(),
  });
  const result = schema.safeParse(product);
  if (!result.success) return null;
  return <div>{result.data.name}</div>;
}

const passwordSchema = z.string().min(8).superRefine((val, ctx) => {
  if (!/[A-Z]/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must contain uppercase letter',
    });
  }
});

const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
]);

const userId = z.string().uuid().brand('UserId');
const orderId = z.string().uuid().brand('OrderId');

function getOrder(uid: z.infer<typeof userId>, oid: z.infer<typeof orderId>) {
}

const orderSchema = z.object({
  quantity: z.int().positive(),
  email: z.email(),
  address: z.string().trim().min(5),
}).superRefine((val, ctx) => {
  // Custom business logic only in superRefine
});

const usernameSchema = z.string().min(1);

async function validateUsername(input: string) {
  const parsed = usernameSchema.parse(input);
  const exists = await checkUsernameExists(parsed);
  if (exists) {
    throw new Error('Username taken');
  }
  return parsed;
}

const userProfileSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  avatar: z.url(),
  bio: z.string().trim(),
});

const userCardSchema = userProfileSchema.pick({
  name: true,
  avatar: true,
});

const parseAndValidateDate = z.string().transform((val) => new Date(val)).pipe(
  z.date().refine((date) => !isNaN(date.getTime()), { message: 'Invalid date' })
);

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).default('light'),
  pageSize: z.int().positive().default(20),
  experimentalFeatures: z.boolean().default(false),
});

const dateFieldSchema = z.string().transform((val) => new Date(val));
type DateFieldInput = z.input<typeof dateFieldSchema>;
type DateFieldOutput = z.infer<typeof dateFieldSchema>;
```
