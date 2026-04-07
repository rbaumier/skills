# Without Skill - Run 1

## Output

Here is my complete code review.

---

# Code Review: UserService (Express + pg)

## CRITICAL -- Fix Immediately

### 1. SQL Injection in `getUsers`
```typescript
`SELECT * FROM users WHERE name LIKE '%${search}%' OR email LIKE '%${search}%'`
```
The `search` query parameter is interpolated directly into SQL. An attacker can exfiltrate or destroy the entire database. Use parameterized queries (`$1`) like the other methods already do.

### 2. Hardcoded Secret
```typescript
const API_SECRET = 'sk_live_9f8a7b6c5d4e3f2a1b0c';
```
A live API key is committed in source code. This must be loaded from an environment variable (like `DATABASE_URL` already is). Rotate this key immediately -- it should be considered compromised.

### 3. Password Hash Leaked in Response
```typescript
passwordHash: user.password_hash,
```
`getUsers` sends the password hash to the client in the JSON response. This is a severe data exposure vulnerability. Remove it entirely or, if truly needed server-side, strip it before serialization.

---

## HIGH -- Security & Correctness

### 4. No Authentication or Authorization
None of the routes are protected. `DELETE /users/:id`, `PUT /users/:id/role`, and `POST /users/sync` are publicly accessible. At minimum, add auth middleware and role-based guards (e.g., only admins can delete users or change roles).

### 5. `createUser` Defaults Role to `'admin'`
```typescript
role: body.role || 'admin',
```
If no role is provided, the user becomes an admin. This is a privilege-escalation bug. Default should be the least-privileged role (`'viewer'` or `'user'`).

### 6. `createUser` Does Not Validate Input
The `UserSchema` Zod schema is defined but never used. `body` is passed through without validation. Malformed or malicious payloads will reach the database. Call `UserSchema.parse(req.body)` and handle `ZodError`.

### 7. `updateUserRole` Does Not Validate Role
`req.body.role` is inserted without checking it against the allowed enum (`admin`, `user`, `viewer`). An attacker can set an arbitrary string as the role.

### 8. No Error Handling Anywhere
Every `async` handler will throw an unhandled promise rejection on any DB or network error, crashing the process or hanging the request. There are no `try/catch` blocks and no Express error-handling middleware.

---

## MEDIUM -- Performance & Reliability

### 9. N+1 Query Problem in `getUsers`
For every user row, two additional queries (orders + profiles) are issued sequentially inside a loop. For 100 users this is 201 queries. Use a JOIN or batch query instead.

### 10. `SELECT *` Everywhere
Every query selects all columns from all tables. This pulls unnecessary data over the wire (including sensitive columns like `password_hash`). Select only the columns you need.

### 11. Unbounded Result Sets
`getUsers` and `exportUsers` have no `LIMIT` or pagination. A table with millions of rows will exhaust memory and time out.

### 12. CSV Export is Injection-Prone
```typescript
`${row.name},${row.email},${row.role}`
```
If `name` or `email` contain commas, quotes, or newlines, the CSV is malformed. Values containing `=`, `+`, `-`, `@` enable CSV formula injection in spreadsheet software. Use proper CSV escaping or a library.

### 13. Unbounded In-Memory Cache
`cache` is a `Map` that grows without limit. `clearExpiredCache` exists but is never called. This is a memory leak in any long-running process.

### 14. `syncExternalUsers` -- Sequential Inserts in a Loop
Each external user triggers a separate `INSERT ... ON CONFLICT` query. For large sets, batch these into a single query or use a transaction with bulk insert.

### 15. `syncExternalUsers` -- No Error Handling on `fetch`
No check on `response.ok`, no `try/catch`. A 500 from the partner API will produce garbage data from `.json()`.

---

## LOW -- Code Quality & Maintainability

### 16. Unused Import: `crypto`
`crypto` is imported but never used. Remove it.

### 17. Unused Import: `lodash` is Heavy
`lodash` is imported for a single `groupBy` call. Use `Object.groupBy()` (ES2024) or a 3-line reduce. The full lodash bundle is ~70KB minified.

### 18. Unused Class Property: `temp`
```typescript
private temp: string;
```
Set in the constructor, never read. Dead code -- remove it.

### 19. Dead Commented-Out Code
The Redis cache block is commented out with no tracking reference (issue, TODO). Remove it or link to a ticket explaining why it exists.

### 20. `buildSearchFilter` -- Nested Ternary
The triple-nested ternary is hard to read. Refactor to an `if/else if` chain or a `switch`-style map.

### 21. Route Handler Wrappers are Boilerplate
```typescript
router.get('/users', (req, res) => service.getUsers(req, res));
```
These anonymous wrappers add nothing. Bind directly: `router.get('/users', service.getUsers.bind(service))` or use a controller decorator pattern.

### 22. `sync` Route Swallows Errors
```typescript
router.post('/users/sync', (req, res) => service.syncExternalUsers().then(() => res.json({ ok: true })));
```
No `.catch()`. A rejected promise results in an unhandled rejection with no response sent to the client.

### 23. Route Order Bug
`/users/export` is registered after `/users/:id`. Express will match `export` as an `:id` parameter. Move static routes before parameterized ones.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| Critical | 3 | SQL injection, leaked secret, leaked password hash |
| High | 5 | No auth, no input validation, no error handling |
| Medium | 7 | N+1 queries, unbounded results, memory leak, CSV injection |
| Low | 8 | Dead code, unused imports, readability |

The top 3 fixes (SQL injection, remove hardcoded secret, strip password hash) should be treated as a P0 incident. The code should not be deployed in its current state.