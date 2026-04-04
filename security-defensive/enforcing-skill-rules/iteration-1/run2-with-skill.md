# Security Review: Node.js Express Application

## Vulnerabilities Found (20 issues)

---

### 1. SQL Injection — String Concatenation in Login Query
**Location:** `/login` endpoint
**Severity:** CRITICAL
**Trap:** `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`

User input is directly concatenated into the SQL query. An attacker can bypass auth with `' OR 1=1 --`.

**Rule violated:** Parameterized queries, never string concatenation.

---

### 2. No Input Validation / Schema Allowlists
**Location:** Every endpoint
**Severity:** HIGH

No input validation anywhere. No schema validation on request bodies, params, or query strings. Every endpoint blindly trusts whatever the client sends.

**Rule violated:** Schema allowlists (never blocklists) on all inputs.

---

### 3. Command Injection via `exec()`
**Location:** `/admin/run` endpoint
**Severity:** CRITICAL
**Trap:** `exec(command, ...)` passes raw user input to a shell.

An attacker can execute arbitrary OS commands. This is remote code execution (RCE).

**Rule violated:** Array args for commands (never shell=True). Never eval/execute untrusted data.

---

### 4. Path Traversal
**Location:** `/files/:name` and `/upload` endpoints
**Severity:** HIGH
**Trap:** `./uploads/${req.params.name}` and `./uploads/${file.name}` — no `realpath()` + prefix check.

An attacker can read arbitrary files with `../../etc/passwd` or write files to arbitrary locations.

**Rule violated:** `realpath()` + prefix check for all file paths.

---

### 5. Arbitrary Code / Command Execution (eval/deserialize equivalent)
**Location:** `/admin/run` endpoint
**Severity:** CRITICAL

`exec(command)` is functionally equivalent to `eval()` for system-level commands. Untrusted input must never be executed.

**Rule violated:** Never eval/pickle/deserialize untrusted data.

---

### 6. No File Upload Validation
**Location:** `/upload` endpoint
**Severity:** HIGH
**Trap:** No size limit, no MIME type check, no extension allowlist.

An attacker can upload executable files, oversized files for DoS, or files with dangerous extensions (.exe, .php, .sh).

**Rule violated:** Validate uploads: size, MIME type, extension allowlist.

---

### 7. XSS — User Input Rendered Directly in HTML
**Location:** `/profile/:id` endpoint
**Severity:** HIGH
**Trap:** `` `<h1>${user.name}</h1><div>${user.bio}</div>` `` — user-controlled data injected directly into HTML response.

An attacker can store `<script>alert(document.cookie)</script>` in their bio for stored XSS.

**Rule violated:** No innerHTML with user input. Use textContent or sanitize with DOMPurify with explicit allowed tags.

---

### 8. Open Redirect / Unsanitized URL
**Location:** `/redirect` endpoint
**Severity:** HIGH
**Trap:** `res.redirect(req.query.url)` — no protocol validation.

An attacker can use `javascript:alert(1)` or redirect to a phishing site. Must validate `new URL(input).protocol` is `http:` or `https:` before any redirect.

**Rule violated:** MUST reject non-http/https protocols. A `javascript:` URI in a redirect or href is XSS. Always validate URL protocol before use.

---

### 9. No CSP or Security Headers
**Location:** Entire application
**Severity:** MEDIUM

No `helmet()` middleware, no Content-Security-Policy, no X-Frame-Options, no X-Content-Type-Options, no HSTS, no Referrer-Policy, no Permissions-Policy.

**Rule violated:** Nonce/hash-based CSP (no unsafe-inline/unsafe-eval), SRI on external scripts. HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy, Permissions-Policy. Use helmet.

---

### 10. JWT Stored in localStorage (returned in response body)
**Location:** `/login` endpoint
**Severity:** HIGH
**Trap:** `res.json({ token })` — JWT sent in response body implies client stores it in localStorage (confirmed by `localStorage.getItem('token')` in `/account/delete`).

localStorage is accessible to any XSS. JWTs must be in httpOnly Secure SameSite=Strict cookies.

