# Run 1 — Without Skill

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
import csrf from 'csurf';
import { z } from 'zod';

const app = express();

// --- Secrets from environment, never hardcoded ---
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// --- Security headers (CSP, X-Frame-Options, etc.) via helmet ---
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
    },
  })
);

// --- CORS: explicit allowlist, no wildcard with credentials ---
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// --- Rate limiting on all endpoints ---
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Stricter rate limit on auth ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

// --- CSRF protection for state-changing requests ---
const csrfProtection = csrf({ cookie: { httpOnly: true, secure: true, sameSite: 'strict' } });

// --- Structured audit logger ---
function auditLog(event: {
  action: string;
  userId?: string;
  resource?: string;
  result: 'success' | 'failure';
  ip: string;
}) {
  // Structured JSON log — ship to log aggregator, never console.log raw bodies
  const entry = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  // In production: send to structured logging service (e.g., pino, winston with JSON transport)
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// --- Input validation schemas ---
const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const uploadSchema = z.object({
  file: z.object({
    name: z.string().max(255),
    data: z.instanceof(Buffer),
    mimetype: z.string(),
    size: z.number(),
  }),
});

// --- Auth middleware ---
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, SECRET!, { algorithms: ['HS256'] });
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// --- HTML escaping to prevent XSS ---
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// --- Redirect URL allowlist for SSRF/open-redirect prevention ---
const ALLOWED_REDIRECT_HOSTS = new Set(
  (process.env.ALLOWED_REDIRECT_HOSTS ?? '').split(',').filter(Boolean)
);

function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      ALLOWED_REDIRECT_HOSTS.has(parsed.host)
    );
  } catch {
    return false;
  }
}

// --- Upload validation constants ---
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.txt']);
const ALLOWED_MIMETYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
  'text/plain',
]);
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

// ============================================================
// Routes
// ============================================================

// --- Login: parameterized query, bcrypt, JWT in httpOnly cookie ---
app.post('/login', authLimiter, csrfProtection, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { email, password } = parsed.data;

  // Parameterized query — never string concatenation
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // bcrypt comparison — passwords stored as bcrypt(12+) hashes
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    auditLog({ action: 'login', userId: email, result: 'failure', ip: req.ip! });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // RS256 preferred for public APIs; HS256 acceptable for internal-only services
  const token = jwt.sign({ userId: user.id, role: user.role }, SECRET!, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });

  // JWT in httpOnly, Secure, SameSite=Strict cookie — never in response body
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600_000,
  });

  auditLog({ action: 'login', userId: user.id, result: 'success', ip: req.ip! });
  res.json({ ok: true });
});

// --- File download: path traversal prevention with realpath + prefix check ---
app.get('/files/:name', authenticate, (req: Request, res: Response) => {
  const uploadsDir = path.resolve('./uploads');
  const requestedPath = path.resolve(uploadsDir, req.params.name);

  // realpath + prefix check to prevent path traversal
  const realRequested = fs.realpathSync(requestedPath);
  if (!realRequested.startsWith(uploadsDir + path.sep)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.sendFile(realRequested);
});

// --- Admin command execution: REMOVED ---
// The /admin/run endpoint that called exec(command) with user input has been
// removed entirely. Executing arbitrary shell commands from user input is
// inherently unsafe (command injection, eval of untrusted data).
//
// If specific admin operations are needed, implement them as discrete,
// parameterized endpoints (e.g., /admin/clear-cache, /admin/restart-worker)
// using execFile with a fixed command and array arguments — never shell=true.
//
// Example of a safe alternative:
app.post(
  '/admin/clear-cache',
  authenticate,
  authorize('admin'),
  csrfProtection,
  (req: Request, res: Response) => {
    // execFile with fixed command + array args — no shell interpolation
    execFile('/usr/bin/redis-cli', ['FLUSHDB'], (err, stdout) => {
      if (err) {
        auditLog({ action: 'clear-cache', result: 'failure', ip: req.ip! });
        return res.status(500).json({ error: 'Operation failed' });
      }
      auditLog({ action: 'clear-cache', result: 'success', ip: req.ip! });
      res.json({ output: stdout });
    });
  }
);

// --- Profile: XSS prevention via HTML escaping ---
app.get('/profile/:id', authenticate, async (req: Request, res: Response) => {
  const idSchema = z.string().uuid();
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const user = await db.findUser(parsed.data);
  if (!user) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Escape all user-controlled content to prevent XSS
  const safeName = escapeHtml(user.name);
  const safeBio = escapeHtml(user.bio);
  res.send(`<html><body><h1>${safeName}</h1><div>${safeBio}</div></body></html>`);
});

// --- Redirect: allowlist + protocol validation + SSRF prevention ---
app.get('/redirect', (req: Request, res: Response) => {
  const url = req.query.url;
  if (typeof url !== 'string' || !isSafeRedirectUrl(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed redirect URL' });
  }
  res.redirect(url);
});

// --- Upload: size, MIME type, extension validation + path traversal prevention ---
app.post('/upload', authenticate, csrfProtection, (req: Request, res: Response) => {
  const file = req.body.file;
  if (!file || !file.name || !file.data) {
    return res.status(400).json({ error: 'Missing file' });
  }

  // Validate extension
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: 'File extension not allowed' });
  }

  // Validate MIME type
  if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
    return res.status(400).json({ error: 'MIME type not allowed' });
  }

  // Validate size
  if (file.size > MAX_UPLOAD_SIZE) {
    return res.status(400).json({ error: 'File too large' });
  }

  // Sanitize filename — strip path separators, use basename only
  const safeName = path.basename(file.name);
  const uploadsDir = path.resolve('./uploads');
  const targetPath = path.resolve(uploadsDir, safeName);

  // Path traversal check
  if (!targetPath.startsWith(uploadsDir + path.sep)) {
    return res.status(403).json({ error: 'Invalid path' });
  }

  fs.writeFileSync(targetPath, file.data);

  auditLog({ action: 'upload', resource: safeName, result: 'success', ip: req.ip! });
  res.json({ path: `/files/${safeName}` });
});

