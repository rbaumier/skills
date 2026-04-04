# Eval: Full Sweep Refactoring (with skill)

## Refactored Code

### user-service.test.ts

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

// vi.hoisted() ensures variables are available inside vi.mock() factory
// (vi.mock hoists to top of file — refs declared outside hoisted scope are undefined)
const { mockFind } = vi.hoisted(() => ({
  mockFind: vi.fn(),
}));

vi.mock('./database', () => ({
  Database: vi.fn(() => ({ find: mockFind })),
}));

// --- Test data factory ---
// Centralizes test data creation; avoids hardcoded fixtures scattered across tests
function createUser(overrides: Partial<{ id: number; name: string }> = {}) {
  return { id: 1, name: 'Alice', ...overrides };
}

describe('UserService', () => {
  afterEach(() => {
    // No manual cleanup() — Vitest + RTL handles it automatically.
    // Only restore mocks to prevent cross-test leakage.
    vi.restoreAllMocks();
  });

  it('returns user by id when user exists in database', async () => {
    // Arrange — each test sets up its own data, no shared state
    const expectedUser = createUser();
    mockFind.mockResolvedValue(expectedUser);

    // Real EmailService — mock at boundaries only (DB is mocked above),
    // never mock internal collaborators like EmailService
    const service = new UserService(new Database(), new EmailService());

    // Act
    const user = await service.getUser(1);

    // Assert — specific field assertions, not snapshots
    expect(user).toHaveProperty('id', expectedUser.id);
    expect(user).toHaveProperty('name', expectedUser.name);
  });

  it('updates user name and returns the updated record', async () => {
    // Arrange — fully independent, no dependency on other tests
    const originalUser = createUser();
    const updatedUser = createUser({ name: 'Bob' });
    mockFind
      .mockResolvedValueOnce(originalUser)   // for initial lookup
      .mockResolvedValueOnce(updatedUser);    // for post-update lookup

    const service = new UserService(new Database(), new EmailService());

    // Act
    const result = await service.updateName(originalUser.id, 'Bob');

    // Assert — specific matcher, not toBeTruthy()
    expect(result).toHaveProperty('name', 'Bob');
  });

  it('processes multiple users and returns transformed results', async () => {
    // Arrange — factory-built data
    const users = [createUser({ id: 1 }), createUser({ id: 2 }), createUser({ id: 3 })];
    for (const u of users) {
      mockFind.mockResolvedValueOnce(u);
    }

    const service = new UserService(new Database(), new EmailService());

    // Act
    const result = await service.processUsers(users);

    // Assert — specific values, NOT toMatchSnapshot() (maintenance trap)
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('id', 1);
    expect(result[1]).toHaveProperty('id', 2);
    expect(result[2]).toHaveProperty('id', 3);
  });
});
```

### checkout.page.ts (Page Object Model)

```typescript
import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for Checkout flow.
 * Encapsulates all selectors and actions — tests read like user stories.
 * Raw selectors never leak into test files.
 */
export class ProductsPage {
  private readonly addToCartButton: Locator;
  private readonly cartButton: Locator;

  constructor(private readonly page: Page) {
    // Role-based selectors — user-centric, resilient to CSS changes
    this.addToCartButton = page.getByRole('button', { name: /add to cart/i });
    this.cartButton = page.getByRole('link', { name: /cart/i });
  }

  async goto() {
    await this.page.goto('/products');
  }

  async addFirstProductToCart() {
    // Use locator API — page.click() is deprecated
    await this.addToCartButton.first().click();
  }

  async openCart() {
    await this.cartButton.click();
  }
}

export class CheckoutPage {
  private readonly nameInput: Locator;
  private readonly addressInput: Locator;
  private readonly cardInput: Locator;
  private readonly submitButton: Locator;
  private readonly confirmationMessage: Locator;
  private readonly cancelButton: Locator;
  private readonly cancelledBadge: Locator;

  constructor(private readonly page: Page) {
    // User-centric selectors: getByRole / getByLabel — never CSS classes or IDs
    this.nameInput = page.getByLabel(/name/i);
    this.addressInput = page.getByLabel(/address/i);
    this.cardInput = page.getByLabel(/card number/i);
    this.submitButton = page.getByRole('button', { name: /submit order/i });
    this.confirmationMessage = page.getByRole('status', { name: /confirmation/i });
    this.cancelButton = page.getByRole('button', { name: /cancel order/i });
    this.cancelledBadge = page.getByText(/cancelled/i);
  }

  async fillShipping(name: string, address: string) {
    await this.nameInput.fill(name);
    await this.addressInput.fill(address);
  }

  async fillPayment(cardNumber: string) {
    await this.cardInput.fill(cardNumber);
  }

  async submitOrder() {
    await this.submitButton.click();
  }

  async expectConfirmationVisible() {
    // Web-first assertion — auto-retries until condition met, no sleep needed
    await expect(this.confirmationMessage).toBeVisible();
  }

  async cancelOrder() {
    await this.cancelButton.click();
  }

  async expectCancelledBadgeVisible() {
    await expect(this.cancelledBadge).toBeVisible();
  }
}
```

### checkout.e2e.ts (Playwright)

```typescript
import { test, expect } from '@playwright/test';
import { ProductsPage, CheckoutPage } from './checkout.page';

