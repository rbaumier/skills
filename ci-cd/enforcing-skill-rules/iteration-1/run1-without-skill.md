# Without Skill - Run 1

## Output

Here is the fixed CI/CD workflow:

```yaml
name: CI/CD
on:
  push:
    branches: [main, develop, staging]
  pull_request:
    branches: ['*']

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  test-unit:
    runs-on: ubuntu-latest
    needs: [lint-typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  test-integration:
    runs-on: ubuntu-latest
    needs: [lint-typecheck]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: admin
          POSTGRES_PASSWORD: ${{ secrets.TEST_DB_PASSWORD }}
          POSTGRES_DB: mydb
        ports:
          - 5432:5432
        options: >-
          --health-cmd="pg_isready -U admin -d mydb"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://admin:${{ secrets.TEST_DB_PASSWORD }}@localhost:5432/mydb

  test-e2e:
    runs-on: ubuntu-latest
    needs: [lint-typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test

  deploy-production:
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration, test-e2e]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    concurrency:
      group: deploy-production
      cancel-in-progress: false
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run deploy:production
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
          AWS_SECRET_KEY: ${{ secrets.AWS_SECRET_KEY }}
```

**Issues fixed:**

1. **Hardcoded secrets removed** -- `DATABASE_URL`, `DEPLOY_TOKEN`, `AWS_SECRET_KEY` were plaintext in `env:` block. Moved to `${{ secrets.* }}` references. The top-level `env` block with secrets is deleted entirely.

2. **Actions pinned to v4** -- `actions/checkout@v3` and `actions/setup-node@v3` upgraded to `@v4`.

3. **Node version bumped to 20** -- Node 18 is EOL; updated to 20 LTS.

4. **`npm install` replaced with `npm ci`** -- Deterministic, lockfile-based installs for CI.

5. **Added `cache: 'npm'`** -- Caches node_modules dependencies across runs.

6. **Monolithic pipeline split into parallel jobs** -- `lint-typecheck`, `test-unit`, `test-integration`, and `test-e2e` run in parallel after lint passes, reducing total pipeline time.

7. **Duplicate deploy removed** -- Production deploy existed both inline (conditional `if` in the pipeline job) and as a separate job. Consolidated into one `deploy-production` job gated on all test jobs.

8. **Integration tests get a real Postgres service** -- Added a `services.postgres` container so integration tests have an actual database instead of connecting to nothing on localhost.

9. **Playwright install step added** -- `npx playwright test` needs browsers installed; added `playwright install --with-deps chromium`.

10. **Deploy job hardened** -- Added `environment: production` (requires GitHub environment protection rules), `concurrency` group to prevent parallel deploys, explicit `permissions`, and `github.event_name == 'push'` guard to prevent deploys from PR merge events.