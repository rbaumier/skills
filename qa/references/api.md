# API harness — HTTP via Bash/curl

Send real HTTP requests and inspect the full response. The matrix rows say *what*
to test; this file is *how* to drive and capture on an HTTP API.

## Core loop per matrix row

```bash
curl -sS -i -X <METHOD> "<base>/<endpoint>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '<payload>' \
  -w '\n%{http_code} %{time_total}s\n' | tee <run-dir>/evidence/<row>.txt
```

- `-i` includes response headers; `-w` appends status + timing; `tee` saves the
  artifact.
- Assert on the **status code AND the body** — a 200 with a wrong or empty body
  is a FAIL. Check `Content-Type`, pagination headers, `Location` on creates,
  error shape on failures.

## Surface-specific levers

- **Auth** — no token, expired token, forged/tampered token, another tenant's
  token (expect 401/403, never another user's data). If a token can't be
  obtained, mark the row BLOCKED.
- **Method / route** — wrong HTTP method, unknown route (expect 404/405, never a
  500 stack trace).
- **Injection** — SQL/NoSQL/template strings in every string field; confirm they
  are rejected or neutralized, never reflected or executed.
- **Concurrency** — fire the same mutating request twice; check for duplicates,
  races, idempotency.

## GraphQL caveat

A GraphQL endpoint returns **200 even on errors**. Assert on the `errors` array
in the body, not the status code. A missing field or a resolver exception hides
inside a 200 — read the body.

## Rule

A clean 500 or an unhandled stack trace on any hostile input is a finding.