// --- Mock third-party external services ---
// Vendor downtime must never break our build. Intercept via page.route().
async function mockStripePayment(page: import('@playwright/test').Page) {
  await page.route('**/api.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'ch_mock_123', status: 'succeeded' }),
    })
  );
}

// --- API seeding helper ---
// Preconditions are set via API, not by driving UI (faster, more reliable)
async function seedCartWithProduct(request: import('@playwright/test').APIRequestContext) {
  await request.post('/api/cart', {
    data: { productId: 'prod_1', quantity: 1 },
  });
}

async function seedOrderForCancellation(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post('/api/orders', {
    data: {
      productId: 'prod_1',
      name: 'John Doe',
      address: '123 Main St',
      cardNumber: '4242424242424242',
    },
  });
  return response.json();
}

test.describe('Checkout', () => {
  // Each test is fully independent — fresh context, no shared state between tests

  test('completes checkout and shows confirmation', async ({ page, request }) => {
    // Arrange — API seeding for preconditions (don't drive UI to create test data)
    await seedCartWithProduct(request);
    await mockStripePayment(page);

    const productsPage = new ProductsPage(page);
    const checkoutPage = new CheckoutPage(page);

    // Act — navigate to cart (product already seeded via API)
    await productsPage.goto();
    await productsPage.openCart();

    // Fill shipping & payment via Page Object methods
    await checkoutPage.fillShipping('John Doe', '123 Main St');
    await checkoutPage.fillPayment('4242424242424242');
    await checkoutPage.submitOrder();

    // Assert — web-first assertion with auto-retry, zero waitForTimeout
    await checkoutPage.expectConfirmationVisible();
  });

  test('cancels an existing order and shows cancelled badge', async ({ page, request }) => {
    // Arrange — fully independent: seed its own order via API, no dependency on checkout test
    await seedOrderForCancellation(request);
    await mockStripePayment(page);

    const checkoutPage = new CheckoutPage(page);
    await page.goto('/orders/latest');

    // Act
    await checkoutPage.cancelOrder();

    // Assert — web-first assertion, auto-retries until visible
    await checkoutPage.expectCancelledBadgeVisible();
  });
});
```

---

## Changes Summary

| # | Issue | Rule Applied | Fix |
|---|-------|-------------|-----|
| 1 | `cleanup()` imported from RTL in Vitest file | Vitest auto-cleans; manual cleanup causes double cleanup | Removed `cleanup()` import; kept only `vi.restoreAllMocks()` in `afterEach` |
| 2 | `mockDb` declared outside `vi.hoisted()` but used in `vi.mock()` factory | `vi.mock()` hoists to top; variable refs inside factory are `undefined` unless via `vi.hoisted()` | Wrapped mock variable in `vi.hoisted()` |
| 3 | `sharedUser` creates test-to-test dependency (test2 depends on test1) | No test-to-test deps; explicit setup per test | Removed `sharedUser`; each test creates its own setup independently |
| 4 | Names: `test1`, `test2`, `test3` | Descriptive names with scenario + expected outcome | Renamed to describe behavior: "returns user by id when user exists in database", etc. |
| 5 | `toMatchSnapshot()` in test3 | Snapshot = maintenance trap; assert specific values instead | Replaced with specific `toHaveLength` and `toHaveProperty` assertions |
| 6 | `toBeTruthy()` in test2 | Specific matchers over generic equality/truthiness | Replaced with `toHaveProperty('name', 'Bob')` for meaningful failure messages |
| 7 | `EmailService` mocked (internal collaborator) | Mock at boundaries only (network, DB, filesystem); never internal collaborators | Used real `EmailService` instance; only `Database` is mocked (it's a boundary) |
| 8 | Hardcoded test data objects | Factories over fixtures; explicit setup per test | Created `createUser()` factory function with override support |
| 9 | `page.click(selector)` used throughout | `page.click()` deprecated; use `page.locator(selector).click()` | All interactions go through Locator API via Page Object methods |
| 10 | `waitForTimeout(2000)`, `waitForTimeout(3000)`, `waitForTimeout(1000)` | Zero sleep: never `waitForTimeout`; wait for network responses or UI state | Removed all `waitForTimeout` calls; rely on Playwright auto-waiting and web-first assertions |
| 11 | CSS class selectors: `.product-card`, `#name`, `#address`, `#card-number`, `#submit-order` | User-centric selectors: `getByRole`, `getByLabel`, `getByText` | Replaced all CSS/ID selectors with role-based and label-based selectors |
| 12 | Real Stripe API call (`api.stripe.com/v1/charges`) | Mock third-party external services; vendor downtime must never break your build | Added `page.route()` interception for Stripe API |
| 13 | Raw selectors and actions inline in tests | Page Object Model: abstract selectors/actions into reusable classes | Created `ProductsPage` and `CheckoutPage` POM classes |
| 14 | `cancel order` test depends on `checkout` test state | Independent tests with fresh context; no shared state | Each test seeds its own preconditions via API; fully independent |
| 15 | `page.$('.confirmation-message')` + `toBeNull()` | Web-first assertions: `expect(locator).toBeVisible()` with auto-retry | Replaced with `expect(locator).toBeVisible()` throughout |
| 16 | UI-driven precondition setup (navigating products, adding to cart) | API seeding for preconditions; don't drive UI to create test data | Added `seedCartWithProduct()` and `seedOrderForCancellation()` API helpers |
