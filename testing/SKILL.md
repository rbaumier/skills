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
**Test pyramid ratios**: ~70% unit (pure logic, transforms, edge cases), ~20% integration (API contracts, DB interactions), ~10% E2E (critical user flows only). Inverting the pyramid (too many E2E, few unit) leads to slow, flaky CI. In reviews: if a project has more E2E tests than unit tests, flag the inverted pyramid
AAA pattern. One concept per test. Descriptive names (scenario + outcome). No logic in tests.
Don't test what types guarantee. Specific matchers over generic equality.
**ZOMBIES mnemonic for edge-case coverage**: Zero/empty, One, Many, Boundaries, Interfaces, Exceptions, Simple/edge. Walk through every category when designing tests for a function. Without this, you only test the happy path and miss the inputs that cause production crashes. In reviews: if a test only covers the happy path without boundary values or empty inputs, flag missing ZOMBIES coverage
Factories over fixtures. Explicit setup per test. Teardown in `finally`/`afterEach`.
Mock at boundaries only — network, filesystem, DB, time, randomness. Never mock internal collaborators.
**MSW (Mock Service Worker) for network mocking**: Use `msw` to intercept fetch/XHR at the network level instead of mocking fetch/axios directly. MSW handlers are reusable across tests, work with any HTTP client, and test real request/response cycles. Without MSW, you mock the HTTP client itself — which means switching from axios to fetch breaks all your mocks. In reviews: if you see `vi.mock('axios')` or `global.fetch = vi.fn()`, recommend MSW instead
Test public interface only. Prefer real deps (in-memory DB) for integration.
**Contract testing for API boundaries**: When your service depends on external APIs, write contract tests that verify the shape/types of responses (not values). Use MSW to intercept and validate against recorded contracts. Without contract tests, a third-party API silently changes a field name and your service breaks in production. In reviews: if integration tests call real external APIs, flag and recommend contract tests with MSW
**Flaky test triage protocol**: Run failing test 3x. If intermittent: classify as flaky. Action: quarantine (`describe.skip` or tag `@flaky`), file a ticket, fix root cause (race condition, shared state, time dependency). Never retry-and-ignore in CI — retries mask real regressions and erode trust in the suite. In reviews: if you see `retries: 3` in Playwright config without a comment explaining why, flag it

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

### Interactions
**`userEvent` over `fireEvent` in RTL**: Use `@testing-library/user-event` instead of `fireEvent` — it simulates real user interactions (typing triggers keydown/keypress/keyup/input/change, click triggers pointer events). `fireEvent.click()` dispatches a single synthetic event; `userEvent.click()` reproduces the full browser event sequence. Without `userEvent`, your tests pass but the real browser fires events your handler never saw. In reviews: if you see `fireEvent.click()` or `fireEvent.change()`, recommend `userEvent`

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
**`test.each` for data-driven tests**: When testing the same logic with multiple inputs, use `test.each` instead of duplicating test bodies. Without it, you copy-paste the same test 5 times and forget to update one. In reviews: if you see 3+ near-identical test bodies differing only in input/expected, flag and recommend `test.each`
Coverage: `vitest run --coverage`. **Coverage as a ratchet, not a target**: Set CI to fail if coverage DROPS from current baseline, not if it's below an arbitrary number. Use `thresholds: { autoUpdate: true }` in vitest config. A hardcoded `threshold = 80` blocks legitimate low-coverage code while ignoring regressions in high-coverage areas. Filter: `-t`, `--changed`, `--related`. Shard: `--shard=1/3`.
Env: `// @vitest-environment jsdom`. Types: `expectTypeOf` + `.test-d.ts`.
Load `references/vitest-*.md` as needed.

---

## 5. Playwright Quick Ref

Role-based selectors. Auto-waiting (no timeouts). Independent tests (no shared state).
POM for maintainability. Traces/screenshots for debugging. Parallel execution.
`testIdAttribute` for custom attrs. `trace: 'retain-on-failure'`.
Never: `waitForTimeout()`, CSS selectors, shared state, `first()`/`nth()` without reason.
**Visual regression testing**: Use `expect(page).toHaveScreenshot()` for visual regression instead of `toMatchSnapshot()` on HTML. Configure `maxDiffPixelRatio: 0.01` for minor anti-aliasing tolerance. Store baselines in git, update with `--update-snapshots`. Without visual assertions, a CSS change silently breaks layout and nobody notices until a user complains
Load `references/playwright-*.md` as needed.
