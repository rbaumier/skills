---
name: docker
description: Use when writing Dockerfiles, configuring docker-compose, optimizing container images, debugging container networking, or hardening Docker security.
---

## Gotchas
- `:latest` tag = unreproducible builds. Pin exact versions: `node:22.12-alpine3.20`.
- `COPY . .` before `npm ci` = cache bust on every code change. Copy lockfile first, install, THEN copy source.
- Bind mount overwrites container's `node_modules`. Use anonymous volume trick: `- /app/node_modules`.
- `NOW()` equivalent: container time drifts if host NTP is off. Mount `/etc/localtime` read-only or set TZ env.
- `docker compose down -v` destroys named volumes. Data gone. Never use `-v` casually.
- `EXPOSE` is documentation only — does NOT publish ports. You still need `-p` or `ports:` in compose.

## Critical Rules

### Dockerfile Structure & Build

<!-- WHY multi-stage: dev dependencies (compilers, test tools) never ship to prod.
     Each stage = clean slate. Only COPY --from what you need. -->
- Multi-stage builds always. Stages: `deps` -> `build` -> `dev` -> `production`.
- Order layers by change frequency: OS deps > lockfile > install > source > build. Maximizes cache hits.
- One `RUN` per logical step. Combine related commands with `&&` to reduce layers, but keep readability.
- `COPY package.json package-lock.json ./` then `RUN npm ci` BEFORE `COPY . .` — cache dependencies layer.
- Use cache mounts for package managers:
  ```dockerfile
  # npm
  RUN --mount=type=cache,target=/root/.npm npm ci
  # pnpm
  RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
  # pip/uv
  RUN --mount=type=cache,target=/root/.cache/uv uv pip install -r requirements.txt
  ```
- `--frozen-lockfile` (pnpm/yarn) or `npm ci` — never `npm install` in CI/Docker. Lockfile is law.
- ENTRYPOINT vs CMD — use ENTRYPOINT for the binary, CMD for default args: `ENTRYPOINT ["node"]` + `CMD ["server.js"]`. Exec form `["..."]` always, never shell form `CMD node server.js` (shell form wraps in `/bin/sh -c`, breaks signal handling). Override CMD at runtime: `docker run myapp worker.js`.
- Multi-platform builds with buildx — `docker buildx build --platform linux/amd64,linux/arm64 -t myapp:v1 --push .`. Create builder: `docker buildx create --use`. For compiled languages, use cross-compilation in build stage. For interpreted languages (Node, Python), it usually just works.
- Alpine for small images. Switch to `-slim` if native deps have musl issues (psycopg2, sharp, etc.).
- Distroless images for production — use `gcr.io/distroless/nodejs22-debian12` or `gcr.io/distroless/static-debian12` as final stage. No shell, no package manager = minimal attack surface. Debug variant available: `:debug` tag adds busybox shell. When distroless is too restrictive, use `*-slim` variants.
- OCI labels for image metadata — add standard labels for traceability: `LABEL org.opencontainers.image.source="https://github.com/org/repo"`, `org.opencontainers.image.version="1.2.0"`, `org.opencontainers.image.revision="$(git rev-parse HEAD)"`. Enables `docker inspect` to trace image to source.

### Multi-Stage Build Pattern

```dockerfile
# -- Stage 1: Dependencies (cached independently from source code) --
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -- Stage 2: Dev (hot-reload, debug tools, volume-mounted source) --
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# -- Stage 3: Build (compile/bundle — tools stay here, never ship) --
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# -- Stage 4: Production (minimal image, non-root, healthcheck) --
FROM node:22-alpine AS production
WORKDIR /app
# Non-root user — NEVER run prod as root
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
USER appuser
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

**Signal handling**: Signal handling with `tini` or `dumb-init` — PID 1 in containers doesn't get default signal handling. Use `tini` as entrypoint to properly forward signals and reap zombies: `ENTRYPOINT ["tini", "--"]` then `CMD ["node", "server.js"]`. Or use `docker run --init`. Without this, SIGTERM is silently ignored = ungraceful shutdown.

```bash
```

```bash
# Target a specific stage
docker build --target dev -t myapp:dev .
docker build --target production -t myapp:prod .
```

### Docker Compose

<!-- docker-compose.yml is typically used for local dev, but always include security defaults regardless of environment. -->
- `depends_on` with `condition: service_healthy` — don't just depend, wait for READY.
- `env_file: .env` for secrets. NEVER hardcode secrets in compose file. `.env` in `.gitignore`.
- Override files: `docker-compose.override.yml` auto-loads for dev. Explicit `-f` for prod.
- Compose Watch for development (Docker Compose 2.22+) — `docker compose watch` replaces manual bind mounts with declarative file sync. Config in compose.yaml: `develop: watch: [{action: sync, path: ./src, target: /app/src}, {action: rebuild, path: package.json}]`. Auto-syncs source changes, rebuilds on dependency changes.
- Compose profiles for optional services — `profiles: [debug]` on services like debug tools, admin panels, monitoring. Start normally: `docker compose up`. Include debug tools: `docker compose --profile debug up`. Keeps default stack lean.
- Healthchecks on every service — compose uses them for dependency ordering.

```yaml
# docker-compose.yml — standard web app stack
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
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "127.0.0.1:6379:6379"        # localhost only
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
# .env (gitignored):
# DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
# REDIS_URL=redis://redis:6379/0
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=postgres
# POSTGRES_DB=app_dev
```

### Volumes & Data

<!-- Three volume types, each for a different purpose.
     Confusing them = data loss or broken dev workflows. -->
- **Named volumes** (`pgdata:/var/lib/...`): persistent data, survives `docker compose down`. Docker-managed.
- **Bind mounts** (`./src:/app/src`): dev only. Maps host dir into container for hot-reload.
- **Anonymous volumes** (`/app/node_modules`): prevents bind mount from overwriting container-generated content.
- Never store persistent data without a volume. Containers are ephemeral — restart = data gone.

### Networking

<!-- Services in same compose file share a default network.
     Use service name as hostname — Docker DNS handles resolution. -->
- Service discovery: use service names as hostnames. `db:5432` not `localhost:5432` from another container.
- Bind to `127.0.0.1` for dev-only ports: `"127.0.0.1:5432:5432"`. Prevents external access.
- Custom networks for isolation: frontend can't reach db directly if they're on different networks.
- In production: omit `ports:` entirely for internal services. Only expose through reverse proxy.

```yaml
# Network isolation: frontend cannot reach db
services:
  frontend:
    networks: [frontend-net]
  api:
    networks: [frontend-net, backend-net]
  db:
    networks: [backend-net]

