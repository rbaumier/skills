# Grade: docker e1 iter2

Grader STRICT. PASS only if the violation is CLEARLY corrected in the real code (with citation). FAIL on any doubt.

| # | Assertion ID | Verdict | Evidence / Reason |
|---|--------------|---------|-------------------|
| 1 | pin-base-image-version | PASS | All `FROM node:22-alpine3.20` (lines 7, 13, 20). No `:latest`. |
| 2 | multi-stage-build | PASS | Three stages: `AS deps` (7), `AS build` (13), `AS production` (20). |
| 3 | copy-lockfile-first | PASS | `COPY package.json package-lock.json ./` (9) then `npm ci` (10) before `COPY . .` (16, in build stage). |
| 4 | npm-ci-not-install | PASS | `npm ci` (line 10); no `npm install`. |
| 5 | layer-order-by-change-frequency | PASS | deps stage: lockfile (9) → install (10); build stage copies deps then source. Prod `apk add tini` (27) before COPY. Ordered by change frequency. |
| 6 | exec-form-cmd | PASS | `ENTRYPOINT ["tini", "--", "node"]` (37) and `CMD ["dist/server.js"]` (38), both exec form. |
| 7 | non-root-user | PASS | `addgroup`/`adduser` (29) + `USER appuser` (30) in production stage. |
| 8 | no-secrets-in-dockerfile | PASS | No `ENV API_KEY=...`. Only `ENV NODE_ENV=production` (34). Secrets removed. |
| 9 | no-secrets-in-compose | PASS | `env_file: .env` on all services (54, 79); no hardcoded `API_KEY=sk-...` in compose. |
| 10 | healthcheck-dockerfile | PASS | `HEALTHCHECK --interval=30s --timeout=3s CMD wget ...` (36) in production stage. |
| 11 | alpine-base-image | PASS | `node:22-alpine3.20` (Alpine variant), not full image. |
| 12 | node-env-production | PASS | `ENV NODE_ENV=production` (34) in production stage. |
| 13 | signal-handling-tini | PASS | `apk add --no-cache tini` (27) + `ENTRYPOINT ["tini", "--", "node"]` (37). |
| 14 | anonymous-volume-node-modules | PASS | compose app volumes: `- .:/app` then `- /app/node_modules` (52-53) anonymous volume. |
| 15 | depends-on-condition-healthy | PASS | `depends_on:` with `condition: service_healthy` for db and redis (57-61). |
| 16 | healthcheck-every-service | PASS | db healthcheck `pg_isready` (86-90), redis healthcheck `redis-cli ping` (102-106). App has HEALTHCHECK in Dockerfile. |
| 17 | pin-compose-image-versions | PASS | `postgres:16-alpine` (76), `redis:7-alpine` (93). No `:latest`. |
| 18 | bind-localhost-dev-ports | PASS | db `127.0.0.1:5432:5432` (78), redis `127.0.0.1:6379:6379` (95). |
| 19 | named-volumes-persistent-data | PASS | db `pgdata:/var/lib/postgresql/data` (81); `pgdata` declared in volumes (109). |
| 20 | security-opt-no-new-privileges | PASS | `security_opt: [no-new-privileges:true]` on app (62-63), db (82-83), redis (98-99). |
| 21 | cap-drop-all | PASS | `cap_drop: [ALL]` on app (64-65), db (84-85), redis (100-101). |
| 22 | resource-limits | FAIL | `deploy.resources.limits` only on app (69-73). db and redis have NO limits. Assertion desc: "on every production service". Not fully corrected. |
| 23 | oci-labels | PASS | `LABEL org.opencontainers.image.source/.version/.revision` (23-25). |
| 24 | cache-mount-package-manager | PASS | `RUN --mount=type=cache,target=/root/.npm npm ci` (10). |
| 25 | combine-run-commands | PASS | `npm run build && npm prune --production` (17); `addgroup ... && adduser` (29). Related commands combined. |
| 26 | entrypoint-cmd-separation | PASS | `ENTRYPOINT ["tini", "--", "node"]` (37) for binary, `CMD ["dist/server.js"]` (38) for args. |
| 27 | read-only-filesystem | PASS | `read_only: true` (66) + `tmpfs: [/tmp]` (67-68) on app. |
| 28 | chown-copied-files | PASS | `COPY --from=build --chown=appuser:appgroup ...` (31, 32, 33). |
| 29 | redis-named-volume | PASS | redis `redisdata:/data` (97); `redisdata` declared in volumes (110). |
| 30 | compose-build-target | PASS | `build:` with `target: production` (46-48). |

## Notes (not graded as fails, but flagged)
- USER appuser (30) is set BEFORE COPY (31-33); with `--chown` the copies still work, so build is valid. Not an assertion.
- App service uses bind mount `.:/app` while building `target: production` — dev/prod mix, but each individual assertion (anon volume, build target) is satisfied.

## Summary
- Passed: 29 / 30
- Failed: 1 (resource-limits — limits only on app, missing on db and redis)
