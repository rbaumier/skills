# With Skill - Run 1

## Output

Now I have both the skill rules and the code to review. Let me conduct the five-axis review as specified by the skill.

---

# Code Review: UserService (Express + pg)

## Context

A TypeScript Express router providing CRUD operations on users, plus department grouping, CSV export, and external user sync. Uses `pg` for database access, `zod` for schema definition, `lodash` for grouping, and an in-memory cache.

## Tests

No tests are included or referenced. This is a significant gap for a service handling user data, authentication-adjacent operations (roles), and external sync.

---

## Findings

### **[BUG] SQL Injection in `getUsers`** — lines in `getUsers`

```typescript
`SELECT * FROM users WHERE name LIKE '%${search}%' OR email LIKE '%${search}%'`
```

`search` is interpolated directly from `req.query` into the SQL string. An attacker can inject arbitrary SQL. This is a textbook SQL injection vulnerability. Must use parameterized queries (`$1`, `$2`).

---

### **[BUG] Hardcoded API Secret** — line near top

```typescript
const API_SECRET = 'sk_live_9f8a7b6c5d4e3f2a1b0c';
```

A live secret key is hardcoded in source code. This will be committed to version control. Must be moved to an environment variable (like `DATABASE_URL` already is). This is a credential leak.

---

### **[BUG] Password Hash Leaked in API Response** — in `getUsers`

```typescript
passwordHash: user.password_hash,
```

The `getUsers` endpoint returns the user's password hash to the client. This is a serious data exposure vulnerability. Password hashes must never leave the server.

---

### **[BUG] No Authentication or Authorization on Any Endpoint**

`deleteUser`, `updateUserRole`, `createUser`, and `syncExternalUsers` have no auth checks. Anyone can delete users, escalate roles to admin, or trigger external sync. At minimum, role-changing and deletion endpoints must verify the caller has admin privileges.

---

### **[BUG] Default Role is `admin` in `createUser`**

```typescript
role: body.role || 'admin',
```

If the client omits `role`, the new user becomes an admin. This should default to the least-privileged role (`'viewer'` or `'user'`). Combined with the missing auth, anyone can create admin accounts.

---

### **[BUG] Zod Schema Defined But Never Used for Validation**

`UserSchema` is declared but `createUser` never calls `.parse()` or `.safeParse()`. The request body is trusted raw. Invalid or malicious data (missing fields, wrong types, extra fields) goes straight to the database.

---

### **[FIX] N+1 Query in `getUsers`**

```typescript
for (const user of users) {
  const orders = await pool.query(...);
  const profile = await pool.query(...);
}
```

For N users, this issues 2N+1 queries. If the search returns 100 users, that is 201 database round-trips. Use a JOIN or batch query (`WHERE user_id = ANY($1)`).

---

### **[FIX] `SELECT *` Everywhere**

Every query uses `SELECT *`. This fetches all columns (including `password_hash` as seen above). Select only the columns needed. This is both a security concern (data leakage) and a performance concern (unnecessary data transfer).

---

### **[FIX] No Input Validation on `deleteUser` and `updateUserRole`**

- `id` from `req.params.id` is not validated (could be non-numeric, empty).
- `role` from `req.body.role` in `updateUserRole` is not validated against the enum. A caller could set `role` to any arbitrary string.

---

### **[FIX] No Error Handling**

None of the handlers have try/catch. Any database error, network failure (in `syncExternalUsers`), or invalid JSON will crash with an unhandled promise rejection. Express will return a raw 500 or hang. Each handler needs error handling that returns a structured error response.

---

### **[FIX] `exportUsers` Has No Pagination and Unsafe CSV Generation**

1. Fetches all users at once with no limit -- unbounded data fetch.
2. CSV values are not escaped. A user name containing a comma or newline breaks the output. Use proper CSV escaping or a library.

---

### **[FIX] `syncExternalUsers` Has No Error Handling for External API**

- No check on `response.ok` or status code. If the external API returns a 500, `response.json()` may throw or return unexpected data.
- No retry logic, no timeout.
- Runs all inserts sequentially in a loop (should use a transaction for atomicity, and could batch).

---

### **[FIX] Unbounded In-Memory Cache**

`cache` is a `Map` that grows without bound. `clearExpiredCache` is defined but never called. Over time, this leaks memory. Either call `clearExpiredCache` on an interval or cap the cache size.

---

### **[FIX] `search` Can Be `undefined`**

```typescript
const search = req.query.search as string;
```

If the query parameter is missing, `search` is `undefined`, and the SQL will contain `LIKE '%undefined%'`. Must validate or default it.

---

### **[CONSIDER] `lodash` Imported for a Single `groupBy` Call**

`lodash` is a large dependency pulled in for one `groupBy` call. A native implementation is trivial:

```typescript
const grouped = Object.groupBy(result.rows, (r) => r.team);
// or: result.rows.reduce(...)
```

This reduces bundle size and eliminates a dependency.

---

### **[CONSIDER] `crypto` Imported But Never Used**

`crypto` is imported at the top but used nowhere in the code. Dead import.

---

### **[CONSIDER] `buildSearchFilter` Is Never Called**

This method exists on the class but is not used by any endpoint or referenced anywhere. Dead code.

---

### **[CONSIDER] `clearExpiredCache` Is Defined But Never Called**

Dead code. Either wire it up on an interval or remove it.

---

### **[AUTO] Commented-Out Redis Implementation**

```typescript
// Old implementation using Redis
// export async function getCachedUser(id: string) { ... }
```

Dead code artifact. Remove it -- version control preserves history.

---

### **[AUTO] `temp` Property on `UserService` Is Unused**

```typescript
private temp: string;
```

Assigned to `''` in the constructor, never read or written anywhere else. Remove it.

---

### **[NIT] `buildSearchFilter` Uses Nested Ternaries**

```typescript
return query.length > 0
  ? query.includes('@')
    ? { type: 'email', value: query }
    : query.match(/^\d+$/)
      ? { type: 'id', value: parseInt(query) }
      : { type: 'name', value: query }
  : { type: 'none' };
```

Three levels of nested ternaries. An if/else chain or early returns would be clearer.

---

### **[NIT] `CacheEntry<T>` Generic Used But Cache Is `Map<string, CacheEntry<any>>`**

The generic typing on `CacheEntry` is defeated by the `any` on the Map and on `getCache` call sites. Not providing real type safety.

---

## Summary

| Axis | Assessment |
|---|---|
| **Correctness** | Critical failures: SQL injection, leaked credentials, leaked password hashes, no input validation, default admin role. Multiple bugs that would cause production incidents. |
| **Readability** | Moderate. Code is straightforward but has dead code (commented Redis, unused `temp`, unused `crypto`, uncalled methods), nested ternaries, and `any` types defeating the type system. |
| **Architecture** | Service mixes HTTP concerns (req/res) with business logic and direct DB access. No repository layer, no separation of concerns. Global mutable cache with no cleanup. |
| **Security** | Fails on nearly every check: SQL injection, hardcoded secret, no auth/authz, password hash exposure, no input validation, unsafe CSV, untrusted external data accepted without validation. |
| **Performance** | N+1 query pattern, unbounded cache, unbounded CSV export, `SELECT *`, sequential inserts in sync, full `lodash` for one function. |

**Verdict:** This code has multiple blocking security vulnerabilities and cannot be merged. The SQL injection and hardcoded secret alone are showstoppers. Fix all [BUG] items, then address [FIX] items before re-review.