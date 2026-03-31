# Review: `user can complete checkout` Playwright Test

## Violations Found

### 1. Zero Sleep Policy (Section 3 — Wait Strategies)

**Rule**: "Never use arbitrary sleeps (`waitForTimeout`) — wait for explicit conditions"
**Also**: Section 5 Constraints — "MUST NOT: Use `waitForTimeout()` (use proper waits)"

The test uses `waitForTimeout` five times:

```typescript
await page.waitForTimeout(3000); // after register
await page.waitForTimeout(2000); // after login
await page.waitForTimeout(1000); // after add to cart
await page.waitForTimeout(5000); // after payment
```

**Fix**: Replace each with signal-based waits — wait for a network response or a UI state change:

```typescript
// After register submit
await page.waitForURL('/login'); // or wherever registration redirects

// After login submit
await page.waitForURL('/dashboard'); // or wherever login redirects

// After add to cart
await expect(page.getByText('Added to cart')).toBeVisible();

// After payment
await expect(page.locator('.confirmation-message')).toBeVisible();
```

---

### 2. CSS Class Selectors (Section 3 — Selection & Interaction)

**Rule**: "Prefer semantic locators (`getByRole`, `getByLabel`, `getByText`) over CSS classes or XPath"
**Also**: Section 5 Constraints — "MUST NOT: Rely on CSS class selectors (brittle)"

Every interaction uses CSS classes: `.email-input`, `.password-input`, `.submit-btn`, `.product-card`, `.add-to-cart`, `#card-number`, `.pay-btn`.

**Fix**: Use role-based or label-based selectors:

```typescript
await page.getByLabel('Email').fill('test@example.com');
await page.getByLabel('Password').fill('Test123!');
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByRole('button', { name: 'Add to cart' }).first().click();
await page.getByLabel('Card number').fill('4242424242424242');
await page.getByRole('button', { name: 'Pay' }).click();
```

---

### 3. Test Isolation — Shared State (Section 3 — Data Management + Section 5 Constraints)

**Rule**: "Each test in pristine environment (incognito context), no shared cookies/storage"
**Also**: Section 5 Constraints — "MUST NOT: Share state between tests"
**Also**: Section 1 — "No test-to-test dependencies; no shared global state"

The test runs in a shared browser context. The user confirms it fails because a previous test left items in the cart.

**Fix**: Use a fresh browser context per test (Playwright's default with `test()` already does this — the issue is likely a custom shared context). Ensure the test does not rely on or leak state:

```typescript
test('user can complete checkout', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // ... test body ...
  await context.close();
});
```

Or simply ensure `playwright.config.ts` does not override the default isolation.

---

### 4. API Seeding — Using UI for Setup (Section 3 — Data Management)

**Rule**: "Seed data via API, not UI — don't use the UI to register a user just to test login"

The test navigates to `/register` and fills out a registration form just to create a user. Registration is not the behavior under test — checkout is.

**Fix**: Seed the user via API or database fixture, then start at login (or better, inject auth state directly):

```typescript
test('user can complete checkout', async ({ page, request }) => {
  // Seed user via API
  await request.post('/api/users', {
    data: { email: 'test@example.com', password: 'Test123!' }
  });

  // Inject auth state or login via API
  const loginResponse = await request.post('/api/login', {
    data: { email: 'test@example.com', password: 'Test123!' }
  });
  // Set auth cookies/storage from response...

  // Now test the actual checkout flow
  await page.goto('/products');
  // ...
});
```

---

### 5. Deprecated `page.click()` / `page.fill()` (Section 3 — Selection & Interaction)

**Rule**: "Use `page.locator(selector).click()`, never `page.click(selector)`"

The test uses `page.click()` and `page.fill()` directly, which are deprecated Playwright APIs.

**Fix**: Use locator-based API:

```typescript
await page.locator('.pay-btn').click();
// or better, with the semantic selector fix:
await page.getByRole('button', { name: 'Pay' }).click();
```

---

### 6. No Page Object Model (Section 3 — Architecture)

**Rule**: "Abstract selectors/actions into reusable classes — tests read like user stories"

All selectors and actions are inline. Registration, login, cart, and checkout are distinct page concerns that should be abstracted.

**Fix**: Create page objects:

```typescript
// Usage in test
await checkoutPage.fillCardNumber('4242424242424242');
await checkoutPage.pay();
await checkoutPage.expectConfirmation('Order confirmed');
```

---

### 7. Mock Third-Party Services (Section 3 — Architecture)

**Rule**: "Mock third-party external services (payment gateways, analytics) to prevent vendor downtime from breaking builds"

The test submits a real card number to what appears to be an unmocked payment flow. If the payment gateway is down or rate-limits, this test fails for reasons unrelated to the application.

**Fix**: Intercept the payment API call:

```typescript
await page.route('**/api/payment', (route) =>
  route.fulfill({ status: 200, json: { status: 'confirmed', orderId: '123' } })
);
```

---

## Summary

| # | Violation | Severity |
|---|-----------|----------|
| 1 | `waitForTimeout` (5 instances) | High — primary flakiness source |
| 2 | CSS class selectors | High — brittle, breaks on styling changes |
| 3 | Shared browser context | High — root cause of the reported cart-state bug |
| 4 | UI-based user seeding | Medium — slow, fragile, not testing checkout |
| 5 | Deprecated `page.click/fill` | Medium — no auto-wait guarantees |
| 6 | No Page Object Model | Medium — maintainability |
| 7 | Unmocked payment gateway | Medium — external dependency |
