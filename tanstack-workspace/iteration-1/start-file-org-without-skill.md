# TanStack Start File Organization & Environment — WITHOUT SKILL

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
├── server/
│   ├── db/
│   │   └── users.ts               # Database queries
│   └── functions/
│       └── users.ts               # Server functions
├── shared/
│   └── schemas/
│       └── user.ts                # Validation schemas
├── components/
│   ├── UserForm.tsx
│   └── UserList.tsx
└── routes/
    └── users/
        └── index.tsx
```

### Database queries

```ts
// app/server/db/users.ts
import { db } from '~/db'

export async function getUserById(id: string) {
  return db.user.findUnique({ where: { id } })
}
```

### Server functions

```ts
// app/server/functions/users.ts
import { createServerFn } from '@tanstack/start'
import { getUserById } from '../db/users'

export const getUser = createServerFn()
  .handler(async ({ data }) => {
    return getUserById(data.id)
  })
```

### Shared schemas

```ts
// app/shared/schemas/user.ts
import { z } from 'zod'

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})
```

### Environment Variables

Use a `.env` file and access variables through `process.env`:

```ts
// app/config.ts
export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  apiKey: process.env.API_KEY!,
  appUrl: process.env.VITE_APP_URL,
}
```

Make sure to add `.env` to your `.gitignore` and document the required variables in a `.env.example` file. For client-accessible variables in Vite-based projects, prefix them with `VITE_`.
