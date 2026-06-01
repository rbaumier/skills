```typescript
// 1. Prototype pollution — strip dangerous keys before merging
function merge(target: any, source: any) {
  // Remove prototype pollution vectors
  const sanitized = Object.keys(source)
    .filter(key => !['__proto__', 'constructor', 'prototype'].includes(key))
    .reduce((acc, key) => ({ ...acc, [key]: source[key] }), {});
  
  for (const key in sanitized) {
    target[key] = sanitized[key];
  }
  return target;
}
const config = merge({}, JSON.parse(userInput));

// 2. Mass assignment — use .pick() or explicit field allowlist
app.put("/users/:id", async (req, res) => {
  // Pick only allowed fields to prevent privilege escalation
  const { name, email } = req.body;
  await db.users.update({ 
    where: { id: req.params.id }, 
    data: { name, email } // explicit fields only
  });
  res.json({ ok: true });
});

// 3. ReDoS-safe regex — no nested quantifiers
const emailRegex = /^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.[a-zA-Z]+$/;
if (emailRegex.test(userEmail)) { /* ... */ }

// 4. Open redirect prevention — validate URL origin
app.get("/redirect", (req, res) => {
  const url = req.query.url as string;
  try {
    const parsed = new URL(url);
    // Only allow relative paths or same-origin URLs
    if (parsed.origin !== new URL(process.env.APP_URL || 'http://localhost:3000').origin) {
      return res.status(403).json({ error: 'Invalid redirect URL' });
    }
    res.redirect(url);
  } catch {
    // Invalid URL, reject
    return res.status(400).json({ error: 'Invalid URL' });
  }
});

// 5. Error handler — don't leak stack traces
app.use((err, req, res, next) => {
  const requestId = crypto.randomUUID();
  // Log full error server-side with request ID
  console.error({ requestId, error: err.message, stack: err.stack });
  // Send generic response to client
  res.status(500).json({
    error: 'Internal server error',
    requestId
  });
});

// 6. OAuth with state parameter AND PKCE
app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state to prevent CSRF
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: 'Invalid state parameter' });
  }
  
  // Exchange code with PKCE verifier
  const body = JSON.stringify({
    client_id: process.env.OAUTH_CLIENT_ID,
    client_secret: process.env.OAUTH_CLIENT_SECRET,
    code,
    code_verifier: req.session.pkceVerifier // PKCE: prevents authorization code interception
  });
  
  const token = await exchangeCode(code as string, body);
  
  // Set token in httpOnly Secure SameSite=Strict cookie (never response body)
  res.cookie("access", token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  
  res.redirect("/dashboard");
});

// 7. IDOR prevention — verify ownership
app.get("/invoices/:id", async (req, res) => {
  const invoice = await db.invoices.findUnique({ 
    where: { 
      id: req.params.id,
      ownerId: req.user.id // Ownership check prevents privilege escalation
    } 
  });
  
  if (!invoice) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.json(invoice);
});

// 8. Supply chain security — multi-layer approach, not just npm audit
// package.json:
// {
//   "scripts": {
//     "security": "npm audit --audit-level=high && lockfile-lint --path package-lock.json",
//     "supply-chain": "npm query ':attr(scripts, [preinstall])' && npm audit signatures"
//   }
// }
//
// CI pipeline should:
// 1. Run "npm audit" to catch published CVEs
// 2. Use "lockfile-lint" to validate resolved URLs and integrity hashes
// 3. Use "Socket.dev" or "Snyk" for behavioral analysis of new dependencies
// 4. Pin CI runner images to digest (not tag) to prevent supply chain substitution
// 5. Enable Dependabot/Renovate for automated security patches
// 6. Flag any new deps with postinstall scripts for manual review
```
