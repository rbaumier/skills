---
name: security-defensive
description: "Secure coding, auth, vulnerability prevention. Trigger on 'security', 'auth', 'XSS', 'CSRF', 'secrets', 'OWASP', 'compliance', 'threat model', 'audit', 'encryption'."
---

## Rules

### Input & Injection
- Schema allowlists (never blocklists), parameterized queries (never concat)
- Array args for commands (never shell=True), realpath()+prefix for paths
- Never eval/pickle/deserialize untrusted data
- Validate uploads: size, MIME, extension. Allowlist URLs for SSRF

### XSS & Client
- No innerHTML/dangerouslySetInnerHTML with user input, use textContent
- DOMPurify with explicit allowed tags for HTML sanitization
- **Sanitize all URLs before use (redirects, hrefs, window.location): MUST reject non-http/https protocols. A `javascript:` URI in a redirect or href is XSS. Always validate `new URL(input).protocol` is `http:` or `https:` before using any user-supplied URL.**
- Nonce/hash-based CSP (no unsafe-inline/unsafe-eval), SRI on external scripts

### Auth & JWT
- JWTs in httpOnly Secure SameSite=Strict cookies (never localStorage)
- RS256 public APIs, HS256 internal only. Short-lived tokens + refresh rotation
- Validate iss/aud/exp. bcrypt(12+) or Argon2id for passwords
- Authz check before every operation (RBAC/ABAC/RLS)
- Never hardcode secrets, use env vars or vault

### CSRF & Headers
- SameSite=Strict + CSRF tokens on state changes. Validate Origin/Referer on non-GET
- HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy, Permissions-Policy
- No wildcard CORS with credentials. Rate limit all endpoints. Use helmet/Talisman

### Secrets & Infra
- .env in .gitignore, secret scanning (TruffleHog/GitGuardian), commit lockfiles
- mTLS for service-to-service, never log passwords/tokens/PII
- **Structured audit logs are REQUIRED. Every log entry MUST include: timestamp, user_id, action, resource, result, IP. Use append-only tamper-evident storage. Do NOT just console.log raw request data — that is not an audit log. Structured fields enable alerting, forensics, and compliance.**
