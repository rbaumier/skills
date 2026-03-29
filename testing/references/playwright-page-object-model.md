# Page Object Model

## Basic Page Object

```typescript
// pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Log in' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async getErrorMessage() {
    return this.errorMessage.textContent();
  }
}
```

## Using Page Objects in Tests

```typescript
// tests/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('successful login redirects to dashboard', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login('user@test.com', 'password123');

  await expect(page).toHaveURL(/dashboard/);
});

test('invalid credentials show error', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login('user@test.com', 'wrongpassword');

  await expect(loginPage.errorMessage).toBeVisible();
});
```

## Custom Fixtures

```typescript
// fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('user@test.com', 'password123');
    await page.waitForURL(/dashboard/);
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

## Using Fixtures

```typescript
// tests/dashboard.spec.ts
import { test, expect } from '../fixtures';

test('shows user profile', async ({ authenticatedPage, dashboardPage }) => {
  await expect(dashboardPage.userProfile).toBeVisible();
});
```

## Component Page Objects

```typescript
// components/NavBar.ts
export class NavBar {
  constructor(private page: Page) {}

  readonly homeLink = () => this.page.getByRole('link', { name: 'Home' });
  readonly profileLink = () => this.page.getByRole('link', { name: 'Profile' });
  readonly logoutButton = () => this.page.getByRole('button', { name: 'Logout' });

  async logout() {
    await this.logoutButton().click();
  }
}

// pages/DashboardPage.ts
export class DashboardPage {
  readonly navBar: NavBar;

  constructor(private page: Page) {
    this.navBar = new NavBar(page);
  }
}
```

## Quick Reference

| Pattern | Purpose |
|---------|---------|
| Page Object | Encapsulate page interactions |
| Fixture | Share setup across tests |
| Component PO | Reusable UI components |
| Locator methods | Lazy evaluation |

| Best Practice | Reason |
|---------------|--------|
| Methods for actions | Readable tests |
| Locators as getters | Lazy evaluation |
| No assertions in PO | Flexibility |
| Fixtures for setup | DRY, maintainable |

## Alternatives to Page Object Model

### In-File `setupTestEnvironment()` Helper

When tests are simple or few, a helper function can replace full POM:

```typescript
async function setupTestEnvironment(page: Page) {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  return {
    getTitle: () => page.getByRole('heading', { level: 1 }),
    getCreateButton: () => page.getByTestId('create-button'),
  };
}

test('shows dashboard title', async ({ page }) => {
  const { getTitle } = await setupTestEnvironment(page);
  await expect(getTitle()).toHaveText('Dashboard');
});
```

### When Helpers Are Sufficient vs Full POM

- **Helpers**: 1-3 test files for a feature, few shared locators, simple setup
- **Full POM**: many test files reusing the same page interactions, complex multi-step flows, shared across team

### The Tradeoff

Helpers are simpler but don't encapsulate locators — if a selector changes, you update every helper that uses it. POM centralizes locators at the cost of more files and indirection.

### Anti-Pattern: Unused Fixtures

Fixtures that are defined but never used are dead code. Audit fixtures periodically and remove unused ones.

### Debounced Input Handling

For inputs with debounce logic (e.g., auto-save, search-as-you-type):

```typescript
await input.clear();
await input.fill('new value');
await input.blur();
await expect(input).toHaveValue('new value');
```

The `blur()` triggers the debounced save/search. Without it, the test may proceed before the debounce fires.
