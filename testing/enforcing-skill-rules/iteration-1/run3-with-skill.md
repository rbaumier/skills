# Refactored Test Files

## Issues Identified and Fixed

1. **Manual `cleanup()` in Vitest** -- Removed. RTL cleanup is automatic with Vitest; manual `cleanup()` causes double cleanup. Replaced with `vi.restoreAllMocks()` only.
2. **`vi.mock()` hoisting with external variable** -- `mockDb` declared outside `vi.mock()` factory but referenced inside it. Because `vi.mock()` hoists to the top, `mockDb` would be `undefined`. Fixed with `vi.hoisted()`.
3. **Test-to-test dependencies** -- `sharedUser` was set in test1 and read in test2. Eliminated shared mutable state; each test has explicit, independent setup.
4. **Non-descriptive test names** -- `test1`, `test2`, `test3` renamed to describe scenario + expected outcome.
5. **`toMatchSnapshot()` usage** -- Replaced with specific value assertions (maintenance trap).
6. **`toBeTruthy()` generic matcher** -- Replaced with specific matchers (`toBe(true)`, `toHaveProperty`, etc.).
7. **Mocking internal collaborator (EmailService)** -- `EmailService` is an internal collaborator, not a boundary. Use the real implementation; only mock at boundaries (DB, network).
8. **Hardcoded test data** -- Extracted factory functions for test data creation.
9. **`page.click(selector)` deprecated** -- Replaced with `page.locator(selector).click()`.
10. **`waitForTimeout()` usage** -- Eliminated all sleep-based waits. Replaced with `waitForResponse`, `toBeVisible()`, and other event/state-based waits.
11. **CSS class/ID selectors** -- Replaced with user-centric selectors: `getByRole`, `getByLabel`, `getByText`.
12. **Real Stripe API call** -- Mocked with `page.route()` interception. Vendor downtime must never break the build.
13. **No Page Object Model** -- Extracted `ProductsPage`, `CartPage`, `CheckoutPage`, and `ConfirmationPage` page objects.
14. **Shared state between E2E tests** -- `cancel order` test depended on `checkout` test state. Made each test fully independent with its own setup.
15. **`page.$()` + `toBeNull()` assertions** -- Replaced with web-first assertions: `expect(locator).toBeVisible()` with auto-retry.
16. **UI-driven precondition setup** -- Used API seeding to create cart/order state instead of navigating through UI.

---

## Refactored Code

### `user-service.test.ts`

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

// vi.hoisted() ensures the variable is available inside the hoisted vi.mock() factory
const { mockFind } = vi.hoisted(() => ({
  mockFind: vi.fn(),
}));

vi.mock('./database', () => ({
  Database: vi.fn(() => ({ find: mockFind })),
}));

// --- Factories ---

/** Creates a user object with sensible defaults, overridable per-field. */
function createUser(overrides: Partial<{ id: number; name: string }> = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Alice',
  };
}

/** Creates an array of user objects for batch-processing tests. */
function createUsers(count: number) {
  return Array.from({ length: count }, (_, i) =>
    createUser({ id: i + 1, name: `User${i + 1}` }),
  );
}

describe('UserService', () => {
  afterEach(() => {
    // No manual cleanup() -- RTL auto-cleans in Vitest.
    vi.restoreAllMocks();
  });

  it('returns the user when found by id', async () => {
    // Arrange
    const expected = createUser({ id: 1, name: 'Alice' });
    mockFind.mockResolvedValue(expected);

    // Real EmailService -- mock only boundaries (DB is mocked above), not internal collaborators
    const service = new UserService(new Database(), new EmailService());

    // Act
    const user = await service.getUser(1);

    // Assert
    expect(user).toEqual(expected);
    expect(mockFind).toHaveBeenCalledWith(1);
  });

  it('updates the user name and returns true on success', async () => {
    // Arrange -- independent setup, no dependency on other tests
    const original = createUser({ id: 1, name: 'Alice' });
    mockFind.mockResolvedValue(original);

    const service = new UserService(new Database(), new EmailService());

    // Act
    const result = await service.updateName(1, 'Bob');

    // Assert -- specific matcher, not toBeTruthy()
    expect(result).toBe(true);
  });

  it('processes multiple users and returns transformed results', async () => {
    // Arrange
    const users = createUsers(3);
    const service = new UserService(new Database(), new EmailService());

    // Act
    const result = await service.processUsers(users);

    // Assert -- specific values, not toMatchSnapshot() (maintenance trap)
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('id', 1);
    expect(result[1]).toHaveProperty('id', 2);
    expect(result[2]).toHaveProperty('id', 3);
  });
});
```

### `checkout.page-objects.ts`

```typescript
// Page Object Model -- abstracts selectors and actions into reusable classes.
// Tests read like user stories; raw selectors never appear inline.

import { type Page, type Locator, expect } from '@playwright/test';