**Rule violated:** JWTs in httpOnly Secure SameSite=Strict cookies (never localStorage).

---

### 11. HS256 for Public-Facing API
**Location:** `/login` endpoint
**Severity:** MEDIUM
**Trap:** `jwt.sign({ ... }, SECRET, { algorithm: 'HS256' })` — symmetric algorithm used for a public-facing API.

HS256 uses a shared secret. Public APIs should use RS256 (asymmetric) so token verification doesn't require the signing key.

**Rule violated:** RS256 for public APIs, HS256 internal only. Short-lived tokens + refresh rotation.

---

### 12. Plaintext Password Comparison
**Location:** `/login` endpoint
**Severity:** CRITICAL
**Trap:** Passwords compared in plaintext in the SQL query (`AND password = '${password}'`).

Passwords must be hashed with bcrypt(12+) or Argon2id. The login flow should fetch the user by email, then `bcrypt.compare()` the input against the stored hash.

**Rule violated:** bcrypt(12+) or Argon2id for password hashing.

---

### 13. No Authorization Checks
**Location:** `/admin/run`, `/account/delete`, `/files/:name`, `/profile/:id`
**Severity:** CRITICAL
**Trap:** No auth middleware on `/admin/run` — anyone can execute commands. No role-based check. `/account/delete` doesn't verify the token belongs to the account being deleted.

Every operation must have an authorization check (RBAC/ABAC/RLS).

**Rule violated:** Authz check before every operation.

---

### 14. Hardcoded Secret
**Location:** Top-level constant
**Severity:** CRITICAL
**Trap:** `const SECRET = 'my-jwt-secret-key-2024'` — secret committed to source code.

Secrets must come from environment variables or a vault, never hardcoded.

**Rule violated:** Never hardcode secrets, use env vars or vault.

---

### 15. No CSRF Protection
**Location:** All state-changing POST endpoints
**Severity:** HIGH
**Trap:** `/login`, `/admin/run`, `/upload`, `/api/action`, `/account/delete` — all POST endpoints that change state but have no CSRF token validation.

**Rule violated:** SameSite=Strict + CSRF tokens on state-changing requests. Validate Origin/Referer on non-GET.

---

### 16. Wildcard CORS with Credentials
**Location:** `app.use(cors({ origin: '*', credentials: true }))`
**Severity:** HIGH
**Trap:** `origin: '*'` with `credentials: true` allows any origin to make credentialed requests.

This is explicitly forbidden by the CORS spec (browsers block it), but the intent reveals a misconfiguration. CORS must be restricted to specific allowed origins.

**Rule violated:** No wildcard CORS with credentials.

---

### 17. No Rate Limiting
**Location:** Entire application
**Severity:** MEDIUM
**Trap:** No rate limiting on any endpoint. Login endpoint is vulnerable to brute-force attacks. Upload endpoint is vulnerable to DoS.

**Rule violated:** Rate limit all endpoints.

---

### 18. Logging Sensitive Data
**Location:** `/api/action` endpoint
**Severity:** HIGH
**Trap:** `console.log('User action:', req.body)` — blindly logs the entire request body which may contain passwords, tokens, PII.

**Rule violated:** Never log passwords/tokens/PII.

---

### 19. No Structured Audit Logs
**Location:** `/api/action` endpoint
**Severity:** HIGH
**Trap:** `console.log('User action:', req.body)` is not an audit log. It lacks structure, is not tamper-evident, and cannot support alerting or forensics.

Structured audit logs are REQUIRED. Every log entry MUST include: timestamp, user_id, action, resource, result, IP. Use append-only tamper-evident storage.

**Rule violated:** Structured audit logs with timestamp, user_id, action, resource, result, IP.

---

### 20. SSRF via Open Redirect
**Location:** `/redirect` endpoint
**Severity:** MEDIUM
**Trap:** The open redirect at `/redirect?url=...` can be abused for SSRF if the server follows the redirect internally, or used as a gadget in phishing chains. URLs should be validated against an allowlist of permitted domains/paths.

