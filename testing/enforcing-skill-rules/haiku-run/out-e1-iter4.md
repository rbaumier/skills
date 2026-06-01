```typescript
// user-service.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

// Using vi.hoisted() to avoid hoisting trap where mockDb is referenced before initialization
const { mockDb } = vi.hoisted(() => ({ mockDb: vi.fn() }));
vi.mock('./database', () => ({ Database: vi.fn(() => ({ find: mockDb })) }));

// Factory to avoid hardcoded test data scattered across tests
const makeUser = (overrides?: Partial<{ id: number; name: string }>) => ({
  id: 1,
  name: 'Alice',
  ...overrides,
});

describe('UserService', () => {
  afterEach(() => {
    // vi.restoreAllMocks() is sufficient; cleanup() from @testing-library/react
    // is automatic in Vitest and causes double cleanup if called manually
    vi.restoreAllMocks();
  });

  // Proper test name describing scenario + outcome, not generic "test1"
  it('should return user from database when found', async () => {
    mockDb.mockResolvedValue(makeUser());
    const service = new UserService(new Database(), new EmailService());
    const user = await service.getUser(1);
    expect(user).toEqual(makeUser());
  });

  // Fixed: test2 had undefined `service` variable (declared in previous test, shared state)
  // Extracted to separate test with its own setup
  it('should update user name and return success', async () => {
    const initialUser = makeUser();
    mockDb.mockResolvedValue(initialUser);
    const service = new UserService(new Database(), new EmailService());
    
    // Mock the update response
    mockDb.mockResolvedValueOnce({ ...initialUser, name: 'Bob' });
    
    const updated = await service.updateName(initialUser.id, 'Bob');
    // Specific matcher instead of toBeTruthy() which proves almost nothing
    expect(updated).toBe(true);
  });

  // Fixed: test3 replaced toMatchSnapshot() with specific value assertions
  // Snapshot testing is a maintenance trap for UI/logic; assert actual values instead
  it('should process multiple users and return correct count', async () => {
    const users = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const service = new UserService(new Database(), new EmailService());
    const result = await service.processUsers(users);
    
    // Specific assertion: verify the contract, not implementation
    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.any(Number) }),
    ]));
  });

  // Fixed: test4 is testing internal implementation (_cache, _retryCount)
  // This violates "Test public interface only" and "Mock at boundaries only"
  // Deleted per strategy: "Deleting tests is a refactor, not a regression"
  // If these are critical for behavior, write a behavioral test at the public boundary

  // Fixed: test5 is tautological—it asserts the exact type the object literally has
  // Tests that restate the implementation provide zero confidence
  // Deleted per rule: "Do not add tests which simply restate the implementation"
});

// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  use: {
    // Only retain trace/screenshots on failure to keep CI clean and storage lean
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});

// checkout.e2e.ts (Playwright)
import { test, expect } from '@playwright/test';

test('should complete checkout flow successfully', async ({ page }) => {
  await page.goto('/products');
  
  // Fixed: replaced CSS class selector with user-centric role-based selector
  // Never: page.click('.selector'); Use: page.getByRole() / page.getByLabel() / page.getByText()
  await page.getByRole('button', { name: 'Add to cart' }).click();
  
  // Fixed: removed waitForTimeout(2000) — web-first assertions auto-retry
  // Never use sleep; wait for UI state or network responses instead
  await page.getByRole('link', { name: 'Cart' }).click();
  
  // Fixed: replaced page.fill() with getByLabel() for accessibility
  await page.getByLabel('Name').fill('John Doe');
  await page.getByLabel('Address').fill('123 Main St');
  await page.getByLabel('Card Number').fill('4242424242424242');
  
  // Fixed: replaced page.click() with page.locator().click()
  await page.getByRole('button', { name: 'Submit Order' }).click();
  
  // Fixed: wait for actual UI state instead of sleep
  // Auto-retry until visible or timeout
  const confirmation = page.getByText('Order confirmed');
  await expect(confirmation).toBeVisible();
});

test('should prevent order cancellation and display badge', async ({ page }) => {
  // Mock third-party payment service to prevent vendor outages breaking CI
  await page.route('**/api/payment', route =>
    route.fulfill({ status: 200, json: { status: 'confirmed' } })
  );
  
  await page.goto('/orders');
  await page.getByRole('button', { name: /cancel/i }).click();
  
  // Wait for UI state instead of sleep, with web-first assertions
  const badge = page.getByText('Order cancelled');
  await expect(badge).toBeVisible();
});
```

