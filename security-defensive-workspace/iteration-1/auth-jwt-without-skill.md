# Security Review: Authentication System

## Summary

13 issues found across the authentication flow. 5 critical, 4 high, 4 medium. The system is not production-safe in its current state.

---

## CRITICAL

### 1. Hardcoded JWT Secret

```typescript
const JWT_SECRET = 'my-super-secret-key-2024';
```

Hardcoded secrets are trivially extractable from source control, compiled bundles, or process memory dumps. Anyone with repo access can forge arbitrary tokens for any user and role.

**Rule violated:** Never hardcode secrets, always env vars or vault.

**Fix:** Load from environment variable or secrets vault (AWS Secrets Manager, HashiCorp Vault). Rotate immediately -- this value is already committed to history.

```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
```

### 2. MD5 Password Hashing

```typescript
const hash = crypto.createHash('md5').update(password).digest('hex');
```

MD5 is not a password hashing function. It is unsalted, unkeyed, and optimized for speed. A modern GPU cracks billions of MD5 hashes per second. Rainbow tables for MD5 are freely available.

**Rule violated:** Hash passwords with bcrypt (cost 12+) or Argon2id.

**Fix:** Use bcrypt or Argon2id. Migrate existing hashes on next successful login.

```typescript
import bcrypt from 'bcrypt';
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### 3. JWT Stored in localStorage

```typescript
localStorage.setItem('token', response.token);
```

`localStorage` is accessible to any JavaScript running on the page. A single XSS vulnerability anywhere in the application leaks every stored token. There is no expiry, no httpOnly flag, and no SameSite protection.

**Rule violated:** Store JWTs in httpOnly Secure SameSite=Strict cookies, never localStorage.

**Fix:** Set the token as an httpOnly cookie from the server.

```typescript
res.cookie('token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000, // 15 minutes
});
```

### 4. No Authorization Check on Admin Endpoint

```typescript
app.get('/api/admin/users', async (req, res) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  const users = await db.user.findMany();
  // decoded.role is never checked
});
```

The token payload contains `role` but it is never verified. Any authenticated user (including regular users) can access the admin user listing endpoint.

**Rule violated:** Always verify authorization before operations (RBAC/ABAC/RLS).

**Fix:** Check `decoded.role` and reject with 403 if unauthorized.

```typescript
if (decoded.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden' });
}
```

### 5. No Authentication or Authorization on Delete Endpoint

```typescript
app.delete('/api/users/:id', async (req, res) => {
  await db.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
```

No token verification whatsoever. Any unauthenticated caller can delete any user by guessing or enumerating IDs.

**Rule violated:** Always verify authorization before operations (RBAC/ABAC/RLS).

**Fix:** Verify JWT, enforce admin role, and confirm the target user exists before deletion.

---

## HIGH

### 6. No Input Validation

Neither `email`, `password`, nor `req.params.id` are validated or sanitized. There are no type checks, length limits, or format constraints. This opens the door to injection, malformed queries, and abuse.

**Rule violated:** Validate all input via schema allowlists, never blocklists.

**Fix:** Validate all inputs with a schema library (e.g., Zod).

```typescript
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});
```

### 7. User Enumeration via Null Dereference

```typescript
const user = await db.user.findByEmail(email);
const hash = crypto.createHash('md5').update(password).digest('hex');
if (hash !== user.passwordHash) // crashes if user is null
```

If the email does not exist, `user` is `null` and the server throws an unhandled error (likely a 500 with a stack trace). An attacker can distinguish "user exists" (401) from "user does not exist" (500), enabling account enumeration.

**Rule violated:** Never expose internal errors to clients.

**Fix:** Return the same generic error response for both cases. Check for null before property access.

```typescript
if (!user) return res.status(401).json({ error: 'Invalid credentials' });
```

### 8. Token Expiry Too Long (30 days)

```typescript
expiresIn: '30d'
```

A 30-day access token gives an attacker a month-long window if a token is leaked. There is no refresh token rotation to limit blast radius.

**Rule violated:** Short-lived access tokens + refresh token rotation.

**Fix:** Use 15-minute access tokens with a refresh token rotation scheme.

### 9. No Rate Limiting on Login

The login endpoint has no rate limiting. Brute-force and credential-stuffing attacks can run unrestricted at network speed.

**Rule violated:** Rate limit all endpoints, stricter on auth/expensive routes.

**Fix:** Rate limit by IP and by account. Lock accounts after repeated failures.

---

## MEDIUM

### 10. HS256 Algorithm on Public-Facing API

```typescript
algorithm: 'HS256'
```

HS256 uses a shared symmetric secret. Every service that verifies tokens must hold the same secret, expanding the attack surface. If any verifier is compromised, it can also forge tokens.

**Rule violated:** RS256 for public APIs, HS256 for internal only.

**Fix:** Use RS256 (asymmetric). Only the auth service holds the private key; verifiers use the public key.

### 11. No JWT Claim Validation (iss, aud)

The `iss` (issuer) and `aud` (audience) claims are neither set during signing nor validated during verification. A JWT issued by a different service or intended for a different audience would be accepted.

**Rule violated:** Validate JWT iss, aud, exp claims.

**Fix:** Set claims during signing and validate them on verification.

```typescript
jwt.sign(payload, secret, { issuer: 'auth-service', audience: 'my-app' });
jwt.verify(token, secret, { issuer: 'auth-service', audience: 'my-app' });
```

### 12. Unhandled jwt.verify Errors

```typescript
const decoded = jwt.verify(token, JWT_SECRET);
```

If the token is missing, expired, or malformed, `jwt.verify` throws an exception. Without try/catch, the server returns a 500 with a stack trace instead of a proper 401.

**Rule violated:** Never expose internal errors to clients.

**Fix:** Wrap in try/catch and return 401 for all verification failures.

### 13. No CSRF Protection

If tokens are moved to cookies (as recommended in finding #3), the application becomes vulnerable to CSRF attacks unless additional protections are added.

**Rule violated:** SameSite=Strict on all cookies + CSRF tokens on state changes.

**Fix:** Use `SameSite=Strict` cookies and add CSRF tokens on all state-changing requests (POST, PUT, DELETE).

---

## Verdict

**Not production-safe.** The five critical findings (hardcoded secret, MD5 hashing, localStorage token storage, missing authorization checks) each independently allow full account compromise or privilege escalation. All critical and high findings must be resolved before deployment.
