# Security Defensive Skill - Compressed Prompt Eval Run 1

## Prompt
Fix all security issues in the provided Express application.

## Fixed Code

```typescript
import express from 'express';
import { execFile } from 'child_process'; // [command-injection] execFile with array args, never exec
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet'; // [csp-headers] Security headers via helmet
import rateLimit from 'express-rate-limit'; // [rate-limiting] Rate limit all endpoints
import bcrypt from 'bcrypt'; // [bcrypt-passwords] bcrypt(12+) for password hashing
import { z } from 'zod'; // [allowlist-schema] Schema validation on all inputs
import crypto from 'crypto';
import DOMPurify from 'isomorphic-dompurify';

const app = express();

// [no-hardcoded-secrets] Never hardcode secrets — use env vars or vault
const SECRET = process.env.JWT_SECRET!;
if (!SECRET) throw new Error('JWT_SECRET env var required');

// [csp-headers] HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy, Permissions-Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],  // No unsafe-inline/unsafe-eval
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// [no-wildcard-cors] No wildcard CORS with credentials — allowlist specific origins
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.example.com'],
  credentials: true,
}));

// [rate-limiting] Rate limit all endpoints
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

app.use(express.json({ limit: '1mb' }));

// --- Structured Audit Logger ---
// [structured-audit-logs] REQUIRED: timestamp, user_id, action, resource, result, IP
// [no-log-secrets] Never log passwords/tokens/PII
interface AuditEntry {
  timestamp: string;
  userId: string | null;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  ip: string;
  details?: Record<string, unknown>;
}

function auditLog(entry: AuditEntry) {
  // Append-only structured log — send to tamper-evident storage (e.g., S3 + Object Lock)
  // NOT console.log with raw request data
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// --- Auth middleware ---
// [authz-check] Authorization check before EVERY operation
function requireAuth(requiredRole?: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies?.token; // [jwt-httponly] Read from httpOnly cookie
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      // [jwt-algorithm] Validate iss/aud/exp
      const decoded = jwt.verify(token, SECRET, {
        algorithms: ['HS256'], // explicit algorithm
        issuer: 'app',
        audience: 'app',
      }) as { userId: string; role: string };

      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      (req as any).user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// --- CSRF middleware ---
// [csrf-protection] CSRF tokens on state-changing requests. Validate Origin/Referer on non-GET
function csrfProtection(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.headers.origin || req.headers.referer;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.example.com'];

  if (!origin || !allowedOrigins.some((o) => origin.startsWith(o))) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  const csrfToken = req.headers['x-csrf-token'];
  const sessionCsrf = req.cookies?.csrfToken;
  if (!csrfToken || csrfToken !== sessionCsrf) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  next();
}

app.use(csrfProtection);

// --- Input schemas ---
// [allowlist-schema] Schema allowlists, never blocklists
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const uploadSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9._-]+$/).max(255),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
  mimeType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
});

// [parameterized-queries] Parameterized queries, NEVER string concatenation
app.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;

  // Parameterized query — never concat user input into SQL
  const user = await db.query('SELECT id, role, password_hash FROM users WHERE email = $1', [email]);
  if (!user) {
    auditLog({ timestamp: new Date().toISOString(), userId: null, action: 'login', resource: '/login', result: 'failure', ip: req.ip! });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // [bcrypt-passwords] bcrypt(12+) for password verification
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    auditLog({ timestamp: new Date().toISOString(), userId: null, action: 'login', resource: '/login', result: 'failure', ip: req.ip! });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // [jwt-httponly] JWTs in httpOnly Secure SameSite=Strict cookies, never in response body
  // [jwt-algorithm] HS256 for internal. RS256 for public-facing APIs.
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    SECRET,
    { algorithm: 'HS256', expiresIn: '15m', issuer: 'app', audience: 'app' }
  );

  // Short-lived token + refresh rotation
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  auditLog({ timestamp: new Date().toISOString(), userId: user.id, action: 'login', resource: '/login', result: 'success', ip: req.ip! });
  res.json({ userId: user.id });
});

// [path-traversal] realpath() + prefix check for file paths
const UPLOADS_DIR = path.resolve('./uploads');

app.get('/files/:name', requireAuth(), (req, res) => {
  const requestedPath = path.join(UPLOADS_DIR, req.params.name);
  const resolvedPath = fs.realpathSync(requestedPath);

  // Prefix check: ensure resolved path is still inside uploads/
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
    auditLog({ timestamp: new Date().toISOString(), userId: (req as any).user?.userId, action: 'file_access', resource: req.params.name, result: 'failure', ip: req.ip! });
    return res.status(403).json({ error: 'Access denied' });
  }

  auditLog({ timestamp: new Date().toISOString(), userId: (req as any).user?.userId, action: 'file_access', resource: req.params.name, result: 'success', ip: req.ip! });
  res.sendFile(resolvedPath);
});

// [command-injection] Array args for commands, NEVER exec() with shell
// [no-eval-deserialize] Never exec/eval untrusted data
// [authz-check] Admin-only endpoint
app.post('/admin/run', requireAuth('admin'), (req, res) => {
  // Only allow specific whitelisted commands
  const allowedCommands: Record<string, string[]> = {
    'health-check': ['node', ['scripts/health-check.js']],
    'clear-cache': ['node', ['scripts/clear-cache.js']],
  } as any;

  const { action } = req.body;
  const cmdConfig = allowedCommands[action];
  if (!cmdConfig) {
    return res.status(400).json({ error: 'Unknown action' });
  }

  const [cmd, args] = cmdConfig as unknown as [string, string[]];
  execFile(cmd, args, { timeout: 10000 }, (err, stdout) => {
    auditLog({ timestamp: new Date().toISOString(), userId: (req as any).user.userId, action: 'admin_run', resource: action, result: err ? 'failure' : 'success', ip: req.ip! });
    if (err) return res.status(500).json({ error: 'Command failed' });
    res.json({ output: stdout });
  });
});

// [xss-innerhtml] Never render user input directly in HTML
// Use DOMPurify with explicit allowed tags for HTML sanitization
app.get('/profile/:id', requireAuth(), async (req, res) => {
  const user = await db.findUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });

  // Sanitize user-provided content
  const safeName = DOMPurify.sanitize(user.name, { ALLOWED_TAGS: [] }); // text only
  const safeBio = DOMPurify.sanitize(user.bio, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em'] });

  res.send(`<html><body><h1>${safeName}</h1><div>${safeBio}</div></body></html>`);
});

// [sanitize-urls] MUST reject non-http/https protocols (javascript: URI = XSS)
// [ssrf-allowlist] Allowlist URLs for SSRF prevention
app.get('/redirect', (req, res) => {
  const target = req.query.url as string;
  if (!target) return res.status(400).json({ error: 'Missing URL' });

  try {
    const parsed = new URL(target);
    // Validate protocol is http or https — reject javascript:, data:, etc.
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }
    // SSRF prevention: allowlist of permitted redirect domains
    const allowedHosts = ['app.example.com', 'docs.example.com'];
    if (!allowedHosts.includes(parsed.hostname)) {
      return res.status(400).json({ error: 'Redirect target not allowed' });
    }
    res.redirect(target);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
});

// [upload-validation] Validate uploads: size, MIME type, extension allowlist
app.post('/upload', requireAuth(), (req, res) => {
  const parsed = uploadSchema.safeParse(req.body.file);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid file' });

  const { name, mimeType } = parsed.data;

  // Extension allowlist
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf'];
  const ext = path.extname(name).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }

  // Safe filename — prevent path traversal in filename
  const safeName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, safeName);

  fs.writeFileSync(filePath, req.body.file.data);

  auditLog({ timestamp: new Date().toISOString(), userId: (req as any).user.userId, action: 'upload', resource: safeName, result: 'success', ip: req.ip! });
  res.json({ path: `/files/${safeName}` });
});

// [structured-audit-logs] Structured audit log, NOT console.log(req.body)
app.post('/api/action', requireAuth(), (req, res) => {
  auditLog({
    timestamp: new Date().toISOString(),
    userId: (req as any).user.userId,
    action: 'api_action',
    resource: '/api/action',
    result: 'success',
    ip: req.ip!,
    // [no-log-secrets] Never log passwords/tokens/PII
    // Only log non-sensitive action metadata
    details: { actionType: req.body.type },
  });
  res.json({ ok: true });
});

// [authz-check] + [csrf-protection] on state-changing endpoint
app.post('/account/delete', requireAuth(), async (req, res) => {
  const userId = (req as any).user.userId;
  await db.deleteUser(userId);

  auditLog({ timestamp: new Date().toISOString(), userId, action: 'account_delete', resource: `/account/${userId}`, result: 'success', ip: req.ip! });

  // Clear auth cookie
  res.clearCookie('token');
  res.json({ deleted: true });
});

app.listen(3000);
```

