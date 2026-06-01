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
import { db } from './db';
import helmet from 'helmet';
import DOMPurify from 'isomorphic-dompurify';

const app = express();

// --- Security middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

app.use(express.json({ limit: '10kb' }));

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

// --- Auth ---
const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY!;
const PUBLIC_KEY = process.env.JWT_PUBLIC_KEY!;

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '15m', issuer: 'api.example.com', audience: 'example.com' }
  );
  const refreshToken = crypto.randomUUID();
  await db.query('INSERT INTO refresh_tokens (token, user_id) VALUES ($1, $2)', [refreshToken, user.id]);

  res.cookie('access', accessToken, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.cookie('refresh', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const hashed = await bcrypt.hash(password, 12);
  const user = await db.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, hashed]
  );

  res.status(201).json({ user });
});

app.post('/api/auth/refresh', async (req, res) => {
  const oldRefresh = req.cookies.refresh;
  if (!oldRefresh) return res.status(401).json({ error: 'No refresh token' });

  const row = await db.query('DELETE FROM refresh_tokens WHERE token = $1 RETURNING user_id', [oldRefresh]);
  if (!row) return res.status(401).json({ error: 'Invalid refresh token' });

  const user = await db.query('SELECT * FROM users WHERE id = $1', [row.user_id]);
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '15m', issuer: 'api.example.com', audience: 'example.com' }
  );
  const newRefresh = crypto.randomUUID();
  await db.query('INSERT INTO refresh_tokens (token, user_id) VALUES ($1, $2)', [newRefresh, user.id]);

  res.cookie('access', accessToken, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.cookie('refresh', newRefresh, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

// --- Middleware ---
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.cookies.access;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, PUBLIC_KEY, {
      algorithms: ['RS256'],
      issuer: 'api.example.com',
      audience: 'example.com',
    });
    req.user = payload as { sub: string; role: string };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Profile ---
app.get('/api/users/:id', authenticate, async (req, res) => {
  // IDOR check: user can only view their own profile
  if (req.user.sub !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const { passwordHash, resetToken, ...publicFields } = user;
  res.json(publicFields);
});

app.put('/api/users/:id', authenticate, async (req, res) => {
  // IDOR check: user can only update their own profile
  if (req.user.sub !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const updated = await db.query(
    'UPDATE users SET name = $1, email = $2, bio = $3 WHERE id = $4 RETURNING id, name, email, bio',
    [parsed.data.name, parsed.data.email, parsed.data.bio, req.params.id]
  );

  res.json(updated);
});

// --- Documents ---
app.get('/api/documents/:id', authenticate, async (req, res) => {
  const doc = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

app.get('/api/files/:name', authenticate, async (req, res) => {
  const UPLOAD_DIR = path.resolve('./uploads');
  const safePath = path.join(UPLOAD_DIR, path.basename(req.params.name));
  // Path traversal defense: verify resolved path is within UPLOAD_DIR
  if (!path.resolve(safePath).startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const data = await fs.readFile(safePath);
  res.send(data);
});

// --- Admin ---
app.post('/api/admin/convert', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { inputFile, format } = req.body;
  
  // Validate format allowlist
  if (!['png', 'jpg', 'webp'].includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  execFile('convert', [inputFile, `output.${format}`], (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Conversion failed' });
    res.json({ output: stdout });
  });
});

// --- Rendering ---
app.get('/api/preview/:id', authenticate, async (req, res) => {
  const page = await db.query('SELECT * FROM pages WHERE id = $1', [req.params.id]);
  if (!page) return res.status(404).json({ error: 'Not found' });

  const sanitizedContent = DOMPurify.sanitize(page.content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'a'],
    ALLOWED_ATTR: ['href'],
  });

  res.send(`<html><body><div>${sanitizedContent}</div></body></html>`);
});

// --- OAuth callback ---
app.get('/api/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

  // Validate state CSRF token
  if (state !== req.session?.oauthState) {
    return res.status(403).json({ error: 'Invalid state' });
  }

  const verifier = req.session?.pkceVerifier;
  if (!verifier) return res.status(400).json({ error: 'Missing PKCE verifier' });

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: verifier,
    }),
  });

  const { access_token } = await tokenResponse.json();
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const githubUser = await userResponse.json();

  const user = await db.query(
    'INSERT INTO users (github_id, name, email) VALUES ($1, $2, $3) ON CONFLICT (github_id) DO UPDATE SET name = $2 RETURNING *',
    [githubUser.id, githubUser.name, githubUser.email]
  );

  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '15m', issuer: 'api.example.com', audience: 'example.com' }
  );
  const refreshToken = crypto.randomUUID();
  await db.query('INSERT INTO refresh_tokens (token, user_id) VALUES ($1, $2)', [refreshToken, user.id]);

  res.cookie('access', accessToken, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.cookie('refresh', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.redirect('/dashboard');
});

// --- Webhook ---
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) return res.status(400).json({ error: 'Missing signature' });

  let event;
  try {
    // Verify webhook signature against raw body
    event = require('stripe').webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'payment_intent.succeeded') {
    await db.query('UPDATE orders SET status = $1 WHERE stripe_id = $2', ['paid', event.data.object.id]);
  }

  res.json({ received: true });
});

// --- Search ---
app.get('/api/search', authenticate, async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.length > 100) return res.status(400).json({ error: 'Invalid query' });

  // Use parameterized query instead of regex to avoid ReDoS
  const results = await db.query('SELECT * FROM articles WHERE title ILIKE $1', [`%${query}%`]);
  res.json(results);
});

// --- Error handler ---
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = crypto.randomUUID();
  console.error(`[${requestId}] Error:`, err.message, err.stack);
  // Never return stack trace or error details to client
  res.status(500).json({ error: 'Internal server error', requestId });
});

app.listen(3000);
```
