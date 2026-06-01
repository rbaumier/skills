```typescript
// user-service.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserService } from './user-service';
import { EmailService } from './email-service';
import { Database } from './database';

const { mockDb } = vi.hoisted(() => ({
  mockDb: vi.fn(),
}));

vi.mock('./database', () => ({ Database: vi.fn(() => ({ find: mockDb })) }));

// Factory for test data
const makeUser = (overrides: Partial<{ id: number; name: string }> = {}) => ({
  id: 1,
  name: 'Alice',
  ...overrides,
});

describe('UserService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUser', () => {
    it('should return user when found in database', async () => {
      mockDb.mockResolvedValue(makeUser());
      const service = new UserService(new Database(), new EmailService());
      const user = await service.getUser(1);
      expect(user).toEqual(makeUser());
    });
  });

  describe('updateName', () => {
    it('should update user name and return success', async () => {
      mockDb.mockResolvedValue(makeUser());
      const service = new UserService(new Database(), new EmailService());
      const updated = await service.updateName(1, 'Bob');
      expect(updated).toBe(true);
    });

    it('should return false when update fails', async () => {
      mockDb.mockRejectedValue(new Error('DB error'));
      const service = new UserService(new Database(), new EmailService());
      const updated = await service.updateName(1, 'Bob');
      expect(updated).toBe(false);
    });
  });

  describe('processUsers', () => {
    it('should process multiple users and return array with correct length', async () => {
      const users = [{ id: 1 }, { id: 2 }, { id: 3 }];
      mockDb.mockResolvedValue(makeUser());
      const service = new UserService(new Database(), new EmailService());
      const result = await service.processUsers(users);
      expect(result).toHaveLength(3);
      expect(result.every((u: any) => u.id !== undefined)).toBe(true);
    });
  });

  describe('cache and retry configuration', () => {
    it('should initialize cache as empty', () => {
      const service = new UserService(new Database(), new EmailService());
      expect((service as any)._cache.size).toBe(0);
    });

    it('should initialize retry count to 3', () => {
      const service = new UserService(new Database(), new EmailService());
      expect((service as any)._retryCount).toBe(3);
    });
  });

  describe('user object shape', () => {
    it('should have numeric id', () => {
      const user = makeUser();
      expect(typeof user.id).toBe('number');
    });

    it('should have string name', () => {
      const user = makeUser();
      expect(typeof user.name).toBe('string');
    });
  });
});

// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});

// checkout.e2e.ts (Playwright)
import { test, expect } from '@playwright/test';

// Page Object Model - encapsulates selectors and interactions
const checkoutPage = {
  addToCart: (page) => page.getByRole('button', { name: 'Add to cart' }).click(),
  openCart: (page) => page.getByRole('link', { name: 'Cart' }).click(),
  fillShipping: async (page, { name, address }) => {
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Address').fill(address);
  },
  fillPayment: async (page, cardNumber) => {
    await page.getByLabel('Card Number').fill(cardNumber);
  },
  submitOrder: (page) => page.getByRole('button', { name: 'Submit Order' }).click(),
  cancelOrder: (page) => page.getByRole('button', { name: 'Cancel Order' }).click(),
  confirmationMessage: (page) => page.getByText('Order confirmed'),
  cancelledBadge: (page) => page.getByText('Cancelled'),
};

test('should complete checkout flow from product selection to confirmation', async ({ page }) => {
  // Navigate to products
  await page.goto('/products');
  
  // Add first product to cart
  await checkoutPage.addToCart(page);
  
  // Open cart
  await checkoutPage.openCart(page);
  
  // Fill shipping information
  await checkoutPage.fillShipping(page, {
    name: 'John Doe',
    address: '123 Main St',
  });
  
  // Fill payment information
  await checkoutPage.fillPayment(page, '4242424242424242');
  
  // Submit order - intercept Stripe call instead of hitting real API
  await page.route('**/api.stripe.com/**', route =>
    route.fulfill({ status: 200, json: { status: 'confirmed', id: 'ch_12345' } })
  );
  
  await checkoutPage.submitOrder(page);
  
  // Wait for confirmation message to be visible
  await expect(checkoutPage.confirmationMessage(page)).toBeVisible();
});

test('should mark order as cancelled when cancel button is clicked', async ({ page }) => {
  await page.goto('/products');
  
  // Cancel order
  await checkoutPage.cancelOrder(page);
  
  // Wait for cancelled badge to appear
  await expect(checkoutPage.cancelledBadge(page)).toBeVisible();
});
```
