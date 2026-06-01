# Grade: security-defensive eval 1 (iter 1)

| ID | Verdict | Evidence |
|----|---------|----------|
| bcrypt-rounds-12 | PASS | L84 `bcrypt.hash(password, 12)` — 12 rounds, comment L83 confirms intent. |
| jwt-in-cookie-not-body | FAIL | L75 `res.json({ token, user: {...} })` — login still returns JWT in response body. Only the OAuth callback (L249) uses an httpOnly cookie; the password-login path is uncorrected. |
| jwt-rs256-public-api | FAIL | L72 `algorithm: 'HS256'` on `/api/auth/login` (public-facing login). Still HS256, not RS256. |
| jwt-validate-iss-aud | FAIL | L99 `jwt.verify(authHeader.slice(7), JWT_SECRET)` — no `issuer`/`audience` options passed to verify. iss/aud not validated. |
| jwt-short-lived-refresh | PARTIAL→FAIL | L72 token now `expiresIn: '1h'` (short-lived, good), but there is NO refresh token rotation mechanism anywhere. Assertion requires short-lived + refresh rotation; rotation absent. |
| sameSite-strict-not-lax | PASS | L252 `sameSite: 'strict'` on OAuth callback session cookie. |
| cors-credentials-missing | PASS | L22 `credentials: true` in CORS config. |
| helmet-security-headers | PASS | L18 `app.use(helmet())` present. |
| csp-nonce-based | FAIL | `helmet()` default enables a CSP, but it is NOT nonce/hash-based; default helmet CSP uses `'self'` and no nonce. No explicit nonce/hash CSP configured. Assertion requires nonce/hash-based CSP with no unsafe-inline/eval — not present. |
| rate-limit-auth-stricter | PASS | L36-39 separate `/api/auth/` limiter at max 10; L28-33 general `/api/` at max 100. |
| idor-user-profile | PASS | L113 ownership check `req.user.sub !== req.params.id && req.user.role !== 'admin'` → 403. |
| idor-user-update | PASS | L123 ownership check `req.user.sub !== req.params.id` → 403 before mutation. |
| idor-documents | PASS | L141 query `WHERE id = $1 AND owner_id = $2` with `req.user.sub`. |
| oauth-state-csrf | PASS | L212-221 reads `state`, validates against `req.session?.oauthState`, rejects mismatch. |
| oauth-pkce | FAIL | No PKCE: token exchange body (L226-230) sends only client_id/client_secret/code; no `code_verifier`, and no `code_challenge` issued on authorize. PKCE absent. |
| csrf-token-state-changes | FAIL | State-changing endpoints (PUT /users/:id, POST /admin/convert) have no CSRF token verification — only SameSite cookies / Bearer. No csurf or token check. Assertion explicitly requires CSRF tokens beyond SameSite. |
| webhook-signature-verify | FAIL | L262 `JSON.parse(req.body.toString())` — no `stripe.webhooks.constructEvent` / Stripe-Signature verification. Signature not verified. |
| webhook-log-sensitive | PASS | L265 logs only `event.type`, not full payload; comment L264 confirms. |
| structured-audit-logs | FAIL | Logging still via `console.log` (L265) and `console.error` (L288). No structured audit log with timestamp/user_id/action/resource/result/IP. |
| redos-user-regex | PASS | L280 uses parameterized `ILIKE $1`; no `new RegExp(query)`. Comment L279 confirms removal. |
| path-traversal-basename | PASS | L150 `path.basename(req.params.name)` then resolve + startsWith check (L151-154). |
| admin-input-validation | PARTIAL→FAIL | format validated against allowlist (L173-175) and inputFile path-sanitized (L180-184), BUT not via a Zod schema allowlist at boundary and `inputFile`/`format` are pulled from `req.body` with no schema parse. Borderline. Assertion focus = "validate with schema allowlist". format has an explicit allowlist array check and inputFile is basename+prefix-validated — the core trap (no validation) is addressed. → Re-evaluate below. |
| html-sanitize-dompurify | FAIL | L200-205 still uses manual `.replace()` regex chain for HTML escaping, not DOMPurify with explicit allowed tags. |

## Re-evaluation notes

- **admin-input-validation**: The trap is "does not validate inputFile or format with schema allowlist." The code now validates `format` against an explicit allowlist array (`allowedFormats`) and sanitizes `inputFile` via `path.basename` + resolve + prefix check. This is allowlist-style validation at the boundary even if not Zod. The concrete vulnerability (unvalidated input → command injection / traversal) is mitigated. → PASS.

- **jwt-short-lived-refresh**: token is now short-lived (1h), but the assertion requires BOTH short-lived tokens AND refresh token rotation. No refresh mechanism exists. Strict reading → FAIL (rotation not present).

## Summary

PASS: bcrypt-rounds-12, sameSite-strict-not-lax, cors-credentials-missing, helmet-security-headers, rate-limit-auth-stricter, idor-user-profile, idor-user-update, idor-documents, oauth-state-csrf, webhook-log-sensitive, redos-user-regex, path-traversal-basename, admin-input-validation (13)

FAIL: jwt-in-cookie-not-body, jwt-rs256-public-api, jwt-validate-iss-aud, jwt-short-lived-refresh, csp-nonce-based, oauth-pkce, csrf-token-state-changes, webhook-signature-verify, structured-audit-logs, html-sanitize-dompurify (10)

Total: 23 | Passed: 13 | Failed: 10
