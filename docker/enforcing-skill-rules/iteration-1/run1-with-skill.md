# With Skill - Run 1

## Output

Now I have both the skill rules and the prompt. Let me fix all the issues following the Docker skill rules strictly.

---

**Fixed Dockerfile:**

```dockerfile
# -- Stage 1: Dependencies (cached independently from source code) --
FROM node:22.12-alpine3.20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# -- Stage 2: Dev (hot-reload, debug tools, volume-mounted source) --
FROM node:22.12-alpine3.20 AS dev
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# -- Stage 3: Build (compile/bundle — tools stay here, never ship) --
FROM node:22.12-alpine3.20 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# -- Stage 4: Production (minimal image, non-root, healthcheck) --
FROM node:22.12-alpine3.20 AS production
WORKDIR /app
RUN apk add --no-cache wget tini
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
USER appuser
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
```

**Fixed docker-compose.yml:**

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      target: dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    env_file: .env
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://admin:admin@db:5432/myapp
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin
      POSTGRES_DB: myapp
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 5s
      timeout: 3s
      retries: 5

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

volumes:
  pgdata:
  redisdata:
```

**.dockerignore** (must exist alongside the Dockerfile):

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

---

**Issues fixed (Dockerfile):**

1. **`:latest` tag** -- pinned to `node:22.12-alpine3.20` for reproducible builds.
2. **`COPY . .` before install** -- copy lockfile first, `npm ci`, then copy source. Maximizes layer cache.
3. **`npm install`** -- replaced with `npm ci` (lockfile is law) plus cache mount.
4. **No multi-stage build** -- added 4 stages: `deps`, `dev`, `build`, `production`.
5. **`apt-get` on Alpine** -- moved to `apk add` where needed; OS deps installed before app code for layer ordering.
6. **Hardcoded secrets in ENV** -- removed `API_KEY` and `DATABASE_URL` from the image entirely. Secrets must come from runtime env vars or mounted secrets, never baked into layers.
7. **Shell form CMD** -- changed `CMD node dist/server.js` to exec form `CMD ["node", "dist/server.js"]` for proper signal handling.
8. **Running as root** -- added non-root `appuser` in production stage with `USER appuser`.
9. **No healthcheck** -- added `HEALTHCHECK` in production stage.
10. **No signal handling** -- added `tini` as ENTRYPOINT for PID 1 signal forwarding and zombie reaping.
11. **No ENTRYPOINT/CMD separation** -- split into `ENTRYPOINT ["tini", "--"]` + `CMD ["node", "dist/server.js"]`.

**Issues fixed (docker-compose.yml):**

1. **Hardcoded secrets** -- removed `API_KEY` from compose; use `env_file: .env` (gitignored) for secrets.
2. **`NODE_ENV=production` in dev compose** -- changed to `development`; compose is for local dev, not prod.
3. **`:latest` on all images** -- pinned `postgres:16-alpine` and `redis:7-alpine`.
4. **No build target** -- added `target: dev` to build the dev stage.
5. **Missing anonymous volume** -- added `- /app/node_modules` to prevent bind mount from overwriting container deps.
6. **`depends_on` without health condition** -- changed to `condition: service_healthy` so services wait for readiness, not just container start.
7. **No healthchecks on db/redis** -- added `healthcheck` blocks on both services.
8. **Ports exposed to all interfaces** -- bound db and redis to `127.0.0.1` only (`"127.0.0.1:5432:5432"`), preventing external access.
9. **No named volumes** -- added `pgdata` and `redisdata` for persistent data; without volumes, restart equals data loss.
10. **Missing `.dockerignore`** -- added to prevent sending `.git`, `node_modules`, `.env`, etc. to the build context.