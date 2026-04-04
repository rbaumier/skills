# Security Review: Node.js Express Application

## Vulnerabilities Found

### 1. SQL Injection (Critical)
**Location:** `/login` — `db.query(\`SELECT * FROM users WHERE email = '${email}' AND password = '${password}'\`)`
**Issue:** String concatenation of user input directly into SQL. An attacker can inject arbitrary SQL (e.g., `' OR 1=1 --`).
**Rule:** Parameterized queries, never string concatenation.

### 2. No Input Validation / Schema Allowlists (High)
**Location:** Every endpoint — no schema validation on any request body or params.
**Issue:** No allowlist-based input validation anywhere. All endpoints accept arbitrary shapes and values.
**Rule:** Schema allowlists (never blocklists) on all inputs. Use a validation library like zod or joi to define explicit schemas for every endpoint.

### 3. Command Injection (Critical)
**Location:** `/admin/run` — `exec(command, ...)`
**Issue:** User-supplied `command` is passed directly to `exec()`, which spawns a shell. This is full remote code execution.
**Rule:** Array args for commands (never shell=True). Use `execFile` with an allowlist of permitted commands and array arguments. Better: remove this endpoint entirely. `exec()` with untrusted input is equivalent to eval — never eval/execute untrusted data.

### 4. Path Traversal (High)
**Location:** `/files/:name` — `` const filePath = `./uploads/${req.params.name}` ``
**Issue:** An attacker can use `../` sequences (e.g., `../../etc/passwd`) to read arbitrary files.
**Rule:** `realpath()` + prefix check. Resolve the absolute path, then verify it starts with the allowed uploads directory.

### 5. Arbitrary File Write via Upload (High)
**Location:** `/upload` — `fs.writeFileSync(\`./uploads/${file.name}\`, file.data)`
**Issue:** No validation of file size, MIME type, or extension. File name could contain `../` for path traversal. Could upload `.exe`, `.sh`, `.html` (stored XSS), or overwrite existing files.
**Rule:** Validate uploads: size, MIME type, extension allowlist. Sanitize filename. Use `realpath()` + prefix check on the write path.

### 6. Reflected XSS (High)
**Location:** `/profile/:id` — `` res.send(`<html><body><h1>${user.name}</h1><div>${user.bio}</div></body></html>`) ``
**Issue:** `user.name` and `user.bio` are interpolated directly into HTML without escaping or sanitization. If these contain `<script>` tags or event handlers, it's XSS.
**Rule:** No innerHTML with user input. Use a templating engine with auto-escaping, or sanitize with DOMPurify with explicit allowed tags.

### 7. Open Redirect / XSS via URL (High)
**Location:** `/redirect` — `res.redirect(req.query.url as string)`
**Issue:** User-supplied URL is used directly in a redirect with no validation. Attacker can redirect to phishing sites or use `javascript:` protocol for XSS.
**Rule:** MUST reject non-http/https protocols. Validate `new URL(input).protocol` is `http:` or `https:` before redirecting. Ideally, allowlist permitted redirect domains.

### 8. SSRF via Open Redirect (Medium)
**Location:** `/redirect` — same endpoint.
**Issue:** The open redirect can be chained for SSRF if internal services follow redirects from this origin.
**Rule:** Allowlist URLs for SSRF prevention. Only allow redirects to known, trusted domains.

### 9. No CSP or Security Headers (Medium)
**Location:** Entire application — no `helmet()` or manual security headers.
**Issue:** Missing Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy.
**Rule:** Nonce/hash-based CSP (no unsafe-inline/unsafe-eval). Use `helmet` middleware. Add HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy, Permissions-Policy.

### 10. JWT Stored in localStorage (High)
**Location:** `/login` returns `res.json({ token })` — token sent in body for client-side storage. `/account/delete` references `localStorage.getItem('token')`.
**Issue:** JWTs in localStorage are accessible to any XSS attack. Combined with the XSS vulnerabilities above, this is token theft.
**Rule:** JWTs in httpOnly Secure SameSite=Strict cookies (never localStorage).

