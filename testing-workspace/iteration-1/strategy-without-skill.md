# Test Suite Review: UserService

## Severity: High — 8 issues found

---

### 1. Real database dependency in tests (Critical)

`beforeAll` connects to and seeds a real `Database`. Tests become slow, flaky, non-isolated, and require infrastructure to run.

**Fix**: Mock `Database` or use an in-memory implementation. Unit tests must not touch real I/O.

---

### 2. Shared mutable state across tests (Critical)

The `db` instance is shared and mutated — `register` inserts rows, `delete` removes them. Test execution order affects results. The `delete` test depends on a prior `register` call within the same test, but the seeded data from `beforeAll` persists and leaks between tests.

**Fix**: Reset database state in `beforeEach`, or use isolated mocks per test.

---

### 3. Snapshot assertion hides intent (`register` test) (High)

```typescript
expect(result).toMatchSnapshot();
```

Snapshots are brittle and hide what the test actually verifies. If the shape of `result` changes in a harmless way (e.g., new timestamp field), the snapshot breaks. If it changes in a harmful way, the snapshot gets blindly updated.

**Fix**: Assert specific fields that matter — `result.name`, `result.email`, `result.id` being defined.

---

### 4. Branch logic in test (`should work correctly`) (High)

```typescript
if (result) { expect(result.name).toBe('John'); } else { expect(result).toBeNull(); }
```

This test passes regardless of whether `getUser` returns the user or `null`. It cannot fail. A test with a conditional expectation is not a test — it is two mutually exclusive scenarios disguised as one.

**Fix**: Split into two tests with explicit setup — one where the user exists, one where it does not. Remove the branch.

---

### 5. Vague test name: `'should work correctly'` (Medium)

Describes nothing about the behavior under test. Cannot diagnose a failure from the name alone.

**Fix**: Use the pattern `"<method> — <scenario> — <expected outcome>"`, e.g., `"getUser returns the user when the ID exists"`.

---

### 6. Testing private internals (`delete` test) (High)

```typescript
(service as any)._cache.size
```

Casting to `any` to access `_cache` couples the test to implementation details. If the caching strategy changes (e.g., switch from Map to LRU, or remove cache), this test breaks even if delete still works correctly.

**Fix**: Assert observable behavior — after deletion, `getUser` should return `null` and the email service should not find the user.

---

### 7. Type-checking test is pointless (`type check`) (Medium)

```typescript
expect(typeof user.id).toBe('string');
```

This test constructs a literal object and checks its types at runtime. TypeScript already guarantees this at compile time. It tests the language, not the application. Zero value.

**Fix**: Delete this test entirely.

---

### 8. Formatting degrades readability (Low)

Multiple statements crammed onto single lines:

```typescript
let db: Database; let emailService: EmailService; let logger: Logger; let service: UserService;
```

**Fix**: One statement per line. Tests are documentation — readability is non-negotiable.

---

## Summary

| Issue | Severity | Category |
|---|---|---|
| Real database in unit tests | Critical | Isolation |
| Shared mutable state | Critical | Isolation |
| Snapshot hides intent | High | Assertions |
| Branch logic in test | High | Correctness |
| Private internals access | High | Coupling |
| Vague test name | Medium | Naming |
| Pointless type test | Medium | Relevance |
| Dense formatting | Low | Readability |

**Bottom line**: Two tests cannot fail (branching logic, type check), one test is coupled to internals, and the entire suite shares a real database. The suite gives false confidence — it would pass even with broken behavior. Fix isolation first, then rewrite assertions to test observable outcomes.
