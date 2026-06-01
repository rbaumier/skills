```typescript
// api-client.test.ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Use MSW to intercept HTTP requests at network level instead of mocking the HTTP client
const server = setupServer(
  http.get("*/users", () => HttpResponse.json([{ id: 1 }])),
  http.get("*/users/1", () => HttpResponse.json({ id: 1, name: "Alice" }))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ApiClient", () => {
  it("should fetch users and return array", async () => {
    const users = await getUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toEqual({ id: 1 });
  });

  it("should fetch single user by id", async () => {
    const user = await getUser(1);
    expect(user).toEqual({ id: 1, name: "Alice" });
  });
});

// form.test.tsx
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

// Page Object Model: encapsulate form interactions
class LoginFormPage {
  constructor(private page: ReturnType<typeof render>) {}

  async fillEmail(email: string) {
    const input = this.page.getByLabel("Email");
    await userEvent.type(input, email);
  }

  async clickSubmit() {
    const button = this.page.getByRole("button", { name: "Submit" });
    await userEvent.click(button);
  }
}

describe("LoginForm", () => {
  it("should submit form with email input", async () => {
    const page = render(<LoginForm />);
    const form = new LoginFormPage(page);
    
    await form.fillEmail("test@test.com");
    await form.clickSubmit();
    
    // Assert behavior, not implementation details
    expect(page.getByRole("button", { name: "Submit" })).toBeEnabled();
  });
});

// external-api.test.ts
import { test, expect } from "@playwright/test";

describe("ExternalPaymentService", () => {
  it("should verify payment status using intercepted request", async ({ page }) => {
    // Route the exact external service call; keep the assertion
    await page.route("**/api.stripe.com/**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ status: "confirmed" }) })
    );
    
    const res = await page.request.get("https://api.stripe.com/v1/charges/ch_123");
    expect(res.ok()).toBe(true);
  });
});

// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        // Use autoUpdate as ratchet: fail only if coverage DROPS, not if below arbitrary number
        autoUpdate: true,
      },
    },
  },
});

// dashboard.e2e.ts
import { test, expect } from "@playwright/test";

test("should render dashboard layout with correct structure", async ({ page }) => {
  await page.goto("/dashboard");
  
  // Use visual regression instead of HTML snapshot
  // Visual assertions are better for layout/styling verification
  await expect(page).toHaveScreenshot("dashboard.png", { maxDiffPixelRatio: 0.01 });
});

// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  // Never use retries to mask flaky tests; quarantine and fix root cause
  // If retries are needed, add a comment explaining why
  webServer: {
    command: "npm run dev",
    port: 3000,
  },
});

// format.test.ts
import { describe, it, expect } from "vitest";

describe("formatCurrency", () => {
  // Use test.each for data-driven tests instead of duplicating test bodies
  it.each([
    [100, "USD", "dollar100.00"],
    [100, "EUR", "euro100.00"],
    [100, "GBP", "pound100.00"],
    [1000, "JPY", "yen1000"],
    [0, "USD", "dollar0.00"],
  ])("should format %s in %s as %s", (amount, currency, expected) => {
    expect(formatCurrency(amount, currency)).toBe(expected);
  });
});
```
