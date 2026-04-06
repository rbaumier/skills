---
name: security-defensive
description: "Secure coding, auth, vulnerability prevention. Trigger on 'security', 'auth', 'XSS', 'CSRF', 'secrets', 'OWASP', 'compliance', 'threat model', 'audit', 'encryption'."
---

## Three-Tier Boundary System

### ALWAYS DO (no exceptions)
- Validate all external input at system boundary with schema allowlists
- Parameterize all database queries — never concatenate user input into SQL
- Encode output to prevent XSS (use framework auto-escaping, never bypass)
- HTTPS for all external communication, HSTS enabled
- Hash passwords with bcrypt(12+)/scrypt/argon2id (never plaintext, never SHA/MD5)
- Security headers on every response (CSP, HSTS, X-Frame-Options, nosniff)
- httpOnly + Secure + SameSite cookies for sessions and tokens
- `npm audit` (or equivalent) clean before every release

### ASK FIRST (requires human approval)
- Adding or changing authentication flows or auth logic
- Storing new categories of sensitive data (PII, payment info)
- Adding new external service integrations or webhooks
- Changing CORS configuration or allowed origins
- Adding file upload handlers
- Modifying rate limiting or throttling rules
- Granting elevated permissions or roles

### NEVER DO
- Commit secrets to version control (API keys, passwords, tokens, .pem/.key files)
- Log sensitive data (passwords, tokens, full credit card numbers, PII)
- Trust client-side validation as a security boundary
- Disable security headers for convenience
- Use `eval()`, `innerHTML`, or `dangerouslySetInnerHTML` with user-provided data
- Store auth tokens in localStorage/sessionStorage (use httpOnly cookies)
- Expose stack traces or internal error details to users
- Use `shell=True` / `exec()` with user input (command injection = RCE)

## Rules

### Input & Injection
- Schema allowlists (never blocklists), parameterized queries (never concat)
- Array args for commands (never shell=True), realpath()+prefix for paths
- Never eval/pickle/deserialize untrusted data
- Validate uploads: size, MIME, extension. Allowlist URLs for SSRF
- **Prototype pollution prevention**: never use recursive merge/deep-extend on user input. `Object.assign({}, userInput)` is shallow-safe, but `lodash.merge({}, userInput)` with `__proto__` keys overwrites `Object.prototype`. **DO**: strip `__proto__`, `constructor`, `prototype` keys from all parsed JSON before merging. **DON'T**: `_.merge(config, JSON.parse(userBody))` without sanitization. WHY: prototype pollution can escalate to RCE via template engines or bypass auth checks
- **Mass assignment / over-posting**: never spread request body directly into DB operations. **DO**: pick allowed fields explicitly: `const { name, email } = req.body; await db.update(users).set({ name, email })`. **DON'T**: `await db.update(users).set(req.body)` — attacker adds `{ role: 'admin' }` and escalates privilege. Use Zod `.pick()` to define exactly which fields are writable per endpoint
- **ReDoS (Regular Expression Denial of Service)**: never use user input in regex patterns. Even hardcoded regex with nested quantifiers like `(a+)+$` causes exponential backtracking. **DO**: use `re2` or `safe-regex` library. Avoid nested quantifiers. Set timeout on regex operations. **DON'T**: `new RegExp(userInput)`. In reviews: flag any `new RegExp(variable)` and any regex with nested quantifiers

### Command Injection
- **DO**: `execFile('convert', [userFile, 'output.png'])` — arguments are passed as array, never interpreted by shell
- **DON'T**: `exec(\`convert ${userFile} output.png\`)` — if userFile is `; rm -rf /` the shell executes it. Same for Python `os.system(f"cmd {input}")`
- **DO**: `subprocess.run(['cmd', arg], shell=False)` in Python. shell=False is default but be explicit — one `shell=True` and you have RCE
- **DON'T**: `child_process.exec(userInput)` — exec() always spawns a shell. Use execFile() or spawn() which do NOT invoke a shell
- WHY this matters: command injection = Remote Code Execution. It's game over — attacker owns your server. No input sanitization is reliable enough; the only safe pattern is never passing user input through a shell interpreter

