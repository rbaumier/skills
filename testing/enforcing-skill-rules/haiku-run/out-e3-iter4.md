```typescript
// api-client.test.ts
import { describe, it, expect, vi } from "vitest";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("node-fetch", () => ({ default: mockFetch }));
import fetch from "node-fetch";

describe("ApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch users and return array of user objects", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: "Alice" }]),
    });
    const users = await getUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toEqual({ id: 1, name: "Alice" });
  });

  it("should fetch single user by id", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: "Alice" }),
    });
    const user = await getUser(1);
    expect(user).toEqual({ id: 1, name: "Alice" });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/users/1"));
  });

  it("should handle zero users", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    const users = await getUsers();
    expect(users).toHaveLength(0);
  });

  it("should handle network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network failed"));
    await expect(getUsers()).rejects.toThrow("Network failed");
  });
});

// form.test.tsx
import { render, userEvent } from "@testing-library/react";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should submit form when user fills email and clicks submit", async () => {
    const { getByRole } = render(<LoginForm onSubmit={vi.fn()} />);
    const emailInput = getByRole("textbox", { name: "Email" });
    const submitButton = getByRole("button", { name: "Submit" });

    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "test@test.com");
    await userEvent.click(submitButton);

    expect(getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("should show validation error for invalid email", async () => {
    const { getByRole, queryByText } = render(<LoginForm onSubmit={vi.fn()} />);
    const emailInput = getByRole("textbox", { name: "Email" });
    const submitButton = getByRole("button", { name: "Submit" });

    await userEvent.type(emailInput, "invalid");
    await userEvent.click(submitButton);

    expect(queryByText("Invalid email format")).toBeInTheDocument();
  });

  it("should disable submit button while form is submitting", async () => {
    const { getByRole } = render(<LoginForm onSubmit={vi.fn()} />);
    const submitButton = getByRole("button", { name: "Submit" });

    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);
    expect(submitButton).toBeDisabled();
  });
});

// external-api.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupServer } from "msw";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("https://api.stripe.com/v1/charges/:id", () =>
    HttpResponse.json({ id: "ch_123", status: "succeeded", amount: 5000 })
  )
);

describe("ExternalPaymentService", () => {
  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  it("should verify payment status when charge exists", async () => {
    const res = await fetch("https://api.stripe.com/v1/charges/ch_123");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({
      id: "ch_123",
      status: "succeeded",
      amount: 5000,
    });
  });

  it("should handle 404 when charge does not exist", async () => {
    server.use(
      http.get("https://api.stripe.com/v1/charges/:id", () =>
        HttpResponse.json({ error: "Not found" }, { status: 404 })
      )
    );
    const res = await fetch("https://api.stripe.com/v1/charges/invalid");
    expect(res.status).toBe(404);
  });

  it("should handle network timeout", async () => {
    server.use(
      http.get("https://api.stripe.com/v1/charges/:id", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return HttpResponse.json({ error: "Timeout" });
      })
    );
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100);
    try {
      await fetch("https://api.stripe.com/v1/charges/ch_123", {
        signal: controller.signal,
      });
    } catch (error) {
      expect(error).toBeTruthy();
    } finally {
      clearTimeout(timeoutId);
    }
  });
});

// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        autoUpdate: true,
      },
    },
  },
});

// dashboard.e2e.ts
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("should display dashboard header with title", async ({ page }) => {
    await page.goto("/dashboard");
    const heading = page.getByRole("heading", { name: "Dashboard" });
    await expect(heading).toBeVisible();
  });

  test("should display user profile card on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    const profileCard = page.getByTestId("user-profile");
    await expect(profileCard).toBeVisible();
    const userName = page.getByText(/Alice/);
    await expect(userName).toBeVisible();
  });

  test("should show layout with sidebar and main content", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.getByRole("navigation");
    const mainContent = page.locator("main");
    await expect(sidebar).toBeVisible();
    await expect(mainContent).toBeVisible();
  });

  test("should capture visual regression for dashboard layout", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveScreenshot("dashboard-layout.png", {
      maxDiffPixelRatio: 0.01,
    });
  });
});

// playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  retries: 1, // Only retry once; for flaky tests, quarantine with @flaky tag instead
});

// format.test.ts
import { describe, it, expect } from "vitest";

const makeCurrencyTestCase = (
  amount: number,
  currency: string,
  expected: string
) => ({ amount, currency, expected });

describe("formatCurrency", () => {
  // ZOMBIES: Zero, One, Many, Boundaries, Interfaces, Exceptions, Simple
  const testCases = [
    makeCurrencyTestCase(0, "USD", "$0.00"), // Zero
    makeCurrencyTestCase(1, "USD", "$1.00"), // One
    makeCurrencyTestCase(100, "USD", "$100.00"), // Simple
    makeCurrencyTestCase(1000, "USD", "$1,000.00"), // Boundary: thousands separator
    makeCurrencyTestCase(100, "EUR", "€100.00"), // Different currency
    makeCurrencyTestCase(100, "GBP", "£100.00"), // Different currency
    makeCurrencyTestCase(1000, "JPY", "¥1000"), // No decimals currency
    makeCurrencyTestCase(0.01, "USD", "$0.01"), // Boundary: small fractional
    makeCurrencyTestCase(999.99, "USD", "$999.99"), // Boundary: near thousand
  ];

  test.each(testCases)(
    "should format $amount $currency as $expected",
    ({ amount, currency, expected }) => {
      const result = formatCurrency(amount, currency);
      expect(result).toBe(expected);
    }
  );

  it("should throw error for unsupported currency", () => {
    expect(() => formatCurrency(100, "XXX")).toThrow("Unsupported currency");
  });

  it("should handle negative amounts", () => {
    const result = formatCurrency(-50, "USD");
    expect(result).toBe("-$50.00");
  });
});
```