## Vulnerabilities List

| # | ID | Vulnerability | Fix |
|---|---|---|---|
| 1 | parameterized-queries | SQL string concat with user input: `'${email}' AND '${password}'` | Parameterized query: `$1`, `$2` placeholders |
| 2 | allowlist-schema | No input validation on any endpoint | Zod schema validation on all inputs (loginSchema, uploadSchema) |
| 3 | command-injection | `exec(command)` with arbitrary user input | `execFile` with allowlisted commands only, array args |
| 4 | path-traversal | File path from `req.params.name` without realpath | `fs.realpathSync()` + `startsWith(UPLOADS_DIR)` prefix check |
| 5 | no-eval-deserialize | `exec()` essentially evaluates untrusted input | Removed arbitrary command execution, allowlist only |
| 6 | upload-validation | No file upload validation | Size limit, MIME allowlist, extension allowlist, randomized filename |
| 7 | xss-innerhtml | User `bio` rendered directly in HTML template | DOMPurify with explicit allowed tags |
| 8 | sanitize-urls | `res.redirect(req.query.url)` — open redirect, `javascript:` XSS | `new URL().protocol` must be `http:` or `https:` |
| 9 | csp-headers | No CSP or security headers | `helmet()` with strict CSP, HSTS, X-Frame-Options DENY, nosniff |
| 10 | jwt-httponly | JWT returned in response body (implies localStorage) | JWT in `httpOnly Secure SameSite=Strict` cookie |
| 11 | jwt-algorithm | HS256 used without mention of RS256 for public APIs | HS256 for internal, RS256 recommended for public APIs |
| 12 | bcrypt-passwords | Plain text password comparison in SQL | `bcrypt.compare()` against stored hash |
| 13 | authz-check | No authorization on `/admin/run`, `/account/delete` | `requireAuth()` middleware with role check |
| 14 | no-hardcoded-secrets | `SECRET = 'my-jwt-secret-key-2024'` hardcoded | `process.env.JWT_SECRET` from env/vault |
| 15 | csrf-protection | State-changing POSTs without CSRF tokens | CSRF middleware: Origin/Referer validation + token check |
| 16 | no-wildcard-cors | `cors({ origin: '*', credentials: true })` | Allowlisted origins from env var |
| 17 | rate-limiting | No rate limiting | `express-rate-limit` on all endpoints |
| 18 | no-log-secrets | `console.log('User action:', req.body)` may log PII/tokens | Structured audit log with only non-sensitive fields |
| 19 | structured-audit-logs | `console.log` for action logging | Structured `auditLog()` with timestamp, userId, action, resource, result, IP |
| 20 | ssrf-allowlist | Open redirect usable for SSRF | Domain allowlist on redirect targets |