**Rule violated:** Allowlist URLs for SSRF prevention.

---

## Fixed Code

```typescript
import express from 'express';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

const app = express();

// --- Secrets from environment, never hardcoded ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required');

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
// For public API, use RS256 with key pair:
// const token = jwt.sign(payload, JWT_PRIVATE_KEY, { algorithm: 'RS256' });
// const decoded = jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] });

// --- CORS: explicit origin, no wildcard with credentials ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

// --- Security headers via helmet (CSP, HSTS, X-Frame-Options, nosniff, etc.) ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],  // Use nonce-based CSP in production
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(express.json({ limit: '1mb' }));

// --- Rate limiting on all endpoints ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

// --- Structured Audit Logger ---
// Every entry: timestamp, user_id, action, resource, result, IP
// Use append-only tamper-evident storage in production (e.g., immutable log service)
interface AuditEntry {
  timestamp: string;
  user_id: string | null;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  ip: string;
}

function auditLog(entry: AuditEntry): void {
  // In production: write to append-only, tamper-evident log store
  // Never log passwords, tokens, or PII in the entry fields
  const logLine = JSON.stringify(entry);
  // Example: append to structured log sink (not console.log of raw data)
  process.stdout.write(logLine + '\n');
}

// --- Input validation schemas (allowlists, never blocklists) ---
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const uploadSchema = z.object({
  file: z.object({
    name: z.string().max(255),
    data: z.string(), // base64
    mimeType: z.string(),
    size: z.number().max(5 * 1024 * 1024), // 5MB max
  }),
});

const actionSchema = z.object({
  action: z.string().max(100),
  resource: z.string().max(255),
});

// --- Auth middleware: verify JWT + extract user ---
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // JWT is read from httpOnly cookie, not Authorization header
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Validate iss, aud, exp, and pin algorithm
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'], // For internal; use RS256 + public key for public APIs
      issuer: 'my-app',
      audience: 'my-app',
    });
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Authz middleware: role-based access control ---
function requireRole(...roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      auditLog({
        timestamp: new Date().toISOString(),
        user_id: user?.userId || null,
        action: 'authz_denied',
        resource: req.path,
        result: 'failure',
        ip: req.ip || 'unknown',
      });
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// --- CSRF token middleware ---
function csrfProtection(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'];
    const sessionCsrf = req.cookies?.csrfToken;
    if (!csrfToken || csrfToken !== sessionCsrf) {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
    // Also validate Origin/Referer
    const origin = req.headers.origin || req.headers.referer;
    if (origin && !ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
      return res.status(403).json({ error: 'Invalid origin' });
    }
  }
  next();
}
app.use(csrfProtection);

// --- URL validation helper ---
// MUST reject non-http/https protocols to prevent javascript: XSS
const ALLOWED_REDIRECT_DOMAINS = (process.env.ALLOWED_REDIRECT_DOMAINS || '').split(',');

function isValidRedirectUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    // Reject non-http(s) protocols (javascript:, data:, etc.)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // Allowlist domains for SSRF prevention
    if (ALLOWED_REDIRECT_DOMAINS.length > 0 && !ALLOWED_REDIRECT_DOMAINS.includes(parsed.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// === ROUTES ===

// Auth: parameterized query, bcrypt, JWT in httpOnly cookie
app.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;

  // Parameterized query — never string concatenation
  const user = await db.query('SELECT id, role, password_hash FROM users WHERE email = $1', [email]);
  if (!user) {
    auditLog({
      timestamp: new Date().toISOString(),
      user_id: null,
      action: 'login_attempt',
      resource: '/login',
      result: 'failure',
      ip: req.ip || 'unknown',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // bcrypt comparison — passwords stored as bcrypt(12+) hashes
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    auditLog({
      timestamp: new Date().toISOString(),
      user_id: null,
      action: 'login_attempt',
      resource: '/login',
      result: 'failure',
      ip: req.ip || 'unknown',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Short-lived token; for public API use RS256 with JWT_PRIVATE_KEY
  const token = jwt.sign(
    { userId: user.id, role: user.role, iss: 'my-app', aud: 'my-app' },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' }
  );

  // JWT in httpOnly Secure SameSite=Strict cookie — never in response body
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  // CSRF token for subsequent requests
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false, // readable by JS for header
    secure: true,
    sameSite: 'strict',
  });

  auditLog({
    timestamp: new Date().toISOString(),
    user_id: user.id,
    action: 'login',
    resource: '/login',
    result: 'success',
    ip: req.ip || 'unknown',
  });

  res.json({ csrfToken });
});

// File download: realpath() + prefix check to prevent path traversal
app.get('/files/:name', authMiddleware, (req, res) => {
  const UPLOADS_DIR = path.resolve('./uploads');
  const requestedPath = path.resolve(UPLOADS_DIR, req.params.name);

  // realpath + prefix check: resolved path MUST start with uploads dir
  const realPath = fs.realpathSync(requestedPath);
  if (!realPath.startsWith(UPLOADS_DIR + path.sep)) {
    auditLog({
      timestamp: new Date().toISOString(),
      user_id: (req as any).user?.userId || null,
      action: 'file_download',
      resource: req.params.name,
      result: 'failure',
      ip: req.ip || 'unknown',
    });
    return res.status(403).json({ error: 'Access denied' });
  }

  auditLog({
    timestamp: new Date().toISOString(),
    user_id: (req as any).user?.userId || null,
    action: 'file_download',
    resource: req.params.name,
    result: 'success',
    ip: req.ip || 'unknown',
  });

  res.sendFile(realPath);
});

// Admin command: REMOVED exec(). Use execFile with array args for specific allowed commands.
// Only allowlisted commands. Never pass user input to a shell.
const ALLOWED_COMMANDS: Record<string, string[]> = {
  'disk-usage': ['df', '-h'],
  'uptime': ['uptime'],
};

app.post('/admin/run', authMiddleware, requireRole('admin'), (req, res) => {
  const commandSchema = z.object({ command: z.enum(['disk-usage', 'uptime']) });
  const parsed = commandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid command' });

  const [cmd, ...args] = ALLOWED_COMMANDS[parsed.data.command];

  // execFile with array args — no shell interpolation
  execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
    auditLog({
      timestamp: new Date().toISOString(),
      user_id: (req as any).user.userId,
      action: 'admin_run',
      resource: parsed.data.command,
      result: err ? 'failure' : 'success',
      ip: req.ip || 'unknown',
    });

    if (err) return res.status(500).json({ error: 'Command failed' });
    res.json({ output: stdout });
  });
});

// Profile: sanitize HTML output to prevent XSS
app.get('/profile/:id', authMiddleware, async (req, res) => {
  const idSchema = z.object({ id: z.string().uuid() });
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid ID' });

  const user = await db.findUser(parsed.data.id);
  if (!user) return res.status(404).json({ error: 'Not found' });

  // Sanitize with DOMPurify — explicit allowed tags, no raw user HTML
  const safeName = DOMPurify.sanitize(user.name, { ALLOWED_TAGS: [] }); // text only
  const safeBio = DOMPurify.sanitize(user.bio, { ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong'] });

  res.send(`<html><body><h1>${safeName}</h1><div>${safeBio}</div></body></html>`);
});

// Redirect: validate URL protocol (http/https only) + domain allowlist for SSRF
app.get('/redirect', (req, res) => {
  const urlSchema = z.object({ url: z.string().max(2048) });
  const parsed = urlSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid URL' });

  // MUST reject non-http/https protocols — javascript: URI = XSS
  // MUST check against domain allowlist — open redirect = SSRF gadget
  if (!isValidRedirectUrl(parsed.data.url)) {
    return res.status(400).json({ error: 'Invalid or disallowed redirect URL' });
  }

  res.redirect(parsed.data.url);
});

// File upload: validate size, MIME type, extension allowlist
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];

app.post('/upload', authMiddleware, (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid upload' });

  const { file } = parsed.data;

  // Validate extension (allowlist)
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }

  // Validate MIME type (allowlist)
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    return res.status(400).json({ error: 'MIME type not allowed' });
  }

  // Size already validated by schema (5MB max)

  // Path traversal protection: sanitize filename, realpath + prefix check
  const UPLOADS_DIR = path.resolve('./uploads');
  const safeName = path.basename(file.name); // strip directory components
  const targetPath = path.resolve(UPLOADS_DIR, safeName);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  fs.writeFileSync(targetPath, Buffer.from(file.data, 'base64'));

  auditLog({
    timestamp: new Date().toISOString(),
    user_id: (req as any).user.userId,
    action: 'file_upload',
    resource: safeName,
    result: 'success',
    ip: req.ip || 'unknown',
  });

  res.json({ path: `/files/${safeName}` });
});

// User action: structured audit log (never console.log raw request data)
app.post('/api/action', authMiddleware, (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  // Structured audit log — NOT console.log(req.body)
  // Never log passwords, tokens, or PII
  auditLog({
    timestamp: new Date().toISOString(),
    user_id: (req as any).user.userId,
    action: parsed.data.action,
    resource: parsed.data.resource,
    result: 'success',
    ip: req.ip || 'unknown',
  });

  res.json({ ok: true });
});

// Delete account: auth + authz check, no localStorage reference
app.post('/account/delete', authMiddleware, async (req, res) => {
  // JWT already verified by authMiddleware (from httpOnly cookie, not localStorage)
  const user = (req as any).user;

  // Authz: user can only delete their own account (or admin can delete any)
  // Already authenticated via middleware; userId comes from verified JWT
  await db.deleteUser(user.userId);

  auditLog({
    timestamp: new Date().toISOString(),
    user_id: user.userId,
    action: 'account_delete',
    resource: `/account/${user.userId}`,
    result: 'success',
    ip: req.ip || 'unknown',
  });

  // Clear auth cookies
  res.clearCookie('token');
  res.clearCookie('csrfToken');
  res.json({ deleted: true });
});

app.listen(3000);
```