### 11. JWT Algorithm — HS256 on Public API (Medium)
**Location:** `jwt.sign({ ... }, SECRET, { algorithm: 'HS256' })`
**Issue:** HS256 uses a shared symmetric secret. For a public-facing API, this means the same secret that signs tokens also verifies them — if leaked, any party can forge tokens.
**Rule:** RS256 for public APIs, HS256 internal only. Use asymmetric keys (RS256/ES256) so signing key stays private. Also: validate `iss`, `aud`, `exp` claims. Use short-lived tokens + refresh rotation.

### 12. Plaintext Password Comparison (Critical)
**Location:** `/login` — passwords are compared directly in the SQL query as plaintext.
**Issue:** Passwords are stored and compared in cleartext. No hashing at all.
**Rule:** bcrypt(12+) or Argon2id for password hashing. Hash on registration, verify hash on login.

### 13. No Authorization Checks (Critical)
**Location:** `/admin/run` — no auth/authz check. `/account/delete` — no role verification. `/files/:name` — no access control. `/upload` — no auth.
**Issue:** Any unauthenticated user can execute admin commands, delete accounts, download files, and upload files.
**Rule:** Authorization check (RBAC/ABAC/RLS) before every operation.

### 14. Hardcoded Secret (High)
**Location:** `const SECRET = 'my-jwt-secret-key-2024'`
**Issue:** JWT signing secret is hardcoded in source code. Will be committed to version control. Trivially extractable.
**Rule:** Never hardcode secrets. Use environment variables or a secrets vault (e.g., `process.env.JWT_SECRET`).

### 15. No CSRF Protection (High)
**Location:** All state-changing POST endpoints (`/login`, `/admin/run`, `/upload`, `/account/delete`, `/api/action`).
**Issue:** No CSRF tokens on any state-changing request. Combined with cookie-based auth, this allows cross-site request forgery.
**Rule:** SameSite=Strict + CSRF tokens on state-changing requests. Validate Origin/Referer on non-GET.

### 16. Wildcard CORS with Credentials (High)
**Location:** `app.use(cors({ origin: '*', credentials: true }))`
**Issue:** Wildcard CORS with credentials is explicitly forbidden by browsers for good reason — it allows any origin to make authenticated requests. Even though browsers block this combo, the configuration intent is dangerous and indicates a misunderstanding.
**Rule:** No wildcard CORS with credentials. Specify an explicit allowlist of trusted origins.

### 17. No Rate Limiting (Medium)
**Location:** Entire application — no rate limiting middleware.
**Issue:** Login endpoint is vulnerable to brute force. All endpoints are vulnerable to DoS.
**Rule:** Rate limit all endpoints. Use `express-rate-limit` or similar. Especially critical on `/login`.

### 18. Logging Sensitive Data (High)
**Location:** `/api/action` — `console.log('User action:', req.body)`
**Issue:** `req.body` may contain passwords, tokens, PII, or other sensitive data. Logging it raw exposes this in log files.
**Rule:** Never log passwords/tokens/PII. Sanitize or redact sensitive fields before logging.

### 19. No Structured Audit Logs (Medium)
**Location:** `/api/action` — `console.log('User action:', req.body)`
**Issue:** This is not an audit log. It lacks structure (timestamp, user_id, action, resource, result, IP). It cannot be queried, alerted on, or used for forensics/compliance.
**Rule:** Structured audit logs are REQUIRED. Every log entry MUST include: timestamp, user_id, action, resource, result, IP. Use append-only tamper-evident storage. Do NOT just console.log raw request data.

---

## Fixed Code

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';

const app = express();

// --- Secrets from environment, never hardcoded ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required');

const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY; // RS256 private key (PEM)
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;   // RS256 public key (PEM)
if (!JWT_PRIVATE_KEY || !JWT_PUBLIC_KEY) {
  throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY env vars are required for RS256');
}

// --- Security headers via helmet (CSP, HSTS, X-Frame-Options, nosniff, etc.) ---
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],       // nonce-based in production
    styleSrc: ["'self'"],
    imgSrc: ["'self'"],
    frameAncestors: ["'none'"],  // X-Frame-Options DENY equivalent
  },
}));
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
app.use(helmet.permittedCrossDomainPolicies());

// --- CORS: explicit origin allowlist, no wildcard with credentials ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

