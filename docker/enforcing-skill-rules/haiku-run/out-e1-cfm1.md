# Dockerfile

```dockerfile
# -- Stage 1: Dependencies (cached independently from source code) --
FROM node:22.12-alpine3.20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# -- Stage 2: Build (compile/bundle — build tools stay here, never ship) --
FROM node:22.12-alpine3.20 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# -- Stage 3: Production (minimal image, non-root, healthcheck) --
FROM node:22.12-alpine3.20 AS production
WORKDIR /app
# OCI labels for traceability — trace any running image back to its source commit.
LABEL org.opencontainers.image.source="https://github.com/org/repo" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.revision="$GIT_SHA"
# tini as PID 1 — forwards SIGTERM and reaps zombies. apk add it, never skip it.
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
# ENTRYPOINT = the init + binary, CMD = default args (override-able at runtime).
ENTRYPOINT ["tini", "--", "node"]
CMD ["dist/server.js"]
```

# docker-compose.yml

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

# .env (gitignored)

```
DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
REDIS_URL=redis://redis:6379/0
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=app_dev
API_KEY=your_actual_key_here
```

# .dockerignore

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
