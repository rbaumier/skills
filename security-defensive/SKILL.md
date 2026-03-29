---
name: security-defensive
description: "Secure coding, auth, vulnerability prevention. Trigger on 'security', 'auth', 'XSS', 'CSRF', 'secrets', 'OWASP', 'compliance', 'threat model', 'audit', 'encryption'."
---

## When to use
- Implementing auth (JWT, OAuth2, OIDC, MFA, RBAC/ABAC)
- Handling user input, file uploads, user-generated content
- Securing APIs, managing secrets/encryption keys
- Running security audits, threat modeling, vuln scanning
- Configuring SAST/DAST/dependency scanning in CI/CD
- Achieving compliance (PCI-DSS, GDPR, HIPAA, SOC2)
- Securing mobile apps or service-to-service comms

## When not to use
- Purely UI styling with no security concern
- Need legal counsel or formal compliance certification
- Lack authorization for security testing

## Rules
- Validate all input via schema allowlists, never blocklists
- Use parameterized queries only, never string concatenation
- Use array args for commands, never shell=True
- Path traversal: realpath() + prefix check
- Never deserialize untrusted data with pickle/eval
- Validate file uploads: size, MIME type, extension
- Never innerHTML/document.write with user input, use textContent
- Sanitize HTML via DOMPurify with explicit allowed tags
- Sanitize URLs: allow only http/https protocols
- Use nonce/hash-based CSP, deploy report-only first
- Store JWTs in httpOnly Secure SameSite=Strict cookies, never localStorage
- RS256 for public APIs, HS256 for internal only
- Short-lived access tokens + refresh token rotation
- Validate JWT iss, aud, exp claims
- Hash passwords with bcrypt (cost 12+) or Argon2id
- Require MFA (TOTP/WebAuthn) for sensitive operations
- Always verify authorization before operations (RBAC/ABAC/RLS)
- Use policy engines (OPA/Cedar/Casbin) for fine-grained authz
- Validate OAuth state + redirect_uri, use PKCE for public clients
- SameSite=Strict on all cookies + CSRF tokens on state changes
- Validate Origin/Referer headers for non-GET requests
- Set HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy
- Set Permissions-Policy to deny unused browser features
- Never wildcard CORS with credentials, whitelist origins
- Use SRI for external scripts
- Rate limit all endpoints, stricter on auth/expensive routes
- Validate content-type, payload size, schema on all request bodies
- Allowlist URLs for SSRF prevention
- Never expose internal errors to clients
- Use helmet (Express), Talisman (Flask), secure settings (Django)
- Never hardcode secrets, always env vars or vault
- .env files in .gitignore, run secret scanning (TruffleHog/GitGuardian)
- Rotate secrets: generate new, update, verify, revoke old
- Use mTLS for zero-trust service-to-service comms
- Short-lived workload certs (24h max), monitor expiry
- Mobile: HTTPS-only WebView, URL allowlist, JS disabled by default
- Mobile: iOS Keychain + biometric, Android Keystore + biometric
- Mobile: certificate pinning, TLS 1.2+, root/jailbreak detection
- Run Semgrep + SAST in pre-commit and CI
- Combine SAST tools, prioritize CRITICAL/HIGH findings
- npm audit / Snyk / Dependabot for dependency scanning
- Always commit lockfiles
- PCI: never store CVV/PIN, tokenize, use hosted payments
- Encrypt at rest with AES-256-GCM, random nonces, HSM/KMS keys
- Threat model with STRIDE/PASTA before building
- Never log passwords, tokens, or PII
- Log: timestamp, user_id, action, resource, result, IP
- Tamper-evident append-only audit trails
- Incident response: detect <15min, contain, root cause, remediate, review
