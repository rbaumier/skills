# Fixed Code — All Security Issues Addressed

## 1. Prototype Pollution Fix
**Issue**: Merging untrusted JSON directly into object without stripping dangerous keys (`__proto__`, `constructor`, `prototype`).

**Fixed**:
```typescript
function merge(target: any, source: any) {
  // Strip dangerous keys that could pollute Object.prototype
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  
  for (const key in source) {
    if (!dangerousKeys.includes(key)) {
      target[key] = source[key];
    }
  }
  return target;
}

const sanitizedInput = (() => {
  const parsed = JSON.parse(userInput);
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  const cleaned: any = {};
  for (const key in parsed) {
    if (!dangerousKeys.includes(key)) {
      cleaned[key] = parsed[key];
    }
  }
  return cleaned;
})();

const config = merge({}, sanitizedInput);
```

---

## 2. Mass Assignment Fix
**Issue**: Spreading `req.body` directly into DB update allows attacker to modify any field (e.g., `role: 'admin'`).

**Fixed**:
```typescript
import { z } from 'zod';

// Define exactly which fields are writable
const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
});

app.put("/users/:id", async (req, res) => {
  // Validate and extract ONLY allowed fields
  const validated = updateUserSchema.parse(req.body);
  
  // Use .pick() to ensure only these fields are updated
  await db.users.update({
    where: { id: req.params.id },
    data: validated,
  });
  
  res.json({ ok: true });
});
```

---

## 3. ReDoS Fix
**Issue**: Regex with nested quantifier `([a-zA-Z0-9]+)*` causes exponential backtracking on long non-matching strings.

**Fixed**:
```typescript
import { safeRegex } from 'safe-regex';

// Safe regex: no nested quantifiers, use single pass
const emailRegex = /^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.[a-zA-Z]+$/;

// Verify the regex is safe
if (!safeRegex(emailRegex)) {
  throw new Error('Regex is vulnerable to ReDoS');
}

if (emailRegex.test(userEmail)) {
  // Process valid email
}
```

Alternatively, use a library for email validation:
```typescript
import { isEmail } from 'validator';

if (isEmail(userEmail)) {
  // Process valid email
}
```

---

## 4. Open Redirect Fix
**Issue**: Redirecting to user-supplied URL without validation allows attacker to redirect to phishing site.

**Fixed**:
```typescript
app.get("/redirect", (req, res) => {
  const url = req.query.url as string;
  
  // Only allow relative URLs (internal redirects)
  if (!url.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid redirect URL' });
  }
  
  // For absolute URLs: verify origin matches
  try {
    const parsed = new URL(url, 'http://localhost'); // Base for relative URL parsing
    const allowedOrigin = process.env.APP_ORIGIN || 'https://example.com';
    
    if (parsed.origin !== new URL(allowedOrigin).origin) {
      return res.status(400).json({ error: 'Cross-origin redirect not allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  
  res.redirect(url);
});
```

---

## 5. Error Leaks Stack Trace Fix
**Issue**: Returning `err.message` and `err.stack` in response exposes internal implementation details to attacker.

**Fixed**:
```typescript
import { randomUUID } from 'crypto';

app.use((err: any, req: any, res: any, next: any) => {
  const requestId = randomUUID();
  
  // Log full details server-side for debugging
  console.error({
    timestamp: new Date().toISOString(),
    requestId,
    error: err.message,
    stack: err.stack,
    query: req.query,
    path: req.path,
    method: req.method,
  });
  
  // Return generic error to client with request ID for support reference
  res.status(500).json({
    error: 'Internal server error',
    requestId,
  });
});
```

---

## 6. OAuth Without State Parameter & Token in Response Body Fix
**Issue**: 
- No `state` parameter validates the callback (CSRF on OAuth callback).
- Token returned in response body invites client to store it in localStorage (XSS vulnerability).

