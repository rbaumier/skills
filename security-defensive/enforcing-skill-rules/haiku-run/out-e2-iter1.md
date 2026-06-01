```typescript
// 1. Prototype pollution — strip dangerous keys before merge
function merge(target: any, source: any) {
  // Delete prototype pollution keys from source before merging
  delete source.__proto__;
  delete source.constructor;
  delete source.prototype;
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    }
  }
  return target;
}
const config = merge({}, JSON.parse(userInput));

// 2. Mass assignment — explicit field picking with Zod
import { z } from 'zod';
const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  // Note: role, permissions NOT included — prevents privilege escalation
});

app.put("/users/:id", async (req, res) => {
  const validated = updateUserSchema.parse(req.body);
  await db.users.update({
    where: { id: req.params.id },
    data: validated, // Only whitelisted fields
  });
  res.json({ ok: true });
});

// 3. ReDoS-safe email regex — no nested quantifiers
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
if (emailRegex.test(userEmail)) { /* ... */ }

// 4. Open redirect prevention — allowlist internal paths
app.get("/redirect", (req, res) => {
  const url = req.query.url as string;
  
  // Only allow internal paths (starting with /) or validate full URLs against allowlist
  if (url.startsWith('/')) {
    res.redirect(url);
  } else {
    try {
      const parsed = new URL(url);
      const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://example.com';
      if (parsed.origin === allowedOrigin) {
        res.redirect(url);
      } else {
        res.status(400).json({ error: 'Invalid redirect target' });
      }
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
    }
  }
});

// 5. Error handling — strip internals, log separately
app.use((err: any, req: any, res: any, next: any) => {
  const requestId = req.id || crypto.randomUUID();
  
  // Log full error server-side with context
  console.error({
    timestamp: new Date().toISOString(),
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });
  
  // Return only generic message to client
  res.status(500).json({
    error: 'Internal server error',
    requestId, // Allows client to reference logs for support
  });
});

// 6. OAuth with PKCE and state parameter
import crypto from 'crypto';

app.get("/auth/login", (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  
  // Store state + verifier in httpOnly session
  req.session.oauthState = state;
  req.session.codeVerifier = codeVerifier;
  
  const authUrl = new URL('https://provider.com/authorize');
  authUrl.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', process.env.OAUTH_REDIRECT_URI!);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', hashCodeChallenge(codeVerifier));
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  res.redirect(authUrl.toString());
});

app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state to prevent CSRF
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: 'Invalid state parameter' });
  }
  
  // Exchange code with PKCE verifier
  const token = await exchangeCode(code as string, req.session.codeVerifier);
  
  // Store token in httpOnly Secure SameSite cookie (not localStorage)
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  
  res.redirect('/dashboard');
});

// 7. IDOR prevention — check ownership before returning resource
app.get("/invoices/:id", async (req, res) => {
  const invoice = await db.invoices.findUnique({
    where: {
      id: req.params.id,
      // Add ownership filter — must belong to authenticated user
      userId: req.user.id,
    },
  });
  
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  res.json(invoice);
});

// 8. Supply chain security — audit on every CI build
// package.json:
// {
//   "scripts": {
//     "security": "npm audit --audit-level=high && npm audit signatures",
//     "pretest": "npm audit"
//   }
// }
// In CI: npm ci && npm run security && npm test
```
