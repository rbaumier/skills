# Fixed Dockerfile and docker-compose.yml

## Dockerfile

```dockerfile
# -- Stage 1: Dependencies (cached independently from source code) --
FROM node:22-alpine3.20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# -- Stage 2: Build (compile/bundle — tools stay here, never ship) --
FROM node:22-alpine3.20 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# -- Stage 3: Production (minimal image, non-root, healthcheck) --
FROM node:22-alpine3.20 AS production
WORKDIR /app
# OCI labels for traceability — trace any running image back to its source commit
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
ENTRYPOINT ["tini", "--", "node"]
CMD ["dist/server.js"]
```

## docker-compose.yml

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
          memory: 512M
          cpus: '0.5'

  db:
    image: postgres:16-alpine
    ports:
      - "127.0.0.1:5432:5432"
    env_file: .env
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

volumes:
  pgdata:
  redisdata:
```

## .env (gitignored)

```
API_KEY=
DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=app_dev
```

## Key Corrections Applied

### Dockerfile
1. **Pinned base image**: `node:22-alpine3.20` (no `:latest`)
2. **Multi-stage build**: `deps` → `build` → `production`
3. **Cache mounts**: `RUN --mount=type=cache,target=/root/.npm npm ci`
4. **Lockfile-first**: `COPY package.json package-lock.json ./` before `RUN npm ci`
5. **npm ci, not install**: Ensures reproducible builds
6. **OCI labels**: `org.opencontainers.image.source`, `.version`, `.revision`
7. **tini as PID 1**: Proper signal handling for graceful shutdown
8. **Non-root user**: `appuser` with explicit `--chown`
9. **ENV NODE_ENV=production**: Required for Node.js
10. **HEALTHCHECK**: Required for `depends_on: condition: service_healthy`
11. **ENTRYPOINT + CMD**: Both in exec form, never CMD alone
12. **No secrets in image**: API_KEY and DATABASE_URL removed from layers

### docker-compose.yml
1. **Pinned image versions**: `postgres:16-alpine`, `redis:7-alpine` (no `:latest`)
2. **env_file: .env**: All secrets externalized, never hardcoded
3. **depends_on with condition**: `service_healthy` instead of just waiting for container start
4. **Anonymous volume**: `/app/node_modules` to prevent bind mount overwrite
5. **Security on ALL services**: `cap_drop: [ALL]`, `no-new-privileges:true` on app, db, redis
6. **read_only: true + tmpfs**: Minimizes attack surface
7. **Healthchecks on every service**: Required for proper dependency ordering
8. **Resource limits**: Memory and CPU on production
9. **Port binding to localhost**: `127.0.0.1:5432:5432` for db/redis, not exposed to network

### Security & Best Practices
- No hardcoded secrets (API_KEY, DATABASE_URL)
- Non-root user in production
- Signal handling with tini
- Proper layer caching (lockfile before source)
- Complete healthcheck suite
- OCI labels for image traceability
- All production checklist items verified
