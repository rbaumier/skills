# TanStack Start File Organization & Environment — WITH SKILL

## Prompt
I'm organizing a TanStack Start project. I have:
- Database queries for fetching users
- Server functions that wrap the DB queries
- Shared validation schemas for user forms
- API keys and database URLs

How should I organize these files and handle the environment variables? Show the file structure and naming conventions.

## Response

### File Structure

```
app/
├── features/
│   └── users/
│       ├── users.server.ts        # Server-only: DB queries, secrets access
│       ├── users.functions.ts     # Server function wrappers (safe to import anywhere)
│       ├── users.schemas.ts       # Shared validation schemas (.ts = shared)
│       ├── users.types.ts         # Shared TypeScript types
│       └── components/
│           ├── UserForm.tsx        # Client component using schemas
│           └── UserList.tsx        # Client component
├── env.ts                         # Environment variable validation
└── start.ts                       # Global middleware
```

### File Naming Conventions

| Extension | Purpose | Import restriction |
|---|---|---|
| `.server.ts` | Server-only logic (DB queries, secrets) | **Never import on client** — bundler enforces this |
| `.functions.ts` | Server function wrappers (`createServerFn`) | Safe to import anywhere |
| `.ts` | Shared utilities, types, schemas | Importable by both client and server |

### Server-only DB queries

```ts
// app/features/users/users.server.ts
// This file NEVER gets bundled to the client
import { db } from '~/db'

export async function getUserById(id: string) {
  return db.user.findUnique({ where: { id } })
}

export async function createUser(data: { name: string; email: string }) {
  return db.user.create({ data })
}
```

### Server function wrappers

```ts
// app/features/users/users.functions.ts
import { createServerFn } from '@tanstack/start'
import { createUserSchema } from './users.schemas'

export const createUserFn = createServerFn()
  .method('POST')
  .validator(createUserSchema)
  .handler(async ({ data }) => {
    // Import server-only code dynamically or rely on tree-shaking
    const { createUser } = await import('./users.server')
    return createUser(data)
  })
```

### Shared validation schemas

```ts
// app/features/users/users.schemas.ts
// Plain .ts — shared between client forms AND server functions
import { z } from 'zod'

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
```

### Environment Variable Validation

```ts
// app/env.ts
import { z } from 'zod'

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_SECRET_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
})

const clientEnvSchema = z.object({
  VITE_API_URL: z.string().url(),        // VITE_ prefix = client-accessible
  VITE_APP_NAME: z.string().default('MyApp'),
})

// Validate at startup — fail fast if env is misconfigured
export const serverEnv = serverEnvSchema.parse(process.env)
export const clientEnv = clientEnvSchema.parse(import.meta.env)
```

### Key rules:
1. **`.server.ts`** for DB queries and secrets — never imported on client
2. **`.functions.ts`** for `createServerFn` wrappers — safe to import anywhere
3. **`.ts`** (plain) for shared schemas and types — used by both client forms and server validation
4. **Validate env vars at startup** with Zod — fail fast on missing config
5. **`VITE_` prefix** for client-accessible environment variables
6. **Keep secrets out of error messages and logs** — never include `DATABASE_URL` or `API_SECRET_KEY` in error objects sent to the client
