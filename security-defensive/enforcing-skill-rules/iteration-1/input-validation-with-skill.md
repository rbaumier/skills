# Security Review: `/api/convert` Endpoint

## Findings

### 1. Command Injection via `exec` (CRITICAL)

**Rule violated**: *Use array args for commands, never shell=True*

```typescript
exec(`convert /uploads/${filename} -format ${outputFormat} /output/${filename}`, ...);
```

`filename` and `outputFormat` are user-controlled and interpolated directly into a shell command. An attacker can inject arbitrary commands (e.g. `filename = "x; rm -rf /"`).

**Fix**: Use `execFile` with an argument array:

```typescript
import { execFile } from 'child_process';

execFile('convert', [
  `/uploads/${filename}`, '-format', outputFormat, `/output/${filename}`
], (err) => { ... });
```

---

### 2. SQL Injection (CRITICAL)

**Rule violated**: *Use parameterized queries only, never string concatenation*

```typescript
const query = `INSERT INTO conversions (filename, format) VALUES ('${filename}', '${outputFormat}')`;
```

Direct string interpolation of user input into SQL. Classic SQL injection vector.

**Fix**: Use parameterized queries:

```typescript
await mysql.query(
  'INSERT INTO conversions (filename, format) VALUES (?, ?)',
  [filename, outputFormat]
);
```

---

### 3. `eval` on Untrusted Data (CRITICAL)

**Rule violated**: *Never deserialize untrusted data with pickle/eval*

```typescript
const prefs = eval('(' + req.cookies.prefs + ')');
```

Cookies are fully attacker-controlled. `eval` executes arbitrary JavaScript on the server, enabling full Remote Code Execution.

**Fix**: Parse as JSON:

```typescript
let prefs = {};
try {
  prefs = JSON.parse(req.cookies.prefs);
} catch {
  prefs = {};
}
```

---

### 4. Path Traversal (HIGH)

**Rule violated**: *Path traversal: realpath() + prefix check*

```typescript
const content = await readFile(`/uploads/${filename}`);
```

A `filename` like `../../etc/passwd` reads arbitrary files from the filesystem.

**Fix**: Resolve and verify the path stays within the uploads directory:

```typescript
import { realpath } from 'fs/promises';
import path from 'path';

const uploadsDir = '/uploads';
const resolved = await realpath(path.join(uploadsDir, filename));
if (!resolved.startsWith(uploadsDir + '/')) {
  return res.status(400).json({ error: 'Invalid filename' });
}
```

---

### 5. Blocklist-Based Validation (HIGH)

**Rule violated**: *Validate all input via schema allowlists, never blocklists*

```typescript
if (blockedExtensions.includes(filename.split('.').pop())) {
```

Two problems:
1. **Blocklist instead of allowlist** -- attackers bypass blocklists with novel extensions.
2. **`blockedExtensions` is user-supplied** from `req.body` -- the attacker controls what gets blocked, defeating the check entirely.

**Fix**: Define an allowlist server-side:

```typescript
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const ext = path.extname(filename).slice(1).toLowerCase();
if (!ALLOWED_EXTENSIONS.includes(ext)) {
  return res.status(400).json({ error: 'Unsupported file type' });
}
```

---

### 6. Missing File Upload Validation (MEDIUM)

**Rule violated**: *Validate file uploads: size, MIME type, extension*

No MIME type or file size validation is performed on the uploaded file content. Only the extension is checked (and poorly -- see finding 5).

---

### 7. Internal Error Exposure (MEDIUM)

**Rule violated**: *Never expose internal errors to clients*

```typescript
if (err) return res.status(500).json({ error: err.message });
```

`err.message` from `exec` can leak filesystem paths, command output, or system details to the attacker.

**Fix**: Log the real error server-side, return a generic message:

```typescript
if (err) {
  logger.error('Conversion failed', { error: err, filename });
  return res.status(500).json({ error: 'Conversion failed' });
}
```

---

### 8. Missing Input Schema Validation (MEDIUM)

**Rule violated**: *Validate content-type, payload size, schema on all request bodies*

No schema validation on `req.body`. The code destructures `filename`, `outputFormat`, and `blockedExtensions` without verifying types or presence, which can cause runtime crashes or unexpected behavior.

---

### 9. Missing Security Headers and Rate Limiting (LOW)

**Rules violated**:
- *Use helmet (Express)*
- *Rate limit all endpoints, stricter on auth/expensive routes*

No evidence of `helmet` middleware or rate limiting. File conversion is an expensive operation and should be rate-limited.

---

## Summary

| # | Finding | Severity | Rule |
|---|---------|----------|------|
| 1 | Command injection via `exec` | CRITICAL | Array args, never shell |
| 2 | SQL injection via string concatenation | CRITICAL | Parameterized queries only |
| 3 | RCE via `eval` on cookie | CRITICAL | Never eval untrusted data |
| 4 | Path traversal on `readFile` | HIGH | realpath() + prefix check |
| 5 | Blocklist from user input | HIGH | Allowlists, never blocklists |
| 6 | No MIME/size validation | MEDIUM | Validate uploads fully |
| 7 | Internal error message leaked | MEDIUM | Never expose internal errors |
| 8 | No request body schema validation | MEDIUM | Validate schema on all bodies |
| 9 | No helmet / rate limiting | LOW | helmet + rate limit |

**3 CRITICAL, 2 HIGH, 3 MEDIUM, 1 LOW** -- this endpoint should not ship in its current form.
