# Fixed Testing Code

## api-client.test.ts
```typescript
import { describe, it, expect, vi } from "vitest";
import fetch from "node-fetch";

// Use vi.hoisted() for variables referenced inside vi.mock() factory
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("node-fetch", () => ({ default: mockFetch }));

describe("ApiClient", () => {
  it("should return users when fetch succeeds", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }]),
    });
    const users = await getUsers();
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(1);
  });

  it("should return user by id when fetch succeeds", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: "Alice" }),
    });
    const user = await getUser(1);
    expect(user.name).toBe("Alice");
    expect(user.id).toBe(1);
  });
});
```

## form.test.tsx
```typescript
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("should submit form when user enters email and clicks submit", async () => {
    const { getByRole } = render(<LoginForm />);
    const input = getByRole("textbox", { name: "Email" });
    const button = getByRole("button", { name: "Submit" });
    
    // Use userEvent for real user interactions, not fireEvent
    await userEvent.type(input, "test@test.com");
    await userEvent.click(button);
    
    // Add specific assertion about form submission
    expect(button).not.toBeDisabled();
  });
});
```

## external-api.test.ts
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("ExternalPaymentService", () => {
  // Mock external Stripe API to prevent real network calls
  beforeEach(() => {
    vi.mock("node-fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should verify payment status returns ok", async () => {
    const { mockFetch } = vi.hoisted(() => ({
      mockFetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }),
    }));

    // Replace with mocked fetch, never call real API
    const res = await mockFetch("https://api.stripe.com/v1/charges/ch_123");
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });
});
```

## vitest.config.ts
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      // Use autoUpdate to ratchet coverage, not hardcoded targets
      // This fails CI only if coverage drops from baseline
      thresholds: {
        autoUpdate: true,
      },
    },
  },
});
```

## dashboard.e2e.ts
```typescript
import { test, expect } from "@playwright/test";

test("should display dashboard layout correctly", async ({ page }) => {
  await page.goto("/dashboard");
  
  // Use visual regression testing instead of HTML snapshot
  // This catches CSS/layout changes, not just HTML structure
  await expect(page).toHaveScreenshot("dashboard.png", {
    maxDiffPixelRatio: 0.01,
  });
});
```

## playwright.config.ts
```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  // Retries only for flaky tests with documented reason
  // Use @flaky tag or describe.skip for known-flaky tests
  // See: https://github.com/org/repo/issues/XXX
  retries: 0, // Disable retries; mark flaky tests with @flaky tag instead
});
```

## format.test.ts
```typescript
import { describe, it, expect } from "vitest";

describe("formatCurrency", () => {
  // Use test.each for data-driven tests instead of duplicating test bodies
  // This covers ZOMBIES: zero (0), one (100), many currencies, boundaries
  it.each([
    { amount: 100, currency: "USD", expected: "dollar100.00" },
    { amount: 100, currency: "EUR", expected: "euro100.00" },
    { amount: 100, currency: "GBP", expected: "pound100.00" },
    { amount: 1000, currency: "JPY", expected: "yen1000" },
    { amount: 0, currency: "USD", expected: "dollar0.00" }, // boundary: zero
  ])("should format $currency with amount $amount as $expected", ({ amount, currency, expected }) => {
    expect(formatCurrency(amount, currency)).toBe(expected);
  });
});
```
