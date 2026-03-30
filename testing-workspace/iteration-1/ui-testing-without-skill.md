# Code Review: Checkout E2E Test

## Issues Found

### 1. Hardcoded `waitForTimeout` everywhere (Critical)

Five `waitForTimeout` calls (3s, 2s, 1s, 5s) make this test slow (~11s of pure waiting) and flaky. If the server is faster, you waste time. If slower, the test fails.

**Fix**: Replace every `waitForTimeout` with an assertion that waits for the expected state:

```typescript
// Instead of: await page.waitForTimeout(3000);
await page.waitForURL('/dashboard'); // or whatever post-register redirect is
// or
await expect(page.locator('.welcome-message')).toBeVisible();
```

### 2. Shared browser state causes cross-test pollution (Critical)

The test shares context with other tests, so leftover cart items cause failures. This is the reported intermittent failure.

**Fix**: Isolate the test. Either:
- Use `test.describe` with a fresh `browser.newContext()` per test
- Clear state at the start: call an API to reset the cart, or clear cookies/localStorage via `page.context().clearCookies()`
- Use Playwright's built-in `storageState` fixture for isolation

### 3. Test does too much (Design)

Registration, login, add-to-cart, and checkout in one test. If registration breaks, you get no signal about checkout. Debugging is harder. Runtime is long.

**Fix**: Split into focused tests. Use `beforeAll` or API calls to set up preconditions (create user, seed cart) instead of driving the full UI flow every time.

### 4. CSS class selectors are brittle (Maintainability)

`.email-input`, `.submit-btn`, `.product-card:first-child .add-to-cart` -- these break when a designer renames classes. Playwright recommends user-facing or test-specific locators.

**Fix**: Use `getByRole`, `getByLabel`, `getByTestId`:

```typescript
await page.getByLabel('Email').fill('test@example.com');
await page.getByRole('button', { name: 'Submit' }).click();
```

### 5. No assertion after registration or login

The test clicks submit and waits, but never verifies that registration or login succeeded. If either silently fails, the test continues and fails later at checkout with a misleading error.

**Fix**: Assert the expected post-action state:

```typescript
await page.click('.submit-btn');
await expect(page).toHaveURL('/dashboard');
```

### 6. Hardcoded test data with no uniqueness

`test@example.com` will collide across parallel test runs or repeated runs if registration is not idempotent.

**Fix**: Generate unique emails per run:

```typescript
const email = `test+${Date.now()}@example.com`;
```

### 7. No cleanup / teardown

The test creates a user and an order but never cleans up. Over time this pollutes the test database and can cause other tests to fail.

**Fix**: Add `test.afterAll` to delete the created user/order via API, or run tests against a database that resets between suites.

## Summary

| # | Issue | Severity |
|---|-------|----------|
| 1 | `waitForTimeout` instead of proper waits | Critical -- flaky + slow |
| 2 | Shared browser state / cart pollution | Critical -- intermittent failures |
| 3 | Single mega-test instead of focused tests | Design |
| 4 | CSS class selectors instead of accessible locators | Maintainability |
| 5 | Missing assertions after register/login | Correctness |
| 6 | Hardcoded non-unique test email | Parallelism |
| 7 | No teardown / cleanup | Maintainability |
