# Security Hardening Checklist

## Authentication And Authorization

- Session creation, renewal, revocation, cookie flags.
- Role checks on server-side mutations and reads.
- API key scope, storage, rotation, and revocation.
- Admin-only surfaces and hidden client-only checks.

## Input And Network Risk

- Runtime validation on API/body/query/path/provider payloads.
- SSRF: URL parsing, protocol allowlist, private IP blocking, redirects.
- File upload/download: MIME sniffing, extension checks, size limits, storage path traversal.
- CORS/CSRF policy and unsafe methods.
- Rate limits and abuse controls.

## Secrets And Logging

- `.env`, deploy env, CI secrets, provider tokens.
- Secret leakage into client bundle, logs, screenshots, fixtures, analytics.
- Error envelopes that do not expose stack traces or provider raw payloads.

## Dependencies

- Package manager audit.
- Lockfile review for unexpected packages.
- Postinstall/build scripts.
- Known CVEs, stale critical deps, abandoned packages.
- Licenses when relevant.

## Output

- Severity-ranked findings.
- Fixed issues and tests.
- Deferred risks and owner/action.