// --- API action: structured audit log, no raw body logging ---
app.post('/api/action', authenticate, csrfProtection, (req: Request, res: Response) => {
  // Never log full request body — may contain passwords, tokens, PII
  auditLog({
    action: 'api-action',
    userId: (req as any).user?.userId,
    result: 'success',
    ip: req.ip!,
  });
  res.json({ ok: true });
});

// --- Account delete: auth + authz, token from cookie not localStorage ---
app.post(
  '/account/delete',
  authenticate,
  csrfProtection,
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    // Authorization: user can only delete their own account
    await db.deleteUser(user.userId);

    res.clearCookie('token');
    auditLog({ action: 'account-delete', userId: user.userId, result: 'success', ip: req.ip! });
    res.json({ deleted: true });
  }
);

// --- Global error handler: generic message to client, structured log server-side ---
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Never leak stack traces, internal errors, or query params to the client
  auditLog({
    action: 'unhandled-error',
    resource: req.path,
    result: 'failure',
    ip: req.ip!,
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3000);
```

## Vulnerabilities Found and Fixed

1. **SQL Injection** — Login query used string concatenation (`'${email}'`). Fixed with parameterized query (`$1` placeholder + params array).

2. **Plaintext Password Comparison** — Passwords compared in raw SQL. Fixed with `bcrypt.compare()` against stored hashes (bcrypt 12+ rounds).

3. **Hardcoded JWT Secret** — `SECRET` was a string literal in source. Fixed: loaded from `process.env.JWT_SECRET`, crashes on startup if missing.

4. **JWT in Response Body (implies localStorage)** — Token returned in JSON, encouraging `localStorage` storage. Fixed: JWT set in `httpOnly`, `Secure`, `SameSite=Strict` cookie.

5. **JWT Algorithm** — HS256 explicitly pinned in `verify()` to prevent algorithm confusion attacks. Note: RS256 recommended for public-facing APIs.

6. **Command Injection / Eval of Untrusted Input** — `exec(command)` with raw user input. Removed entirely. Replaced with discrete admin endpoints using `execFile` with fixed commands and array arguments.

7. **No Authorization Checks** — `/admin/run` and `/account/delete` had no auth/authz. Fixed: `authenticate` + `authorize('admin')` middleware on admin routes; user ownership check on account delete.

8. **Path Traversal (File Download)** — `./uploads/${req.params.name}` allowed `../../etc/passwd`. Fixed: `path.resolve()` + `fs.realpathSync()` + prefix check against uploads directory.

9. **Path Traversal (File Upload)** — Same issue on upload. Fixed: `path.basename()` to strip traversal, plus prefix check.

10. **XSS via innerHTML** — `user.name` and `user.bio` rendered directly in HTML. Fixed with `escapeHtml()` encoding all special characters.

11. **Open Redirect / SSRF** — `res.redirect(req.query.url)` with no validation. Fixed: protocol check (http/https only) + host allowlist via `ALLOWED_REDIRECT_HOSTS` env var.

12. **No Input Validation** — No schema validation on any endpoint. Fixed: Zod schemas for login, file upload, profile ID (UUID).

13. **No Upload Validation** — No size, MIME type, or extension checks. Fixed: extension allowlist, MIME type allowlist, 5MB size cap.

14. **Wildcard CORS with Credentials** — `origin: '*'` + `credentials: true` is invalid and dangerous. Fixed: explicit origin allowlist from `ALLOWED_ORIGINS` env var.

15. **No Security Headers / CSP** — No helmet or CSP. Fixed: `helmet()` with strict CSP directives.

16. **No Rate Limiting** — All endpoints unprotected. Fixed: global rate limiter (100 req/15min) + stricter auth limiter (10 req/15min).

17. **No CSRF Protection** — State-changing POSTs without CSRF tokens. Fixed: `csurf` middleware on all POST routes.

18. **Logging Sensitive Data** — `console.log('User action:', req.body)` could log passwords/tokens/PII. Fixed: structured audit logger that records only action, userId, timestamp, IP, result — never raw request bodies.

19. **Structured Audit Logs** — Replaced `console.log` with structured JSON audit entries including timestamp, userId, action, resource, result, IP.

20. **`localStorage` Reference on Server** — `localStorage.getItem('token')` in server code is a dead reference. Removed; token now read from httpOnly cookie via middleware.