### Path Traversal
- **DO**: `const safePath = path.join(UPLOAD_DIR, path.basename(filename))` — basename strips all directory components, so `../../etc/passwd` becomes `passwd`
- **DO**: After resolving, verify the final path starts with your allowed directory: `if (!path.resolve(safePath).startsWith(path.resolve(UPLOAD_DIR))) throw`
- **DON'T**: `fs.readFile(\`/uploads/${userInput}\`)` — userInput `../../../etc/passwd` reads system files
- **DON'T**: Trust URL-decoded paths. `%2e%2e%2f` decodes to `../`. Always resolve AFTER decoding
- WHY: path traversal lets attackers read source code, .env files, private keys — anything the process can access. Combined with file write, it's full RCE

### XSS & Client
- No innerHTML/dangerouslySetInnerHTML with user input, use textContent
- DOMPurify with explicit allowed tags for HTML sanitization
- **Sanitize all URLs before use (redirects, hrefs, window.location): MUST reject non-http/https protocols. A `javascript:` URI in a redirect or href is XSS. Always validate `new URL(input).protocol` is `http:` or `https:` before using any user-supplied URL.**
- **Open redirect prevention**: never redirect to a user-supplied URL without validation. **DO**: allowlist internal paths only: `if (url.startsWith('/')) return res.redirect(url)`. For absolute URLs: verify `new URL(target).origin === expectedOrigin`. **DON'T**: `res.redirect(req.query.returnTo)`. WHY: open redirects are used in OAuth phishing chains to steal auth codes
- Nonce/hash-based CSP (no unsafe-inline/unsafe-eval), SRI on external scripts

### Auth, Sessions & Password Hashing
- JWTs in httpOnly Secure SameSite=Strict cookies (never localStorage)
- RS256 public APIs, HS256 internal only. Short-lived tokens + refresh rotation
- Validate iss/aud/exp. Authz check before every operation (RBAC/ABAC/RLS)
- **Password hashing**: bcrypt(12+) for most apps, argon2id for highest security, scrypt as alternative. **Never** SHA-256/MD5/plaintext. **DO**:
```typescript
import { hash, compare } from 'bcrypt';
const hashed = await hash(plaintext, 12); // salt rounds >= 12
const valid = await compare(plaintext, hashed);
```
- **Session cookie configuration** — every flag matters:
```typescript
cookie: {
  httpOnly: true,     // JS cannot read it — blocks XSS token theft
  secure: true,       // HTTPS only — blocks network sniffing
  sameSite: 'lax',    // blocks CSRF from cross-origin POST
  maxAge: 24 * 60 * 60 * 1000, // 24h — short-lived sessions reduce blast radius
}
```
- **IDOR prevention**: always verify the authenticated user owns or has access to the requested resource. **DO**: `WHERE id = $1 AND org_id = $currentUserOrg` — add ownership filter to every query. **DON'T**: `WHERE id = $1` with user-supplied ID alone. RLS helps, but explicit ownership checks are defense-in-depth. In reviews: if a route takes an ID param and queries without ownership validation, flag it as IDOR
- **OAuth/OIDC security**: always use PKCE for all OAuth flows (prevents authorization code interception). Validate `state` parameter to prevent CSRF on OAuth callbacks. Store tokens in httpOnly cookies, never localStorage. Use short-lived access tokens + refresh token rotation. In reviews: if you see an OAuth flow without PKCE or without state validation, flag it
- Never hardcode secrets, use env vars or vault

### CSRF & Headers
- SameSite=Strict + CSRF tokens on state changes. Validate Origin/Referer on non-GET
- HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy, Permissions-Policy
- No wildcard CORS with credentials. Use helmet/Talisman
- **CORS configuration** — be explicit, never permissive:
```typescript
import cors from 'cors';
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,           // only if you need cookies cross-origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// NEVER: origin: '*' with credentials: true — browsers block it, devs add hacks that break security
// NEVER: origin: true (reflects any origin) — equivalent to wildcard, defeats same-origin policy
```

### Rate Limiting
- Rate limit ALL endpoints. Stricter limits on auth and expensive operations:
```typescript
import rateLimit from 'express-rate-limit';

// General API: 100 req / 15 min per IP
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Auth endpoints: 10 req / 15 min per IP (brute-force protection)
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
}));
```
- WHY separate tiers: credential stuffing attacks send thousands of login attempts. General rate limits are too generous for auth. Password reset, OTP verification, and signup also need strict limits

