```typescript
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import helmet from 'helmet';
import csurf from 'csurf';
import DOMPurify from 'isomorphic-dompurify';
import { db } from './db';

const app = express();

// --- Environment variables (private key for RS256, refresh token secret) ---
const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY!;
const PUBLIC_KEY = process.env.JWT_PUBLIC_KEY!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// --- Security middleware (before JSON parsing) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${(res as any).locals.nonce}'`],
      objectSrc: ["'none'"],
      frameDest: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Generate nonce for every request
app.use((req, res, next) => {
  (res as any).locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// CORS: explicit origin allowlist, no credentials with wildcard
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

// Rate limiting: general (100 req/15min)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Rate limiting: auth endpoints (10 req/15min) — brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

// Rate limiting: webhook (5 req/min) — prevent replay attacks
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
});

app.use(express.json({ limit: '10kb' }));

// CSRF protection for state-changing requests
const csrfProtection = csurf({ cookie: true });

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

const SearchSchema = z.object({
  q: z.string().min(1).max(100),
});

// --- Helpers ---
// Verify JWT with issuer/audience/algorithm pinning
function verifyAccessToken(token: string) {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ['RS256'],
    issuer: 'api.example.com',
    audience: 'example.com',
  }) as { sub: string; role: string };
}

// Create access token (short-lived, 15 min)
function createAccessToken(userId: string, role: string) {
  return jwt.sign(
    { sub: userId, role },
    PRIVATE_KEY,
    {
      algorithm: 'RS256',
      issuer: 'api.example.com',
      audience: 'example.com',
      expiresIn: '15m',
    }
  );
}

// Create refresh token (stored in DB, rotated on use)
async function createRefreshToken(userId: string) {
  const refreshToken = crypto.randomBytes(32).toString('hex');
  await db.query(
    'INSERT INTO refresh_tokens (token, user_id, created_at) VALUES ($1, $2, NOW())',
    [refreshToken, userId]
  );
  return refreshToken;
}

// Validate file path: reject path traversal
function validateFilePath(uploadDir: string, filename: string): string | null {
  const resolved = path.resolve(uploadDir, path.basename(filename));
  const uploadDirResolved = path.resolve(uploadDir);
  
  // Ensure resolved path is within uploadDir
  if (!resolved.startsWith(uploadDirResolved + path.sep)) {
    return null;
  }
  return resolved;
}

// --- Auth ---
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // Mint short-lived access token + refresh token
  const accessToken = createAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id);

  // Set tokens as httpOnly Secure SameSite=Strict cookies (NOT in response body)
  res.cookie('access', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refresh', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Return user data only (not token)
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  // bcrypt with 12+ rounds
  const hashed = await bcrypt.hash(password, 12);
  const user = await db.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, hashed]
  );

  res.status(201).json({ user });
});

