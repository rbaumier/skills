# Fixed Test Code - All SKILL.md Rules Applied

## user-service.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

// vi.hoisted() must come before vi.mock() to avoid undefined references
const { mockDb } = vi.hoisted(() => ({
  mockDb: vi.fn(),
}));

vi.mock('./database', () => ({
  Database: vi.fn(() => ({ find: mockDb })),
}));

// Factory pattern for test data - sane defaults with per-test overrides
const makeUser = (overrides: Partial<{ id: number; name: string }> = {}) => ({
  id: 1,
  name: 'Alice',
  ...overrides,
});

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    // No cleanup() call — Vitest handles RTL cleanup automatically
    vi.clearAllMocks();
    service = new UserService(new Database(), new EmailService());
  });

  // Test 1: renamed with descriptive `should [action] when [condition]` pattern
  it('should fetch user from database when requested', async () => {
    const expectedUser = makeUser({ id: 1, name: 'Alice' });
    mockDb.mockResolvedValue(expectedUser);

    const user = await service.getUser(1);

    expect(user).toEqual(expectedUser);
  });

  // Test 2: no shared state, service created fresh in this test
  it('should update user name and return true when name changes', async () => {
    const user = makeUser({ id: 1, name: 'Alice' });
    mockDb.mockResolvedValue(user);
    const fetched = await service.getUser(1);

    const updated = await service.updateName(fetched.id, 'Bob');

    // Specific matcher instead of toBeTruthy()
    expect(updated).toBe(true);
  });

  // Test 3: assert specific output instead of snapshot
  it('should process multiple users and return count', async () => {
    const users = [makeUser({ id: 1 }), makeUser({ id: 2 }), makeUser({ id: 3 })];

    const result = await service.processUsers(users);

    // Specific assertion instead of toMatchSnapshot()
    expect(result).toEqual({ processedCount: 3, failed: 0 });
  });

  // Test 4: DELETED — testing private implementation (_cache.size, _retryCount)
  // is scaffolding. These should be tested at the boundary (behavior tests)
  // or deleted if they don't affect observable behavior.

  // Test 5: DELETED — this test asserts types (typeof), which types already guarantee.
  // Type tests belong in .test-d.ts files with expectTypeOf(), not runtime tests.
});

// Regression test example (good practice shown)
describe('UserService — regression tests', () => {
  it('should not panic on empty user list (#1234)', () => {
    // https://github.com/org/repo/issues/1234
    const service = new UserService(new Database(), new EmailService());
    expect(() => service.processUsers([])).not.toThrow();
  });
});
```

---

## playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Only capture on failure, not on every test
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
```

---

## checkout.e2e.ts (Playwright)

```typescript
import { test, expect } from '@playwright/test';

// Page Object pattern — encapsulate selectors and interactions
const checkoutPage = {
  goto: (page: any) => page.goto('/products'),
  addToCart: (page: any) =>
    page.getByRole('button', { name: /add to cart/i }).click(),
  openCart: (page: any) =>
    page.getByRole('link', { name: /cart/i }).click(),
  fillName: (page: any, name: string) =>
    page.getByLabel(/name/i).fill(name),
  fillAddress: (page: any, address: string) =>
    page.getByLabel(/address/i).fill(address),
  fillCardNumber: (page: any, card: string) =>
    page.getByLabel(/card number/i).fill(card),
  submitOrder: (page: any) =>
    page.getByRole('button', { name: /submit order/i }).click(),
  getConfirmationMessage: (page: any) =>
    page.getByRole('status', { name: /order confirmed/i }),
};

test('should complete checkout flow and show confirmation', async ({ page }) => {
  await checkoutPage.goto(page);

  // User adds product to cart
  await checkoutPage.addToCart(page);

  // Web-first assertion: auto-retry until visible (no waitForTimeout)
  await expect(checkoutPage.getConfirmationMessage(page)).toBeVisible();

  // User opens cart
  await checkoutPage.openCart(page);

  // User fills shipping info
  await checkoutPage.fillName(page, 'John Doe');
  await checkoutPage.fillAddress(page, '123 Main St');
  await checkoutPage.fillCardNumber(page, '4242424242424242');

  // User submits order
  await checkoutPage.submitOrder(page);

  // Assert confirmation is visible (auto-waits, no sleep)
  await expect(checkoutPage.getConfirmationMessage(page)).toBeVisible();
});

test('should cancel order and show cancelled badge', async ({ page }) => {
  // Mock payment gateway before navigation
  await page.route('**/api/payment', (route) =>
    route.fulfill({
      status: 200,
      json: { status: 'confirmed' },
    })
  );

  await checkoutPage.goto(page);

  // User clicks cancel
  await page.getByRole('button', { name: /cancel order/i }).click();

  // Assert badge is visible (auto-wait, no sleep)
  await expect(
    page.getByText(/order cancelled/i)
  ).toBeVisible();
});
```

---

## Summary of Changes

| Issue | Fix |
|-------|-----|
| `mockDb` undefined in factory | Wrapped in `vi.hoisted()` |
| `cleanup()` double cleanup | Removed; Vitest auto-cleans |
| `toBeTruthy()` generic matcher | Changed to `toBe(true)` |
| `test1`, `test2` poor names | Renamed to `should [action] when [condition]` |
| `sharedUser` shared state | Each test creates fresh service instance |
| `toMatchSnapshot()` maintenance trap | Replaced with specific `toEqual({ processedCount: 3, failed: 0 })` |
| Private impl tests (`_cache.size`) | Deleted; not behavior tests |
| Type tests in runtime | Deleted; belong in `.test-d.ts` with `expectTypeOf()` |
| CSS selectors `.product-card .add-to-cart` | Changed to `getByRole('button', { name: /add to cart/i })` |
| `page.click()` deprecated | Changed to `getByRole().click()` |
| CSS ID selectors `#name` | Changed to `getByLabel(/name/i)` |
| `waitForTimeout(2000)` sleep | Replaced with `expect().toBeVisible()` auto-retry |
| Real Stripe API call | Mocked with `page.route()` |
| `video: 'on'` always capture | Changed to `'retain-on-failure'` |
| No data factories | Added `makeUser()` builder with defaults |
| No Page Object | Extracted `checkoutPage` object with reusable helpers |
| No regression test pattern | Added example `describe('— regression tests')` |
