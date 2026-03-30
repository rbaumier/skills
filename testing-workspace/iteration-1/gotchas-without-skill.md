# Code Review: Test Code Issues

## Unit Tests (Vitest + React Testing Library)

### 1. Missing import for `UserList`
The component under test is never imported. The file will fail at compile time.

### 2. `page.click` in a unit test
`await page.click('.user-item')` uses Playwright's `page` global inside a Vitest/RTL unit test. `page` is undefined here. If the intent is to simulate a click, use `userEvent.click()` or `fireEvent.click()` from Testing Library.

### 3. No async waiting for rendered content
`render(<UserList />)` is synchronous, but `fetchUsers` returns a promise. The test never waits for the async data to appear in the DOM (e.g., via `findByText`, `waitFor`, or `screen.findByRole`). The assertion on `.user-name` will run before the fetch resolves and likely fail.

### 4. `vi.restoreAllMocks()` without `vi.clearAllMocks()`
`restoreAllMocks` restores original implementations but does not clear recorded calls. Since `mockFetch` is defined once at module scope and reused across tests, call history leaks between tests. Use `vi.clearAllMocks()` (or `vi.resetAllMocks()` which does both) in `afterEach`.

### 5. Fragile DOM querying with `container.querySelector`
Querying by CSS class (`.user-name`) couples tests to implementation details. Prefer `screen.getByText('Alice')` or `screen.getByRole()` for resilient, accessible queries.

### 6. Snapshot on the full render result
`expect(result).toMatchSnapshot()` snapshots the RTL `RenderResult` object, not the DOM. This captures internal RTL metadata, not meaningful UI output. Use `expect(result.container).toMatchSnapshot()` or, better, assert specific empty-state text.

### 7. `vi.mock` hoisting gotcha
`vi.mock('./api', () => ({ fetchUsers: mockFetch }))` references `mockFetch` which is defined before the mock call. Vitest hoists `vi.mock` to the top of the file, so `mockFetch` may not yet be initialized when the factory runs. The safe pattern is to use `vi.hoisted()`:

```typescript
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock('./api', () => ({ fetchUsers: mockFetch }));
```

---

## Playwright Test

### 8. Deprecated `page.$` API
`await page.$('.success-msg')` returns an `ElementHandle | null`. The Playwright team discourages `page.$` in favor of locator-based APIs. Use:

```typescript
await expect(page.locator('.success-msg')).toBeVisible();
```

### 9. Deprecated `page.click` (string selector)
`page.click('#submit-btn')` is a legacy convenience method. Prefer the locator API:

```typescript
await page.locator('#submit-btn').click();
```

### 10. No navigation or setup
The test clicks a button with no prior `page.goto()`. Unless a `beforeEach` handles navigation, the page is blank and the selector will time out.

### 11. Weak assertion
`expect(msg).toBeTruthy()` only checks that the handle is non-null. It does not verify visibility, text content, or that the element is in the viewport. `toBeVisible()` from `@playwright/test` is the correct assertion.

---

## Summary

| # | Severity | Issue |
|---|----------|-------|
| 1 | **Error** | Missing `UserList` import |
| 2 | **Error** | `page.click` used in unit test (wrong API) |
| 3 | **Error** | No async wait -- assertions race the fetch |
| 7 | **Error** | `vi.mock` hoisting makes `mockFetch` undefined |
| 4 | **Bug** | Mock state leaks between tests |
| 6 | **Bug** | Snapshot captures RTL internals, not DOM |
| 10 | **Bug** | No `page.goto()` before interaction |
| 5 | **Smell** | Fragile CSS-class queries |
| 8 | **Smell** | Deprecated `page.$` API |
| 9 | **Smell** | Deprecated `page.click(string)` API |
| 11 | **Smell** | Weak `toBeTruthy` assertion |