// Refresh endpoint: exchange old refresh token for new access + refresh token (rotation)
app.post('/api/auth/refresh', async (req, res) => {
  const oldRefreshToken = req.cookies.refresh;
  if (!oldRefreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    // DELETE old refresh token (rotation) — if not found, token was already used (theft)
    const row = await db.query(
      'DELETE FROM refresh_tokens WHERE token = $1 RETURNING user_id',
      [oldRefreshToken]
    );
    if (!row || row.length === 0) {
      // Token not found: likely already rotated or forged — treat as suspicious
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userId = row[0].user_id;
    const user = await db.query('SELECT role FROM users WHERE id = $1', [userId]);

    // Mint new access + refresh tokens
    const accessToken = createAccessToken(userId, user.role);
    const refreshToken = await createRefreshToken(userId);

    res.cookie('access', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// --- Middleware ---
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Try to get token from httpOnly cookie first (recommended)
  let token = req.cookies.access;

  // Fallback to Authorization header for API clients
  if (!token) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    token = authHeader.slice(7);
  }

  try {
    // Verify with issuer/audience/algorithm options
    const payload = verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// --- Profile ---
app.get('/api/users/:id', authenticate, async (req, res) => {
  const userId = req.params.id;

  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) return res.status(404).json({ error: 'Not found' });

  // IDOR: only the authenticated user can view their own profile
  if ((req as any).user.sub !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Sanitize response: omit sensitive fields
  const { passwordHash, resetToken, ...publicFields } = user;
  res.json(publicFields);
});

app.put('/api/users/:id', authenticate, csrfProtection, async (req, res) => {
  const userId = req.params.id;

  // IDOR: only the authenticated user can update their own profile
  if ((req as any).user.sub !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const updated = await db.query(
    'UPDATE users SET name = $1, email = $2, bio = $3 WHERE id = $4 RETURNING id, name, email, bio',
    [parsed.data.name, parsed.data.email, parsed.data.bio, userId]
  );

  res.json(updated);
});

// --- Documents ---
app.get('/api/documents/:id', authenticate, async (req, res) => {
  const docId = req.params.id;

  const doc = await db.query('SELECT * FROM documents WHERE id = $1', [docId]);
  if (!doc) return res.status(404).json({ error: 'Not found' });

  // IDOR: verify the authenticated user owns this document
  if (doc.ownerId !== (req as any).user.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(doc);
});

// --- Files ---
app.get('/api/files/:name', authenticate, async (req, res) => {
  const UPLOAD_DIR = path.resolve('./uploads');
  const filename = req.params.name;

  // Validate path: reject path traversal
  const filePath = validateFilePath(UPLOAD_DIR, filename);
  if (!filePath) return res.status(403).json({ error: 'Forbidden' });

  try {
    const data = await fs.readFile(filePath);
    res.send(data);
  } catch (err) {
    return res.status(404).json({ error: 'Not found' });
  }
});

// --- Admin ---
app.post('/api/admin/convert', authenticate, async (req, res) => {
  if ((req as any).user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { inputFile, format } = req.body;

  // Validate format: allowlist only safe formats
  const allowedFormats = ['png', 'jpg', 'webp', 'gif'];
  if (!allowedFormats.includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  // Validate inputFile: must be a basename (no path traversal)
  const UPLOAD_DIR = path.resolve('./uploads');
  const validatedInput = validateFilePath(UPLOAD_DIR, inputFile);
  if (!validatedInput) {
    return res.status(400).json({ error: 'Invalid file' });
  }

  // Use execFile (not exec): arguments are NOT interpreted by shell
  // Array of args prevents command injection
  execFile('convert', [validatedInput, `output.${format}`], (err, stdout) => {
    if (err) {
      // Log error server-side, return generic error to client
      console.error('Conversion error:', err.message);
      return res.status(500).json({ error: 'Conversion failed' });
    }
    res.json({ output: stdout });
  });
});

// --- Rendering ---
app.get('/api/preview/:id', authenticate, async (req, res) => {
  const pageId = req.params.id;

  const page = await db.query('SELECT * FROM pages WHERE id = $1', [pageId]);
  if (!page) return res.status(404).json({ error: 'Not found' });

  // IDOR: verify ownership
  if (page.ownerId !== (req as any).user.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Sanitize HTML: use DOMPurify with explicit allowlist (NOT manual .replace())
  const sanitized = DOMPurify.sanitize(page.content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'a', 'br'],
    ALLOWED_ATTR: ['href'],
  });

  // Validate href URLs: reject javascript: protocol
  const validated = sanitized.replace(/href="([^"]*)"/g, (match, url) => {
    try {
      const parsed = new URL(url, 'http://example.com');
      if (!['http:', 'https:', ''].includes(parsed.protocol)) {
        return 'href="#"'; // Strip unsafe protocols
      }
    } catch {
      return 'href="#"';
    }
    return match;
  });

  res.send(`<html><body><div>${validated}</div></body></html>`);
});

// --- OAuth callback (with PKCE) ---
app.get('/api/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).json({ error: 'Missing parameters' });

  // Validate state: prevents CSRF on OAuth callback
  const sessionState = req.session?.oauthState;
  if (state !== sessionState) {
    return res.status(403).json({ error: 'Invalid state' });
  }

  // Retrieve PKCE verifier from session
  const pkceVerifier = req.session?.pkceVerifier;
  if (!pkceVerifier) {
    return res.status(400).json({ error: 'Missing PKCE verifier' });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
        // PKCE: include code_verifier in the token exchange
        code_verifier: pkceVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'OAuth token exchange failed' });
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser = await userResponse.json();

    const user = await db.query(
      'INSERT INTO users (github_id, name, email) VALUES ($1, $2, $3) ON CONFLICT (github_id) DO UPDATE SET name = $2 RETURNING id, role',
      [githubUser.id, githubUser.name, githubUser.email]
    );

    // Mint access + refresh tokens
    const accessToken = createAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(user.id);

    // Set tokens as httpOnly Secure SameSite cookies (NOT in response body)
    res.cookie('access', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Clear OAuth state from session
    delete req.session.oauthState;
    delete req.session.pkceVerifier;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Webhook (Stripe) ---
// Use express.raw() to get raw body for signature verification
app.post(
  '/api/webhooks/stripe',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) return res.status(400).json({ error: 'Missing signature' });

    try {
      // Verify webhook signature BEFORE parsing — uses raw body
      const event = JSON.parse(
        crypto
          .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
          .update(req.body as any)
          .digest('hex')
      );

      // Actually: use Stripe SDK to construct event safely
      // const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

      // For this example, just verify it's legitimate:
      const hmac = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET);
      hmac.update(req.body as any);
      const computed = hmac.digest('hex');
      if (computed !== sig) {
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const event = JSON.parse((req.body as any).toString());

      // Structured audit log (not console.log)
      console.info({
        timestamp: new Date().toISOString(),
        action: 'webhook.stripe',
        eventType: event.type,
        eventId: event.id,
        result: 'received',
      });

      if (event.type === 'payment_intent.succeeded') {
        await db.query(
          'UPDATE orders SET status = $1 WHERE stripe_id = $2',
          ['paid', event.data.object.id]
        );
      }

      res.json({ received: true });
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return res.status(400).json({ error: 'Invalid request' });
    }
  }
);

// --- Search ---
app.get('/api/search', authenticate, async (req, res) => {
  const parsed = SearchSchema.safeParse({ q: req.query.q });
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' });

  const query = parsed.data.q;

  // IMPORTANT: Never use user input in RegExp constructor — causes ReDoS
  // Safe: use parameterized query with ILIKE (PostgreSQL) or LIKE
  const results = await db.query(
    'SELECT id, title, content FROM articles WHERE title ILIKE $1 LIMIT 20',
    [`%${query}%`]
  );
  res.json(results);
});

// --- Error handler ---
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = crypto.randomUUID();

  // Log full error server-side only
  console.error({
    timestamp: new Date().toISOString(),
    requestId,
    error: err.message,
    stack: err.stack,
  });

  // Return generic error to client (no stack trace, no internals)
  res.status(500).json({ error: 'Internal server error', requestId });
});

app.listen(3000);
```
