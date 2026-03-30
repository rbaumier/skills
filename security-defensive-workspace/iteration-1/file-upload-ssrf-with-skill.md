# Security Review: File Upload & URL Fetch Endpoints

## Violations Found

### 1. Path Traversal via `file.originalname` (CRITICAL)

```typescript
await fs.writeFile(`/uploads/${file.originalname}`, file.buffer);
```

**Violated rule**: "Path traversal: realpath() + prefix check"

`file.originalname` is attacker-controlled. A filename like `../../etc/cron.d/backdoor` writes outside `/uploads/`. No `realpath()` + prefix check is performed.

**Fix**: Resolve the final path and verify it stays within the uploads directory.

```typescript
import path from 'path';

const safeName = path.basename(file.originalname);
const dest = path.join('/uploads', safeName);
const resolved = await fs.realpath(path.dirname(dest)).catch(() => path.resolve(path.dirname(dest)));
if (!path.join(resolved, safeName).startsWith('/uploads/')) {
  return res.status(400).json({ error: 'Invalid filename' });
}
await fs.writeFile(path.join(resolved, safeName), file.buffer);
```

### 2. No File Upload Validation (CRITICAL)

```typescript
upload.single('file') // no constraints
```

**Violated rule**: "Validate file uploads: size, MIME type, extension"

No size limit, MIME type check, or extension allowlist. Allows uploading executables, scripts, or arbitrarily large files.

**Fix**: Configure multer with limits and a file filter.

```typescript
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});
```

### 3. Server-Side Request Forgery (CRITICAL)

```typescript
const { url } = req.query;
const response = await fetch(url);
```

**Violated rule**: "Allowlist URLs for SSRF prevention"

User-supplied `url` is fetched without any validation. An attacker can reach internal services (`http://169.254.169.254/latest/meta-data/`, `http://localhost:6379/`, `file:///etc/passwd`).

**Fix**: Validate against an allowlist of permitted domains and protocols.

```typescript
const allowedHosts = ['api.example.com', 'cdn.example.com'];
const parsed = new URL(url);
if (!['http:', 'https:'].includes(parsed.protocol)) {
  return res.status(400).json({ error: 'Invalid protocol' });
}
if (!allowedHosts.includes(parsed.hostname)) {
  return res.status(400).json({ error: 'Host not allowed' });
}
const response = await fetch(parsed.toString());
```

### 4. No Input Validation on Query Parameter (HIGH)

```typescript
const { url } = req.query;
```

**Violated rule**: "Validate all input via schema allowlists, never blocklists"

No schema validation on the `url` query parameter. Should validate type, format, and required presence before use.

**Fix**: Validate with a schema (e.g., Zod).

```typescript
import { z } from 'zod';
const schema = z.object({ url: z.string().url() });
const result = schema.safeParse(req.query);
if (!result.success) {
  return res.status(400).json({ error: 'Invalid URL parameter' });
}
```

### 5. No Content-Type / Payload Validation (MEDIUM)

**Violated rule**: "Validate content-type, payload size, schema on all request bodies"

The upload endpoint does not validate that the incoming request content-type is `multipart/form-data` before processing.

### 6. Internal Error Exposure (MEDIUM)

**Violated rule**: "Never expose internal errors to clients"

Neither endpoint has error handling. Unhandled exceptions (e.g., DNS failures in `fetch`, disk write errors) will leak stack traces to the client via Express's default error handler.

**Fix**: Wrap in try/catch and return generic error responses.

### 7. No Rate Limiting (MEDIUM)

**Violated rule**: "Rate limit all endpoints, stricter on auth/expensive routes"

Both endpoints perform expensive I/O (disk writes, outbound HTTP) with no rate limiting, enabling abuse and resource exhaustion.

### 8. Missing Security Headers (LOW)

**Violated rule**: "Use helmet (Express)"

No evidence of `helmet` middleware. Should be applied app-wide.

## Summary

| # | Issue | Severity | Rule |
|---|-------|----------|------|
| 1 | Path traversal via originalname | CRITICAL | realpath() + prefix check |
| 2 | No file upload validation | CRITICAL | Validate file uploads: size, MIME type, extension |
| 3 | SSRF via unvalidated URL fetch | CRITICAL | Allowlist URLs for SSRF prevention |
| 4 | No input schema validation | HIGH | Validate all input via schema allowlists |
| 5 | No content-type validation | MEDIUM | Validate content-type, payload size, schema |
| 6 | Internal error exposure | MEDIUM | Never expose internal errors to clients |
| 7 | No rate limiting | MEDIUM | Rate limit all endpoints |
| 8 | Missing security headers | LOW | Use helmet (Express) |