networks:
  frontend-net:
  backend-net:
```

### Security

<!-- Security is not optional. Every production image must follow these rules.
     A single leaked secret in an image layer = compromised forever (layers are cached/shared). -->
- Non-root USER in production stage. Always. `RUN addgroup ... && adduser ...` then `USER appuser`.
- No secrets in Dockerfile or image layers. Not in ENV, not in COPY. Use runtime env vars or mounted secrets.
- `security_opt: [no-new-privileges:true]` — prevents privilege escalation inside container.
- `read_only: true` with explicit `tmpfs` for writable dirs — minimizes attack surface.
- `cap_drop: [ALL]` then `cap_add` only what's needed. Principle of least privilege.
- Pin base image versions. Never `:latest`. Reproducible builds = auditable builds.
- BuildKit build secrets — never `COPY` or `ARG` secrets into image layers. Use `RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci` for private registry auth. Pass secrets at build time: `docker build --secret id=npmrc,src=.npmrc`. Secrets never appear in image history.
- Image scanning in CI — run `trivy image myapp:latest` before pushing. Fail CI on HIGH/CRITICAL CVEs: `trivy image --severity HIGH,CRITICAL --exit-code 1`. For Dockerfile linting, use `hadolint Dockerfile` to catch anti-patterns before building. Both tools are fast and free.

```yaml
# Production-hardened compose service
services:
  app:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/.cache
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE            # Only if binding port < 1024
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

### .dockerignore

<!-- Same idea as .gitignore but for build context.
     Missing .dockerignore = slow builds, leaked secrets, bloated images. -->
- Always create one. Without it, COPY sends EVERYTHING to the daemon (including .git, node_modules, .env).
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

### Resource Limits

<!-- Without limits, one container can OOM the host and kill everything.
     Always set memory limits in production. -->
- Set `deploy.resources.limits` on every production service.
- Formula: `(docker_memory * 0.6) / container_count` = safe per-container limit.
- Always set limits, even in dev. Use generous values for dev (1G/1cpu), strict for prod (512M/0.5cpu).

### Debugging

```bash
# Logs
docker compose logs -f app               # Follow app logs in real-time
docker compose logs --tail=50 db          # Last 50 lines from db

# Shell into running container
docker compose exec app sh
docker compose exec db psql -U postgres

# Status and resources
docker compose ps                         # Service status
docker stats                              # Live CPU/memory per container

# Network debugging
docker compose exec app nslookup db       # DNS resolution check
docker compose exec app wget -qO- http://api:3000/health

# Rebuild
docker compose up --build                 # Rebuild images then start
docker compose build --no-cache app       # Full rebuild, no cache

# Cleanup
docker compose down                       # Stop + remove containers
docker system prune                       # Remove unused images/containers/networks
# docker compose down -v                  # DANGER: removes volumes = data loss
```

## Anti-Patterns
- `docker compose` in production without orchestrator. Use K8s, ECS, or Swarm for real deployments.
- One mega-container with all services. One process per container. Compose orchestrates the rest.
- Running as root. Always create and switch to non-root user.
- Secrets in `docker-compose.yml` or baked into image layers. Use `.env` files (gitignored) or Docker secrets.
- `npm install` instead of `npm ci` in Docker. Lockfile drift = unreproducible builds.
- Skipping healthchecks. Without them, `depends_on` only waits for container start, not service ready.
