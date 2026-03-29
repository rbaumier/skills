# GitLab CI for Playwright

## Services Configuration

Use GitLab CI services for test dependencies:

```yaml
# .gitlab-ci.yml
services:
  - name: postgres:16
    alias: postgres
    variables:
      POSTGRES_DB: test_db
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
  - name: axllent/mailpit:latest
    alias: mailpit
```

## Artifact-Based Build/Test Split

Separate build and test jobs for efficiency:

```yaml
build:
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
      - node_modules/
    expire_in: 1 hour

e2e-tests:
  stage: test
  needs: [build]
  image: mcr.microsoft.com/playwright:v1.48.0-jammy
  services:
    - name: postgres:16
      alias: postgres
  variables:
    API_URL: http://localhost:3000
    DATABASE_URL: postgresql://test_user:test_password@postgres:5432/test_db
  script:
    - npx playwright test --project=chromium
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
    expire_in: 7 days
```

## Running Specific Projects in CI

Limit to a single browser in CI to save time:

```bash
npx playwright test --project=chromium
```

Use `--project` flag rather than removing projects from config (keeps local multi-browser testing).

## Dual Local/CI Infrastructure

| Concern | Local | CI |
|---------|-------|----|
| Database | `docker-compose` postgres | GitLab service |
| Email | `docker-compose` mailpit | GitLab service |
| App server | `npm run dev` (webServer config) | Built artifact + `npm start` |
| Browser | System-installed | Playwright Docker image |

## Environment Variables

```yaml
variables:
  # CI-specific
  API_URL: http://localhost:3000
  DATABASE_URL: postgresql://test_user:test_password@postgres:5432/test_db
  MAILPIT_URL: http://mailpit:8025
  CI: "true"
```

In `playwright.config.ts`, use these with fallbacks:

```typescript
use: {
  baseURL: process.env.API_URL || 'http://localhost:3000',
},
```
