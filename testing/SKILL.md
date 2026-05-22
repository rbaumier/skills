---
name: testing
description: "Use when writing tests, choosing test strategies, or setting up test infrastructure — TDD, unit tests, E2E, Vitest, Playwright, coverage."
---

## Gotchas
- `vi.mock()` hoists to top — variable refs inside factory `undefined` unless via `vi.hoisted()`
- **`afterEach(cleanup)` in RTL is automatic with Vitest** — manual `cleanup()` causes double cleanup. Remove it; keep only `vi.restoreAllMocks()`. In reviews: if you see `cleanup()` imported from `@testing-library/react` in a Vitest file, flag it as unnecessary double cleanup
- `page.click(selector)` deprecated — use `page.locator(selector).click()`
- `toMatchSnapshot()` maintenance trap — assert specific values instead

---

## 1. Strategy

### Tests are designed artifacts — deletable, refactorable

A test is code; the same rules apply to its lifecycle. Tests are not a monotonically growing asset class.

- **Internal tests are scaffolding.** Once the code under test is wired through a system boundary that has its own tests, audit the internal ones. If every change either (a) doesn't touch them or (b) breaks them in ways where the fix is "copy the actual into the expected", they're testing implementation, not behavior — delete them. In reviews: test file where every recent change is `expected: <copied from output>` -> flag "this test has no oracle, delete or rewrite at the boundary"
- **"Tests survive refactors" applies at the system boundary.** Internal tests are *expected* to break under refactor — that's how the type system and red squigglies guide the change. The "good tests survive refactors" maxim is true for tests at the boundary (API, public function, user-facing behavior) and false for tests at every internal seam. In reviews: refactor PR with broken internal tests being treated as a regression -> clarify "these were scaffolding; rewrite or delete is correct"
- **The urge to test an internal collaborator is a signal.** Either (a) promote the collaborator to a documented system boundary with quality docs and version stability, OR (b) stop wanting to test it directly. The third option ("just test it anyway") creates the "over-mocked, breaks-on-refactor, masks-real-bugs" failure mode.
- **Deleting tests is a refactor, not a regression.** A test that doesn't earn its maintenance cost is a liability. The "tests as designed artifacts" framing means tests are a valid target of refactoring, including outright deletion when their oracle is gone.
- **Every commit that changes prod code should change tests** OR be declared a pure refactor OR be specially scrutinized. A commit invisible to tests is one of those three; the reviewer's job is to decide which. In reviews: prod diff with zero test diff and no "refactor" label -> flag "explain or add coverage"

### Test quality criteria

Use these as a first-pass filter on every new test:

- **The Neural Network test**: imagine the entire implementation under test is replaced by an opaque ML model that produces correct outputs for known inputs. Would the test still be valid? If yes, you're testing behavior. If no (because the test mocks an internal function the NN wouldn't have, or asserts on an intermediate value the NN wouldn't expose), you're testing implementation. Single sharpest framing for "is this a behavior test."
- **Do not add tests which simply restate the implementation. These provide zero confidence.** If the test mirrors the code (same branches, same constants, same mocks shaped like the function body), it cannot catch a bug — any bug in the impl is duplicated in the test. The test passes by tautology. In reviews: test asserting the exact return shape the function literally constructs, with no transformation/edge-case/interaction being verified -> flag "tautological, delete or rewrite at a real oracle"
- **Debug-distance**: write a unit test specifically where bugs are *cheap to introduce* and *expensive to debug from an integration test*. Not "isolation is virtuous" — "this code is hot for bugs and far from the system boundary, so a focused test there shortens debug loops." Picks: parsers, edge-case math, state-machine transitions, retry/backoff logic.
- **Cost of adding one more test**: this is the metric for test-infra health. If writing a new test costs more than fixing the bug, your test infrastructure is broken — fix the infra (better builders, the `check()` idiom below, snapshot machinery, fast in-memory DB), not the team's "discipline". Reviews: 30+ lines of setup boilerplate for a 3-line assertion -> flag "extract a builder; the infra is the bug here"

### Sans-IO architecture for fast tests

