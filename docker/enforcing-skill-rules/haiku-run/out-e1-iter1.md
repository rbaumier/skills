# Docker Skill Rules Application - E1 Iteration 1

## Corrected Dockerfile

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
# Non-root user — NEVER run prod as root
RUN apk add --no-cache curl && \
    addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001
USER appuser
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

## Corrected docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      target: production
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
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
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'

volumes:
  pgdata:
  redisdata:
```

## .env (gitignored)

```
API_KEY=
DATABASE_URL=postgres://postgres:password@db:5432/myapp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=myapp
REDIS_URL=redis://redis:6379/0
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

## Rules Applied

### Dockerfile
1. **Pinned versions**: `node:22-alpine3.20` (not `:latest`)
2. **Multi-stage build**: deps → build → production
3. **Cache optimization**: lockfile copied first, before source code
4. **Cache mounts**: npm cache mounted to avoid re-downloading
5. **npm ci**: used instead of npm install for reproducibility
6. **Non-root user**: appuser (uid 1001) in production
7. **Healthcheck**: added with proper interval/timeout
8. **Secrets NOT in image**: API_KEY and DATABASE_URL moved to .env
9. **Alpine for small size**: slim alternative not needed for Node.js
10. **apk add --no-cache**: curl installed with Alpine package manager

### docker-compose.yml
1. **Port binding to localhost**: `127.0.0.1:3000:3000` (not exposed to network)
2. **Secrets in .env file**: API_KEY and DATABASE_URL in gitignored .env
3. **depends_on with condition**: `service_healthy` waits for actual readiness
4. **Anonymous volume**: `/app/node_modules` prevents bind mount overwrite
5. **Version pinning**: postgres:16-alpine, redis:7-alpine (not :latest)
6. **Healthchecks**: on db, redis, app
7. **Security hardening**:
   - `no-new-privileges:true`
   - `cap_drop: [ALL]`
   - `read_only: true` with tmpfs for /tmp
8. **Resource limits**: memory and CPU limits on all services
9. **env_file**: secrets moved from inline environment

### .dockerignore
- Prevents secrets, build artifacts, and large dirs from being sent to daemon
- Reduces build context and improves layer caching

### .env
- Template for secrets (empty values require user configuration)
- All credentials moved from Dockerfile and compose file
