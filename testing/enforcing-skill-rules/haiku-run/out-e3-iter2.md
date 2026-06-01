```typescript
// api-client.test.ts
import { describe, it, expect, vi } from "vitest";

// Use vi.hoisted() for variables referenced inside vi.mock() factory
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("node-fetch", () => ({ default: mockFetch }));
import fetch from "node-fetch";

describe("ApiClient", () => {
  it("should fetch users and return array", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => [{ id: 1 }] });
    const users = await getUsers();
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(1);
  });

  it("should fetch single user with name", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => ({ id: 1, name: "Alice" }) });
    const user = await getUser(1);
    expect(user.name).toBe("Alice");
    expect(user.id).toBe(1);
  });
});

// form.test.tsx
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("should submit form when user enters email and clicks submit", async () => {
    const { getByRole } = render(<LoginForm />);
    const input = getByRole("textbox", { name: "Email" });
    const button = getByRole("button", { name: "Submit" });
    
    // Fill the input first, then submit (correct order)
    await userEvent.type(input, "test@test.com");
    await userEvent.click(button);
    
    // Assert submission happened (e.g., check success message or form state change)
    const successMessage = getByRole("status", { name: /submitted/i });
    expect(successMessage).toBeVisible();
  });
});

// external-api.test.ts
import { test, expect, vi } from "vitest";
import { ExternalPaymentService } from "./payment";

describe("ExternalPaymentService", () => {
  it("should verify payment status via mocked external API", async () => {
    // Mock the fetch call instead of hitting real Stripe API
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: "ch_123", status: "succeeded" }),
      })
    ));

    const res = await fetch("https://api.stripe.com/v1/charges/ch_123");
    expect(res.ok).toBe(true);

    vi.unstubAllGlobals();
  });
});

// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    coverage: {
      // Use coverage as a ratchet: fail only if coverage DROPS from baseline
      // Never hardcode arbitrary thresholds like 80% (blocks legitimate code, misses regressions)
      thresholds: {
        autoUpdate: true,
      },
    },
  },
});

// dashboard.e2e.ts
import { test, expect } from "@playwright/test";

test("dashboard layout should display header and sidebar", async ({ page }) => {
  await page.goto("/dashboard");
  
  // Assert specific UI elements instead of snapshot matching
  // This survives CSS refactors and is more maintainable
  const header = page.getByRole("banner");
  const sidebar = page.locator("[role='navigation']");
  const mainContent = page.getByRole("main");
  
  await expect(header).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(mainContent).toBeVisible();
});

// playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  // retries: 3 only when root cause of flakiness is fixed
  // Retries mask real regressions and erode trust in the suite
  // If tests are flaky, quarantine with @flaky tag and file a ticket
  retries: 0,
  use: {
    trace: "retain-on-failure",
  },
});

// format.test.ts
import { describe, it, expect } from "vitest";

describe("formatCurrency", () => {
  // Use test.each for data-driven tests instead of duplicating test bodies
  // Reduces copy-paste errors and makes patterns visible
  it.each([
    [100, "USD", "$100.00"],
    [100, "EUR", "€100.00"],
    [100, "GBP", "£100.00"],
    [1000, "JPY", "¥1000"],
    [0, "USD", "$0.00"],
  ])(
    "should format %i %s as %s",
    (amount, currency, expected) => {
      expect(formatCurrency(amount, currency)).toBe(expected);
    }
  );
});
```
