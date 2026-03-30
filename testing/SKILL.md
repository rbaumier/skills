---
name: testing
description: "Testing strategy, TDD, UI testing, Vitest, Playwright. Trigger on 'test', 'TDD', 'coverage', 'E2E', 'unit test', 'Vitest', 'Playwright'."
---

## When to use
- Designing test strategy for new feature/project
- Writing unit/integration/E2E tests
- TDD workflow (red-green-refactor, tracer bullets)
- UI testing with Playwright (browser automation, Page Object Model)
- Unit testing with Vitest (mocking, coverage, filtering)
- Reviewing test quality, debugging flaky tests
- Refactoring legacy code with safety nets

## When not to use
- Manual QA or exploratory testing
- Performance/load testing (use specialized tools)

## Gotchas
- Mocking internal modules (not boundaries) makes tests pass but hides real bugs. Only mock: network, filesystem, time, randomness.
- `vi.mock()` hoists to top of file — it runs before imports. Variable references inside the mock factory will be `undefined` unless prefixed with `vi`.
- Playwright `page.click()` auto-waits, but `page.locator().click()` does NOT auto-retry assertions. Use `expect(locator).toBeVisible()` before interacting.
- `toMatchSnapshot()` is a maintenance trap — snapshots grow stale and get blindly updated. Assert specific values instead.
- `afterEach(cleanup)` in React Testing Library is automatic with Vitest — adding it manually causes double cleanup.

---

## 1. Testing Strategy

### Core Philosophy
- **Testing Trophy**: focus on integration tests; unit for complex logic/edge cases; E2E for critical paths
- **Test behavior, not implementation** — tests must survive refactoring
- **Determinism is king** — flaky tests worse than no tests; same result every time, everywhere
- **Fast feedback** — tests must run fast enough for every save
- **Isolation** — no test-to-test dependencies; no shared global state (DB, FS, network)
- **Don't test what the type system already guarantees**

### Strategic Patterns
- **AAA**: Arrange (setup), Act (execute), Assert (verify)
- **Property-based testing**: use generators (fast-check) to test invariants against random inputs
- **Golden master testing**: snapshot current output for legacy code; ensure refactoring preserves it

### Writing Quality Tests
- One concept per test — multiple assertions OK if same concept
- Descriptive names: sentences with scenario + expected outcome
- No logic in tests — no loops, conditionals; keep declarative and flat
- **Mock at boundaries only** — mock ONLY external I/O: network (API calls), filesystem, database, time, randomness. **Never spy on or mock internal collaborators** like loggers, event emitters, or internal services within the same codebase. Spying on `logger.info` or `eventBus.emit` couples tests to implementation — if you refactor logging, tests break even though behavior is unchanged. In reviews: if you see `vi.spyOn` on a class that is NOT an external boundary (network, DB, filesystem), flag it as mocking an internal implementation detail

### Data & State Management
- Factories over fixtures — dynamic builders, not static JSON
- Explicit setup — each test creates its own data
- Teardown guarantees — clean up side effects in `finally`/`afterEach`; use transaction rollbacks
- Immutable inputs — prevent side effects leaking between assertions

### Test Doubles (Mocks, Stubs, Spies)
- Stub queries (return values); spy on commands (side effects)
- Don't mock simple types — use real value objects
- Verify *that* side effect happened, not *how*

### Assertions & Feedback
- Meaningful failure messages — explain *why* without opening code
- Specific matchers (`toContain`, `toThrow`, `toMatchObject`) over generic equality

### Integration & Boundaries
- Test public interface only — private methods are implementation details
- Prefer real dependencies (in-memory DB, containers) over mocks for integration tests
- Network isolation: mock/intercept all external calls (MSW, Nock) for determinism and speed
- Integration vs E2E: prefer fast integration tests with mocked backends for edge cases; reserve full E2E for happy paths

---

## 2. TDD Workflow

### Philosophy

**Core principle**: Tests verify behavior through public interfaces, not implementation details.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_. A good test reads like a specification. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation: they mock internal collaborators, test private methods, or verify through external means. Warning sign: test breaks when you refactor, but behavior hasn't changed.

See `references/tdd-tests.md` for examples and `references/tdd-mocking.md` for mocking guidelines.

### Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing."

