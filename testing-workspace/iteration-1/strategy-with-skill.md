# Test Suite Review: `UserService`

## Violations Found

### 1. `toMatchSnapshot()` is a maintenance trap (Gotchas)

**Rule**: "snapshots grow stale and get blindly updated. Assert specific values instead."

```typescript
// test: 'register'
expect(result).toMatchSnapshot();
```

**Fix**: Replace with explicit assertions on the fields that matter:

```typescript
expect(result).toMatchObject({ name: 'Jane', email: 'jane@test.com' });
expect(result.id).toEqual(expect.any(String));
```

---

### 2. Conditional logic in tests (Writing Quality Tests)

**Rule**: "No logic in tests — no loops, conditionals; keep declarative and flat."

```typescript
// test: 'should work correctly'
if (result) { expect(result.name).toBe('John'); } else { expect(result).toBeNull(); }
```

This test passes regardless of the outcome. It asserts two contradictory things and succeeds at both. It verifies nothing.

**Fix**: Pick the expected behavior and assert it directly:

```typescript
test('getUser returns the user when it exists', async () => {
  const result = await service.getUser('1');
  expect(result).toMatchObject({ id: '1', name: 'John' });
});
```

---

### 3. Vague test names (Writing Quality Tests)

**Rule**: "Descriptive names: sentences with scenario + expected outcome."

- `'register'` — what about register? Happy path? Validation?
- `'should work correctly'` — says nothing about scenario or expectation.
- `'delete'` — what behavior is being verified?
- `'type check'` — not a behavior.

**Fix**: Use the pattern `<action> <scenario> <expected outcome>`:

```typescript
test('register creates user, sends welcome email, and logs event', ...)
test('getUser returns existing user by id', ...)
test('delete removes user from cache', ...)
```

---

### 4. Testing private internals (Testing Strategy — Test public interface only)

**Rule**: "Test public interface only — private methods are implementation details." / "Test behavior, not implementation — tests must survive refactoring."

```typescript
// test: 'delete'
const cacheSize = (service as any)._cache.size;
await service.delete('del@test.com');
expect((service as any)._cache.size).toBe(cacheSize - 1);
```

Casting to `any` to reach `_cache` is a red flag. This test breaks if the internal cache is renamed, replaced with a Map, or removed entirely — even if delete still works correctly.

**Fix**: Assert observable behavior:

```typescript
test('delete removes user so subsequent lookup returns null', async () => {
  const { id } = await service.register({ name: 'Del', email: 'del@test.com', password: 'p' });
  await service.delete('del@test.com');
  const result = await service.getUser(id);
  expect(result).toBeNull();
});
```

---

### 5. Testing type-level guarantees at runtime (Testing Strategy)

**Rule**: "Don't test what the type system already guarantees."

```typescript
// test: 'type check'
expect(typeof user.id).toBe('string');
expect(typeof user.name).toBe('string');
```

TypeScript already guarantees `User.id` is a string. This test adds zero value and will never fail unless the type definition itself is wrong — which would be caught at compile time.

**Fix**: Delete this test entirely.

---

### 6. Shared mutable state across tests — `beforeAll` with real DB (Data & State Management)

**Rule**: "Isolation — no test-to-test dependencies; no shared global state (DB, FS, network)." / "Explicit setup — each test creates its own data."

```typescript
beforeAll(async () => { db = new Database(); await db.connect(); await db.seed([testUser]); });
```

All tests share one DB instance seeded once. The `'register'` test inserts a user, the `'delete'` test inserts and deletes another. These mutations leak across tests. Execution order matters — reordering or running tests in isolation may break them.

**Fix**: Use per-test setup with transaction rollback, or re-seed in `beforeEach`:

```typescript
beforeEach(async () => {
  await db.beginTransaction();
  await db.seed([testUser]);
});
afterEach(async () => {
  await db.rollback();
});
```

---

### 7. Multiple unrelated concepts in one test (Writing Quality Tests)

**Rule**: "One concept per test — multiple assertions OK if same concept."

```typescript
// test: 'register'
// Concept 1: return value shape
expect(result).toMatchSnapshot();
// Concept 2: email side effect
expect(emailService.send).toHaveBeenCalledWith(...);
// Concept 3: logging side effect
expect(logger.info).toHaveBeenCalledWith(...);
// Concept 4: database persistence
const dbUser = await db.findById(result.id);
```

Four distinct concepts in one test. If the email assertion fails, you don't know if DB persistence works.

**Fix**: Split into focused tests:

```typescript
test('register persists user to database', ...)
test('register sends welcome email to new user', ...)
test('register logs registration event', ...)
```

---

## Summary

| # | Issue | Severity | Skill Rule |
|---|-------|----------|------------|
| 1 | `toMatchSnapshot()` on domain object | High | Gotchas |
| 2 | Conditional logic hides failures | Critical | Writing Quality Tests |
| 3 | Vague test names | Medium | Writing Quality Tests |
| 4 | Testing private `_cache` via `as any` | High | Test public interface only |
| 5 | Runtime type checks that TypeScript handles | Low | Don't test type guarantees |
| 6 | Shared DB state across tests | High | Isolation / Explicit setup |
| 7 | Multiple concepts per test | Medium | One concept per test |

**Verdict**: This suite has structural problems that undermine its value. Tests 2 and 4 are the most dangerous — one silently passes regardless of behavior, the other will break on any internal refactor. The shared DB state makes the suite order-dependent and non-parallelizable.
