# Fixed Code

```typescript
// user-service.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

const mockDb = vi.fn();
vi.mock('./database', () => ({ Database: vi.fn(() => ({ find: mockDb })) }));

describe('UserService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return user when getUser is called with valid id', async () => {
    mockDb.mockResolvedValue({ id: 1, name: 'Alice' });
    const service = new UserService(new Database(), new EmailService());
    const user = await service.getUser(1);
    expect(user).toEqual({ id: 1, name: 'Alice' });
  });

  it('should update user name when updateName is called with valid id', async () => {
    mockDb.mockResolvedValue({ id: 1, name: 'Alice' });
    const service = new UserService(new Database(), new EmailService());
    const user = await service.getUser(1);
    const updated = await service.updateName(user.id, 'Bob');
    expect(updated).toBeTruthy();
  });

  it('should return list of processed users with expected structure', async () => {
    const users = [{ id: 1 }, { id: 2 }, { id: 3 }];
    mockDb.mockResolvedValue(users);
    const service = new UserService(new Database(), new EmailService());
    const result = await service.processUsers(users);
    expect(result).toHaveLength(3);
    expect(result.every((u) => 'id' in u && 'processed' in u)).toBe(true);
  });

  it('should reject when getUserById is called with invalid user id', async () => {
    mockDb.mockRejectedValue(new Error('User not found'));
    const service = new UserService(new Database(), new EmailService());
    await expect(service.getUser(999)).rejects.toThrow('User not found');
  });

  it('should send confirmation email when user is created', async () => {
    const emailService = new EmailService();
    const spyEmail = vi.spyOn(emailService, 'send');
    mockDb.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' });
    const service = new UserService(new Database(), emailService);
    await service.createUser({ name: 'Alice', email: 'alice@example.com' });
    expect(spyEmail).toHaveBeenCalledWith('alice@example.com', expect.any(String));
  });
});

// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

// checkout.e2e.ts (Playwright)
import { test, expect } from '@playwright/test';

test('should complete checkout flow and display confirmation', async ({ page }) => {
  await page.goto('/products');
  await page.locator('[data-testid="product-card"]:first-child [data-testid="add-to-cart"]').click();
  await page.locator('[data-testid="cart-icon"]').click();
  
  // Wait for cart to load and verify items visible
  await expect(page.locator('[data-testid="cart-items"]')).toBeVisible();
  
  // Fill shipping form
  await page.fill('#name', 'John Doe');
  await page.fill('#address', '123 Main St');
  await page.fill('#card-number', '4242424242424242');
  
  // Mock Stripe API before submitting
  await page.route('**/api/stripe/**', (route) =>
    route.fulfill({ status: 200, json: { status: 'confirmed', id: 'ch_12345' } })
  );
  
  await page.locator('#submit-order').click();
  
  // Wait for confirmation message to appear
  await expect(page.locator('[data-testid="confirmation-message"]')).toBeVisible();
  const confirmText = await page.locator('[data-testid="confirmation-message"]').textContent();
  expect(confirmText).toContain('Order confirmed');
});

test('should display cancelled badge when order is cancelled', async ({ page }) => {
  await page.goto('/cart');
  
  // Create precondition: order exists via API, not UI automation
  await page.request.post('/api/orders', {
    data: { status: 'pending', userId: 1 }
  });
  
  await page.reload();
  await page.locator('[data-testid="cancel-order-button"]').click();
  
  // Wait for element state, not arbitrary time
  await expect(page.locator('[data-testid="cancelled-badge"]')).toBeVisible();
});
```

## Issues Fixed

### Vitest Issues
1. **Removed `cleanup()` import and call** — Vitest auto-cleans; manual cleanup causes double-cleanup errors
2. **Added `vi.restoreAllMocks()`** — proper teardown in `afterEach`
3. **Renamed tests with descriptive names** — `test1` → `should return user when getUser is called with valid id`
4. **Removed shared state** — each test creates its own service and setup
5. **Added missing service instantiation** — test2 had undefined `service`
6. **Replaced snapshot with specific assertions** — assert structure (`toHaveLength`, all have `id` and `processed`)
7. **Removed private implementation testing** — `_cache`, `_retryCount` not tested
8. **Replaced tautological test** — instead of testing type of literal, test actual behavior (email sending, error handling)

### Playwright Issues
1. **Changed trace config** — `'retain-on-failure'` instead of `'on'` (saves disk space)
2. **Added screenshot: 'only-on-failure'** — video removed (too expensive)
3. **Replaced `page.click(selector)`** with `page.locator().click()` — modern API
4. **Removed all `waitForTimeout()`** — replaced with explicit waits: `toBeVisible()`, `page.reload()`
5. **Added route interception for Stripe** — mocked external API instead of calling real service
6. **Added `[data-testid]` selectors** — proper user-centric locators instead of CSS classes
7. **Replaced `page.$()` with `page.locator()`** — modern Playwright API
8. **Moved precondition to API** — don't drive UI to create state, seed via request
9. **Removed test interdependencies** — each test stands alone
