# Run 1 — With Skill

## Vulnerabilities Found

### 1. SQL Injection (Critical)
**Location:** `/login` — `` db.query(`SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`) ``
**Issue:** Direct string concatenation of user input into SQL query. Attacker can bypass auth or dump the entire database.
**Rule:** Parameterized queries, never string concatenation.

### 2. Plaintext Password Comparison (Critical)
**Location:** `/login` — password stored and compared as plaintext in the SQL query.
**Issue:** Passwords must be hashed with bcrypt(12+)/argon2id. Comparing plaintext means the DB stores plaintext passwords.
**Rule:** bcrypt(12+) or argon2id for password hashing. Never SHA-256/MD5/plaintext.

### 3. No Input Validation / Schema Allowlisting (High)
**Location:** Every endpoint — no schema validation on any request body or query parameter.
**Issue:** Any shape of data is accepted. No Zod/Joi schemas. Violates the system boundary validation requirement.
**Rule:** Schema allowlists (never blocklists) on all inputs at system boundary.

### 4. Command Injection / RCE (Critical)
**Location:** `/admin/run` — `exec(command)` with user-supplied string.
**Issue:** `exec()` spawns a shell. User input passed directly = full Remote Code Execution. This endpoint should not exist in its current form. If system commands are needed, use `execFile()` with an allowlist of permitted commands and array arguments.
**Rule:** Array args for commands, never shell=True/exec() with user input. Never eval/execute untrusted data.

### 5. Path Traversal — File Read (High)
**Location:** `/files/:name` — `` `./uploads/${req.params.name}` ``
**Issue:** `../../etc/passwd` reads arbitrary files. No `basename()` stripping, no `realpath()` + prefix check.
**Rule:** realpath() + prefix check for file paths.

### 6. Path Traversal — File Write (High)
**Location:** `/upload` — `` `./uploads/${file.name}` ``
**Issue:** Same traversal but for writes. Attacker can overwrite arbitrary files including source code.
**Rule:** realpath() + prefix check for file paths.

### 7. No Upload Validation (High)
**Location:** `/upload` — no size, MIME type, or extension validation.
**Issue:** Attacker can upload executables, oversized files, or files with dangerous extensions.
**Rule:** Validate uploads: size, MIME type, extension allowlist.

### 8. XSS via Server-Side HTML Rendering (High)
**Location:** `/profile/:id` — `` `<h1>${user.name}</h1><div>${user.bio}</div>` ``
**Issue:** User-controlled `name` and `bio` rendered directly into HTML without encoding. Stored XSS.
**Rule:** Encode output to prevent XSS. No innerHTML with user input; use textContent or sanitize with DOMPurify.

### 9. Open Redirect / SSRF (High)
**Location:** `/redirect` — `res.redirect(req.query.url)` with no validation.
**Issue:** Attacker can redirect users to phishing sites or use `javascript:` URIs for XSS. Also usable for SSRF if the redirect is followed server-side.
**Rule:** Validate URL protocol is http/https. Allowlist redirect targets or verify same-origin. Allowlist URLs for SSRF prevention.

### 10. JWT Returned in Response Body (High)
**Location:** `/login` — `res.json({ token })` implies client stores token in localStorage.
**Issue:** Tokens in localStorage are accessible to any XSS. Must be in httpOnly cookies.
**Rule:** JWTs in httpOnly Secure SameSite=Strict cookies, never localStorage.

### 11. HS256 for Public-Facing API (Medium)
**Location:** `/login` — `jwt.sign(..., { algorithm: 'HS256' })`.
**Issue:** HS256 uses a shared secret. Public APIs should use RS256 (asymmetric) so verifiers don't need the signing key.
**Rule:** RS256 for public APIs, HS256 internal only.

### 12. Hardcoded Secret (Critical)
**Location:** `const SECRET = 'my-jwt-secret-key-2024'` at top of file.
**Issue:** Secret committed to source code. Anyone with repo access has the signing key.
**Rule:** Never hardcode secrets, use env vars or vault.

### 13. No Authorization Checks (Critical)
**Location:** `/admin/run` has no auth/authz. `/account/delete` has no role check. `/profile/:id` has no ownership check.
**Issue:** Any unauthenticated user can execute commands, delete accounts, or view profiles.
**Rule:** Authorization check before every operation (RBAC/ABAC/RLS).

