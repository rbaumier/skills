# TanStack Start Server Functions & Middleware — WITH SKILL

## Prompt
I'm building a TanStack Start app. Write:
1. A server function that creates a new todo item, accepting title and description
2. A middleware that checks if the user is authenticated
3. The server function should use the auth middleware
4. Store the session token in localStorage for persistence

## Response

> **WARNING**: Do NOT store session tokens in `localStorage`. Use **HTTP-only cookies** for session persistence. localStorage is vulnerable to XSS attacks — any injected script can steal the token.

### Auth Middleware

```ts
// app/middleware/auth.ts
import { createMiddleware } from '@tanstack/start'
import { getCookie } from 'vinxi/http'

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const sessionToken = getCookie('session_token')

  if (!sessionToken) {
    throw new Error('Unauthorized')
  }

  const user = await validateSessionToken(sessionToken)
  if (!user) {
    throw new Error('Invalid session')
  }

  // Middleware adds context via next({ context: {...} })
  return next({
    context: {
      user,
      sessionToken,
    },
  })
})
```

### Server Function (mutation = POST)

```ts
// app/features/todos/todos.functions.ts
import { createServerFn } from '@tanstack/start'
import { z } from 'zod'
import { authMiddleware } from '~/middleware/auth'

const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})

export const createTodo = createServerFn()
  .method('POST') // Mutations must use POST, not the default GET
  .middleware([authMiddleware])
  .validator(createTodoSchema)
  .handler(async ({ data, context }) => {
    // context.user comes from authMiddleware
    const todo = await db.todos.create({
      data: {
        title: data.title,
        description: data.description,
        userId: context.user.id,
      },
    })
    return todo
  })
```

### Key points:
1. **`createServerFn()`** for all server-side logic
2. **Input validation with Zod** via `.validator()` — always validate server function inputs
3. **`.method('POST')`** — default is GET which is idempotent/cacheable; mutations need POST
4. **Middleware provides context** via `next({ context: {...} })` — the handler receives it
5. **HTTP-only cookies** for sessions — **never localStorage**. Cookies are sent automatically, not accessible to JS, and immune to XSS theft
