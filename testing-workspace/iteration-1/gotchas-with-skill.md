# Test Code Review

## Vitest / React Testing Library Issues

### 1. Mocking internal module instead of boundary
**Rule violated**: "Only mock: network, filesystem, time, randomness."

```typescript
vi.mock('./api', () => ({ fetchUsers: mockFetch }));
```

`./api` is an internal module. The test should either use the real module with a mocked network layer (e.g., MSW to intercept HTTP requests), or mock at the `fetch`/`XMLHttpRequest` boundary. Mocking internal modules makes tests pass but hides real bugs — if `./api` changes its contract, the test stays green while production breaks.

### 2. `vi.mock()` variable reference will be `undefined`
**Rule violated**: "Variable references inside the mock factory will be `undefined` unless prefixed with `vi`."

```typescript
const mockFetch = vi.fn();
vi.mock('./api', () => ({ fetchUsers: mockFetch }));
```

`vi.mock()` is hoisted to the top of the file — it runs before `const mockFetch = vi.fn()`. Inside the factory, `mockFetch` is `undefined`. Fix: use `vi.hoisted()`.

```typescript
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock('./api', () => ({ fetchUsers: mockFetch }));
```

### 3. Manual `cleanup` causes double cleanup
**Rule violated**: "Adding it manually causes double cleanup."

```typescript
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
```

React Testing Library auto-cleans with Vitest. Manual `cleanup()` runs it twice, which can cause subtle bugs. Remove the `cleanup()` call; keep only `vi.restoreAllMocks()`.

### 4. `toMatchSnapshot()` is a maintenance trap
**Rule violated**: "Snapshots grow stale and get blindly updated. Assert specific values instead."

```typescript
expect(result).toMatchSnapshot();
```

This will pass on the first run (snapshot is created), then become stale over time. Developers blindly update snapshots without reviewing diffs. Assert the specific empty-state behavior instead:

```typescript
expect(screen.getByText('No users found')).toBeInTheDocument();
```

### 5. Mixing Playwright API (`page.click`) inside a Vitest unit test
**Bug**: The `page` object does not exist in a Vitest/JSDOM environment.

```typescript
const { container } = render(<UserList />);
await page.click('.user-item'); // page is undefined here
```

This will throw a `ReferenceError`. Use `@testing-library/user-event` or `fireEvent` instead.

### 6. DOM querying via `container.querySelector` instead of semantic queries
**Rule violated**: "Prefer semantic locators (`getByRole`, `getByLabel`, `getByText`) over CSS classes."

```typescript
expect(container.querySelector('.user-name')?.textContent).toBe('Alice');
```

CSS class selectors are brittle and couple tests to implementation. Use:

```typescript
expect(screen.getByText('Alice')).toBeInTheDocument();
```

---

## Playwright E2E Test Issues

### 7. Using deprecated `page.click()` instead of locator API
**Rule violated**: "Use `page.locator(selector).click()`, never `page.click(selector)`."

```typescript
await page.click('#submit-btn');
```

`page.click()` is a legacy convenience method. Use the locator API which has better auto-waiting and retry semantics:

```typescript
await page.locator('#submit-btn').click();
```

### 8. CSS ID selector instead of role-based selector
**Rule violated**: "Use role-based selectors when possible" and "Do not rely on CSS class selectors (brittle)."

```typescript
await page.click('#submit-btn');
const msg = await page.$('.success-msg');
```

Both `#submit-btn` and `.success-msg` are implementation details. Prefer:

```typescript
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByText('Success')).toBeVisible();
```

### 9. Using `page.$` with truthy check instead of web-first assertion
**Rule violated**: "Use async assertions that retry automatically (`expect(locator).toBeVisible()`)."

```typescript
const msg = await page.$('.success-msg');
expect(msg).toBeTruthy();
```

`page.$` returns immediately — it does not wait or retry. If the success message appears after an async operation, this is a race condition. Use a web-first assertion that auto-retries:

```typescript
await expect(page.getByText('Success')).toBeVisible();
```

---

## Summary

| # | Issue | Severity |
|---|-------|----------|
| 1 | Mock internal module instead of network boundary | High |
| 2 | `vi.mock()` hoisting makes `mockFetch` undefined | High (runtime crash) |
| 3 | Double cleanup | Medium |
| 4 | Snapshot instead of specific assertion | Medium |
| 5 | `page.click` in Vitest context (wrong API) | High (runtime crash) |
| 6 | CSS selector instead of semantic query | Low |
| 7 | Deprecated `page.click()` API | Medium |
| 8 | CSS selectors instead of role-based | Medium |
| 9 | `page.$` + truthy instead of web-first assertion | High (flaky) |