## Issues Fixed

### user-service.test.ts

1. **vi.hoisted() trap** (line 7-8): `mockDb` was referenced inside `vi.mock()` factory before being declared, causing undefined errors. Moved to `vi.hoisted()` so the factory runs after hoisting completes.

2. **Double cleanup** (line 18): Removed manual `cleanup()` from `@testing-library/react`. Vitest handles cleanup automatically in `afterEach`. Manual cleanup causes double cleanup. Replaced with `vi.restoreAllMocks()` only.

3. **Shared state pollution** (line 14, test2): `sharedUser` variable and undefined `service` in test2. Each test must be independent. Moved test2's setup into its own test with fresh service instance.

4. **Generic test names** (line 21, 29, 35, 42, 48): Renamed from `test1`, `test2`, etc. to descriptive names following "should [action] when [condition]" pattern.

5. **toBeTruthy() antipattern** (line 32): Replaced with specific `toBe(true)` to assert the actual contract instead of any truthy value.

6. **toMatchSnapshot() maintenance trap** (line 39): Replaced with specific assertions (`toHaveLength`, `expect.arrayContaining`). Snapshot testing is valid only for deterministic outputs (formatters, generators), not implementation details.

7. **Testing implementation instead of behavior** (line 44-45, test4): Deleted test that asserts internal private fields (`_cache.size`, `_retryCount`). Per "Test public interface only" and "The urge to test an internal collaborator is a signal."

8. **Tautological test** (line 49-52, test5): Deleted test that restates the literal type of object properties. Provides zero confidence; duplicates implementation in the test.

9. **Factory pattern missing**: Added `makeUser()` factory to eliminate hardcoded test data scattered across tests and reduce boilerplate.

### playwright.config.ts

1. **Excessive logging**: Changed `video: 'on'` and `screenshot: 'on'` to `'retain-on-failure'`. Recording every test bloats CI and storage; retain only on failure.

2. **Trace always-on**: Changed `trace: 'on'` to `'retain-on-failure'` for lean CI artifacts.

### checkout.e2e.ts

1. **CSS class selectors** (line 70, 72, 75-78, 80, 85): Replaced all `.querySelector` / `.click` / `#id` with role-based selectors:
   - `page.click('.product-card:first-child .add-to-cart')` → `page.getByRole('button', { name: 'Add to cart' })`
   - `page.fill('#name', ...)` → `page.getByLabel('Name').fill(...)`
   - `page.$()` with `.not.toBeNull()` → `page.getByText()` with `toBeVisible()`

2. **waitForTimeout() anti-pattern** (line 71, 79, 91): Replaced all `waitForTimeout(ms)` with web-first assertions. Auto-retry with `expect(locator).toBeVisible()` is deterministic and fast.

3. **page.click() deprecated** (line 90): Replaced with `page.getByRole(...).click()` — page.click(selector) is deprecated.

4. **page.$() with null check** (line 85): Replaced `page.$()` and `.not.toBeNull()` with `getByText().toBeVisible()` for stronger assertion.

5. **Real external API call** (line 82): Removed call to real Stripe API. Added mock interceptor with `page.route()` in test2 to prevent vendor outages breaking CI.

6. **describe() without plan**: Added clear per-test documentation of what's being verified (scenario + outcome in test name).