Tests are slow because of I/O, not because of code volume. Push I/O to the edges; the compute core takes values in and returns values. Even a 100k-line core can be tested at compile speeds when no test touches disk/network/clock. When deciding where to draw the line between "core" and "shell", let test-cost-per-line decide. Reviews: unit test that opens a real socket / writes to disk / sleeps for time -> flag "lift the I/O to the caller, test the pure function"

### Fire-and-forget concurrency is untestable by construction

```ts
function doStuffInBackground(p: Param) {
  setTimeout(() => { /* ... */ }, 0);  // returns nothing, untestable
}
```

If an async API doesn't return a handle (Promise, AbortController, task ID) you can await/join/cancel, the test cannot observe completion or assert outcomes — it can only `setTimeout` and hope. Refuse the API shape in code review. Structured concurrency: every spawned task is reachable and joinable. Reviews: `setTimeout`/`setInterval`/raw `Promise.resolve().then()` for fire-and-forget work in non-test code -> flag "return a handle"

Test behavior not implementation. Determinism is king. Fast feedback. No test-to-test deps.
Testing Trophy: integration > unit (complex logic only) > E2E (critical paths).
**Test pyramid ratios**: ~70% unit (pure logic, transforms, edge cases), ~20% integration (API contracts, DB interactions), ~10% E2E (critical user flows only). Inverting the pyramid (too many E2E, few unit) leads to slow, flaky CI. In reviews: if a project has more E2E tests than unit tests, flag the inverted pyramid
AAA pattern. One concept per test. Descriptive names (scenario + outcome). No logic in tests.
Don't test what types guarantee. Specific matchers over generic equality.
**ZOMBIES mnemonic for edge-case coverage**: Zero/empty, One, Many, Boundaries, Interfaces, Exceptions, Simple/edge. Walk through every category when designing tests for a function. Without this, you only test the happy path and miss the inputs that cause production crashes. In reviews: if a test only covers the happy path without boundary values or empty inputs, flag missing ZOMBIES coverage
Factories over fixtures. Explicit setup per test. Teardown in `finally`/`afterEach`.
Mock at boundaries only — network, filesystem, DB, time, randomness. Never mock internal collaborators.
**MSW (Mock Service Worker) for network mocking**: Use `msw` to intercept fetch/XHR at the network level instead of mocking fetch/axios directly. MSW handlers are reusable across tests, work with any HTTP client, and test real request/response cycles. Without MSW, you mock the HTTP client itself — which means switching from axios to fetch breaks all your mocks. In reviews: if you see `vi.mock('axios')` or `global.fetch = vi.fn()`, recommend MSW instead
Test public interface only. Prefer real deps (in-memory DB) for integration.
**Contract testing for API boundaries**: When your service depends on external APIs, write contract tests that verify the shape/types of responses (not values). Use MSW to intercept and validate against recorded contracts. Without contract tests, a third-party API silently changes a field name and your service breaks in production. In reviews: if integration tests call real external APIs, flag and recommend contract tests with MSW
**Flaky test triage protocol**: Run failing test 3x. If intermittent: classify as flaky. Action: quarantine (`describe.skip` or tag `@flaky`), file a ticket, fix root cause (race condition, shared state, time dependency). Never retry-and-ignore in CI — retries mask real regressions and erode trust in the suite. In reviews: if you see `retries: 3` in Playwright config without a comment explaining why, flag it

### Colocate tests with the source — no `__tests__/` directories
Test files live next to the module they cover (`foo.ts` + `foo.test.ts`, or `foo.integration.test.ts`). Never group under `__tests__/` sub-directories. Colocation keeps source and tests visible in the same listing, removes a navigation step, and prevents divergence between `src/X/__tests__/foo.test.ts` and `src/X/foo.ts` when the module moves. Reviews: tests grouped under `__tests__/` -> flag "colocate next to the source"

### Test Naming as Specification
Names follow `should [action] when [condition]` with nested `describe` by module then method. A reader understands expected behavior without reading the test body.
```typescript
describe('OrderService', () => {
  describe('cancel', () => {
    it('should refund full amount when order is pending', () => { /* ... */ });
    it('should throw ForbiddenError when order is already shipped', () => { /* ... */ });
  });
});
```
In reviews: test named `test1`, `testCreate`, or `it works` -> flag "name must describe scenario + outcome"

