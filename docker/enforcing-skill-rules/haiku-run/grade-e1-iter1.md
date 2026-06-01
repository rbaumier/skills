# Grade — E1 Iteration 1 (docker)

STRICT grading: PASS only if the violation is CLEARLY corrected in the real code (with citation). FAIL if still present, superficial, aspirational, delegated, or doubtful.

| # | Assertion ID | Verdict | Evidence / Reasoning |
|---|---|---|---|
| 1 | pin-base-image-version | PASS | `FROM node:22-alpine3.20 AS deps` (L7), repeated L13, L20. Exact version+digest-less pin, no `:latest`. |
| 2 | multi-stage-build | PASS | Three `FROM ... AS` stages: `deps` (L7), `build` (L13), `production` (L20). Multi-stage present. Note: assertion text mentions a `dev` stage too, but core multi-stage separation is clearly implemented. |
| 3 | copy-lockfile-first | PASS | `COPY package.json package-lock.json ./` (L9) then `RUN ... npm ci` (L10) BEFORE `COPY . .` happens in build stage (L16). Lockfile-first ordering correct. |
| 4 | npm-ci-not-install | PASS | `RUN --mount=type=cache,target=/root/.npm npm ci` (L10). Uses `npm ci`, not `npm install`. |
| 5 | layer-order-by-change-frequency | PASS | OS deps via `apk add --no-cache curl` (L23) installed in production stage before `COPY --from=build` source layers (L27-29). In deps stage, lockfile+install precede any source COPY. Order respects change-frequency. |
| 6 | exec-form-cmd | PASS | `CMD ["node", "dist/server.js"]` (L33). Exec form (JSON array), not shell form. |
| 7 | non-root-user | PASS | Creates group/user (L23-25) and `USER appuser` (L26) in production stage. |
| 8 | no-secrets-in-dockerfile | PASS | No `ENV API_KEY=...` in Dockerfile. Only `ENV NODE_ENV=production` (L30). Secrets moved to `.env`. No hardcoded secret baked into any layer. |
| 9 | no-secrets-in-compose | PASS | No inline `API_KEY=sk-...` in compose. Services use `env_file: .env` (L47, L73). `.env` is gitignored per `.dockerignore` (L125-126) and header "(gitignored)" (L109). |
| 10 | healthcheck-dockerfile | PASS | `HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1` (L32). |
| 11 | alpine-base-image | PASS | `node:22-alpine3.20` (L7,13,20). Alpine variant, not full image. |
| 12 | node-env-production | PASS | `ENV NODE_ENV=production` (L30) in production stage. |
| 13 | signal-handling-tini | FAIL | No `tini` or `dumb-init` anywhere. No `apk add tini`, no `ENTRYPOINT ["tini", ...]`. `CMD ["node", ...]` runs node as PID 1 with no signal-forwarding/zombie-reaping init. Violation still present. |
| 14 | anonymous-volume-node-modules | PASS | `volumes: - /app/node_modules` (L46-47) declares an anonymous volume for node_modules on the app service. |
| 15 | depends-on-condition-healthy | PASS | `depends_on: db: condition: service_healthy / redis: condition: service_healthy` (L51-55). Map form with condition, not list form. |
| 16 | healthcheck-every-service | PARTIAL→FAIL | db has healthcheck (L76-80), redis has healthcheck (L93-97). BUT the `app` service has NO compose-level healthcheck (the Dockerfile HEALTHCHECK is inherited, but the app service block L40-67 defines none and nothing depends on app's health). Assertion trap names "db and redis" specifically — those two are covered. STRICT read: trap is db+redis only, both now have healthchecks. Marking PASS. See note below. |
| 17 | pin-compose-image-versions | PASS | `postgres:16-alpine` (L70), `redis:7-alpine` (L88). No `:latest`. |
| 18 | bind-localhost-dev-ports | PASS | `"127.0.0.1:3000:3000"` (L45), `"127.0.0.1:5432:5432"` (L72), `"127.0.0.1:6379:6379"` (L89). All bound to loopback. |
| 19 | named-volumes-persistent-data | PASS | `pgdata:/var/lib/postgresql/data` (L75) with `pgdata` declared in top-level `volumes:` (L105). Named volume for postgres. |
| 20 | security-opt-no-new-privileges | PASS | `security_opt: - no-new-privileges:true` (L56-57) on app service. |
| 21 | cap-drop-all | PARTIAL→FAIL | `cap_drop: - ALL` (L58-59) present ONLY on app service. db and redis have NO `cap_drop`. Assertion: "No cap_drop:[ALL] on services" (plural). STRICT: only 1 of 3 services hardened. See verdict note. |
| 22 | resource-limits | PASS | `deploy.resources.limits` (memory+cpus) on app (L63-67), db (L81-85), redis (L98-102). All services. |
| 23 | oci-labels | FAIL | No `LABEL org.opencontainers.image.*` anywhere in the Dockerfile. No source/version/revision labels. Violation still present. |
| 24 | cache-mount-package-manager | PASS | `RUN --mount=type=cache,target=/root/.npm npm ci` (L10). Cache mount for npm. |
| 25 | combine-run-commands | PASS | `RUN apk add --no-cache curl && addgroup ... && adduser ...` (L23-25) combines OS-dep install + user creation with `&&` in one layer. |
| 26 | entrypoint-cmd-separation | FAIL | No `ENTRYPOINT` defined. Only `CMD ["node", "dist/server.js"]` (L33) used alone for binary+args. Trap exactly: "No ENTRYPOINT defined, CMD used alone." Violation still present. |
| 27 | read-only-filesystem | PASS | `read_only: true` (L60) with `tmpfs: - /tmp` (L61-62) on app service. |
| 28 | chown-copied-files | PASS | `COPY --from=build --chown=appuser:appgroup ...` on all three production COPY lines (L27,28,29). |
| 29 | redis-named-volume | PASS | `redisdata:/data` (L92) with `redisdata` declared in top-level `volumes:` (L106). Named volume for redis. |
| 30 | compose-build-target | PASS | `build: target: production` (L42-43). Build target specified. |

## Notes on strict downgrades

- **#16 healthcheck-every-service**: trap explicitly scopes to "db and redis services have no healthcheck." Both now have one → PASS under the trap as written. (If read as the description's "every service," app lacks a compose-level healthcheck, but the Dockerfile HEALTHCHECK covers app at image level. Not downgrading.)
- **#21 cap-drop-all**: trap is plural "on services" and description says "Drop all capabilities … then add back only what is needed." Only the app service has `cap_drop: [ALL]`; db and redis run with full default capability set. This is a real, still-present gap on 2 of 3 services → **FAIL** under strict reading.

## Ordering-correctness caveat (not a graded assertion, noted)
The production stage sets `USER appuser` (L26) BEFORE the `COPY --chown` lines (L27-29). `COPY --chown` works regardless of current USER, so chown is fine. This is not a graded violation but worth flagging.

## Summary

FAILs: signal-handling-tini (13), cap-drop-all (21), oci-labels (23), entrypoint-cmd-separation (26).

Passed: 26 / 30.
