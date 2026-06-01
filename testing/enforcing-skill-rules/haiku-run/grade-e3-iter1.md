# Grade — testing eval 3, iter 1 (STRICT)

Verdict per assertion. PASS only if the trap is CLEARLY corrected in the real code (with citation).

| ID | Verdict | Evidence (cite) |
|----|---------|-----------------|
| msw-not-vi-mock-fetch | PASS | No `vi.mock(...)` on fetch anywhere. Network mocked via MSW: `setupServer(http.get("*/users", () => HttpResponse.json(...)))` (lines 10-13). `node-fetch` imported (line 2) but never mocked. |
| zombies-coverage | PASS | Beyond happy path: empty array `HttpResponse.json([])` (l.27), 404 throw `rejects.toThrow()` (l.44, l.115), negative `formatCurrency(-100,...)` (l.229), large `999999999` (l.233), invalid currency throw (l.237), value 0 (l.218). |
| userEvent-not-fireEvent | PASS | `userEvent.type(emailInput, ...)` (l.65) and `userEvent.click(submitButton)` (l.66/76); no `fireEvent` present. |
| contract-test-external-api | PASS | Stripe mocked at boundary: `http.get("https://api.stripe.com/v1/charges/:id", () => HttpResponse.json(...))` (l.92-95); no real API call. |
| coverage-ratchet | PASS | `autoUpdate: true` present in thresholds (l.130). Ratchet mechanism applied. Caveat: vestigial hardcoded `80`s remain in a malformed `branches: { lines: 80, ... }` (l.131), but the assertion's prescribed fix (`autoUpdate: true`) is clearly present. |
| visual-screenshot-not-html-snapshot | PASS | `await expect(page).toHaveScreenshot("dashboard.png", {...})` (l.148); no `toMatchSnapshot()` on HTML anywhere. |
| flaky-retries-flagged | PASS | No `retries: 3` in playwright.config.ts; retries removed, with explanatory comment on why (l.188-190). Trap eliminated. |
| test-each-data-driven | PASS | `it.each([...])(...)` consolidates the formatCurrency cases (l.213-225); no duplicated test bodies. |
| test-pyramid-ratio | FAIL | No mention of test pyramid or ~70/20/10 unit/integration/E2E ratios anywhere in the code or the "Rules Applied" prose (l.242-263). The architecture/awareness assertion is unaddressed. |

**Score: 8 / 9 PASS**
