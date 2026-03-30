# Workflow & Pitfalls - Without Skill

## Response to prompt

Your code looks mostly good! Here are a few suggestions:

### 1. The `add` function
This is fine - wrapping pure functions in Result gives you consistent error handling across your codebase. It's a matter of style.

### 2. UserNotFound error
Your error class looks good. You might want to add a status code property for HTTP responses:

```typescript
class UserNotFound extends Error {
  statusCode = 404;
  constructor(id: string) {
    super(`User ${id} not found`);
  }
}
```

### 3. The getUser service
The catch handler looks fine. Catching all errors and mapping them to your domain error type is a common pattern. This ensures your service always returns a known error type.

### 4. The controller
The try/catch in the controller is actually a good defensive practice. Even though getUser returns a Result, there could be other errors (middleware, serialization, etc.) so the try/catch acts as a safety net:

```typescript
async function handleGetUser(req, res) {
  try {
    const result = await getUser(req.params.id);
    if (result.ok) {
      res.json(result.value);
    } else {
      res.status(404).json({ error: result.error.message });
    }
  } catch (e) {
    res.status(500).json({ error: 'Internal error' });
  }
}
```

This is the recommended pattern - use Result for expected errors, try/catch for unexpected ones.

Overall your adoption looks solid. Keep going!