export class ProductsPage {
  private readonly addToCartButton: Locator;

  constructor(private page: Page) {
    this.addToCartButton = page.getByRole('button', { name: /add to cart/i });
  }

  async goto() {
    await this.page.goto('/products');
  }

  /** Add the first visible product to the cart. */
  async addFirstProductToCart() {
    await this.addToCartButton.first().click();
  }
}

export class CartPage {
  private readonly cartButton: Locator;

  constructor(private page: Page) {
    this.cartButton = page.getByRole('link', { name: /cart/i });
  }

  async open() {
    await this.cartButton.click();
    // Wait for cart content to be visible instead of sleeping
    await expect(this.page.getByRole('heading', { name: /cart/i })).toBeVisible();
  }
}

export class CheckoutPage {
  constructor(private page: Page) {}

  /** Fill shipping information using accessible label selectors. */
  async fillShipping(name: string, address: string) {
    await this.page.getByLabel('Name').fill(name);
    await this.page.getByLabel('Address').fill(address);
  }

  /** Fill payment information using accessible label selectors. */
  async fillPayment(cardNumber: string) {
    await this.page.getByLabel('Card number').fill(cardNumber);
  }

  /** Submit the order and wait for the network response (no sleep). */
  async submitOrder() {
    const responsePromise = this.page.waitForResponse('**/api/orders');
    await this.page.getByRole('button', { name: /submit order/i }).click();
    await responsePromise;
  }
}

export class ConfirmationPage {
  private readonly confirmationMessage: Locator;
  private readonly cancelledBadge: Locator;
  private readonly cancelButton: Locator;

  constructor(private page: Page) {
    this.confirmationMessage = page.getByText(/order confirmed/i);
    this.cancelledBadge = page.getByText(/cancelled/i);
    this.cancelButton = page.getByRole('button', { name: /cancel order/i });
  }

  /** Web-first assertion with auto-retry -- no page.$() + toBeNull(). */
  async expectConfirmationVisible() {
    await expect(this.confirmationMessage).toBeVisible();
  }

  async cancelOrder() {
    const responsePromise = this.page.waitForResponse('**/api/orders/*');
    await this.cancelButton.click();
    await responsePromise;
  }

  async expectCancelledBadgeVisible() {
    await expect(this.cancelledBadge).toBeVisible();
  }
}
```

### `checkout.e2e.ts`

```typescript
import { test, expect } from '@playwright/test';
import {
  ProductsPage,
  CartPage,
  CheckoutPage,
  ConfirmationPage,
} from './checkout.page-objects';

// Mock Stripe (external third-party service) -- vendor downtime must never break the build.
// Intercept via page.route() instead of hitting real https://api.stripe.com.
async function mockStripePayment(page: import('@playwright/test').Page) {
  await page.route('**/api.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: { id: 'ch_mock_123', status: 'succeeded' },
    }),
  );
}

// API seeding -- create preconditions via API, don't drive UI to set up test data.
async function seedCartWithProduct(page: import('@playwright/test').Page) {
  await page.request.post('/api/cart', {
    data: { productId: 'prod_1', quantity: 1 },
  });
}

async function seedOrderForCancellation(page: import('@playwright/test').Page): Promise<string> {
  const response = await page.request.post('/api/orders', {
    data: {
      items: [{ productId: 'prod_1', quantity: 1 }],
      shipping: { name: 'John Doe', address: '123 Main St' },
      payment: { cardNumber: '4242424242424242' },
    },
  });
  const order = await response.json();
  return order.id;
}

test.describe('Checkout', () => {
  test('completes checkout flow and shows confirmation', async ({ page }) => {
    // Arrange -- mock external services, seed data via API
    await mockStripePayment(page);
    await seedCartWithProduct(page);

    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const confirmationPage = new ConfirmationPage(page);

    // Act -- navigate to cart (data already seeded via API, no UI-driven setup)
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /cart/i })).toBeVisible();

    // Fill shipping and payment via page objects
    await checkoutPage.fillShipping('John Doe', '123 Main St');
    await checkoutPage.fillPayment('4242424242424242');
    await checkoutPage.submitOrder();

    // Assert -- web-first assertion with auto-retry
    await confirmationPage.expectConfirmationVisible();
  });

  test('cancels an existing order and shows cancelled badge', async ({ page }) => {
    // Arrange -- fully independent: seed its own order via API, no shared state
    await mockStripePayment(page);
    const orderId = await seedOrderForCancellation(page);

    const confirmationPage = new ConfirmationPage(page);

    // Act -- navigate directly to the order (API-seeded)
    await page.goto(`/orders/${orderId}`);
    await confirmationPage.cancelOrder();

    // Assert -- web-first assertion, not page.$() + toBeNull()
    await confirmationPage.expectCancelledBadgeVisible();
  });
});
```
