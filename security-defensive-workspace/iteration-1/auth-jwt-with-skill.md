# Auth System Review (with skill)

## Violations Found

### CRITICAL

| # | Rule Violated | Line/Area | Issue | Fix |
|---|--------------|-----------|-------|-----|
| 1 | Never hardcode secrets, always env vars or vault | `const JWT_SECRET = 'my-super-secret-key-2024'` | JWT signing secret is hardcoded in source code. Leaked via version control. | `const JWT_SECRET = process.env.JWT_SECRET!` + validate on startup. |
| 2 | Hash passwords with bcrypt (cost 12+) or Argon2id | `crypto.createHash('md5').update(password).digest('hex')` | MD5 is cryptographically broken. No salt. Vulnerable to rainbow tables and collision attacks. | `await bcrypt.compare(password, user.passwordHash)` with bcrypt cost 12+. |
| 3 | Store JWTs in httpOnly Secure SameSite=Strict cookies, never localStorage | `localStorage.setItem('token', response.token)` | localStorage is accessible to any JS on the page -- trivially stolen via XSS. | Set token in `Set-Cookie: httpOnly; Secure; SameSite=Strict` response header. |
| 4 | Short-lived access tokens + refresh token rotation | `expiresIn: '30d'` | 30-day token lifetime. If stolen, attacker has a month of access. | Access token: 15m max. Add refresh token rotation endpoint. |
| 5 | Always verify authorization before operations (RBAC/ABAC/RLS) | `app.delete('/api/users/:id')` | No auth check at all -- any unauthenticated request can delete any user. | Verify JWT + check role/ownership before delete. |
| 6 | Always verify authorization before operations (RBAC/ABAC/RLS) | `app.get('/api/admin/users')` | Token is verified but `decoded.role` is never checked -- any authenticated user can list all users. | `if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })` |
| 7 | Validate JWT iss, aud, exp claims | `jwt.verify(token, JWT_SECRET)` | No `issuer` or `audience` validation. Tokens from other services could be accepted. | `jwt.verify(token, JWT_SECRET, { issuer: 'myapp', audience: 'myapp' })` and set same in `jwt.sign`. |
| 8 | Never expose internal errors to clients | `jwt.verify` / `db.user.delete` | No try/catch -- unhandled exceptions leak stack traces to client. | Wrap in try/catch, return generic error messages, log details server-side. |
| 9 | Rate limit all endpoints, stricter on auth/expensive routes | `/api/login` | Login endpoint has no rate limiting -- vulnerable to brute force and credential stuffing. | Add rate limiter (e.g., `express-rate-limit`), stricter on `/api/login` (5 req/min per IP). |
| 10 | Validate all input via schema allowlists, never blocklists | `req.body`, `req.params.id` | No input validation on email, password, or id parameter. | Validate with zod/joi schema: email format, password length, id as UUID. |
| 11 | RS256 for public APIs, HS256 for internal only | `algorithm: 'HS256'` | If this is a public-facing API, HS256 is inappropriate -- the secret is shared, any party that can verify can also forge tokens. | Use RS256 with asymmetric key pair for public APIs. |
| 12 | Use helmet (Express) | Missing entirely | No security headers configured. | `app.use(helmet())` to set HSTS, X-Frame-Options, nosniff, etc. |

### Summary

**12 violations** across authentication, authorization, cryptography, token storage, input validation, and infrastructure hardening. The three most dangerous issues are the hardcoded secret, MD5 password hashing, and the completely unprotected delete endpoint. This code should not be deployed in its current state.
