---
name: ci-cd
description: CI/CD pipelines, GitHub Actions, deployment strategies, quality gates, caching, monorepo CI. Use when setting up or modifying CI pipelines, configuring GitHub Actions, adding quality gates, optimizing build times, or choosing deployment strategies.
---

## Quality Gate Pipeline

Every PR passes these gates in order. No gate is skipped — fix the failure, never disable the check.

```
lint → type-check → unit tests → build → integration → E2E → security audit → bundle size
```

Run the first four in parallel (independent, fast). Integration/E2E after build succeeds.

## GitHub Actions — Standard CI

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm test -- --coverage

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npm audit --audit-level=high
```

## Database Integration Tests

```yaml
  integration:
    runs-on: ubuntu-latest
    needs: [build]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: ci_user
          POSTGRES_PASSWORD: ${{ secrets.CI_DB_PASSWORD }}
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://ci_user:${{ secrets.CI_DB_PASSWORD }}@localhost:5432/testdb
```

Always store credentials in GitHub Secrets — even for CI-only test databases.

## E2E Tests

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

## Branch Protection Rules

Configure on the default branch (main):
- **Required status checks**: all CI jobs must pass before merge
- **Required reviews**: minimum 1 approval
- **No force-push**: prevent history rewriting
- **Auto-merge**: enable — if checks pass and approved, merge automatically

## Deployment Strategies

| Strategy | When to use | Risk | Rollback speed |
|---|---|---|---|
| **Rolling** | Stateless services, zero-downtime default | Low | Minutes |
| **Blue-green** | Need instant rollback, database-compatible changes only | Low | Seconds (swap) |
| **Canary** | Risky changes, need gradual validation with real traffic | Medium | Seconds (route shift) |
| **Recreate** | Breaking DB migrations, can tolerate brief downtime | High | Redeploy previous |

**Default to rolling.** Use canary for user-facing changes with uncertain impact. Use blue-green when you need guaranteed instant rollback. Use recreate only when the other three are impossible.

### Staged Rollout Flow

```
PR merged → staging deploy (auto) → manual verify → production deploy → monitor 15 min
                                                                         ├── errors → rollback
                                                                         └── clean → done
```

**Rollout decision thresholds** — advance, hold, or rollback:

| Signal | Advance | Hold & Investigate | Rollback immediately |
|--------|---------|-------------------|---------------------|
| Error rate | ≤ baseline | >1.5x baseline | >2x baseline |
| P95 latency | ≤ baseline +20% | >30% above baseline | >50% above baseline |
| Business metrics | Stable | Decline >2% | Decline >5% |
| Health checks | All passing | Intermittent failures | Sustained failures |

Every deployment must be reversible. Ship a rollback workflow:

```yaml
name: Rollback
on:
  workflow_dispatch:
    inputs:
      version: { description: 'Version to rollback to', required: true }
jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - run: npx vercel rollback ${{ inputs.version }}
```

## Caching Strategies

**Dependencies** — use `setup-node` with `cache: 'npm'`. Automatic, no config needed.

**Build artifacts** — cache `.next/cache`, `dist`, or framework-specific build caches:

```yaml
- uses: actions/cache@v4
  with:
    path: .next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('src/**') }}
    restore-keys: nextjs-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-
```

**Docker layers** — use `docker/build-push-action` with `cache-from: type=gha` and `cache-to: type=gha,mode=max`.

## Monorepo CI — Path Filtering

Only run jobs for packages that changed. Saves minutes on every PR.

```yaml
on:
  pull_request:
    paths:
      - 'packages/api/**'
      - 'package-lock.json'
```

For complex monorepos, use `dorny/paths-filter` to conditionally run jobs:

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api: ['packages/api/**']
            web: ['packages/web/**']

  test-api:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    # ... run API tests only
```

## CI Optimization — When Pipeline Exceeds 10 Minutes

Apply in order of impact:
1. **Cache dependencies** — `setup-node` cache option or `actions/cache`
2. **Parallelize jobs** — lint, typecheck, test as independent jobs
3. **Path filters** — skip unrelated jobs (e.g., skip E2E for docs-only PRs)
4. **Shard tests** — matrix strategy to split test suites across runners
5. **Move slow tests off critical path** — run nightly on schedule, not per-PR
6. **Larger runners** — GitHub-hosted large runners for CPU-heavy builds

## Environment Management

```
.env.example   → committed (template)
.env           → NOT committed (local dev)
.env.test      → committed (test env, no real secrets)
CI secrets     → GitHub Secrets
Prod secrets   → deployment platform vault
```

CI never has production secrets. Separate secrets per environment.

## Verification Checklist

After setting up or modifying CI:
- All quality gates present (lint, types, tests, build, audit)
- Pipeline runs on every PR and push to main
- Failures block merge (branch protection configured)
- Secrets in secrets manager, not in code
- Deployment has a rollback mechanism
- Pipeline completes in under 10 minutes