**Correct approach**: Vertical slices via tracer bullets. One test -> one implementation -> repeat.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED->GREEN: test1->impl1
  RED->GREEN: test2->impl2
  ...
```

### Workflow

#### 1. Planning
- Confirm with user what interface changes are needed
- Confirm which behaviors to test (prioritize — you can't test everything)
- Identify opportunities for deep modules (see `references/tdd-deep-modules.md`)
- Design interfaces for testability (see `references/tdd-interface-design.md`)
- List behaviors to test (not implementation steps)
- Get user approval on the plan

#### 2. Tracer Bullet
Write ONE test that confirms ONE thing:
```
RED:   Write test for first behavior -> test fails
GREEN: Write minimal code to pass -> test passes
```

#### 3. Incremental Loop
For each remaining behavior:
```
RED:   Write next test -> fails
GREEN: Minimal code to pass -> passes
```
Rules: One test at a time. Only enough code to pass current test. Don't anticipate future tests.

#### 4. Refactor
After all tests pass, look for refactor candidates (see `references/tdd-refactoring.md`):
- Extract duplication
- Deepen modules (move complexity behind simple interfaces)
- Apply SOLID principles where natural
- **Never refactor while RED.** Get to GREEN first.

### Checklist Per Cycle
```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```

---

## 3. UI Testing Standards

### Selection & Interaction
- **User-Centric Selectors**: prefer semantic locators (`getByRole`, `getByLabel`, `getByText`) over CSS classes or XPath
- **Actionability**: never force a click — ensure element is stable, visible, enabled
- **Animation Timing**: don't interact mid-transition — wait for element stability/visibility
- **Text Matching**: use case-insensitive and substring matching for resilience
- **Auto-Wait Locators**: use `page.locator(selector).click()`, never `page.click(selector)`

### Wait Strategies
- **Zero Sleep Policy**: never use arbitrary sleeps (`waitForTimeout`) — wait for explicit conditions
- **Network Timing**: wait for explicit network responses using predicates
- **Web-First Assertions**: use async assertions that retry automatically (`expect(locator).toBeVisible()`)
- **Signal-Based Waiting**: wait for specific network responses (200 OK) or UI state changes

### Data Management
- **API Seeding**: seed data via API, not UI — don't use the UI to register a user just to test login
- **Fresh Contexts**: each test in pristine environment (incognito context), no shared cookies/storage
- **Database Teardown**: clean up after tests, or run in rollback transactions

### Architecture
- **Page Object Model**: abstract selectors/actions into reusable classes — tests read like user stories
- **Determinism**: mock third-party external services (payment gateways, analytics) to prevent vendor downtime from breaking builds
- **Visual Regression**: use snapshot testing for canvas, charts, complex layouts where DOM assertion is insufficient

### Error Handling
- **Traceability**: capture video, network traces, screenshots solely on failure in CI
- **Soft Assertions**: verify independent elements so one failure does not hide others
- **Error Messages**: explain "Why" it failed, not just "What"

---

## 4. Unit Testing — Vitest Quick Reference

Config via `defineConfig` from `vitest/config`. Shares Vite config.

### Core API
- `test`/`it` for tests, `describe` for grouping
- `expect` with `toBe`, `toEqual`, `toMatchObject`, matchers
- Hooks: `beforeEach`, `afterEach`, `beforeAll`, `afterAll`, `aroundEach`

### Mocking
- Mock functions: `vi.fn()`, modules: `vi.mock()`, spies: `vi.spyOn()`
- Fake timers: `vi.useFakeTimers()`, advance: `vi.advanceTimersByTime()`
- Use `vi.hoisted()` for variables needed inside `vi.mock()` factory

### Key Features
- Snapshot testing: `toMatchSnapshot()`, `toMatchInlineSnapshot()`
- Coverage via V8 (default) or Istanbul: `vitest run --coverage`
- Custom fixtures: `test.extend()` for test context
- Concurrent tests: `test.concurrent()` (use context's `expect`)
- Filter by name (`-t`), file glob, tags, `--changed`, `--related`
- Shard for CI: `--shard=1/3`
- Per-file environment: `// @vitest-environment jsdom`
- Type testing: `expectTypeOf` with `.test-d.ts` files
- Multi-project workspace: `vitest.workspace.ts`
- CLI: `vitest` (watch), `vitest run` (single), `vitest bench` (benchmarks)

