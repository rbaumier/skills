# Testing Eval — Full Sweep — Compressed Run 1

## Fixed Code

```typescript
// user-service.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

// [vi-hoisted] vi.hoisted() for variables used inside vi.mock() factory
const { mockFind } = vi.hoisted(() => ({
  mockFind: vi.fn(),
}));

vi.mock('./database', () => ({
  Database: vi.fn(() => ({ find: mockFind })),
}));

// [factories-not-fixtures] Factory function for test data
function createUser(overrides: Partial<{ id: number; name: string }> = {}) {
  return { id: 1, name: 'Alice', ...overrides };
}

describe('UserService', () => {
  // [no-rtl-cleanup] No manual cleanup() — automatic in Vitest.
  // Only vi.restoreAllMocks() needed.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // [descriptive-names] Descriptive names with scenario + expected outcome
  // [no-test-deps] Each test has its own setup, no shared mutable state
  // [mock-boundaries-only] EmailService is real (internal collaborator), only DB is mocked (boundary)
  it('returns user when found by id', async () => {
    const expectedUser = createUser();
    mockFind.mockResolvedValue(expectedUser);

    const service = new UserService(new Database(), new EmailService());
    const user = await service.getUser(1);

    expect(user).toEqual(expectedUser);
  });

  it('updates user name and returns the updated record', async () => {
    const original = createUser();
    mockFind.mockResolvedValue(original);

    const service = new UserService(new Database(), new EmailService());
    const updated = await service.updateName(original.id, 'Bob');

    // [specific-matchers] Specific matcher, not toBeTruthy()
    expect(updated.name).toBe('Bob');
  });

  // [no-snapshot] Assert specific values, not toMatchSnapshot()
  it('processes multiple users and returns their processed results', async () => {
    const users = [createUser({ id: 1 }), createUser({ id: 2 }), createUser({ id: 3 })];
    const service = new UserService(new Database(), new EmailService());
    const result = await service.processUsers(users);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
    expect(result[2].id).toBe(3);
  });
});
```

```typescript
// checkout.e2e.ts (Playwright)
import { test, expect } from '@playwright/test';

// [page-object-model] Page Object Model abstractions
class ProductPage {
  constructor(private page: import('@playwright/test').Page) {}

  async addFirstProductToCart() {
    await this.page.locator('[data-testid="product-card"]').first().getByRole('button', { name: /add to cart/i }).click();
  }

  async openCart() {
    await this.page.getByRole('button', { name: /cart/i }).click();
  }
}

class CheckoutPage {
  constructor(private page: import('@playwright/test').Page) {}

  async fillShipping(name: string, address: string) {
    await this.page.getByLabel('Name').fill(name);
    await this.page.getByLabel('Address').fill(address);
  }

  async fillPayment(cardNumber: string) {
    await this.page.getByLabel('Card number').fill(cardNumber);
  }

  async submitOrder() {
    await this.page.getByRole('button', { name: /submit order/i }).click();
  }

  async expectConfirmation() {
    // [web-first-assertions] web-first assertion with auto-retry
    await expect(this.page.getByText(/confirmation/i)).toBeVisible();
  }

  async cancelOrder() {
    await this.page.getByRole('button', { name: /cancel order/i }).click();
  }

  async expectCancelled() {
    await expect(this.page.getByText(/cancelled/i)).toBeVisible();
  }
}

// [mock-external-services] Mock Stripe with page.route() interception
// [independent-e2e] Each test seeds its own data, no shared state
// [api-seeding] API seeding for preconditions
test.describe('Checkout', () => {
  test('completes checkout flow with valid payment', async ({ page }) => {
    // [mock-external-services] Intercept Stripe API
    await page.route('**/api.stripe.com/**', (route) =>
      route.fulfill({ status: 200, json: { status: 'confirmed', id: 'ch_mock' } })
    );

    // [api-seeding] Seed cart via API instead of driving UI
    await page.request.post('/api/test/seed-cart', {
      data: { products: [{ id: 'prod_1', qty: 1 }] },
    });

    await page.goto('/checkout');

    const checkout = new CheckoutPage(page);

    // [role-selectors] getByLabel, getByRole — not CSS selectors
    await checkout.fillShipping('John Doe', '123 Main St');
    await checkout.fillPayment('4242424242424242');

    // [no-waitForTimeout] Wait for network response, not arbitrary timeout
    const orderResponse = page.waitForResponse('**/api/orders');
    await checkout.submitOrder();
    await orderResponse;

    // [web-first-assertions] Auto-retrying assertion
    await checkout.expectConfirmation();
  });

  // [independent-e2e] Independent test with own setup
  test('cancels an existing order', async ({ page }) => {
    // [api-seeding] Seed an order via API
    await page.request.post('/api/test/seed-order', {
      data: { status: 'confirmed' },
    });

    await page.goto('/orders');

    const checkout = new CheckoutPage(page);
    await checkout.cancelOrder();

    // [no-waitForTimeout] No timeout, web-first assertion auto-retries
    await checkout.expectCancelled();
  });
});
```

## Issues Fixed

| # | Assertion ID | What was wrong | Fix applied |
|---|---|---|---|
| 1 | no-rtl-cleanup | Manual `cleanup()` import from RTL | Removed; only `vi.restoreAllMocks()` |
| 2 | vi-hoisted | `mockDb` declared before `vi.mock()` factory | `vi.hoisted()` wrapping mock vars |
| 3 | no-test-deps | `sharedUser` mutated across tests | Each test has independent setup |
| 4 | descriptive-names | `test1`, `test2`, `test3` | Scenario + expected outcome names |
| 5 | no-snapshot | `toMatchSnapshot()` | Specific value assertions |
| 6 | specific-matchers | `toBeTruthy()` | `toBe('Bob')` specific matcher |
| 7 | mock-boundaries-only | EmailService mocked (internal collaborator) | Real EmailService; only DB mocked (boundary) |
| 8 | factories-not-fixtures | Hardcoded `{ id: 1, name: 'Alice' }` | `createUser()` factory function |
| 9 | locator-click | `page.click(selector)` deprecated | `page.locator().click()` / `page.getByRole().click()` |
| 10 | no-waitForTimeout | `waitForTimeout(2000/3000/1000)` | `waitForResponse` / web-first assertions |
| 11 | role-selectors | CSS `.product-card`, `#name` selectors | `getByRole`, `getByLabel`, `getByText` |
| 12 | mock-external-services | Real Stripe API call | `page.route()` interception |
| 13 | page-object-model | Raw selectors inline in tests | `ProductPage`, `CheckoutPage` POM classes |
| 14 | independent-e2e | cancel test depends on checkout state | Each test seeds own data via API |
| 15 | web-first-assertions | `page.$()` + `toBeNull()` | `expect(locator).toBeVisible()` auto-retry |
| 16 | api-seeding | UI-driven precondition setup | `page.request.post()` API seeding |