### Regression Test Discipline
Every bug fix gets a regression test named with the issue number and a link. Dedicated `regression.spec.ts` file or prefixed tests for priority execution.
```typescript
// regression.spec.ts
it('should not panic on empty input (#1234)', () => {
  // https://github.com/org/repo/issues/1234
  expect(parse('')).toEqual({ nodes: [] });
});
```
In reviews: bug fix PR without a regression test -> flag "add regression test with issue link"

**Mark known-failing tests rather than skipping them.** When you find a bug you can't fix immediately, add the failing test with `it.fails(...)` / `it.todo(...)` (Vitest) or equivalent, linked to the issue. Suite reports the failure but doesn't go red. The day someone accidentally fixes the bug, the test starts passing and the suite fails — closing the loop automatically. Reviews: bug known and ticketed but no failing-test marker exists -> flag "add an expected-fail test"

### Specification-Driven Tests
Tests organized section by section of the specification. References to exact spec sections in comments. Domain edge cases tested mandatorily.
```typescript
describe('RFC 7230 Section 3.2.6 — Quoted String', () => {
  it('should handle escaped characters within quotes', () => { /* ... */ });
});
```

### Property-Based Testing (TypeScript)
Use `fast-check` for round-trip invariants, idempotence, and mathematical properties. Complements unit tests — does not replace them. Catches edge cases that hardcoded values miss.
```typescript
import fc from 'fast-check';
test('encode/decode round-trip', () => {
  fc.assert(fc.property(fc.string(), (input) => {
    expect(decode(encode(input))).toBe(input);
  }));
});
```
Good candidates: serializers, parsers, sorting, math operations, state machine transitions

**Ephemeral model-based testing — use the old impl as oracle during a rewrite.** When refactoring/rewriting a function or module, before deleting the old code, write a property test of the form `newImpl(x).should.equal(oldImpl(x))` over generated inputs. Keep both in parallel until the property holds across thousands of cases. Edge-case discrepancies become permanent regression tests even after the old code is deleted. This is the single most underused property-testing pattern.

**Assertions in production code compound property-test power.** A property test that runs 10,000 inputs against a function studded with invariant asserts is also running 10,000 checks of each assert (the assert failure crashes the property iteration, which the fuzzer logs). Investment in in-code invariants (see `coding-standards` Runtime Invariants section) is leverage for any future fuzz/property suite. Pair them.

**"Query your code" workflow.** When uncertain whether an invariant holds, write the assertion and run the property suite. The suite either confirms it or returns a counter-example. Cheaper than thinking; more reliable than guessing.

### Deterministic Tests — Concrete Patterns
Zero source of non-determinism. Inject dependencies for all impure operations:
- **Time**: injectable `TimeProvider` or `vi.useFakeTimers()` — never rely on `Date.now()` in assertions
- **Random**: seeded RNG (`seedrandom` or pass seed as param) — reproducible on failure
- **Async scheduling**: deterministic scheduler, never `setTimeout` in prod code under test
- **IDs**: factory-generated sequential IDs or fixed UUIDs in tests

### Multi-Layer Testing (6 techniques)
Combine complementary techniques for robust coverage:
1. **Unit** — pure logic, transforms, edge cases (fastest, most numerous)
2. **Integration** — API contracts, DB interactions with real adapters
3. **Property-based** — invariants, round-trips, mathematical properties
4. **Fuzz** — random invalid inputs to find crashes/panics
5. **Regression** — every fixed bug gets a dedicated test
6. **Fault injection** — simulate I/O failures, timeouts, partial writes to verify resilience

**Layered integration tests — enter at each layer's boundary.** For a system with layers L1 → L2 → L3 → L4, write integration tests that enter at *each* layer (not only the topmost). Reasons: (a) when working in L2, the L2-entry test is the fastest signal; rebuilding only L2's downstream is cheap. (b) Layered tests express ownership: each layer's tests are maintained by whoever owns that layer. (c) Testing only at L4 hides L2 bugs behind L3's defensiveness.

