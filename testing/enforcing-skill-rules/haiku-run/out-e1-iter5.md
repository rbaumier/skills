```typescript
// user-service.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

// Rule: vi.hoisted() for variables referenced inside vi.mock() factory
const { mockDb } = vi.hoisted(() => ({ mockDb: vi.fn() }));
vi.mock('./database', () => ({ Database: vi.fn(() => ({ find: mockDb })) }));

// Factory for creating test users with defaults
const makeUser = (over: Partial<{ id: number; name: string }> = {}) =>
  ({ id: 1, name: 'Alice', ...over });

describe('UserService', () => {
  afterEach(() => {
    // Rule: Remove cleanup() - Vitest does automatic cleanup; manual cleanup causes double cleanup
    vi.restoreAllMocks();
  });

  // Rule: Descriptive names following "should [action] when [condition]"
  describe('getUser', () => {
    it('should return user when found in database', async () => {
      const expected = makeUser();
      mockDb.mockResolvedValue(expected);
      
      const service = new UserService(new Database(), new EmailService());
      const user = await service.getUser(1);
      
      expect(user).toEqual(expected);
    });
  });

  // Rule: Don't use shared state (sharedUser) - each test must be independent
  describe('updateName', () => {
    it('should update user name and return true when successful', async () => {
      const user = makeUser();
      mockDb.mockResolvedValue(user);
      
      const service = new UserService(new Database(), new EmailService());
      const updated = await service.updateName(user.id, 'Bob');
      
      // Rule: Specific matchers, not toBeTruthy() - assert the actual contract
      expect(updated).toBe(true);
    });

    it('should return false when user not found', async () => {
      mockDb.mockResolvedValue(null);
      
      const service = new UserService(new Database(), new EmailService());
      const updated = await service.updateName(999, 'Bob');
      
      expect(updated).toBe(false);
    });
  });

  // Rule: ZOMBIES coverage - test multiple scenarios (Zero/One/Many/Boundaries/Exceptions)
  describe('processUsers', () => {
    it('should return empty array when given empty input', async () => {
      const service = new UserService(new Database(), new EmailService());
      const result = await service.processUsers([]);
      
      expect(result).toEqual([]);
    });

    it('should process single user correctly', async () => {
      const users = [makeUser()];
      const service = new UserService(new Database(), new EmailService());
      
      const result = await service.processUsers(users);
      
      // Rule: Assert specific values instead of toMatchSnapshot()
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(users[0]);
    });

    it('should process multiple users in order', async () => {
      const users = [makeUser({ id: 1 }), makeUser({ id: 2 }), makeUser({ id: 3 })];
      const service = new UserService(new Database(), new EmailService());
      
      const result = await service.processUsers(users);
      
      expect(result).toHaveLength(3);
      expect(result.map(u => u.id)).toEqual([1, 2, 3]);
    });
  });

  // Rule: Don't test internal implementation (_cache, _retryCount)
  // These are scaffolding; test behavior via public interface instead
  // If internal state is critical, promote it to a documented public API
  
  describe('public behavior', () => {
    it('should handle concurrent requests without errors', async () => {
      const users = [makeUser({ id: 1 }), makeUser({ id: 2 })];
      mockDb.mockResolvedValue(makeUser());
      
      const service = new UserService(new Database(), new EmailService());
      
      const results = await Promise.all([
        service.getUser(1),
        service.getUser(2),
      ]);
      
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(1);
      expect(results[1].id).toBe(2);
    });
  });
});

// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Rule: Capture video/traces/screenshots on FAILURE only, not always
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

// checkout.e2e.ts (Playwright)
import { test, expect } from '@playwright/test';

test('should complete checkout flow when all steps succeed', async ({ page }) => {
  await page.goto('/products');
  
  // Rule: Use page.locator() with role-based selectors, never CSS classes
  await page.getByRole('button', { name: /add to cart/i }).first().click();
  
  // Rule: Never waitForTimeout - wait for UI state or network responses
  await page.getByRole('link', { name: /cart/i }).click();
  await page.getByRole('heading', { name: /cart/i }).isVisible();
  
  // Rule: Use getByLabel for form fields with labels, not CSS IDs
  await page.getByLabel(/name/i).fill('John Doe');
  await page.getByLabel(/address/i).fill('123 Main St');
  await page.getByLabel(/card number/i).fill('4242424242424242');
  
  // Rule: Route external API calls, don't make real requests
  await page.route('**/api.stripe.com/**', route =>
    route.fulfill({ status: 200, json: { status: 'succeeded' } })
  );
  
  await page.getByRole('button', { name: /submit/i }).click();
  
  // Rule: Wait for UI state, not arbitrary time
  await expect(page.getByText(/order confirmed/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /confirmation/i })).toBeVisible();
});

test('should show cancelled badge when user cancels order', async ({ page }) => {
  await page.goto('/orders');
  
  // Rule: Use locator with role, never CSS classes
  await page.getByRole('button', { name: /cancel/i }).first().click();
  
  // Rule: Auto-retry assertion, never waitForTimeout
  await expect(page.getByText(/cancelled/i)).toBeVisible();
});
```