// --- Rate limiting on all endpoints ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Stricter rate limit for login (brute force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '1mb' }));

// --- Structured audit logger ---
// Every log entry includes: timestamp, user_id, action, resource, result, IP
// In production, use append-only tamper-evident storage (e.g., immutable log service)
interface AuditEntry {
  timestamp: string;
  userId: string | null;
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'denied';
  ip: string;
  metadata?: Record<string, unknown>;
}

function auditLog(entry: AuditEntry): void {
  // Structured JSON output — pipe to append-only log sink in production
  // Never include raw request bodies (may contain passwords/tokens/PII)
  const logLine = JSON.stringify({
    timestamp: entry.timestamp,
    user_id: entry.userId,
    action: entry.action,
    resource: entry.resource,
    result: entry.result,
    ip: entry.ip,
    ...(entry.metadata ? { metadata: entry.metadata } : {}),
  });
  // In production: write to append-only, tamper-evident log storage
  process.stdout.write(logLine + '\n');
}

// --- Input schemas (allowlists, not blocklists) ---
const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const uploadSchema = z.object({
  file: z.object({
    name: z.string().max(255).regex(/^[a-zA-Z0-9._-]+$/), // safe characters only
    data: z.string(), // base64
    mimeType: z.string(),
    size: z.number(),
  }),
});

// --- CSRF token middleware ---
// For state-changing requests, validate CSRF token from header matches cookie
function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    auditLog({
      timestamp: new Date().toISOString(),
      userId: null,
      action: 'csrf_validation',
      resource: req.path,
      result: 'denied',
      ip: req.ip || 'unknown',
    });
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }
  next();
}

