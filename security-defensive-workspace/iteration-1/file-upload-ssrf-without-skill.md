# Security Review: `/api/upload` and `/api/fetch-url`

## Critical Vulnerabilities

### 1. Path Traversal in File Upload

```typescript
await fs.writeFile(`/uploads/${file.originalname}`, file.buffer);
```

`file.originalname` is user-controlled. An attacker can craft a filename like `../../etc/cron.d/backdoor` to write arbitrary files anywhere on the filesystem.

**Impact**: Remote Code Execution, full server compromise.

**Fix**: Sanitize the filename -- strip directory components, use a generated name.

```typescript
import { randomUUID } from 'crypto';
import path from 'path';

const ext = path.extname(file.originalname);
const safeName = `${randomUUID()}${ext}`;
await fs.writeFile(path.join('/uploads', safeName), file.buffer);
```

---

### 2. Server-Side Request Forgery (SSRF) in `/api/fetch-url`

```typescript
const { url } = req.query;
const response = await fetch(url);
```

No validation on `url`. An attacker can request internal resources:

- `http://169.254.169.254/latest/meta-data/` -- AWS instance metadata (credentials leak)
- `http://localhost:6379/` -- internal Redis
- `file:///etc/passwd` -- local files (runtime-dependent)

**Impact**: Cloud credential theft, internal network scanning, data exfiltration.

**Fix**: Validate the URL against an allowlist of schemes and block private/internal IP ranges.

```typescript
import { URL } from 'url';

const parsed = new URL(url as string);
if (!['http:', 'https:'].includes(parsed.protocol)) {
  return res.status(400).json({ error: 'Invalid protocol' });
}
// Resolve hostname and reject private IPs (10.x, 172.16-31.x, 192.168.x, 169.254.x, 127.x, ::1)
```

---

### 3. Missing Input Validation on Upload

No checks on:
- **File size** -- unbounded uploads enable denial of service.
- **File type** -- uploading `.html` or `.svg` files to a served `/uploads` directory enables stored XSS.
- **`req.file` nullability** -- if no file is attached, `req.file` is `undefined` and the handler throws.

---

### 4. Unrestricted File Serving Implied

If `/uploads` is statically served, any uploaded file is directly accessible. Combined with no file-type validation, this enables:
- Stored XSS via `.html`/`.svg` uploads.
- Phishing pages hosted on your domain.

**Fix**: Serve uploads from a separate domain/CDN, set `Content-Disposition: attachment`, and validate MIME types.

---

## Summary

| # | Vulnerability | Severity |
|---|--------------|----------|
| 1 | Path Traversal (arbitrary file write) | **Critical** |
| 2 | SSRF (internal network/cloud metadata access) | **Critical** |
| 3 | No input validation (DoS, XSS) | **High** |
| 4 | Unrestricted file serving (stored XSS) | **Medium** |