**Coverage marks — assert the reason something didn't happen.** Negative assertions are weak: `expect(x).not.toBeCalled()` can pass for the wrong reason (the code path was never reached at all). Solution: emit a side-channel marker (`telemetry.mark('cache-hit')` or in-test event) that explains *why* the thing didn't happen, and assert on that. `expect(events).toContain('cache-hit')` is positive evidence, not absence of evidence.

**Continuous fuzzer + checked-in corpus.** Two distinct loops. (a) An off-CI fuzzer continuously runs against `main`, exploring new territory, non-deterministic. (b) The corpus discovered by (a) is checked into the repo and run in regular CI, deterministic. Failure in (a) means "fuzzer found a new bug, file an issue". Failure in (b) means "you regressed a known input, fix the PR".

### Test Infrastructure as Investment
Invest in test helpers: fluent builders for test contexts, assertion helpers with visual diffs, dedicated test utilities package. The setup boilerplate should be one line.
```typescript
// Good: builder abstracts setup complexity
const ctx = await TestBuilder.create()
  .withUser({ role: 'admin' })
  .withOrder({ status: 'pending' })
  .build();
```
In reviews: copy-pasted setup boilerplate across 5+ tests -> flag "extract test builder"

**The `check()` idiom — one helper per API under test.** Don't call the function-under-test directly from each test. Wrap it in a single `check(input, expected)` helper. When the API signature changes (added argument, renamed, error shape moves), you fix one place. Tests then read as input → expected pairs, not as setup ceremony.
```typescript
// Bad — every test re-implements the call shape
it('parses unicode', () => {
  const { tokens, errors } = parse('héllo', { mode: 'lax' });
  expect(errors).toEqual([]);
  expect(tokens).toEqual([{ kind: 'word', value: 'héllo' }]);
});

// Good — `check` is the only caller of `parse`; signature changes touch one spot
const check = (input: string, expected: Token[]) => {
  const { tokens, errors } = parse(input, { mode: 'lax' });
  expect(errors).toEqual([]);
  expect(tokens).toEqual(expected);
};
it('parses unicode', () => check('héllo', [{ kind: 'word', value: 'héllo' }]));
```
This trick alone often turns "30-minute API refactor" into "5-minute API refactor".

**Use the test runner as a universal automation hammer.** Anything you'd put in a CI YAML can be a test instead: code formatting compliance, no merge commits in history, license compatibility of dependencies, "this function must run in O(n)" performance check, "this generated file matches the source schema". Benefits: runs locally on the dev machine, integrates with the existing test infrastructure, no extra runner to learn. Reviews: CI YAML doing something that could be a test -> flag "move to a `*.spec.ts` for local-friendliness"

### Test Isolation — Prefix Strategy
Each test creates its own instances, no shared singletons. Prefix shared keys by test to avoid parallel collisions:
```typescript
const testId = crypto.randomUUID().slice(0, 8);
const cacheKey = `test_${testId}_user_session`;
```
In reviews: test that fails alone but passes in suite (or vice versa) -> flag "shared state pollution"

### Ecosystem / Real-World Testing
For tools (linters, formatters, compilers): run against real open-source projects in CI as a safety net. Benchmarks use representative real-world data, not synthetic micro-examples.

### Snapshot Testing — Nuanced Usage
`toMatchSnapshot()` on UI components is a maintenance trap — assert specific values instead.
**But snapshots are excellent for deterministic output**: CLI formatters, code generators, compilers, serializers. Use `insta` (Rust) or inline snapshots (Vitest) for these. Update with `--update-snapshots`. The distinction: snapshot tests work when the output is the contract (formatting), not when it's a side effect of implementation (component render).

### Compile-Time Type Tests
Type tests are as rigorous as runtime tests. In TS: `.test-d.ts` files with `expectTypeOf`. In Rust: `compile_fail` doc-tests documenting what the API **forbids**.
```typescript
// user.test-d.ts
import { expectTypeOf } from 'vitest';
expectTypeOf<ReturnType<typeof getUser>>().toEqualTypeOf<Promise<Result<User, 'not-found'>>>();
```
In reviews: generic library without type tests -> flag "add .test-d.ts for public API types"

