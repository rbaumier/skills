# Run 1 — Without Skill (v2 eval)

```typescript
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import csrf from 'csurf';
import { z } from 'zod';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { db } from './db';
import { auditLog } from './audit'; // structured audit logger

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const app = express();

// --- Structured audit logger (timestamp, user_id, action, resource, result, IP) ---
// Assumed: auditLog(entry: { timestamp, userId, action, resource, result, ip }) => void

// --- Security headers via helmet (CSP, HSTS, X-Frame-Options, nosniff) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'"],  // nonce-based: see per-response nonce below
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// --- CORS ---
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// --- Rate limiting: general ---
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// --- Stricter rate limit for auth endpoints ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10kb' }));

// --- CSRF protection for state-changing routes ---
const csrfProtection = csrf({ cookie: { httpOnly: true, secure: true, sameSite: 'strict' } });

// --- Schemas ---
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const UpdateProfileSchema = z.object({
  name: z.string().max(100),
  email: z.string().email(),
  bio: z.string().max(500),
});

const ConvertSchema = z.object({
  inputFile: z.string().regex(/^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+$/), // basename only, no paths
  format: z.enum(['png', 'jpg', 'gif', 'webp', 'pdf']),
});

// --- Auth keys (RS256 for public API) ---
const JWT_PRIVATE_KEY = fs.readFile(process.env.JWT_PRIVATE_KEY_PATH!).then(b => b.toString());
const JWT_PUBLIC_KEY = fs.readFile(process.env.JWT_PUBLIC_KEY_PATH!).then(b => b.toString());
const JWT_ISSUER = process.env.JWT_ISSUER || 'myapp';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'myapp-api';
const REFRESH_SECRET = process.env.REFRESH_SECRET!;

// --- Token helpers ---
async function signAccessToken(payload: { sub: string; role: string }): Promise<string> {
  const privateKey = await JWT_PRIVATE_KEY;
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
}

async function verifyAccessToken(token: string) {
  const publicKey = await JWT_PUBLIC_KEY;
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as { sub: string; role: string };
}

// --- Auth: Login ---
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken(user.id);

  // Store refresh token hash for rotation
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await db.query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [refreshHash, user.id]);

  // JWT in httpOnly Secure SameSite=Strict cookie — never in response body
  res.cookie('access_token', accessToken, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 });

  auditLog({ timestamp: new Date().toISOString(), userId: user.id, action: 'login', resource: 'auth', result: 'success', ip: req.ip });

  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

// --- Auth: Refresh token rotation ---
app.post('/api/auth/refresh', authLimiter, async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  try {
    const payload = jwt.verify(token, REFRESH_SECRET, { algorithms: ['HS256'] }) as { sub: string; type: string };
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });

    // Validate against stored hash (rotation check)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await db.query('SELECT * FROM users WHERE id = $1 AND refresh_token_hash = $2', [payload.sub, tokenHash]);
    if (!user) return res.status(401).json({ error: 'Token revoked' });

    // Rotate: issue new pair
    const newAccess = await signAccessToken({ sub: user.id, role: user.role });
    const newRefresh = signRefreshToken(user.id);
    const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    await db.query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [newHash, user.id]);

    res.cookie('access_token', newAccess, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', newRefresh, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// --- Auth: Register ---
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const hashed = await bcrypt.hash(password, 12); // 12+ rounds
  const user = await db.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, hashed]
  );

  auditLog({ timestamp: new Date().toISOString(), userId: user.id, action: 'register', resource: 'auth', result: 'success', ip: req.ip });

  res.status(201).json({ user });
});

// --- Middleware: authenticate from cookie ---
async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = await verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Profile: IDOR-protected ---
app.get('/api/users/:id', authenticate, async (req, res) => {
  // Ownership check: users can only view their own profile (admins exempt)
  if (req.user.sub !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const { passwordHash, resetToken, refresh_token_hash, ...publicFields } = user;
  res.json(publicFields);
});

app.put('/api/users/:id', authenticate, csrfProtection, async (req, res) => {
  // Ownership check: users can only update their own profile
  if (req.user.sub !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const updated = await db.query(
    'UPDATE users SET name = $1, email = $2, bio = $3 WHERE id = $4 RETURNING id, name, email, bio',
    [parsed.data.name, parsed.data.email, parsed.data.bio, req.params.id]
  );

  auditLog({ timestamp: new Date().toISOString(), userId: req.user.sub, action: 'update_profile', resource: `user:${req.params.id}`, result: 'success', ip: req.ip });

  res.json(updated);
});

// --- Documents: IDOR-protected with ownership filter ---
app.get('/api/documents/:id', authenticate, async (req, res) => {
  const doc = await db.query('SELECT * FROM documents WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.sub]);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

// --- File serving: path traversal protection ---
app.get('/api/files/:name', authenticate, async (req, res) => {
  const UPLOAD_DIR = path.resolve('./uploads');
  const safeName = path.basename(req.params.name); // strip directory components
  const filePath = path.resolve(UPLOAD_DIR, safeName);

  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const data = await fs.readFile(filePath);
  res.send(data);
});

// --- Admin: input-validated convert ---
app.post('/api/admin/convert', authenticate, csrfProtection, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const parsed = ConvertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { inputFile, format } = parsed.data;
  const CONVERT_DIR = path.resolve('./convert-input');
  const safeInput = path.resolve(CONVERT_DIR, path.basename(inputFile));

  if (!safeInput.startsWith(CONVERT_DIR + path.sep)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  execFile('convert', [safeInput, path.join(CONVERT_DIR, `output.${format}`)], (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Conversion failed' });
    auditLog({ timestamp: new Date().toISOString(), userId: req.user.sub, action: 'convert', resource: `file:${inputFile}`, result: 'success', ip: req.ip });
    res.json({ output: stdout });
  });
});

// --- Rendering: DOMPurify instead of manual regex ---
app.get('/api/preview/:id', authenticate, async (req, res) => {
  const page = await db.query('SELECT * FROM pages WHERE id = $1', [req.params.id]);
  if (!page) return res.status(404).json({ error: 'Not found' });

  const nonce = crypto.randomBytes(16).toString('base64');
  const sanitizedContent = DOMPurify.sanitize(page.content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href'],
  });

  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self'`);
  res.send(`<html><body><div>${sanitizedContent}</div></body></html>`);
});

