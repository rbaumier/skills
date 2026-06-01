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
import { db } from './db';

const app = express();

// --- Security middleware ---
app.use(helmet());

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// General API rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Stricter rate limiting for auth endpoints
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
}));

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
}).strict(); // Prevent mass assignment

// --- Auth ---
const JWT_SECRET = process.env.JWT_SECRET!;

app.post('/api/auth/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' } // Short-lived access token
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/register', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  // bcrypt with salt rounds >= 12 for proper security
  const hashed = await bcrypt.hash(password, 12);
  const user = await db.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, hashed]
  );

  res.status(201).json({ user });
});

// --- Middleware ---
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: string; role: string };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Profile ---
app.get('/api/users/:id', authenticate, async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Not found' });

  // IDOR prevention: only allow users to view their own profile, or admins to view any
  if (req.user.sub !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { passwordHash, resetToken, ...publicFields } = user;
  res.json(publicFields);
});

app.put('/api/users/:id', authenticate, async (req, res) => {
  // IDOR prevention: only allow users to update their own profile
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
  const doc = await db.query(
    'SELECT * FROM documents WHERE id = $1 AND owner_id = $2',
    [req.params.id, req.user.sub]
  );
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

app.get('/api/files/:name', authenticate, async (req, res) => {
  const UPLOAD_DIR = path.resolve('./uploads');
  const fileName = path.basename(req.params.name); // Prevent path traversal
  const filePath = path.resolve(path.join(UPLOAD_DIR, fileName));

  // Verify the resolved path is within the allowed directory
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const data = await fs.readFile(filePath);
    res.send(data);
  } catch (err) {
    return res.status(404).json({ error: 'Not found' });
  }
});

// --- Admin ---
app.post('/api/admin/convert', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { inputFile, format } = req.body;

  // Validate format to prevent injection
  const allowedFormats = ['png', 'jpg', 'gif', 'webp'];
  if (!allowedFormats.includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  // Validate and sanitize inputFile path
  const UPLOAD_DIR = path.resolve('./uploads');
  const fileName = path.basename(inputFile);
  const safePath = path.resolve(path.join(UPLOAD_DIR, fileName));

  if (!safePath.startsWith(UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Use execFile with array arguments (never shell=true, never string template)
  execFile('convert', [safePath, `output.${format}`], (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Conversion failed' });
    res.json({ output: stdout });
  });
});

// --- Rendering ---
app.get('/api/preview/:id', authenticate, async (req, res) => {
  const page = await db.query('SELECT * FROM pages WHERE id = $1', [req.params.id]);
  if (!page) return res.status(404).json({ error: 'Not found' });

  // HTML escape all dynamic content to prevent XSS
  const sanitizedContent = page.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  res.send(`<html><body><div>${sanitizedContent}</div></body></html>`);
});

// --- OAuth callback ---
app.get('/api/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;

  // Validate code and state parameters
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

  // Verify CSRF state parameter (should be validated against session storage)
  const sessionState = req.session?.oauthState;
  if (state !== sessionState) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    return res.status(401).json({ error: 'OAuth exchange failed' });
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const githubUser = await userResponse.json();

  const user = await db.query(
    'INSERT INTO users (github_id, name, email) VALUES ($1, $2, $3) ON CONFLICT (github_id) DO UPDATE SET name = $2 RETURNING id',
    [githubUser.id, githubUser.name, githubUser.email]
  );

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.cookie('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Only redirect to internal paths to prevent open redirect
  res.redirect('/dashboard');
});

// --- Webhook ---
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = JSON.parse(req.body.toString());

  // Never log sensitive webhook data
  console.log('Stripe webhook event type received:', event.type);

  if (event.type === 'payment_intent.succeeded') {
    await db.query('UPDATE orders SET status = $1 WHERE stripe_id = $2', ['paid', event.data.object.id]);
  }

  res.json({ received: true });
});

// --- Search ---
app.get('/api/search', authenticate, async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.length > 100) return res.status(400).json({ error: 'Invalid query' });

  // Never use user input in RegExp constructor - use ILIKE instead for safe pattern matching
  const results = await db.query('SELECT * FROM articles WHERE title ILIKE $1', [`%${query}%`]);
  res.json(results);
});

// --- Error handler ---
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = crypto.randomUUID();
  // Log full error server-side with requestId, but return generic message to client
  console.error(`[${requestId}] Error:`, err.message, err.stack);
  res.status(500).json({ error: 'Internal server error', requestId });
});

app.listen(3000);
```