// --- Auth middleware: extract and verify JWT from httpOnly cookie ---
function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.['auth-token'];
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    // RS256 for public API — validate algorithm, issuer, audience, expiry
    const decoded = jwt.verify(token, JWT_PUBLIC_KEY!, {
      algorithms: ['RS256'],
      issuer: 'myapp',
      audience: 'myapp-api',
    }) as { userId: string; role: string };
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Authorization middleware ---
function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !allowedRoles.includes(user.role)) {
      auditLog({
        timestamp: new Date().toISOString(),
        userId: user?.userId || null,
        action: 'authorization_check',
        resource: req.path,
        result: 'denied',
        ip: req.ip || 'unknown',
      });
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

// --- URL validation: reject non-http/https protocols ---
function isAllowedUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Allowlist for redirect domains (SSRF prevention)
const ALLOWED_REDIRECT_DOMAINS = (process.env.ALLOWED_REDIRECT_DOMAINS || '').split(',').filter(Boolean);

function isAllowedRedirectUrl(input: string): boolean {
  if (!isAllowedUrl(input)) return false;
  try {
    const parsed = new URL(input);
    return ALLOWED_REDIRECT_DOMAINS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

// --- Upload validation constants ---
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

const UPLOADS_DIR = path.resolve('./uploads');

// ============================================================
// ROUTES
// ============================================================

// Auth: login
app.post('/login', loginLimiter, csrfProtection, async (req: Request, res: Response) => {
  // Schema allowlist validation
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password } = parsed.data;

  // Parameterized query — never concatenation
  const user = await db.query('SELECT id, email, role, password_hash FROM users WHERE email = $1', [email]);
  if (!user) {
    auditLog({
      timestamp: new Date().toISOString(),
      userId: null,
      action: 'login',
      resource: '/login',
      result: 'failure',
      ip: req.ip || 'unknown',
      metadata: { reason: 'user_not_found' },
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // bcrypt password verification (passwords stored as bcrypt 12+ hashes)
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    auditLog({
      timestamp: new Date().toISOString(),
      userId: null,
      action: 'login',
      resource: '/login',
      result: 'failure',
      ip: req.ip || 'unknown',
      metadata: { reason: 'invalid_password' },
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // RS256 JWT with short expiry, issuer, audience
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_PRIVATE_KEY!,
    { algorithm: 'RS256', expiresIn: '15m', issuer: 'myapp', audience: 'myapp-api' }
  );

  // JWT in httpOnly Secure SameSite=Strict cookie — never in response body
  res.cookie('auth-token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });

  auditLog({
    timestamp: new Date().toISOString(),
    userId: user.id,
    action: 'login',
    resource: '/login',
    result: 'success',
    ip: req.ip || 'unknown',
  });

  res.json({ ok: true });
});

// File download: realpath + prefix check
app.get('/files/:name', authenticate, (req: Request, res: Response) => {
  const requestedPath = path.join(UPLOADS_DIR, req.params.name);
  const resolvedPath = fs.realpathSync(requestedPath);

  // Prefix check: resolved path must be within uploads directory
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
    auditLog({
      timestamp: new Date().toISOString(),
      userId: (req as any).user?.userId || null,
      action: 'file_download',
      resource: req.params.name,
      result: 'denied',
      ip: req.ip || 'unknown',
      metadata: { reason: 'path_traversal_attempt' },
    });
    return res.status(403).json({ error: 'Forbidden' });
  }

  auditLog({
    timestamp: new Date().toISOString(),
    userId: (req as any).user.userId,
    action: 'file_download',
    resource: req.params.name,
    result: 'success',
    ip: req.ip || 'unknown',
  });

  res.sendFile(resolvedPath);
});

// Admin command: allowlisted commands only, execFile with array args (no shell)
const ALLOWED_COMMANDS: Record<string, string> = {
  'disk-usage': '/usr/bin/df',
  'uptime': '/usr/bin/uptime',
};

app.post('/admin/run', authenticate, authorize('admin'), csrfProtection, (req: Request, res: Response) => {
  const commandSchema = z.object({
    command: z.enum(Object.keys(ALLOWED_COMMANDS) as [string, ...string[]]),
    args: z.array(z.string().max(100)).max(10).optional(),
  });

  const parsed = commandSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid command' });
  }

  const execPath = ALLOWED_COMMANDS[parsed.data.command];
  const args = parsed.data.args || [];

  // execFile with array args — no shell interpolation
  execFile(execPath, args, { timeout: 5000 }, (err, stdout) => {
    auditLog({
      timestamp: new Date().toISOString(),
      userId: (req as any).user.userId,
      action: 'admin_command',
      resource: parsed.data.command,
      result: err ? 'failure' : 'success',
      ip: req.ip || 'unknown',
    });

    if (err) return res.status(500).json({ error: 'Command failed' });
    res.json({ output: stdout });
  });
});

// Profile: escaped output (use a template engine with auto-escaping in production)
app.get('/profile/:id', authenticate, async (req: Request, res: Response) => {
  const idSchema = z.object({ id: z.string().uuid() });
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const user = await db.findUser(parsed.data.id);
  if (!user) return res.status(404).json({ error: 'Not found' });

  // HTML-escape user-controlled content to prevent XSS
  // In production, use a templating engine with auto-escaping (e.g., Handlebars, EJS)
  // or DOMPurify with explicit allowed tags for rich content
  const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  res.send(`<html><body><h1>${escapeHtml(user.name)}</h1><div>${escapeHtml(user.bio)}</div></body></html>`);
});

// Redirect: validate protocol is http/https + domain allowlist (SSRF prevention)
app.get('/redirect', (req: Request, res: Response) => {
  const url = req.query.url as string;

  if (!url || !isAllowedRedirectUrl(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed redirect URL' });
  }

  res.redirect(url);
});

// File upload: validate size, MIME type, extension allowlist
app.post('/upload', authenticate, csrfProtection, (req: Request, res: Response) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid upload data' });
  }

  const { file } = parsed.data;

  // Size check
  if (file.size > MAX_UPLOAD_SIZE) {
    return res.status(400).json({ error: 'File too large' });
  }

  // MIME type allowlist
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }

  // Extension allowlist
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ error: 'File extension not allowed' });
  }

  // Safe filename: generate a UUID to prevent path traversal and name collisions
  const safeFilename = `${crypto.randomUUID()}${ext}`;
  const targetPath = path.join(UPLOADS_DIR, safeFilename);

  // Double-check: realpath prefix validation
  const resolvedDir = path.resolve(UPLOADS_DIR);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedDir + path.sep)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  fs.writeFileSync(targetPath, Buffer.from(file.data, 'base64'));

  auditLog({
    timestamp: new Date().toISOString(),
    userId: (req as any).user.userId,
    action: 'file_upload',
    resource: safeFilename,
    result: 'success',
    ip: req.ip || 'unknown',
    metadata: { originalName: file.name, mimeType: file.mimeType, size: file.size },
  });

  res.json({ path: `/files/${safeFilename}` });
});

