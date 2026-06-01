# Fix report — security-defensive (Haiku, weak executor)

Eval1 13/23, Eval2 7/8. 11 fails triaged. Root cause across the board: the failing rules
existed only as terse one-liners in the Rules section; Haiku fixed the loud/obvious issues
(helmet, rate-limit tiers, bcrypt rounds, IDOR, path traversal) but skipped the subtle
auth/OAuth/CSP/CSRF/webhook/logging items because nothing in the body *embodied* them as
DO/DON'T code or forced enumeration before output.

## Per-fail classification

| id | class | action |
|----|-------|--------|
| jwt-in-cookie-not-body | R | New DO/DON'T: token as cookie, never `res.json({ token })`; applies to every token path. |
| jwt-rs256-public-api | R | New DO/DON'T: RS256 for public/browser-facing, HS256 internal-only, with sign example. |
| jwt-validate-iss-aud | R | New rule: `jwt.verify(token, key, { algorithms, issuer, audience })` — never bare verify. |
| jwt-short-lived-refresh | R | New code block: ≤15m access token + refresh-token rotation mechanism (DELETE...RETURNING). |
| csp-nonce-based | R | New rule + helmet CSP code: explicit nonce policy, no unsafe-inline/eval; "bare helmet() is NOT enough". |
| oauth-pkce | R | New rule + code: code_verifier/code_challenge generation + send verifier in exchange; "state is not PKCE". |
| csrf-token-state-changes | R | New rule: csurf/double-submit token on mutations; "SameSite alone is not enough". |
| webhook-signature-verify | R | Genuinely MISSING rule. Added `stripe.webhooks.constructEvent` DO/DON'T; webhook = unauthenticated public URL. |
| structured-audit-logs | R | Rule existed but no code; added structured-entry code block + explicit DON'T console.log. |
| html-sanitize-dompurify | R | Strengthened terse bullet → DO (isomorphic-dompurify + allowlist) / DON'T (manual .replace chain is not sanitization). |
| supply-chain-beyond-audit | A | Assertion too literal (only credited 3 named tools; rejected digest-pinning + install-script detection the skill teaches). Broadened description in assertions-e2.json + evals.json to accept any genuine beyond-`npm audit` measure; `npm audit signatures` alone still excluded. Also reinforced skill rule to name lockfile-lint/Socket.dev/Snyk. |

Counts: R=10, V=0, A=1, F=0.

## Skill changes (all in body, DO/DON'T + embodied code)
- Auth section: 4 new JWT rules (cookie-delivery, RS256, iss/aud verify, refresh rotation block).
- OAuth: new PKCE rule with two-step code block.
- CSRF & Headers: new CSRF-token rule + new nonce-based CSP helmet block.
- XSS & Client: strengthened DOMPurify bullet.
- Secrets & Infra: new webhook-signature rule + audit-log code example; supply-chain rule names tools.
- New "STOP — Before You Output Reviewed/Fixed Code" LOUD checklist enumerating the 10 subtle
  items Haiku kept missing, with an explicit "if you can't fix one, say so — don't silently skip".

## Regression guard
Only additive edits + one strengthened bullet. Did not touch any rule that passed
(helmet, rate-limit, bcrypt, IDOR, path traversal, redos, prototype-pollution, mass-assignment,
open-redirect, error-stack-leak, oauth-state, sameSite-strict, cors-credentials). The new
nonce CSP and CSRF-token rules are stricter supersets of existing guidance, not contradictions.

## Assertion changes
- supply-chain-beyond-audit: broadened description (assertions-e2.json + evals.json).
