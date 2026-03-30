# Security Review: Service Configuration

## Verdict: FAIL - Critical

---

## Critical Issues

### 1. Hardcoded secrets in source code

All four values in `config` are plaintext credentials committed to source:

| Secret | Risk |
|---|---|
| `dbUrl` with `admin:P@ssw0rd123` | Full database access. Credential reuse likely. |
| `sk_live_abc123def456` | Live Stripe key = real charges, refunds, customer PII. |
| `jwtSecret: 'change-me-in-production'` | Token forgery. Any attacker can mint admin JWTs. |
| `AKIA1234567890ABCDEF` | AWS IAM key. Lateral movement across AWS resources. |

**Fix**: Move all secrets to environment variables or a secrets manager (AWS Secrets Manager, Vault, Doppler). Reference via `process.env.DB_URL`, etc. Rotate every credential above immediately -- they must be considered compromised if this code has ever been in a repo.

### 2. No `.gitignore` for `.env`

Without `.gitignore` covering `.env*`, the migration to env vars will fail at the first `git add .` -- secrets end up in git history anyway.

**Fix**: Add `.env*` and `!.env.example` to `.gitignore` before any `.env` file is created.

### 3. No secret scanning in CI

No pre-commit hook or CI step to catch future leaks (e.g., a developer adds a new key inline).

**Fix**: Add `gitleaks` or `trufflehog` as a pre-commit hook and CI gate. Block merges on detection.

---

## High Issues

### 4. Logging request bodies and full headers

```typescript
body: req.body,
headers: req.headers,
```

This dumps passwords, tokens, credit card numbers, PII, and `Authorization` headers into logs. Logs are typically stored with weaker access controls than the application itself.

**Fix**: Allowlist specific safe fields. Never log `req.body` or `req.headers` wholesale.

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  path: req.path,
  userId: req.user?.id,
  method: req.method,
}));
```

### 5. JWT secret used as a Bearer token

```typescript
headers: { 'Authorization': `Bearer ${config.jwtSecret}` }
```

The signing secret is being sent over the wire as an auth token. This is a category error: the JWT secret signs tokens, it should never leave the process. If the internal API logs or echoes headers, the secret is exposed.

**Fix**: Generate a proper JWT or use a dedicated service-to-service token/mTLS for internal API calls.

---

## Medium Issues

### 6. HTTP for internal API call

```typescript
fetch('http://internal-api:3000/data', ...)
```

Plaintext HTTP even on internal networks allows credential interception via ARP spoofing, compromised sidecars, or misconfigured service meshes.

**Fix**: Use HTTPS with proper certs, or mTLS if running in a service mesh (Istio, Linkerd).

### 7. No lockfile

Without a lockfile (`bun.lock`, `package-lock.json`, `yarn.lock`), dependency versions are non-deterministic. A compromised or yanked transitive dependency installs silently.

**Fix**: Commit a lockfile. Run `npm audit` / `bun audit` in CI.

---

## Summary of Required Actions

1. **Rotate all four credentials immediately.** They are compromised.
2. Move secrets to env vars or a secrets manager.
3. Add `.env*` to `.gitignore`.
4. Add secret scanning (gitleaks/trufflehog) to pre-commit and CI.
5. Strip `req.body` and `req.headers` from logs; allowlist safe fields only.
6. Stop using the JWT signing secret as a Bearer token.
7. Switch internal calls to HTTPS/mTLS.
8. Commit a lockfile and audit dependencies in CI.
