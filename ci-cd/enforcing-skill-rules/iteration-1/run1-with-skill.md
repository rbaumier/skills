# With Skill - Run 1

## Output

Now I have the prompt. Let me analyze all the issues against the skill rules and produce the fixed YAML.

Here is the fixed CI/CD pipeline with all issues resolved:

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  # Path filtering for monorepo — only run what changed
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

  # Gate 1-3: lint, typecheck, test — run in parallel (independent, fast)
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

  # Gate 4: build — after lint, typecheck, test pass
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

  # Gate 5: integration tests — after build, only if API changed
  integration:
    runs-on: ubuntu-latest
    needs: [build, changes]
    if: needs.changes.outputs.api == 'true'
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

  # Gate 6: E2E tests — after build, only if web changed
  e2e:
    runs-on: ubuntu-latest
    needs: [build, changes]
    if: needs.changes.outputs.web == 'true'
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

  # Deploy — only on push to main, after all gates pass
  deploy-production:
    runs-on: ubuntu-latest
    needs: [build, integration, e2e]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npm run deploy:production
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
          AWS_SECRET_KEY: ${{ secrets.AWS_SECRET_KEY }}
```

```yaml
# .github/workflows/rollback.yml
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

---

**Issues fixed (17):**

1. **Hardcoded secrets in env block** (`DATABASE_URL`, `DEPLOY_TOKEN`, `AWS_SECRET_KEY`) -- moved all credentials to `${{ secrets.* }}`. This was a critical security violation; secrets must never appear in code.
2. **Global `env` block with secrets** -- removed entirely. CI never exposes secrets globally; they are scoped to the specific steps that need them.
3. **Wildcard PR trigger (`branches: ['*']`)** -- narrowed to `[main]` only. PRs should target the default branch.
4. **Unnecessary trigger branches (`develop`, `staging`)** -- removed. The skill specifies PR + push to main only.
5. **Single monolithic `pipeline` job** -- split into parallel independent jobs: `lint`, `typecheck`, `test`, then `build` after those pass, then `integration`/`e2e` after build. This follows the required gate order: `lint -> type-check -> unit tests -> build -> integration -> E2E -> security audit`.
6. **Missing `npm audit`** -- added `npm audit --audit-level=high` in the build job (security audit gate).
7. **`npm install` instead of `npm ci`** -- changed to `npm ci` for deterministic installs in CI.
8. **`actions/checkout@v3`** -- upgraded to `@v4`.
9. **`actions/setup-node@v3`** -- upgraded to `@v4`.
10. **Node 18** -- upgraded to `22` per skill standard.
11. **Missing dependency caching** -- added `cache: 'npm'` to `setup-node`.
12. **No Postgres service for integration tests** -- added service container with health checks.
13. **Missing Playwright browser install** -- added `npx playwright install --with-deps chromium`.
14. **Missing Playwright failure artifact upload** -- added `upload-artifact@v4` on failure.
15. **No monorepo path filtering** -- added `dorny/paths-filter@v3` with conditional jobs for `packages/api` and `packages/web`.
16. **Inline deploy in pipeline job** -- removed the shell conditional deploy from the pipeline; deploy is handled by the dedicated `deploy-production` job only.
17. **No rollback mechanism** -- added a separate `rollback.yml` workflow with `workflow_dispatch`.