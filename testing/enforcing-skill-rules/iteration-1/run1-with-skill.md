# Refactored Test Files

## Issues Found and Fixed

1. **Manual `cleanup()` in Vitest** -- RTL auto-cleans in Vitest; manual call causes double cleanup. Removed import and call; kept only `vi.restoreAllMocks()`.
2. **`vi.mock()` hoisting with external variable** -- `mockDb` declared outside factory but referenced inside it. Moved to `vi.hoisted()` so the reference survives hoisting.
3. **Test-to-test dependency** -- `test2` depended on `sharedUser` set by `test1`. Removed shared mutable state; each test sets up its own data.
4. **Non-descriptive test names** -- `test1`, `test2`, `test3` replaced with scenario + expected outcome names.
5. **`toMatchSnapshot()` maintenance trap** -- Replaced with specific value assertions.
6. **Generic `toBeTruthy()`** -- Replaced with specific matcher (`toBe(true)` or structural assertion).
7. **Mocking internal collaborator `EmailService`** -- Mock at boundaries only (DB is a boundary, EmailService is not). Use real EmailService; only mock Database.
8. **Hardcoded test data** -- Extracted factory functions for creating test users.
9. **`page.click(selector)` deprecated** -- Replaced with `page.locator(selector).click()`.
10. **`waitForTimeout()` everywhere** -- Replaced with web-first waits (`waitForResponse`, `toBeVisible()`, etc.).
11. **CSS class/ID selectors** -- Replaced with role-based and label-based selectors (`getByRole`, `getByLabel`).
12. **Real Stripe API call** -- Mocked with `page.route()` interception.
13. **No Page Object Model** -- Extracted `ProductsPage`, `CartPage`, `CheckoutPage`, `OrderPage` page objects.
14. **Shared state between E2E tests** -- Each test is fully independent with its own setup.
15. **`page.$()` + `toBeNull()`** -- Replaced with web-first assertions: `expect(locator).toBeVisible()`.
16. **UI-driven precondition setup** -- Used API seeding to create cart/order state instead of clicking through UI.

---

## `user-service.test.ts`

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

// vi.hoisted() ensures the variable is available inside the vi.mock() factory,
// which gets hoisted to the top of the file by Vitest's transform.
const { mockFind } = vi.hoisted(() => ({
  mockFind: vi.fn(),
}));

vi.mock('./database', () => ({
  Database: vi.fn(() => ({ find: mockFind })),
}));

// --- Factories: build test data with sensible defaults, override per-test ---

function createUser(overrides: Partial<{ id: number; name: string }> = {}) {
  return { id: 1, name: 'Alice', ...overrides };
}

describe('UserService', () => {
  afterEach(() => {
    // No manual cleanup() -- RTL auto-cleans in Vitest.
    // Only restore mocks to prevent cross-test leakage.
    vi.restoreAllMocks();
  });

  it('returns the user when found by id', async () => {
    const expected = createUser();
    mockFind.mockResolvedValue(expected);

    // EmailService is an internal collaborator -- use the real one.
    // Only Database (I/O boundary) is mocked.
    const service = new UserService(new Database(), new EmailService());
    const user = await service.getUser(1);

    expect(user).toEqual(expected);
  });

  it('updates the user name and returns the updated user', async () => {
    // Each test is independent -- no reliance on sharedUser from another test.
    const original = createUser();
    mockFind.mockResolvedValue(original);

    const service = new UserService(new Database(), new EmailService());
    const updated = await service.updateName(original.id, 'Bob');

    // Specific matcher: assert the exact shape, not just truthiness.
    expect(updated).toEqual(createUser({ name: 'Bob' }));
  });

  it('processes multiple users and returns their transformed results', async () => {
    const users = [createUser({ id: 1 }), createUser({ id: 2 }), createUser({ id: 3 })];
    const service = new UserService(new Database(), new EmailService());
    const result = await service.processUsers(users);

    // Specific assertions instead of toMatchSnapshot() --
    // snapshots are a maintenance trap that hide regressions.
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
    expect(result[2].id).toBe(3);
  });
});
```

---

## `checkout.e2e.ts` (Playwright)

```typescript
import { test, expect } from '@playwright/test';