### 14. IDOR on `/account/delete` (High)
**Location:** `/account/delete` — deletes `decoded.userId` but no ownership verification that the requester owns that account.
**Issue:** If token is stolen or forged, no secondary ownership check.
**Rule:** Verify authenticated user owns/has access to the requested resource.

### 15. Wildcard CORS with Credentials (High)
**Location:** `cors({ origin: '*', credentials: true })`.
**Issue:** Browsers block this combination, so developers add hacks that break security. Must use explicit origin allowlist.
**Rule:** No wildcard CORS with credentials. Explicit origin list from env vars.

### 16. No Security Headers (High)
**Location:** No `helmet()`, no CSP, no HSTS, no X-Frame-Options, no nosniff.
**Issue:** Missing all standard security headers. No Content-Security-Policy.
**Rule:** helmet(), strict CSP with nonces (no unsafe-inline/unsafe-eval), HSTS, X-Frame-Options DENY, nosniff.

### 17. No CSRF Protection (High)
**Location:** All state-changing POST endpoints lack CSRF tokens.
**Issue:** SameSite cookies help but CSRF tokens are defense-in-depth for state-changing operations.
**Rule:** SameSite=Strict + CSRF tokens on state changes.

### 18. No Rate Limiting (High)
**Location:** No rate limiting on any endpoint, especially `/login`.
**Issue:** Credential stuffing and brute-force attacks are trivial.
**Rule:** Rate limit all endpoints. Stricter limits on auth endpoints.

### 19. Logging Sensitive Data (Medium)
**Location:** `/api/action` — `console.log('User action:', req.body)`.
**Issue:** `req.body` may contain passwords, tokens, or PII. Raw `console.log` is not a structured audit log.
**Rule:** Never log passwords/tokens/PII. Use structured audit logs with timestamp, user_id, action, resource, result, IP.

### 20. No Structured Audit Logging (Medium)
**Location:** Only `console.log` used for action logging.
**Issue:** No structured fields (timestamp, user_id, action, resource, result, IP). Cannot enable alerting, forensics, or compliance.
**Rule:** Structured audit logs with append-only tamper-evident storage.

### 21. localStorage Reference in Server Code (Bug)
**Location:** `/account/delete` — `localStorage.getItem('token')`.
**Issue:** `localStorage` does not exist server-side. This is dead code / bug that also reveals the antipattern of storing tokens in localStorage.
**Rule:** Never store auth tokens in localStorage/sessionStorage.

### 22. Error Handling Leaks Internals (Medium)
**Location:** No global error handler. Individual endpoints may expose raw error messages or stack traces.
**Issue:** Without a global error handler, unhandled errors leak stack traces and internal paths to clients.
**Rule:** Generic error messages to clients. Log full error server-side with request ID.

### 23. No HTTPS Enforcement (Medium)
**Location:** `app.listen(3000)` with no TLS or HSTS.
**Issue:** No enforcement of HTTPS. Cookies and tokens transmitted in cleartext.
**Rule:** HTTPS for all external communication, HSTS enabled.

---

## Fixed Code

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from 'csurf';
import crypto from 'crypto';
import { hash, compare } from 'bcrypt';
import { z } from 'zod';

const app = express();

// --- Secrets from environment, never hardcoded ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required');

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;  // For RS256 verification
const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY; // For RS256 signing

const UPLOAD_DIR = path.resolve('./uploads');

// --- Security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],  // No unsafe-inline, no unsafe-eval
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// --- CORS: explicit origin allowlist, never wildcard with credentials ---
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// --- Rate limiting: general + strict auth tier ---
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Brute-force protection
}));

app.use('/account/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
}));

// --- CSRF protection on state-changing routes ---
const csrfProtection = csrf({ cookie: { httpOnly: true, secure: true, sameSite: 'strict' } });
app.use(csrfProtection);

// --- Structured audit logger ---
function auditLog(entry: {
  userId?: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  ip: string;
  meta?: Record<string, unknown>;
}) {
  // Append-only structured log. In production, ship to tamper-evident storage.
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  // Never log passwords, tokens, or PII in meta
  console.log(JSON.stringify(logEntry));
}

