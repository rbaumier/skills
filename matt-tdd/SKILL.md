---
name: matt-tdd
description: Test-driven development with red-green-refactor loop. Use when user wants to build features or fix bugs using TDD, mentions "red-green-refactor", wants integration tests, or asks for test-first development.
---

# Test-Driven Development

## Philosophy

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification - "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

**Do not add tests which simply restate the implementation. These provide zero confidence.** A test that mirrors the code — same branches, same constants, same mocks shaped like the function body — cannot catch a bug, because any bug in the impl is duplicated in the test. It passes by tautology. If you can copy lines from the implementation into the assertion and the test still passes, it's not a test, it's a checksum of itself. Delete it or rewrite it against a real oracle (a spec, a reference implementation, an observable user-facing outcome).

**Scope qualifier for "tests survive refactors":** this rule applies at the **system boundary** — the public API, the user-facing behavior, the contract that outside callers depend on. It does **not** apply to internal scaffolding tests written during development. Those are expected (and welcome) to break during a refactor; the breakage is how the type system and red squigglies guide the change. Treat internal tests as designed artifacts (see `testing` skill) — they can be rewritten, deleted, or refactored just like any other code. The maxim "good tests survive refactors" without this scope qualifier produces over-mocked, behavior-blind suites that pass while production breaks.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" - treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

**Correct approach**: Vertical slices via tracer bullets. One test → one implementation → repeat. Each test responds to what you learned from the previous cycle. Because you just wrote the code, you know exactly what behavior matters and how to verify it.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## Workflow

### 1. Planning

When exploring the codebase, use the project's domain glossary so that test names and interface vocabulary match the project's language, and respect ADRs in the area you're touching.

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for [deep modules](deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Tracer Bullet

In a typed codebase, the loop is **Type → Test → Code → Refactor**, not Test → Code → Refactor. The type signature is the first executable spec — a failing typecheck is the first red, before the test runner is even invoked. This is not a deviation from TDD; it's TDD acknowledging that the signature is part of the test surface in a language that has one.

Write the signature first (one function, one struct, one trait — minimal to express the behavior you're about to test), then the test, then the body.

Then write ONE test that confirms ONE thing about the system:

```
TYPE:  Write the signature → typecheck fails (or signature didn't exist)
RED:   Write test against that signature → test fails
GREEN: Write minimal code to pass → test passes
```

This is your tracer bullet - proves the path works end-to-end.

### 3. Incremental Loop

For each remaining behavior:

```
RED:   Write next test → fails
GREEN: Minimal code to pass → passes
```

Rules:

- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior

### 4. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## When TDD doesn't fit — build a bespoke harness instead

For some domains the generic xUnit shape feels wrong, and "skip TDD" is the lazy answer. The right answer is to build a problem-specific harness that gives you the same feedback loop:

- **Concurrent / distributed systems:** TLA+ for design-level invariants, Jepsen-style chaos testing, recorded replay logs against the real implementation
- **Games / simulations:** record-and-replay determinism tests, golden-frame screenshots, behavior trees with assertions
- **Compilers / parsers:** corpus-based testing (run against real input files, snapshot the output), differential testing against a reference implementation
- **Schemas / migrations:** round-trip property tests on real production data shapes, migration replay against a copy of prod
- **Performance work:** benchmark suites with regression thresholds, criterion-style statistical comparisons

TDD bridges "I think I know how to solve this" → "this is what the code looks like". It does not replace upstream problem-thinking. When the unit/integration shape doesn't fit your domain, design the test harness as carefully as you'd design the production code — it's still test-first, just with a different test shape.

## Checklist Per Cycle

```
[ ] Type signature written before test
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor (if test is at a system boundary)
[ ] Code is minimal for this test
[ ] No speculative features added
```