// ------------------------------------------------------------------
// Page Object Model: selectors and actions live in reusable classes.
// Tests read like user stories, not DOM spelunking.
// ------------------------------------------------------------------

class ProductsPage {
  constructor(private page: import('@playwright/test').Page) {}

  async goto() {
    await this.page.goto('/products');
  }

  /** Add the first visible product to cart via its accessible button. */
  async addFirstProductToCart() {
    await this.page
      .getByRole('article')
      .first()
      .getByRole('button', { name: /add to cart/i })
      .click();
  }
}

class CartPage {
  constructor(private page: import('@playwright/test').Page) {}

  async open() {
    await this.page.getByRole('link', { name: /cart/i }).click();
    // Web-first assertion: auto-retries until the cart heading is visible.
    await expect(this.page.getByRole('heading', { name: /cart/i })).toBeVisible();
  }
}

class CheckoutPage {
  constructor(private page: import('@playwright/test').Page) {}

  async fillShipping(name: string, address: string) {
    // Role/label selectors -- never CSS IDs or classes.
    await this.page.getByLabel(/name/i).fill(name);
    await this.page.getByLabel(/address/i).fill(address);
  }

  async fillPayment(cardNumber: string) {
    await this.page.getByLabel(/card number/i).fill(cardNumber);
  }

  async submitOrder() {
    // Wait for the payment API response instead of sleeping.
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/payment') && resp.status() === 200,
    );
    await this.page.getByRole('button', { name: /submit order/i }).click();
    await responsePromise;
  }

  /** Verify the confirmation message is visible (web-first, auto-retry). */
  async expectConfirmation() {
    await expect(this.page.getByRole('status', { name: /confirmation/i })).toBeVisible();
  }
}

class OrderPage {
  constructor(private page: import('@playwright/test').Page) {}

  async cancelOrder() {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/orders') && resp.status() === 200,
    );
    await this.page.getByRole('button', { name: /cancel order/i }).click();
    await responsePromise;
  }

  async expectCancelled() {
    await expect(this.page.getByText(/cancelled/i)).toBeVisible();
  }
}

// ------------------------------------------------------------------
// Helper: mock third-party payment gateway so vendor downtime
// never breaks our build.
// ------------------------------------------------------------------

async function mockPaymentGateway(page: import('@playwright/test').Page) {
  await page.route('**/api.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'ch_mock', status: 'succeeded' }),
    }),
  );
}

// ------------------------------------------------------------------
// Helper: API seeding -- create preconditions via API, not UI clicks.
// ------------------------------------------------------------------

async function seedCartWithProduct(request: import('@playwright/test').APIRequestContext) {
  await request.post('/api/cart', {
    data: { productId: 'product-1', quantity: 1 },
  });
}

async function seedOrderForCancellation(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post('/api/orders', {
    data: {
      productId: 'product-1',
      name: 'John Doe',
      address: '123 Main St',
      card: '4242424242424242',
    },
  });
  const order = await response.json();
  return order.id as string;
}

// ------------------------------------------------------------------
// Tests -- each is fully independent, no shared state.
// ------------------------------------------------------------------

test('checkout completes and shows confirmation for a valid order', async ({ page, request }) => {
  // Mock external payment provider -- never hit real Stripe.
  await mockPaymentGateway(page);

  // API seeding: put a product in the cart without driving the UI.
  await seedCartWithProduct(request);

  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);

  await page.goto('/checkout');

  await checkout.fillShipping('John Doe', '123 Main St');
  await checkout.fillPayment('4242424242424242');
  await checkout.submitOrder();
  await checkout.expectConfirmation();
});

test('cancelling an order shows the cancelled badge', async ({ page, request }) => {
  // Fully independent: seed its own order via API, not from previous test.
  await mockPaymentGateway(page);
  const orderId = await seedOrderForCancellation(request);

  await page.goto(`/orders/${orderId}`);

  const orderPage = new OrderPage(page);
  await orderPage.cancelOrder();
  await orderPage.expectCancelled();
});
```
