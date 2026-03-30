# TanStack Start Server Functions & Middleware — WITHOUT SKILL

## Prompt
I'm building a TanStack Start app. Write:
1. A server function that creates a new todo item, accepting title and description
2. A middleware that checks if the user is authenticated
3. The server function should use the auth middleware
4. Store the session token in localStorage for persistence

## Response

### Auth Middleware

```ts
// app/middleware/auth.ts
import { createMiddleware } from '@tanstack/start'

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) {
    throw new Error('Unauthorized')
  }

  const user = await verifyToken(token)
  return next({ context: { user } })
})
```

### Server Function

```ts
// app/server/todos.ts
import { createServerFn } from '@tanstack/start'
import { authMiddleware } from '~/middleware/auth'

export const createTodo = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const { title, description } = data as { title: string; description: string }

    const todo = await db.todos.create({
      data: {
        title,
        description,
        userId: context.user.id,
      },
    })
    return todo
  })
```

### Client-side token storage

```ts
// After login, store the token
const handleLogin = async (credentials) => {
  const { token } = await loginFn(credentials)
  localStorage.setItem('session_token', token)
}

// Include token in requests
const token = localStorage.getItem('session_token')
```

This sets up a basic server function with auth middleware. The session token is stored in localStorage and sent as a Bearer token in the Authorization header for subsequent requests.