### Vitest Reference Files

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Vi Utilities | `references/vitest-advanced-vi.md` | Mock functions, spying, module mocking, fake timers |
| Configuration | `references/vitest-core-config.md` | vitest.config.ts setup |
| Test API | `references/vitest-core-test-api.md` | test/it modifiers, parameterized tests |
| Describe API | `references/vitest-core-describe.md` | Suite grouping, modifiers |
| Expect API | `references/vitest-core-expect.md` | Assertions, matchers, asymmetric matchers |
| CLI | `references/vitest-core-cli.md` | Commands, options, sharding |
| Hooks | `references/vitest-core-hooks.md` | Lifecycle hooks, around hooks |
| Mocking | `references/vitest-features-mocking.md` | Module mocking, timers, globals |
| Coverage | `references/vitest-features-coverage.md` | V8/Istanbul, thresholds, CI |
| Snapshots | `references/vitest-features-snapshots.md` | File/inline/error snapshots |
| Filtering | `references/vitest-features-filtering.md` | Name, tags, changed files |
| Concurrency | `references/vitest-features-concurrency.md` | Parallel tests, sharding, pools |
| Context/Fixtures | `references/vitest-features-context.md` | test.extend, custom fixtures |
| Environments | `references/vitest-advanced-environments.md` | jsdom, happy-dom, custom |
| Projects | `references/vitest-advanced-projects.md` | Multi-project, monorepo |
| Type Testing | `references/vitest-advanced-type-testing.md` | expectTypeOf, assertType |
| Generation | `references/vitest-generation.md` | Source/version metadata |

---

## 5. E2E Testing — Playwright Quick Reference

### Core Workflow
1. Analyze requirements — identify user flows to test
2. Configure Playwright with proper settings
3. Write tests — POM pattern, proper selectors, auto-waiting
4. Debug — fix flaky tests, use traces
5. Integrate — add to CI/CD pipeline

### Constraints

**MUST DO:**
- Use role-based selectors when possible
- Leverage auto-waiting (no arbitrary timeouts)
- Keep tests independent (no shared state)
- Use Page Object Model for maintainability
- Enable traces/screenshots for debugging
- Run tests in parallel
- Configure `testIdAttribute` when project uses custom test attributes
- Use `trace: 'retain-on-failure'` (not `on-first-retry`)

**MUST NOT DO:**
- Use `waitForTimeout()` (use proper waits)
- Rely on CSS class selectors (brittle)
- Share state between tests
- Ignore flaky tests
- Use `first()`, `nth()` without good reason

### Playwright Reference Files

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Selectors | `references/playwright-selectors-locators.md` | Locator priority, filtering, role selectors |
| Page Objects | `references/playwright-page-object-model.md` | POM patterns, fixtures, component POs |
| API Mocking | `references/playwright-api-mocking.md` | Route interception, HAR recording |
| Configuration | `references/playwright-configuration.md` | playwright.config.ts, auth, CI |
| Debugging | `references/playwright-debugging-flaky.md` | Flaky tests, trace viewer, waits |
| Data-Test Strategy | `references/playwright-data-test-strategy.md` | data-test attributes, testIdAttribute |
| API Response Verification | `references/playwright-api-response-verification.md` | Verifying API responses in E2E |
| Real Backend Testing | `references/playwright-real-backend-testing.md` | Full stack, email verification, DB |
| Visual Regression | `references/playwright-visual-regression.md` | Screenshots, computed styles |
| GitLab CI | `references/playwright-gitlab-ci.md` | GitLab CI/CD pipeline |
| Dialog Handling | `references/playwright-dialog-handling.md` | Browser confirm/prompt dialogs |

---

## 6. TDD Reference Files

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Good vs Bad Tests | `references/tdd-tests.md` | Test quality examples, red flags |
| Mocking Principles | `references/tdd-mocking.md` | When to mock, dependency injection |
| Deep Modules | `references/tdd-deep-modules.md` | Interface size vs implementation depth |
| Interface Design | `references/tdd-interface-design.md` | Designing for testability |
| Refactoring | `references/tdd-refactoring.md` | Post-TDD refactor candidates |
