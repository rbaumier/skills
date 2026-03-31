# Security Review: API Configuration

## Critical Issues

### 1. CSRF via Wildcard CORS + Credentials (CRITICAL)

```typescript
app.use(cors({ origin: '*', credentials: true }));
```

`origin: '*'` with `credentials: true` is the textbook CSRF enabler. Any malicious site can make authenticated cross-origin requests. Browsers block `Access-Control-Allow-Credentials: true` when `Access-Control-Allow-Origin: *`, but many CORS libraries silently reflect the requesting origin instead -- effectively whitelisting every domain.

**Fix**: Allowlist specific origins explicitly.

```typescript
app.use(cors({
  origin: ['https://app.example.com'],
  credentials: true,
}));
```

### 2. No CSRF Token on State-Changing Endpoint (CRITICAL)

```typescript
app.post('/api/transfer', async (req, res) => {
  const { to, amount } = req.body;
  await transferFunds(req.user.id, to, amount);
});
```

A fund transfer endpoint with zero CSRF protection. Combined with the wildcard CORS policy, any page on the internet can trigger transfers on behalf of authenticated users.

**Fix**: Add a synchronizer token or double-submit cookie pattern. At minimum, validate `Origin`/`Referer` headers against a known allowlist.

### 3. Session Cookie Without `secure` Flag (HIGH)

```typescript
cookie: { httpOnly: true, secure: false, sameSite: 'lax' }
```

`secure: false` sends the session cookie over plaintext HTTP. Any network observer (public Wi-Fi, ISP, MITM proxy) can steal the session.

**Fix**: Set `secure: true`. Enforce HTTPS at the infrastructure layer.

### 4. `sameSite: 'lax'` Insufficient for Financial Operations (HIGH)

`lax` only blocks cross-site POST from `<form>` submissions initiated by non-top-level navigations. It does not protect against:

- Top-level form POST navigations (user clicks a link on attacker site that submits a form).
- GET-based state changes (if any exist).

For a financial transfer endpoint, `sameSite: 'strict'` is the safer default, combined with an explicit CSRF token.

### 5. No Rate Limiting (HIGH)

The `/api/transfer` endpoint has no rate limiting. An attacker (or compromised session) can drain an account with rapid repeated requests.

**Fix**: Apply rate limiting per user per endpoint. Example with `express-rate-limit`:

```typescript
import rateLimit from 'express-rate-limit';

const transferLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user.id,
});

app.post('/api/transfer', transferLimiter, handler);
```

### 6. No Security Headers (MEDIUM)

Missing `helmet` or equivalent. No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, etc.

**Fix**: Add `helmet()` middleware before route definitions.

### 7. No Input Validation (MEDIUM)

`to` and `amount` are used directly from `req.body` with no validation. This opens the door to:

- Negative amounts (reverse transfers).
- Non-numeric amounts (potential injection or logic errors).
- Self-transfers or transfers to invalid accounts.

**Fix**: Validate and sanitize inputs. Use a schema validator (e.g., Zod).

```typescript
const TransferSchema = z.object({
  to: z.string().uuid(),
  amount: z.number().positive().finite(),
});
```

## Summary

| Issue | Severity | OWASP Category |
|---|---|---|
| Wildcard CORS + credentials | Critical | A01:2021 Broken Access Control |
| No CSRF protection on transfer | Critical | A01:2021 Broken Access Control |
| Cookie `secure: false` | High | A02:2021 Cryptographic Failures |
| Weak `sameSite` for financial ops | High | A01:2021 Broken Access Control |
| No rate limiting | High | A04:2021 Insecure Design |
| No security headers | Medium | A05:2021 Security Misconfiguration |
| No input validation | Medium | A03:2021 Injection |

This configuration is not safe for production. The CORS + credentials + no-CSRF combination on a fund transfer endpoint is an actively exploitable vulnerability chain.
