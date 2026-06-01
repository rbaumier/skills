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
- **Sanitize HTML with DOMPurify — never hand-roll escaping with `.replace(/</g, '&lt;')` chains.** Manual regex misses attribute contexts, `&` ordering, encoded payloads, and `srcdoc`/`on*` handlers; it is a guaranteed XSS hole. **DO** (works server-side via jsdom): `import DOMPurify from 'isomorphic-dompurify'; const safe = DOMPurify.sanitize(page.content, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'a'], ALLOWED_ATTR: ['href'] });`. **DON'T**: `page.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')` — a manual escape chain is NOT sanitization.
- **Sanitize all URLs before use (redirects, hrefs, window.location): MUST reject non-http/https protocols. A `javascript:` URI in a redirect or href is XSS. Always validate `new URL(input).protocol` is `http:` or `https:` before using any user-supplied URL.**
- **Open redirect prevention**: never redirect to a user-supplied URL without validation. **DO**: allowlist internal paths only: `if (url.startsWith('/')) return res.redirect(url)`. For absolute URLs: verify `new URL(target).origin === expectedOrigin`. **DON'T**: `res.redirect(req.query.returnTo)`. WHY: open redirects are used in OAuth phishing chains to steal auth codes
- Nonce/hash-based CSP (no unsafe-inline/unsafe-eval), SRI on external scripts

### Auth, Sessions & Password Hashing
- JWTs in httpOnly Secure SameSite=Strict cookies (never localStorage)
- RS256 public APIs, HS256 internal only. Short-lived tokens + refresh rotation
- Validate iss/aud/exp. Authz check before every operation (RBAC/ABAC/RLS)
- **JWT delivery — set the token as a cookie, NEVER return it in the response body.** Returning `res.json({ token })` invites the client to store it in `localStorage`, where any XSS steals it. **DO**: `res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'strict' }); res.json({ user })`. **DON'T**: `res.json({ token, user })`. This applies to login, register, AND OAuth callbacks — every code path that mints a token.
- **JWT algorithm — RS256 for any public-facing / browser-facing API, HS256 only between trusted internal services.** A public login endpoint is public-facing → RS256. **DO**: `jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256', issuer: 'api.example.com', audience: 'example.com', expiresIn: '15m' })`. **DON'T**: `jwt.sign(payload, SECRET, { algorithm: 'HS256' })` on a public endpoint — symmetric secret shared with every verifier is a bigger blast radius.
- **JWT verification MUST pass issuer + audience options — never `jwt.verify(token, key)` alone.** Without them an attacker replays a token minted for another service. **DO**: `jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'], issuer: 'api.example.com', audience: 'example.com' })`. Always pin `algorithms` too (prevents `alg: none` / HS256-vs-RS256 confusion). **DON'T**: `jwt.verify(authHeader.slice(7), SECRET)` with no options.
- **Short-lived access token + refresh rotation — both are required, a short expiry alone is not enough.** Access token ≤ 15m; issue a separate refresh token, store it httpOnly, and rotate (invalidate the old one) on every use:
```typescript
// On login / OAuth success: mint a SHORT access token + a refresh token, deliver BOTH as cookies
const accessToken = jwt.sign({ sub: user.id }, PRIVATE_KEY, { algorithm: 'RS256', issuer: 'api.example.com', audience: 'example.com', expiresIn: '15m' });
const refreshToken = crypto.randomUUID();
await db.query('INSERT INTO refresh_tokens (token, user_id) VALUES ($1, $2)', [refreshToken, user.id]);
res.cookie('access', accessToken, { httpOnly: true, secure: true, sameSite: 'strict' });
res.cookie('refresh', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' });

// On refresh: ROTATE — delete the old refresh token, issue a new one (detects token theft)
app.post('/api/auth/refresh', async (req, res) => {
  const old = req.cookies.refresh;
  const row = await db.query('DELETE FROM refresh_tokens WHERE token = $1 RETURNING user_id', [old]);
  if (!row) return res.status(401).json({ error: 'Invalid refresh token' });
  // ...mint new access + new refresh, set cookies again
});
```
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
- **PKCE is not optional — every OAuth flow needs `code_verifier` / `code_challenge`, not just `state`.** `state` stops CSRF; PKCE stops a stolen authorization code being redeemed by an attacker. A callback that exchanges `code` with only `client_id`/`client_secret` is missing PKCE.
```typescript
// 1. On authorize: generate a verifier, send its SHA-256 challenge, stash verifier + state in the session
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
req.session.pkceVerifier = verifier;
req.session.oauthState = crypto.randomBytes(16).toString('hex');
// redirect to provider with code_challenge=<challenge>&code_challenge_method=S256&state=<state>

// 2. On callback: validate state, THEN send code_verifier in the token exchange
if (req.query.state !== req.session.oauthState) return res.status(403).json({ error: 'Invalid state' });
const body = JSON.stringify({
  client_id: process.env.GITHUB_CLIENT_ID,
  client_secret: process.env.GITHUB_CLIENT_SECRET,
  code: req.query.code,
  code_verifier: req.session.pkceVerifier, // <-- PKCE: without this the exchange is interceptable
});
```
- Never hardcode secrets, use env vars or vault