### Secrets & Infra
- .env in .gitignore, secret scanning (TruffleHog/GitGuardian), commit lockfiles
- mTLS for service-to-service, never log passwords/tokens/PII
- **Error responses must not leak internals**: return generic error messages to clients. **DO**: `res.status(500).json({ error: 'Internal server error', requestId })` — include a request ID for correlation. **DON'T**: `res.status(500).json({ error: err.message, stack: err.stack })`. Log the full error server-side with the request ID. In reviews: if you see `err.message` or `err.stack` in a response body, flag it as information disclosure
- **Structured audit logs are REQUIRED. Every log entry MUST include: timestamp, user_id, action, resource, result, IP. Use append-only tamper-evident storage. Do NOT just console.log raw request data — that is not an audit log. Structured fields enable alerting, forensics, and compliance.**

### Dependency Security
- Run `npm audit` (or `pnpm audit`) on every CI build. A known-vulnerable dependency in production = liability you chose to accept
- `npm audit --audit-level=high` to fail CI only on high/critical. Low/moderate: track in backlog, don't block deploys
- Check for expired/abandoned packages: `npm outdated` — if a package hasn't been updated in 2+ years and has open CVEs, find an alternative. Unmaintained packages accumulate silent vulnerabilities
- Pin exact versions in lockfile (committed). `npm ci` (not `npm install`) in CI — guarantees reproducible builds and catches lockfile drift
- Enable Dependabot or Renovate for automated PRs on security patches. Manual tracking doesn't scale
- **Supply chain beyond npm audit**: pin CI runner images to digest (not tag). Verify package provenance with `npm audit signatures`. Use `npm query ':attr(scripts, [preinstall])'` to detect packages with install scripts (potential malware vector). In reviews: if `package.json` adds a new dependency with a postinstall script, flag it for manual review

## OWASP Top 10 Quick Reference

### 1. Injection — parameterized queries, array args for commands (see Input & Injection above)
### 2. Broken Authentication — bcrypt(12+)/argon2id, httpOnly cookies, rate-limited login (see Auth above)
### 3. XSS — framework auto-escaping, DOMPurify, CSP with nonces (see XSS & Client above)
### 4. Broken Access Control
```typescript
// ALWAYS check ownership, not just authentication
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);
  if (task.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const updated = await taskService.update(req.params.id, req.body);
  return res.json(updated);
});
```
### 5. Security Misconfiguration — helmet(), strict CSP, explicit CORS (see CSRF & Headers above)
### 6. Sensitive Data Exposure
```typescript
// Never return sensitive fields in API responses — strip at the boundary
function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, resetToken, ...publicFields } = user;
  return publicFields;
}
```
### 7. Missing Function-Level Access Control — authz middleware on EVERY route, not just auth check
### 8. CSRF — SameSite cookies + CSRF tokens on state-changing operations (see CSRF & Headers above)
### 9. Using Components with Known Vulnerabilities — `npm audit`, Dependabot/Renovate (see Dependency Security above)
### 10. Insufficient Logging & Monitoring — structured audit logs with timestamp/user/action/resource/result/IP (see Secrets & Infra above)

## Pre-Deployment Security Checklist
- [ ] `npm audit` clean (no high/critical)
- [ ] No hardcoded secrets in source (run `trufflehog filesystem .` or `gitleaks detect`)
- [ ] .env files in .gitignore, secrets in vault/platform env vars
- [ ] All user inputs validated with schema (Zod/Joi/Pydantic)
- [ ] Parameterized queries only (no string concat SQL)
- [ ] Auth on every API endpoint, authz check before data access
- [ ] HTTPS-only, HSTS enabled, secure cookie flags set
- [ ] CSP headers configured (no unsafe-inline/unsafe-eval)
- [ ] Rate limiting on auth endpoints and expensive operations
- [ ] Error responses don't leak stack traces or internal paths
- [ ] File uploads validated (size, type, extension) and stored outside webroot
- [ ] CORS restricted to known origins (no wildcard with credentials)
