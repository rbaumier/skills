# API Response Verification

## Three-Step Verification Pattern

1. Fill form / prepare action
2. `waitForResponse` (set up before triggering)
3. Verify status code + response body

## Response Body Capture Pattern

Capture the response body inside the predicate to avoid race conditions with navigation that might destroy the response object:

```typescript
let responseBody: Record<string, unknown> = {};
const responsePromise = page.waitForResponse(async (response) => {
  if (response.url().includes("/api/v1/resource") && response.request().method() === "POST") {
    if (response.status() < 400) {
      responseBody = await response.json();
    }
    return true;
  }
  return false;
}, { timeout: 15000 });

await page.click('[data-test="submit"]');
const response = await responsePromise;
expect(response.status()).toBeLessThan(400);
expect(responseBody.id).toBeDefined();
```

Key: set up `waitForResponse` **before** the click that triggers the request.

## When to Verify Response Bodies vs Status Codes

**Status code only** — sufficient when:
- The UI already reflects success/failure visually
- You only care that the request succeeded

**Response body verification** — needed when:
- The response contains IDs or tokens used in subsequent steps
- You need to confirm the server processed data correctly (not just accepted it)
- UI feedback is generic (e.g., "Success") but you need to verify specifics

## Combining UI and API Assertions

```typescript
// Verify both the API response and the UI update
const responsePromise = page.waitForResponse(
  (r) => r.url().includes("/api/v1/resource") && r.status() < 400
);

await page.getByTestId('submit-button').click();
await responsePromise;

// Now verify the UI reflects the change
await expect(page.getByText('Resource created')).toBeVisible();
```