### CSRF & Headers
- SameSite=Strict + CSRF tokens on state changes. Validate Origin/Referer on non-GET
- HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy, Permissions-Policy
- No wildcard CORS with credentials. Use helmet/Talisman
- **CSRF tokens are required on state-changing requests — SameSite cookies are defense-in-depth, NOT a replacement.** SameSite has gaps (old browsers, `lax` GET-with-side-effects, subdomain attacks). Every POST/PUT/PATCH/DELETE that uses cookie auth needs a CSRF token. **DO**: mount `csurf` (or double-submit token) and verify it on mutations: `app.use(csrf({ cookie: true }))`, then the handler checks the token automatically. **DON'T**: rely on `sameSite: 'strict'` alone and skip the token.
- **CSP must be nonce/hash-based — bare `helmet()` is NOT enough.** Helmet's default CSP is generic and still allows patterns you don't want; you must configure an explicit policy with a per-request nonce and **no `unsafe-inline` / `unsafe-eval`**. **DO**:
```typescript
app.use((req, res, next) => { res.locals.nonce = crypto.randomBytes(16).toString('base64'); next(); });
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`], // nonce, never 'unsafe-inline'
      objectSrc: ["'none'"],
    },
  },
}));
// inline <script> tags must then carry nonce="<the nonce>"
```
**DON'T**: `app.use(helmet())` and assume CSP is handled — that is not a nonce/hash policy.
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
- **Verify webhook signatures before trusting ANY webhook payload — a webhook endpoint is an unauthenticated public URL.** Anyone can POST a forged `payment_intent.succeeded` and mark orders paid. The provider signs each request; verify it against the raw body with your signing secret. **DO** (Stripe): `const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);` — wrap in try/catch and return 400 on failure. **DON'T**: `const event = JSON.parse(req.body.toString())` and act on it. (GitHub: HMAC-SHA256 of body vs `X-Hub-Signature-256`.)
- **Structured audit logs are REQUIRED. Every log entry MUST include: timestamp, user_id, action, resource, result, IP. Use append-only tamper-evident storage. Do NOT just console.log raw request data — that is not an audit log. Structured fields enable alerting, forensics, and compliance.** **DO**:
```typescript
// A structured audit entry — fields are queryable; console.log of a string is not.
logger.info({ timestamp: new Date().toISOString(), user_id: req.user?.sub, action: 'order.paid', resource: orderId, result: 'success', ip: req.ip });
```
**DON'T**: `console.log('webhook received', event)` or `console.error('Error:', err)` as your audit trail — unstructured text cannot be alerted on or correlated.

### Dependency Security
- Run `npm audit` (or `pnpm audit`) on every CI build. A known-vulnerable dependency in production = liability you chose to accept
- `npm audit --audit-level=high` to fail CI only on high/critical. Low/moderate: track in backlog, don't block deploys
- Check for expired/abandoned packages: `npm outdated` — if a package hasn't been updated in 2+ years and has open CVEs, find an alternative. Unmaintained packages accumulate silent vulnerabilities
- Pin exact versions in lockfile (committed). `npm ci` (not `npm install`) in CI — guarantees reproducible builds and catches lockfile drift
- Enable Dependabot or Renovate for automated PRs on security patches. Manual tracking doesn't scale
- **Supply chain beyond `npm audit`** — `npm audit` only catches *published CVEs*; it misses typosquats, malicious install scripts, and lockfile tampering. Add at least one dedicated supply-chain tool: **lockfile-lint** (validate resolved URLs/integrity in the lockfile), **Socket.dev** (behavioral analysis of new deps), or **Snyk** (deeper than audit). Also: pin CI runner images to digest (not tag), verify provenance with `npm audit signatures`, and detect install-script malware with `npm query ':attr(scripts, [preinstall])'`. **DON'T** treat `npm audit` (or `npm audit signatures`) as your whole supply-chain story. In reviews: if `package.json` adds a new dependency with a postinstall script, flag it for manual review

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

## STOP — Before You Output Reviewed/Fixed Code

When asked to "fix all security issues" or review auth code, the easy wins (helmet, rate limit, bcrypt rounds, parameterized queries) are NOT the whole job. The subtle, high-severity issues below are the ones most often left unfixed. Walk this list explicitly and fix every item that applies before returning code:

- [ ] **JWT not in response body** — token set as httpOnly Secure SameSite=Strict cookie, NOT `res.json({ token })`. Check EVERY path that mints a token (login, register, OAuth).
- [ ] **JWT alg = RS256** on any public/browser-facing API (HS256 only internal).
- [ ] **`jwt.verify` passes `{ algorithms, issuer, audience }`** — never `jwt.verify(token, key)` alone.
- [ ] **Access token ≤ 15m AND a refresh-token rotation mechanism exists** — short expiry alone is not enough.
- [ ] **CSP is an explicit nonce/hash policy** with no `unsafe-inline`/`unsafe-eval` — bare `helmet()` does NOT satisfy this.
- [ ] **PKCE** (`code_verifier`/`code_challenge`) on every OAuth flow — `state` alone is not PKCE.
- [ ] **CSRF token** verified on every cookie-authed POST/PUT/PATCH/DELETE — SameSite alone is not enough.
- [ ] **Webhook signature verified** against the raw body before acting — never `JSON.parse(req.body)` and trust it.
- [ ] **Structured audit log** (timestamp/user_id/action/resource/result/ip) — not `console.log`.
- [ ] **HTML sanitized with DOMPurify + explicit allowlist** — not a manual `.replace()` escape chain.

If you cannot fix one (e.g. needs more context), say so explicitly — do NOT silently skip it.

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
