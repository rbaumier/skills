# Trust boundaries reference

The orchestrator computes which trust boundaries a diff crosses, then passes the comma-separated list (or literal `none`) as `{trust_boundaries}` into every line-anchored agent template (Correctness, Tests, Skill, Subsystem, CLAUDE.md Compliance, Occam Razor).

**Runs for Lite and Full** — boundaries don't gate `high_stakes`. A Lite diff touching `network` / `serialization` / `external-api` still gets the lens.

Union across the unified file-set (`"$DEFAULT_BRANCH"...HEAD` ∪ unstaged ∪ staged ∪ untracked). Zero or more of:
`user-input | network | filesystem | secrets | process-exec | database | auth | permissions | concurrency | external-api | serialization`.

The **Failure modes** column is the **single source of truth** for line-anchored agents when a boundary is active. Templates reference this table — they do not duplicate it.

| Boundary | Signals (path globs / imports / code patterns) | Failure modes |
|---|---|---|
| `user-input` | HTTP handlers, form parsers, CLI argv, request-body deserialization, `req.body`/`req.query`/`params` | injection (SQL/command/template), unsanitized rendering, missing length/shape validation |
| `network` | `fetch(`, `http.get(`, `axios`, `got`, `undici`, `reqwest`, raw sockets | unbounded retries, missing timeouts, leaked credentials in URLs/headers, silent failure on non-2xx |
| `filesystem` | `fs.readFile`/`writeFile`, `std::fs`, `path.join` from user input, archive extraction | path traversal, symlink races, missing `O_NOFOLLOW`, unbounded reads |
| `secrets` | `.env*`, env reads of `*_KEY`/`*_SECRET`/`*_TOKEN`, JWT secret loading, KMS/Vault | secret printed to logs/errors, secret committed to fixtures, secret in URL query string |
| `process-exec` | `child_process.exec`/`spawn`, `std::process::Command`, shell-string concatenation | shell-string concatenation, missing arg array, unescaped user input as command parts |
| `database` | ORM imports (drizzle, prisma, typeorm, sqlx, sea-orm), `db.query`/`pool.execute`, SQL templates | missing tenant/owner filter, raw SQL with interpolation, N+1, missing transaction on multi-step writes |
| `auth` | session lookup, `getSession(`, JWT verification, `bcrypt`/`argon2`, OAuth callback handlers | session fixation, missing rotation, JWT verification skipped or with wrong key, replay |
| `permissions` | role checks, RBAC predicates, `can(`/`authorize(`, policy lookups | check-then-use TOCTOU, wrong role for the operation, missing check on shared resource |
| `concurrency` | `Promise.all` with side effects, mutexes, atomics, worker threads, channels, `tokio::spawn` | unsynchronized shared state, dropped futures, non-atomic compound ops, deadlock potential |
| `external-api` | third-party SDK imports (Stripe, Twilio, S3 client, OpenAI, etc.) | missing rate-limit handling, retry-without-idempotency-key, sensitive payload not redacted |
| `serialization` | `JSON.parse` of untrusted input, `serde` derives, protobuf encode/decode, `pickle.loads`, YAML loaders | trusting parsed shape without validation, prototype pollution, deserialization of untrusted blobs |
