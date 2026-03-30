---
name: testing
description: "Testing strategy, TDD, UI testing, Vitest, Playwright. Trigger on 'test', 'TDD', 'coverage', 'E2E', 'unit test', 'Vitest', 'Playwright'."
---

## Gotchas
- `vi.mock()` hoists to top — variable refs inside factory `undefined` unless via `vi.hoisted()`
- **`afterEach(cleanup)` in RTL is automatic with Vitest** — manual `cleanup()` causes double cleanup. Remove it; keep only `vi.restoreAllMocks()`. In reviews: if you see `cleanup()` imported from `@testing-library/react` in a Vitest file, flag it as unnecessary double cleanup
- `page.click(selector)` deprecated — use `page.locator(selector).click()`
- `toMatchSnapshot()` maintenance trap — assert specific values instead

---

## 1. Strategy

Test behavior not implementation. Determinism is king. Fast feedback. No test-to-test deps.
Testing Trophy: integration > unit (complex logic only) > E2E (critical paths).
AAA pattern. One concept per test. Descriptive names (scenario + outcome). No logic in tests.
Don't test what types guarantee. Specific matchers over generic equality.
Factories over fixtures. Explicit setup per test. Teardown in `finally`/`afterEach`.
Mock at boundaries only — network, filesystem, DB, time, randomness. Never mock internal collaborators.
Test public interface only. Prefer real deps (in-memory DB) for integration.

---

## 2. TDD

Vertical slices via tracer bullets. One test -> one impl -> repeat. Never all tests first.
RED: write test -> fail. GREEN: minimal code -> pass. Refactor only when GREEN.
Tests describe behavior through public interfaces. Good test survives refactor.
Load `references/tdd-*.md` as needed.

---

## 3. UI Testing

### Selectors
User-centric: `getByRole`, `getByLabel`, `getByText` — never CSS classes/XPath.
Use `page.locator(selector).click()`, never `page.click(selector)`.

### Waits
**Zero sleep**: never `waitForTimeout` — wait for network responses or UI state.
Web-first assertions: `expect(locator).toBeVisible()` (auto-retry).

### Data
API seeding — don't drive UI to create preconditions. Fresh incognito context per test.

### Architecture
**Page Object Model**: abstract selectors/actions into reusable classes — tests read like user stories. All page interactions (fill, click, assert) belong in PO methods, not inline in tests. In reviews: if you see raw selectors and actions repeated inline across tests without a Page Object abstraction, flag the missing POM pattern.

**Mock third-party external services**: payment gateways, analytics, any vendor API. Vendor downtime must never break your build. Intercept via `page.route()`:
```typescript
await page.route('**/api/payment', route =>
  route.fulfill({ status: 200, json: { status: 'confirmed' } })
);
```
In reviews: if you see a test hitting a real external service (payment, SMS, email, analytics), flag it — mock it with route interception.

### Error Handling
Capture video/traces/screenshots on failure only. Soft assertions for independent elements.

---

## 4. Vitest Quick Ref

Config: `defineConfig` from `vitest/config`. Core: `test`/`it`, `describe`, `expect`, hooks.
Mock: `vi.fn()`, `vi.mock()`, `vi.spyOn()`. Timers: `vi.useFakeTimers()`.
Use `vi.hoisted()` for vars inside `vi.mock()` factory.
Coverage: `vitest run --coverage`. Filter: `-t`, `--changed`, `--related`. Shard: `--shard=1/3`.
Env: `// @vitest-environment jsdom`. Types: `expectTypeOf` + `.test-d.ts`.
Load `references/vitest-*.md` as needed.

---

## 5. Playwright Quick Ref

Role-based selectors. Auto-waiting (no timeouts). Independent tests (no shared state).
POM for maintainability. Traces/screenshots for debugging. Parallel execution.
`testIdAttribute` for custom attrs. `trace: 'retain-on-failure'`.
Never: `waitForTimeout()`, CSS selectors, shared state, `first()`/`nth()` without reason.
Load `references/playwright-*.md` as needed.
