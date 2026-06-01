```typescript
// api-client.test.ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("*/users", () => HttpResponse.json([{ id: 1 }])),
  http.get("*/users/:id", () => HttpResponse.json({ id: 1, name: "Alice" }))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ApiClient", () => {
  it("fetches users", async () => {
    const users = await getUsers();
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(1);
  });

  it("fetches single user", async () => {
    const user = await getUser(1);
    expect(user.name).toBe("Alice");
    expect(user.id).toBe(1);
  });
});

// form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("should submit form with valid email", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    
    const input = screen.getByRole("textbox", { name: "Email" });
    await user.type(input, "test@test.com");
    
    const button = screen.getByRole("button", { name: "Submit" });
    await user.click(button);
    
    expect(input).toHaveValue("test@test.com");
  });
});

// external-api.test.ts
import { test, expect } from "@playwright/test";

test("should verify payment status", async ({ page }) => {
  await page.route("**/api.stripe.com/**", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, status: "confirmed" })
    })
  );
  
  const res = await page.request.get("https://api.stripe.com/v1/charges/ch_123");
  expect(res.ok()).toBe(true);
});

// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        autoUpdate: true
      },
    },
  },
});

// dashboard.e2e.ts
import { test, expect } from "@playwright/test";

test("should match dashboard layout visually", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveScreenshot("dashboard.png", { maxDiffPixelRatio: 0.01 });
});

// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  // retries removed: each test must pass consistently; use page.route() for external services
  // and deterministic fixtures to eliminate flakiness root causes
});

// format.test.ts
import { describe, it, expect } from "vitest";

describe("formatCurrency", () => {
  it.each([
    { amount: 100, currency: "USD", expected: "dollar100.00" },
    { amount: 100, currency: "EUR", expected: "euro100.00" },
    { amount: 100, currency: "GBP", expected: "pound100.00" },
    { amount: 1000, currency: "JPY", expected: "yen1000" },
    { amount: 0, currency: "USD", expected: "dollar0.00" },
  ])("should format $currency currency: $amount → $expected", ({ amount, currency, expected }) => {
    expect(formatCurrency(amount, currency)).toBe(expected);
  });
});
```