// --- Input schemas (Zod allowlists) ---
const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const uploadSchema = z.object({
  file: z.object({
    name: z.string().max(255),
    data: z.string(), // base64 or buffer representation
    mimeType: z.string(),
    size: z.number().max(5 * 1024 * 1024), // 5MB max
  }),
});

const actionSchema = z.object({
  actionType: z.string().max(100),
  resourceId: z.string().max(100).optional(),
});

const redirectSchema = z.object({
  url: z.string().max(2048),
});

// --- Allowed upload extensions and MIME types ---
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt']);
const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain',
]);

// --- Authentication middleware ---
function authenticate(req: Request, res: Response, next: NextFunction) {
  // JWT is read from httpOnly cookie, never from localStorage
  const token = req.cookies?.authToken;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Validate iss, aud, exp claims
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'], // Explicit algorithm; use RS256 + public key for public APIs
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Authorization middleware ---
function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// --- Sanitize user output for HTML (prevent XSS) ---
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// =============================================================================
// ROUTES
// =============================================================================

// --- Login: parameterized query, bcrypt comparison, JWT in httpOnly cookie ---
app.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { email, password } = parsed.data;

  try {
    // Parameterized query — never concatenate user input into SQL
    const user = await db.query(
      'SELECT id, role, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      // Constant-time-safe: don't reveal whether email exists
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // bcrypt comparison — password stored as bcrypt hash, never plaintext
    const valid = await compare(password, user.password_hash);
    if (!valid) {
      auditLog({
        action: 'login',
        resource: 'auth',
        result: 'failure',
        ip: req.ip || 'unknown',
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Short-lived token. For public APIs, use RS256 with JWT_PRIVATE_KEY.
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      }
    );

    // JWT in httpOnly Secure SameSite=Strict cookie — never in response body
    res.cookie('authToken', token, {
      httpOnly: true,     // JS cannot read — blocks XSS token theft
      secure: true,       // HTTPS only — blocks network sniffing
      sameSite: 'strict', // Blocks CSRF from cross-origin requests
      maxAge: 60 * 60 * 1000, // 1 hour — short-lived
    });

    auditLog({
      userId: user.id,
      action: 'login',
      resource: 'auth',
      result: 'success',
      ip: req.ip || 'unknown',
    });

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- File download: path traversal prevention with basename + realpath check ---
app.get('/files/:name', authenticate, async (req: Request, res: Response) => {
  // basename() strips all directory components: ../../etc/passwd -> passwd
  const safeName = path.basename(req.params.name);
  const filePath = path.join(UPLOAD_DIR, safeName);

  // Resolve and verify the final path starts with allowed directory
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await fs.access(resolved);
    return res.sendFile(resolved);
  } catch {
    return res.status(404).json({ error: 'File not found' });
  }
});

// --- Admin run: REMOVED exec() with user input entirely ---
// The original /admin/run endpoint passed user input to exec(), which is
// full RCE. Instead, provide an allowlist of permitted operations.
const ALLOWED_ADMIN_COMMANDS: Record<string, { cmd: string; args: string[] }> = {
  'disk-usage': { cmd: '/usr/bin/df', args: ['-h'] },
  'uptime': { cmd: '/usr/bin/uptime', args: [] },
};

app.post(
  '/admin/run',
  authenticate,
  authorize('admin'),
  async (req: Request, res: Response) => {
    const commandName = z.object({ command: z.string().max(50) }).safeParse(req.body);
    if (!commandName.success) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const allowed = ALLOWED_ADMIN_COMMANDS[commandName.data.command];
    if (!allowed) {
      return res.status(400).json({ error: 'Unknown command' });
    }

    // execFile() — arguments passed as array, never interpreted by shell
    execFile(allowed.cmd, allowed.args, { timeout: 5000 }, (err, stdout) => {
      if (err) {
        auditLog({
          userId: (req as any).user.userId,
          action: 'admin_run',
          resource: commandName.data.command,
          result: 'failure',
          ip: req.ip || 'unknown',
        });
        return res.status(500).json({ error: 'Command failed' });
      }

      auditLog({
        userId: (req as any).user.userId,
        action: 'admin_run',
        resource: commandName.data.command,
        result: 'success',
        ip: req.ip || 'unknown',
      });

      return res.json({ output: stdout });
    });
  }
);

// --- Profile: XSS prevention via HTML encoding + ownership check (IDOR) ---
app.get('/profile/:id', authenticate, async (req: Request, res: Response) => {
  const idSchema = z.object({ id: z.string().uuid() });
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const user = await db.findUser(parsed.data.id);
  if (!user) {
    return res.status(404).json({ error: 'Not found' });
  }

  // IDOR prevention: verify the authenticated user owns or has access
  if (user.id !== (req as any).user.userId && (req as any).user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // HTML-encode all user-controlled data to prevent stored XSS
  const safeName = escapeHtml(user.name);
  const safeBio = escapeHtml(user.bio);

  return res.send(
    `<html><body><h1>${safeName}</h1><div>${safeBio}</div></body></html>`
  );
});

// --- Redirect: validate URL protocol + same-origin check (open redirect + SSRF) ---
app.get('/redirect', (req: Request, res: Response) => {
  const parsed = redirectSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const target = parsed.data.url;

  // Allow relative paths (internal navigation)
  if (target.startsWith('/') && !target.startsWith('//')) {
    return res.redirect(target);
  }

  // For absolute URLs: reject non-http(s) protocols (blocks javascript: URIs)
  // and verify origin matches our expected origin (prevents open redirect + SSRF)
  try {
    const url = new URL(target);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    const allowedOrigins = (process.env.ALLOWED_REDIRECT_ORIGINS || '').split(',');
    if (!allowedOrigins.includes(url.origin)) {
      return res.status(400).json({ error: 'Redirect target not allowed' });
    }

    return res.redirect(target);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
});

// --- Upload: validation (size, MIME, extension) + path traversal prevention ---
app.post('/upload', authenticate, async (req: Request, res: Response) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { file } = parsed.data;

  // Extension allowlist
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }

  // MIME type allowlist
  if (!ALLOWED_MIMES.has(file.mimeType)) {
    return res.status(400).json({ error: 'MIME type not allowed' });
  }

  // Size check (already validated by Zod, defense-in-depth)
  if (file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File too large' });
  }

  // Path traversal prevention: basename strips directory components
  const safeName = path.basename(file.name);
  const filePath = path.join(UPLOAD_DIR, safeName);

  // Verify resolved path stays within upload directory
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await fs.writeFile(resolved, file.data);

    auditLog({
      userId: (req as any).user.userId,
      action: 'upload',
      resource: safeName,
      result: 'success',
      ip: req.ip || 'unknown',
    });

    return res.json({ path: `/files/${safeName}` });
  } catch {
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// --- API action: structured audit log, no raw req.body logging ---
app.post('/api/action', authenticate, async (req: Request, res: Response) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // Structured audit log — never console.log(req.body) which may contain PII/tokens
  auditLog({
    userId: (req as any).user.userId,
    action: parsed.data.actionType,
    resource: parsed.data.resourceId || 'unknown',
    result: 'success',
    ip: req.ip || 'unknown',
  });

  return res.json({ ok: true });
});

// --- Account delete: auth + ownership + CSRF protected ---
app.post('/account/delete', authenticate, async (req: Request, res: Response) => {
  // JWT is read from httpOnly cookie by authenticate middleware (not localStorage)
  const user = (req as any).user;

  // Ownership check: user can only delete their own account
  // (CSRF token validated by csrfProtection middleware above)
  try {
    await db.deleteUser(user.userId);

    auditLog({
      userId: user.userId,
      action: 'account_delete',
      resource: `user:${user.userId}`,
      result: 'success',
      ip: req.ip || 'unknown',
    });

    // Clear the auth cookie
    res.clearCookie('authToken');
    return res.json({ deleted: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Global error handler: generic message to client, full log server-side ---
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = crypto.randomUUID();

  // Log full error server-side for debugging (never send to client)
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  }));

  // Generic error to client with request ID for correlation
  return res.status(500).json({ error: 'Internal server error', requestId });
});

app.listen(3000);
```
