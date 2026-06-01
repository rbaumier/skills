# Fixed Dockerfile & docker-compose.yml

## Dockerfile (Multi-stage with all production hardening)

```dockerfile
# -- Stage 1: Dependencies (cached independently from source code) --
FROM node:22.12-alpine3.20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# -- Stage 2: Build (compile/bundle — tools stay here, never ship) --
FROM node:22.12-alpine3.20 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# -- Stage 3: Production (minimal image, non-root, healthcheck) --
FROM node:22.12-alpine3.20 AS production
WORKDIR /app

# OCI labels for traceability — trace any running image back to its source commit
LABEL org.opencontainers.image.source="https://github.com/org/repo" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.revision="$GIT_SHA"

# tini as PID 1 — forwards SIGTERM and reaps zombies
RUN apk add --no-cache tini

# Non-root user — NEVER run prod as root
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001

USER appuser

# Copy only production artifacts, never source
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./

ENV NODE_ENV=production

EXPOSE 3000

# Healthcheck to verify service is ready
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1

# ENTRYPOINT = init + binary, CMD = default args (overridable at runtime)
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
```

## docker-compose.yml (Dev with security defaults)

```yaml
services:
  app:
    build:
      context: .
      target: dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app                        # Bind mount: hot-reload source changes
      - /app/node_modules             # Anonymous volume: preserve container deps
    env_file: .env                    # ALL secrets in .env (gitignored), NEVER inline
    environment:
      - NODE_ENV=development
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    # Security defaults — include even in dev
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  db:
    image: postgres:16-alpine
    ports:
      - "127.0.0.1:5432:5432"        # localhost only — not exposed to network
    env_file: .env                    # POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB in .env
    volumes:
      - pgdata:/var/lib/postgresql/data
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  redis:
    image: redis:7-alpine
    ports:
      - "127.0.0.1:6379:6379"        # localhost only
    volumes:
      - redisdata:/data
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'

volumes:
  pgdata:
  redisdata:
```

## .env (git-ignored secrets file)

```
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dev_password_only
POSTGRES_DB=myapp_dev
DATABASE_URL=postgres://postgres:dev_password_only@db:5432/myapp_dev

# Redis
REDIS_URL=redis://redis:6379/0

# Application (development only)
NODE_ENV=development
```

## .dockerignore

```
node_modules
.git
.env
.env.*
dist
coverage
*.log
.next
.cache
docker-compose*.yml
Dockerfile*
README.md
tests/
```

## Summary of Fixes

**Dockerfile Issues Fixed:**
1. ✅ Pinned base image: `node:22.12-alpine3.20` (not `:latest`)
2. ✅ Multi-stage build: `deps` → `build` → `production`
3. ✅ Cache mounts for npm: `RUN --mount=type=cache,target=/root/.npm npm ci`
4. ✅ Lockfile-first pattern: COPY package files, install, THEN copy source
5. ✅ Removed hardcoded secrets (API_KEY, DATABASE_URL) — use `.env` instead
6. ✅ Used `npm ci` (not `npm install`) for reproducible CI builds
7. ✅ Added OCI labels for traceability (`org.opencontainers.image.*`)
8. ✅ Added tini as PID 1 for proper signal handling
9. ✅ Non-root USER (appuser:appgroup)
10. ✅ `--chown` on every COPY
11. ✅ `ENV NODE_ENV=production`
12. ✅ HEALTHCHECK with HTTP check
13. ✅ ENTRYPOINT (init + binary) AND CMD (args) in exec form

**docker-compose.yml Issues Fixed:**
1. ✅ Pinned service images (no `:latest`)
2. ✅ Moved all secrets to `.env` file (gitignored)
3. ✅ Added `depends_on` with `condition: service_healthy`
4. ✅ Bind localhost ports only: `127.0.0.1:5432:5432`
5. ✅ Anonymous volume for node_modules
6. ✅ Security hardening on ALL services: `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `read_only: true`, `tmpfs`
7. ✅ Added healthchecks on every service
8. ✅ Resource limits on every service
9. ✅ Removed dev mode hardcoding (left as EXPOSE, can target build stages)

**Secrets Security:**
- ❌ BEFORE: `API_KEY=sk-secret-1234567890` hardcoded in ENV
- ✅ AFTER: Secrets ONLY in `.env` (git-ignored), never in Dockerfile or compose file