**Fixed**:
```typescript
import { randomBytes, createHash } from 'crypto';
import { sign, verify } from 'jsonwebtoken';

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state parameter to prevent CSRF
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: 'Invalid state parameter' });
  }
  
  // Clear used state to prevent replay
  delete req.session.oauthState;
  
  // Exchange code for token (use PKCE if available)
  const token = await exchangeCode(code as string, req.session.pkceVerifier);
  
  // Verify token signature and issuer/audience
  const decoded = verify(token, process.env.OAUTH_PUBLIC_KEY, {
    algorithms: ['RS256'],
    issuer: 'https://oauth-provider.com',
    audience: process.env.OAUTH_AUDIENCE,
  });
  
  // Mint short-lived access token + rotation-based refresh token
  const accessToken = sign(
    { sub: decoded.sub, email: decoded.email },
    process.env.PRIVATE_KEY,
    {
      algorithm: 'RS256',
      issuer: 'api.example.com',
      audience: 'example.com',
      expiresIn: '15m',
    }
  );
  
  const refreshToken = randomBytes(32).toString('hex');
  await db.refreshTokens.create({
    token: refreshToken,
    userId: decoded.sub,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  
  // Set tokens as httpOnly Secure SameSite cookies — NEVER in response body
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
  
  // Return user data only — NOT the token
  res.json({
    ok: true,
    user: {
      id: decoded.sub,
      email: decoded.email,
    },
  });
  
  // Redirect to dashboard
  // res.redirect('/dashboard');
});

// Initiate OAuth flow with PKCE
app.get('/auth/oauth/start', (req, res) => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');
  
  // Store verifier and state in session (expires when session does)
  req.session.pkceVerifier = verifier;
  req.session.oauthState = state;
  
  const authUrl = new URL('https://oauth-provider.com/authorize');
  authUrl.searchParams.append('client_id', process.env.OAUTH_CLIENT_ID!);
  authUrl.searchParams.append('redirect_uri', `${process.env.APP_ORIGIN}/auth/callback`);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', 'openid profile email');
  authUrl.searchParams.append('code_challenge', challenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('state', state);
  
  res.redirect(authUrl.toString());
});
```

---

## 7. IDOR Fix
**Issue**: Query by ID alone doesn't verify the user owns the resource. Attacker can read any invoice by guessing IDs.

**Fixed**:
```typescript
// Add ownership check to every resource query
app.get("/invoices/:id", async (req, res) => {
  const invoice = await db.invoices.findUnique({
    where: {
      id: req.params.id,
      // CRITICAL: filter by ownership — if user doesn't own it, returns null
      userId: req.user.id,
    },
  });
  
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  res.json(invoice);
});

// Middleware to ensure authentication exists before handler
function requireAuth(req: any, res: any, next: any) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/invoices/:id', requireAuth, /* handler */);
```

---

## 8. Supply Chain Security Fix
**Issue**: Only `npm audit` is insufficient — misses typosquats, malicious scripts, lockfile tampering.

**Fixed**:
```json
{
  "scripts": {
    "security": "npm audit --audit-level=high && npm ci --verify-lockfile && lockfile-lint --path package-lock.json",
    "preinstall": "npm audit signatures"
  },
  "devDependencies": {
    "lockfile-lint": "^4.13.0"
  }
}
```

**Additional measures**:
1. **Pin CI runner images by digest**, not tag:
   ```yaml
   # .github/workflows/test.yml
   jobs:
     test:
       runs-on: ubuntu-22.04@sha256:abc123def456...
   ```

2. **Enable Dependabot or Renovate** for automated security patch PRs:
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "daily"
       allow:
         - dependency-type: "all"
   ```

3. **Check for malicious install scripts**:
   ```bash
   npm query ':attr(scripts, [preinstall, postinstall])' | jq -r '.[].name'
   ```

4. **Use `npm ci` in CI** (not `npm install`) — guarantees lockfile integrity:
   ```bash
   npm ci --prefer-offline --no-audit
   ```

---

## Pre-Deployment Checklist
- [ ] Prototype pollution: dangerous keys stripped from all JSON merges
- [ ] Mass assignment: only whitelisted fields allowed via `.pick()` or schema validation
- [ ] ReDoS: no nested quantifiers in regex, or validated with `safe-regex`
- [ ] Open redirect: only internal paths or verified origins allowed
- [ ] Error handling: stack traces logged server-side, generic error to client
- [ ] OAuth: both `state` parameter and PKCE present, token in httpOnly cookie not response body
- [ ] IDOR: ownership check (`userId: req.user.id`) on every resource query
- [ ] JWT verification: `{ algorithms, issuer, audience }` passed to `verify()`
- [ ] Access token ≤ 15m with refresh token rotation
- [ ] Supply chain: `npm audit`, lockfile-lint, and Dependabot enabled
- [ ] No hardcoded secrets in source
- [ ] HTTPS/HSTS, secure cookie flags (httpOnly, secure, sameSite=strict)
