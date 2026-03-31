# Security Review: API Configuration

## Verdict: FAIL — Critical vulnerabilities

---

## Violations Found

### 1. Wildcard CORS with credentials (CRITICAL)

```typescript
app.use(cors({ origin: '*', credentials: true }));
```

**Rule violated**: "Never wildcard CORS with credentials, whitelist origins"

Wildcard `origin: '*'` combined with `credentials: true` allows any website to make authenticated cross-origin requests to this API. An attacker's site can issue requests that carry the user's session cookie, effectively bypassing same-origin protections.

**Fix**: Whitelist allowed origins explicitly.

```typescript
const ALLOWED_ORIGINS = [process.env.FRONTEND_URL];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Blocked by CORS'));
  },
  credentials: true,
}));
```

---

### 2. SameSite not Strict, Secure flag disabled (CRITICAL)

```typescript
session({ cookie: { httpOnly: true, secure: false, sameSite: 'lax' } })
```

**Rule violated**: "SameSite=Strict on all cookies + CSRF tokens on state changes"

- `secure: false` allows the cookie to be sent over plain HTTP, exposing it to network-level interception.
- `sameSite: 'lax'` permits cookies on top-level navigations (GET), which is insufficient for a financial transfer endpoint. `Strict` prevents the cookie from being sent on any cross-site request.

**Fix**:

```typescript
session({
  cookie: { httpOnly: true, secure: true, sameSite: 'strict' },
})
```

---

### 3. No CSRF token on state-changing endpoint (CRITICAL)

```typescript
app.post('/api/transfer', async (req, res) => { ... });
```

**Rule violated**: "SameSite=Strict on all cookies + CSRF tokens on state changes"

The `/api/transfer` endpoint mutates state (transfers funds) but has no CSRF token validation. Even with `SameSite=Strict`, a CSRF token is defense-in-depth.

**Fix**: Add CSRF middleware (e.g., `csurf` or a custom double-submit cookie pattern) and validate the token on every non-GET request.

---

### 4. No Origin/Referer header validation (HIGH)

**Rule violated**: "Validate Origin/Referer headers for non-GET requests"

No middleware checks the `Origin` or `Referer` header on POST requests. This is a secondary CSRF defense that should be present alongside tokens.

**Fix**: Add middleware that rejects POST/PUT/DELETE/PATCH requests whose `Origin` header does not match the allowlist.

---

### 5. No security headers (HIGH)

**Rule violated**: "Set HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy" and "Use helmet (Express)"

No security headers are configured. The app is missing HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

**Fix**:

```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

### 6. No rate limiting (HIGH)

**Rule violated**: "Rate limit all endpoints, stricter on auth/expensive routes"

A financial transfer endpoint with no rate limiting is vulnerable to brute-force abuse and denial-of-wallet attacks.

**Fix**:

```typescript
import rateLimit from 'express-rate-limit';
app.use('/api/transfer', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
```

---

### 7. No request body validation (MEDIUM)

```typescript
const { to, amount } = req.body;
```

**Rule violated**: "Validate content-type, payload size, schema on all request bodies" and "Validate all input via schema allowlists, never blocklists"

The `to` and `amount` fields are destructured directly from the body with no type checking, range validation, or schema enforcement. A malicious payload could pass negative amounts, non-numeric values, or excessively large transfers.

**Fix**: Validate with a schema library (e.g., Zod).

```typescript
import { z } from 'zod';
const TransferSchema = z.object({
  to: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
});
// In handler:
const parsed = TransferSchema.parse(req.body);
```

---

### 8. No MFA on sensitive operation (MEDIUM)

**Rule violated**: "Require MFA (TOTP/WebAuthn) for sensitive operations"

Fund transfers are a sensitive financial operation. No step-up authentication or MFA challenge is present.

---

### 9. No authorization check (MEDIUM)

**Rule violated**: "Always verify authorization before operations (RBAC/ABAC/RLS)"

The handler trusts `req.user.id` exists but performs no explicit authorization check (e.g., verifying the user has permission to transfer, that the account belongs to them, or that they haven't exceeded limits).

---

### 10. Error handling exposes internals (LOW)

**Rule violated**: "Never expose internal errors to clients"

No error handling wraps `transferFunds`. If it throws, Express's default error handler may leak stack traces or internal details to the client.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 3     |
| MEDIUM   | 3     |
| LOW      | 1     |

This configuration has fundamental security flaws. The combination of wildcard CORS with credentials, weak cookie settings, and no CSRF protection on a financial transfer endpoint creates a directly exploitable CSRF attack vector. An attacker can craft a page that silently transfers funds from any authenticated user who visits it.