---

## Summary of All Fixes

| # | Vulnerability | Fix Applied |
|---|---|---|
| 1 | SQL Injection (string concat) | Parameterized query with `$1` placeholder |
| 2 | No input validation | Zod schema allowlists on every endpoint |
| 3 | Command injection (`exec`) | Replaced with `execFile` + allowlisted commands with array args |
| 4 | Path traversal | `path.resolve()` + `realpathSync()` + prefix check |
| 5 | Untrusted code execution | Removed arbitrary command execution entirely |
| 6 | No upload validation | Size, MIME type, and extension allowlists |
| 7 | XSS (raw HTML rendering) | DOMPurify sanitization with explicit allowed tags |
| 8 | Open redirect (no protocol check) | `new URL().protocol` validation — only `http:` / `https:` allowed |
| 9 | No security headers / CSP | `helmet()` with strict CSP, HSTS, X-Frame-Options DENY, nosniff |
| 10 | JWT in localStorage | JWT in httpOnly Secure SameSite=Strict cookie |
| 11 | HS256 on public API | Noted RS256 for public APIs; code comments show how to switch |
| 12 | Plaintext passwords | bcrypt.compare() against stored hash; bcrypt(12+) for hashing |
| 13 | No authorization checks | `authMiddleware` + `requireRole()` on all protected routes |
| 14 | Hardcoded secret | `process.env.JWT_SECRET` with startup validation |
| 15 | No CSRF protection | CSRF token middleware + SameSite=Strict cookies + Origin validation |
| 16 | Wildcard CORS + credentials | Explicit origin allowlist from env var |
| 17 | No rate limiting | `express-rate-limit` on all endpoints + stricter on auth |
| 18 | Logging sensitive data | Structured audit log with specific fields — never raw `req.body` |
| 19 | No structured audit logs | `auditLog()` with timestamp, user_id, action, resource, result, IP |
| 20 | SSRF via open redirect | Domain allowlist validation in `isValidRedirectUrl()` |