// --- OAuth callback: state parameter + PKCE ---
app.get('/api/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  // Validate state parameter to prevent CSRF
  if (!state || state !== req.cookies?.oauth_state) {
    return res.status(403).json({ error: 'Invalid state parameter' });
  }
  // Clear one-time state cookie
  res.clearCookie('oauth_state');

  // Retrieve PKCE code_verifier from session/cookie
  const codeVerifier = req.cookies?.pkce_code_verifier;
  if (!codeVerifier) {
    return res.status(403).json({ error: 'Missing PKCE verifier' });
  }
  res.clearCookie('pkce_code_verifier');

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return res.status(401).json({ error: 'OAuth token exchange failed' });

  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const githubUser = await userResponse.json();

  const user = await db.query(
    'INSERT INTO users (github_id, name, email) VALUES ($1, $2, $3) ON CONFLICT (github_id) DO UPDATE SET name = $2 RETURNING *',
    [githubUser.id, githubUser.name, githubUser.email]
  );

  const accessToken = await signAccessToken({ sub: user.id, role: user.role || 'user' });
  const refreshToken = signRefreshToken(user.id);
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await db.query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [refreshHash, user.id]);

  // SameSite=Strict, httpOnly, Secure
  res.cookie('access_token', accessToken, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 });

  auditLog({ timestamp: new Date().toISOString(), userId: user.id, action: 'oauth_login', resource: 'github', result: 'success', ip: req.ip });

  res.redirect('/dashboard');
});

// --- Webhook: signature verification, no sensitive logging ---
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) return res.status(400).json({ error: 'Missing signature' });

  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
  let event: any;
  try {
    // Verify webhook signature using Stripe's method
    const payload = req.body.toString();
    const elements = signature.split(',');
    const timestampStr = elements.find(e => e.startsWith('t='))?.slice(2);
    const sig = elements.find(e => e.startsWith('v1='))?.slice(3);
    if (!timestampStr || !sig) return res.status(400).json({ error: 'Invalid signature format' });

    const signedPayload = `${timestampStr}.${payload}`;
    const expectedSig = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(signedPayload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Reject stale timestamps (5 minute tolerance)
    const timestamp = parseInt(timestampStr, 10);
    if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
      return res.status(400).json({ error: 'Stale webhook' });
    }

    event = JSON.parse(payload);
  } catch {
    return res.status(400).json({ error: 'Webhook verification failed' });
  }

  // Structured audit log — NO sensitive payment data
  auditLog({ timestamp: new Date().toISOString(), userId: 'system', action: 'webhook_received', resource: `stripe:${event.type}`, result: 'success', ip: req.ip });

  if (event.type === 'payment_intent.succeeded') {
    await db.query('UPDATE orders SET status = $1 WHERE stripe_id = $2', ['paid', event.data.object.id]);
  }

  res.json({ received: true });
});

// --- Search: no user input in regex ---
app.get('/api/search', authenticate, async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.length > 100) return res.status(400).json({ error: 'Invalid query' });

  // Use parameterized ILIKE only — no RegExp with user input (ReDoS risk)
  const results = await db.query('SELECT id, title, excerpt FROM articles WHERE title ILIKE $1', [`%${query}%`]);
  res.json(results);
});

// --- Error handler: no stack leak, structured log ---
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = crypto.randomUUID();
  auditLog({
    timestamp: new Date().toISOString(),
    userId: (req as any).user?.sub || 'anonymous',
    action: 'error',
    resource: req.originalUrl,
    result: 'failure',
    ip: req.ip,
    metadata: { requestId, error: err.message, stack: err.stack },
  });
  res.status(500).json({ error: 'Internal server error', requestId });
});

app.listen(3000);
```
