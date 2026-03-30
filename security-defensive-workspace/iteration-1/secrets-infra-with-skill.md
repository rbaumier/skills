# Security Review: Service Configuration

## Violations Found

### CRITICAL -- Hardcoded Secrets

**Rule**: "Never hardcode secrets, always env vars or vault"

Four production secrets are hardcoded as string literals in source code:

| Secret | Value in code | Risk |
|---|---|---|
| `dbUrl` | `postgresql://admin:P@ssw0rd123@db.prod.internal:5432/app` | Full database access with admin credentials |
| `stripeKey` | `sk_live_abc123def456` | Live payment API key -- financial exposure |
| `jwtSecret` | `change-me-in-production` | Token forgery -- full auth bypass |
| `awsAccessKey` | `AKIA1234567890ABCDEF` | AWS account takeover |

**Fix**: Load all secrets from environment variables or a vault (AWS Secrets Manager, HashiCorp Vault, Doppler). The config should read:

```typescript
export const config = {
  dbUrl: process.env.DATABASE_URL!,
  stripeKey: process.env.STRIPE_SECRET_KEY!,
  jwtSecret: process.env.JWT_SECRET!,
  awsAccessKey: process.env.AWS_ACCESS_KEY_ID!,
};
```

Validate at startup that all required env vars are present; crash immediately if any are missing.

---

### CRITICAL -- No .gitignore for .env Files

**Rule**: ".env files in .gitignore, run secret scanning (TruffleHog/GitGuardian)"

Without `.env` in `.gitignore`, secrets will be committed to version control. Once pushed, they are in the git history permanently (even after deletion).

**Fix**: Add `.env*` to `.gitignore`. If secrets were ever committed, rotate them immediately -- removing the file does not remove it from history.

---

### CRITICAL -- No Secret Scanning in CI

**Rule**: ".env files in .gitignore, run secret scanning (TruffleHog/GitGuardian)"

No SAST or secret scanning is configured. The hardcoded secrets in this file would pass CI unchallenged.

**Fix**: Add TruffleHog or GitGuardian to the CI pipeline as a blocking check. Also add a pre-commit hook (e.g., `detect-secrets`) to catch secrets before they reach the remote.

---

### CRITICAL -- No Lockfile Committed

**Rule**: "Always commit lockfiles"

Missing lockfile means dependency resolution is non-deterministic. A compromised or yanked transitive dependency can silently change between installs.

**Fix**: Commit `bun.lock`, `package-lock.json`, or `pnpm-lock.yaml`. Pin dependency versions and run `npm audit` / Snyk / Dependabot for dependency scanning.

---

### HIGH -- Logging Sensitive Data

**Rule**: "Never log passwords, tokens, or PII"

`logRequest` logs `req.headers` and `req.body` in full. Headers contain `Authorization` tokens, cookies, and session identifiers. Request bodies may contain passwords, credit card numbers, or other PII.

**Fix**: Strip sensitive fields before logging:

```typescript
function logRequest(req, res) {
  const { authorization, cookie, ...safeHeaders } = req.headers;
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    user_id: req.user?.id,
    ip: req.ip,
  }));
}
```

Log only: timestamp, user_id, action, resource, result, IP -- per the skill's logging rule.

---

### HIGH -- JWT Secret Weakness

**Rule**: "RS256 for public APIs, HS256 for internal only"

`jwtSecret: 'change-me-in-production'` is a weak symmetric key. If this service exposes a public API, it should use RS256 with an asymmetric key pair, not a shared secret.

Additionally, the value `change-me-in-production` suggests a default that was never changed -- a common deployment failure mode.

**Fix**: Use RS256 with key pairs for public APIs. For any symmetric secret, generate a cryptographically random value (minimum 256 bits) and store it in a vault. Never use human-readable default values.

---

### MEDIUM -- Unvalidated Internal Fetch (SSRF)

**Rule**: "Allowlist URLs for SSRF prevention"

The `fetch('http://internal-api:3000/data')` call uses an unencrypted HTTP connection to an internal service with no URL allowlisting.

**Fix**: Use HTTPS (mTLS preferred for service-to-service per zero-trust rules). Maintain an explicit allowlist of permitted internal URLs. Validate that the resolved address is not a loopback or metadata endpoint.

---

### MEDIUM -- No Internal Error Exposure Controls

**Rule**: "Never expose internal errors to clients"

No error handling wraps the fetch call. If it throws, the stack trace (including internal hostnames like `internal-api:3000`) may leak to the client.

**Fix**: Wrap in try/catch, return generic error responses to clients, log the full error server-side.

---

## Summary

| Severity | Count | Categories |
|---|---|---|
| CRITICAL | 4 | Hardcoded secrets, missing .gitignore, no secret scanning, no lockfile |
| HIGH | 2 | Logging PII/tokens, weak JWT secret |
| MEDIUM | 2 | SSRF risk, internal error exposure |

**Immediate actions**: Rotate all four hardcoded secrets (they must be considered compromised), move to env vars or vault, add `.env*` to `.gitignore`, commit the lockfile, and add secret scanning to CI.