// User action logging: structured audit log, no raw req.body
app.post('/api/action', authenticate, csrfProtection, (req: Request, res: Response) => {
  const actionSchema = z.object({
    action: z.string().max(100),
    resource: z.string().max(200).optional(),
  });

  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid action data' });
  }

  // Structured audit log — never log raw request body (may contain PII/tokens)
  auditLog({
    timestamp: new Date().toISOString(),
    userId: (req as any).user.userId,
    action: parsed.data.action,
    resource: parsed.data.resource || req.path,
    result: 'success',
    ip: req.ip || 'unknown',
  });

  res.json({ ok: true });
});

// Delete account: auth + authz + CSRF
app.post('/account/delete', authenticate, csrfProtection, async (req: Request, res: Response) => {
  const user = (req as any).user;

  // Authorization: user can only delete their own account
  // JWT is extracted from httpOnly cookie by authenticate middleware — never localStorage
  await db.deleteUser(user.userId);

  auditLog({
    timestamp: new Date().toISOString(),
    userId: user.userId,
    action: 'account_delete',
    resource: `/account/${user.userId}`,
    result: 'success',
    ip: req.ip || 'unknown',
  });

  // Clear auth cookie
  res.clearCookie('auth-token');
  res.json({ deleted: true });
});

app.listen(3000);
```

---

## Summary of All Vulnerabilities (20 issues)

| # | Vulnerability | Severity | OWASP Category | Fix Applied |
|---|---|---|---|---|
| 1 | SQL Injection via string concatenation | Critical | A03:2021-Injection | Parameterized queries with `$1` placeholders |
| 2 | No input validation / schema allowlists | High | A03:2021-Injection | Zod schemas on every endpoint |
| 3 | Command Injection via `exec()` | Critical | A03:2021-Injection | `execFile()` + command allowlist + array args |
| 4 | Path Traversal on file download | High | A01:2021-Broken Access Control | `realpath()` + prefix check |
| 5 | No upload validation | High | A04:2021-Insecure Design | Size, MIME, extension allowlist + UUID filename |
| 6 | Reflected/Stored XSS in profile | High | A03:2021-Injection | HTML escaping (use DOMPurify for rich content) |
| 7 | Open Redirect without protocol check | High | A01:2021-Broken Access Control | URL protocol validation (http/https only) |
| 8 | SSRF via open redirect | Medium | A10:2021-SSRF | Domain allowlist for redirects |
| 9 | No security headers / CSP | Medium | A05:2021-Security Misconfiguration | helmet() with strict CSP, HSTS, etc. |
| 10 | JWT in localStorage | High | A07:2021-Auth Failures | httpOnly Secure SameSite=Strict cookie |
| 11 | HS256 on public API | Medium | A02:2021-Crypto Failures | RS256 with asymmetric keys |
| 12 | Plaintext password comparison | Critical | A02:2021-Crypto Failures | bcrypt(12+) hash verification |
| 13 | No authorization checks | Critical | A01:2021-Broken Access Control | Auth middleware + role-based authorize() |
| 14 | Hardcoded JWT secret | High | A02:2021-Crypto Failures | Environment variables |
| 15 | No CSRF protection | High | A01:2021-Broken Access Control | CSRF token middleware on state-changing routes |
| 16 | Wildcard CORS with credentials | High | A05:2021-Security Misconfiguration | Explicit origin allowlist |
| 17 | No rate limiting | Medium | A04:2021-Insecure Design | express-rate-limit on all endpoints + stricter on login |
| 18 | Logging sensitive data | High | A09:2021-Security Logging Failures | Never log raw req.body; redact PII/tokens |
| 19 | No structured audit logs | Medium | A09:2021-Security Logging Failures | Structured JSON with timestamp, user_id, action, resource, result, IP |
| 20 | eval/exec of untrusted data | Critical | A03:2021-Injection | Removed direct exec(); allowlisted commands only |