---

## 2. TDD

Vertical slices via tracer bullets. One test -> one impl -> repeat. Never all tests first.
RED: write test -> fail. GREEN: minimal code -> pass. Refactor only when GREEN.
Tests describe behavior through public interfaces. Good test survives refactor.
Load `references/tdd-*.md` as needed.

---

## 3. UI Testing

### Selectors
User-centric: `getByRole`, `getByLabel`, `getByText` — never CSS classes/XPath.
Use `page.locator(selector).click()`, never `page.click(selector)`.

### Interactions
**`userEvent` over `fireEvent` in RTL**: Use `@testing-library/user-event` instead of `fireEvent` — it simulates real user interactions (typing triggers keydown/keypress/keyup/input/change, click triggers pointer events). `fireEvent.click()` dispatches a single synthetic event; `userEvent.click()` reproduces the full browser event sequence. Without `userEvent`, your tests pass but the real browser fires events your handler never saw. In reviews: if you see `fireEvent.click()` or `fireEvent.change()`, recommend `userEvent`

### Waits
**Zero sleep**: never `waitForTimeout` — wait for network responses or UI state.
Web-first assertions: `expect(locator).toBeVisible()` (auto-retry).

### Data
API seeding — don't drive UI to create preconditions. Fresh incognito context per test.

### Architecture
**Page Object Model**: abstract selectors/actions into reusable classes — tests read like user stories. All page interactions (fill, click, assert) belong in PO methods, not inline in tests. In reviews: if you see raw selectors and actions repeated inline across tests without a Page Object abstraction, flag the missing POM pattern.

**Mock third-party external services**: payment gateways, analytics, any vendor API. Vendor downtime must never break your build. Intercept via `page.route()`:
```typescript
await page.route('**/api/payment', route =>
  route.fulfill({ status: 200, json: { status: 'confirmed' } })
);
```
In reviews: if you see a test hitting a real external service (payment, SMS, email, analytics), flag it — mock it with route interception.

### Error Handling
Capture video/traces/screenshots on failure only. Soft assertions for independent elements.

---

## 4. Vitest Quick Ref

Config: `defineConfig` from `vitest/config`. Core: `test`/`it`, `describe`, `expect`, hooks.
Mock: `vi.fn()`, `vi.mock()`, `vi.spyOn()`. Timers: `vi.useFakeTimers()`.
Use `vi.hoisted()` for vars inside `vi.mock()` factory.
**`test.each` for data-driven tests**: When testing the same logic with multiple inputs, use `test.each` instead of duplicating test bodies. Without it, you copy-paste the same test 5 times and forget to update one. In reviews: if you see 3+ near-identical test bodies differing only in input/expected, flag and recommend `test.each`
Coverage: `vitest run --coverage`. **Coverage as a ratchet, not a target**: Set CI to fail if coverage DROPS from current baseline, not if it's below an arbitrary number. Use `thresholds: { autoUpdate: true }` in vitest config. A hardcoded `threshold = 80` blocks legitimate low-coverage code while ignoring regressions in high-coverage areas. Filter: `-t`, `--changed`, `--related`. Shard: `--shard=1/3`.
Env: `// @vitest-environment jsdom`. Types: `expectTypeOf` + `.test-d.ts`.
Load `references/vitest-*.md` as needed.

---

## 5. Playwright Quick Ref

Role-based selectors. Auto-waiting (no timeouts). Independent tests (no shared state).
POM for maintainability. Traces/screenshots for debugging. Parallel execution.
`testIdAttribute` for custom attrs. `trace: 'retain-on-failure'`.
Never: `waitForTimeout()`, CSS selectors, shared state, `first()`/`nth()` without reason.
**Visual regression testing**: Use `expect(page).toHaveScreenshot()` for visual regression instead of `toMatchSnapshot()` on HTML. Configure `maxDiffPixelRatio: 0.01` for minor anti-aliasing tolerance. Store baselines in git, update with `--update-snapshots`. Without visual assertions, a CSS change silently breaks layout and nobody notices until a user complains
Load `references/playwright-*.md` as needed.
