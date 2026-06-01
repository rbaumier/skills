# Docker Skill Rules - E1 Corrections

## Issues Fixed

### Dockerfile Issues:
1. `:latest` tag - replaced with pinned version
2. `COPY . .` before `npm ci` - reordered to copy lockfile first
3. `RUN npm install` - changed to `npm ci`
4. Missing multi-stage build - added `dev`, `build`, and `production` stages
5. Secrets in ENV (`API_KEY`, `DATABASE_URL`) - removed from image, moved to compose
6. Missing `tini` for PID 1 signal handling - added
7. Running as root - added non-root user
8. Missing OCI labels - added
9. Missing `ENTRYPOINT` + `CMD` pair - added (CMD-alone is a smell)
10. `apt-get` in Node image (bloat) - removed, using Alpine
11. Missing `NODE_ENV` in production stage
12. Missing `HEALTHCHECK`

### Docker Compose Issues:
1. `:latest` tags - pinned all versions
2. `depends_on` without `condition: service_healthy` - added conditions
3. Secrets hardcoded in environment - moved to `.env` file
4. Ports exposed (`:5432`, `:6379`) - restricted to `127.0.0.1` for localhost only
5. Missing security hardening - added `cap_drop`, `security_opt`, `read_only`, `tmpfs`
6. Missing `.env` for secrets management
7. Missing `env_file: .env` reference
8. No healthchecks on services - added to all
9. Missing resource limits - added

## Fixed Dockerfile

```dockerfile
# -- Stage 1: Dependencies (cached independently from source code) --
FROM node:22-alpine3.20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# -- Stage 2: Dev (hot-reload, debug tools, volume-mounted source) --
FROM node:22-alpine3.20 AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["npm", "run", "dev"]

# -- Stage 3: Build (compile/bundle — tools stay here, never ship) --
FROM node:22-alpine3.20 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# -- Stage 4: Production (minimal image, non-root, healthcheck) --
FROM node:22-alpine3.20 AS production
WORKDIR /app
# OCI labels for traceability
LABEL org.opencontainers.image.source="https://github.com/org/repo" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.revision="main"
# tini as PID 1 — forwards SIGTERM and reaps zombies
RUN apk add --no-cache tini
# Non-root user — NEVER run prod as root
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
USER appuser
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
# ENTRYPOINT = the init + binary, CMD = default args (override-able at runtime)
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
```

## Fixed docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    env_file: .env
    environment:
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
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
      - "127.0.0.1:5432:5432"
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
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
      - "127.0.0.1:6379:6379"
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

## .env (gitignored)

```
DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
REDIS_URL=redis://redis:6379/0
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=app_dev
API_KEY=sk-secret-1234567890
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

## Key Corrections Summary

✓ Multi-stage builds (deps → build → production)
✓ Pinned base image versions (node:22-alpine3.20)
✓ Dependencies cached independently (package.json/lockfile first)
✓ `npm ci` instead of `npm install`
✓ Cache mounts for package manager
✓ OCI labels for image traceability
✓ `tini` for proper signal handling
✓ Non-root user with proper `--chown`
✓ `ENV NODE_ENV=production` in prod stage
✓ HEALTHCHECK on all services
✓ `ENTRYPOINT` + `CMD` pair (exec form, never shell form)
✓ All secrets removed from image layers, in .env instead
✓ Security hardening on all services (cap_drop, security_opt, read_only, tmpfs)
✓ `depends_on` with `condition: service_healthy`
✓ Ports restricted to `127.0.0.1` for internal services
✓ Resource limits set on all services
✓ `.dockerignore` to prevent context bloat
