# Grade — testing eval 1 iter 1

Code: `out-e1-iter1.md`. STRICT: PASS only if the violation is CLEARLY corrected in the actual code (cited). FAIL on doubt or if no relevant code exists.

| # | id | verdict | evidence / why |
|---|----|---------|----------------|
| 1 | no-rtl-cleanup | PASS | No `cleanup` import (line 5 imports only `describe, it, expect, afterEach, vi`); `afterEach` keeps only `vi.restoreAllMocks()` (lines 14-16). Manual cleanup removed. |
| 2 | vi-hoisted | FAIL | Line 10 `const mockDb = vi.fn();` declared at module top, then used inside `vi.mock('./database', () => ({ Database: vi.fn(() => ({ find: mockDb })) }))` factory (line 11). This is exactly the hoisting trap — `vi.mock` is hoisted above the `const`, so `mockDb` is referenced before init. `vi.hoisted()` was NOT used. Violation not corrected. |
| 3 | no-test-deps | PASS | Each `it` block creates its own `service` and calls `mockDb.mockResolvedValue(...)` per test (lines 19, 26, 35, 43, 51). No `sharedUser` carried across tests; "update name" test re-fetches its own user (lines 26-28). |
| 4 | descriptive-names | PASS | All tests use scenario + outcome names, e.g. "should return user when getUser is called with valid id" (line 18), "should send confirmation email when user is created" (line 48). No `test1/2/3`. |
| 5 | no-snapshot | PASS | No `toMatchSnapshot()` anywhere. The former snapshot test now asserts `toHaveLength(3)` + structural check (lines 38-39). |
| 6 | specific-matchers | FAIL | Line 30 still uses `expect(updated).toBeTruthy();` — the exact generic-truthiness trap named in the assertion. Not replaced with a specific matcher. Violation persists. |
| 7 | mock-boundaries-only | PASS | `EmailService` is no longer module-mocked; it is instantiated real and only `vi.spyOn(emailService, 'send')` is used (lines 49-50). Only `Database` (a boundary) is mocked (line 11). Internal collaborator no longer mocked. |
| 8 | factories-not-fixtures | FAIL | Test data still hardcoded inline as object literals: `{ id: 1, name: 'Alice' }` (lines 19, 26, 51), `[{ id: 1 }, { id: 2 }, { id: 3 }]` (line 34). No factory function introduced. Violation not corrected. |
| 9 | locator-click | PASS | All clicks use `page.locator(...).click()` (lines 72, 73, 88, 105). No `page.click(selector)`. |
| 10 | no-waitForTimeout | PASS | No `waitForTimeout` anywhere; waits are `expect(locator).toBeVisible()` (lines 76, 91, 108). |
| 11 | role-selectors | FAIL | Assertion requires user-centric `getByRole`/`getByLabel`, not CSS. Code replaced CSS classes with `[data-testid=...]` attribute selectors (lines 72-73, 76, 88, 91-92, 105, 108) and still uses raw CSS id selectors `#name`, `#address`, `#card-number`, `#submit-order` (lines 79-81, 88). No `getByRole`/`getByLabel` used. The named trap (`#name`) literally remains (line 79). Violation not corrected. |
| 12 | mock-external-services | PASS | Stripe mocked via `page.route('**/api/stripe/**', route => route.fulfill(...))` (lines 84-86). No real Stripe call. |
| 13 | page-object-model | FAIL | No Page Object Model. Raw selectors/actions remain inline in both tests (lines 72-92, 97-108). Assertion's required abstraction absent. |
| 14 | independent-e2e | PASS | Second test starts fresh (`page.goto('/cart')`, seeds its own order via API, line 97-101). Does not depend on checkout test state. |
| 15 | web-first-assertions | PASS | Uses `await expect(page.locator(...)).toBeVisible()` (lines 76, 91, 108). No `page.$()` + `toBeNull()`. |
| 16 | api-seeding | PASS | Precondition created via `page.request.post('/api/orders', ...)` (lines 100-102), not by driving UI. |
| 17 | test-behavior-not-impl | PASS | No `(service as any)`, no `_cache`/`_retryCount` access anywhere. The former private-internals test replaced by behavior tests (error rejection line 42-46, email send line 48-55). |
| 18 | dont-test-types | PASS | No `typeof` assertions; tautological type test removed and replaced with behavior assertions. |
| 19 | trace-retain-on-failure | PASS | Config sets `trace: 'retain-on-failure'` and `screenshot: 'only-on-failure'` (lines 62-63); no `'on'`. (Video omitted entirely, acceptable.) |
