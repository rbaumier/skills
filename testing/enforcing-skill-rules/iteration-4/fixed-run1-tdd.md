# Testing Skill Eval — TDD Workflow Review — Run 1

## Prompt

Review this TDD approach and list all issues:

> I'm building a shopping cart. Here's my plan:
> 1. Write ALL tests first (addItem, removeItem, updateQuantity, calculateTotal, applyDiscount, checkout) -- all 6 at once
> 2. Then implement all methods
> 3. calculateTotal test is failing due to rounding, so I'll refactor the implementation now
> 4. Once all tests pass, ship it

## Review: Every Issue Found

### Issue 1: All 6 tests written at once -- violates vertical slices

**Problem**: Writing all 6 tests upfront is horizontal slicing. You are designing the entire API surface before implementing any of it. This creates a batch-and-queue workflow where nothing is validated until the end.

**Rule**: Vertical slices via tracer bullets. Pick one thin slice (e.g., `addItem` adds a product to an empty cart) and go RED -> GREEN -> REFACTOR for that single slice before moving to the next.

**Fix**: Write one test (`addItem adds product to empty cart`). Make it pass. Refactor. Then write the next test (`addItem increments quantity for duplicate`). Make it pass. Refactor. Repeat.

---

### Issue 2: "Write all tests, then implement all methods" -- no tracer bullet

**Problem**: The plan is "all tests first, then all implementation." This is waterfall-in-miniature, not TDD. You lose the tight feedback loop that TDD provides. You cannot validate your API design incrementally. If test #5 reveals a design flaw, you have to rework tests 1-4.

**Rule**: Tracer bullet -- one thin slice end-to-end first. One test -> one implementation -> repeat. Never batch all tests first.

**Fix**: Cycle through RED-GREEN-REFACTOR one test at a time. Each cycle should be minutes, not hours.

---

### Issue 3: Refactoring while tests are failing -- violates RED/GREEN/REFACTOR

**Problem**: "calculateTotal test is failing due to rounding, so I'll refactor the implementation now." You cannot refactor during RED. Refactoring means changing code structure without changing behavior. If tests are failing, behavior is wrong -- you need to fix, not refactor.

**Rule**: RED -> GREEN -> REFACTOR. Refactor only when GREEN. During RED, write only the minimal code to make the failing test pass. During REFACTOR, all tests must stay GREEN.

**Fix**: First make calculateTotal pass (GREEN) with whatever minimal code works, even if ugly. Only then refactor the rounding logic while keeping all tests green.

---

### Issue 4: Plan to implement "all methods" at once -- not minimal code

**Problem**: "Then implement all methods" implies writing full implementations for all 6 methods in a single pass. TDD demands you write only enough code to pass the current failing test.

**Rule**: Write only enough code to pass the current test. Each GREEN step is the minimum possible implementation. This prevents over-engineering and ensures every line of production code is driven by a test.

**Fix**: After writing the `addItem` test (RED), write the minimal `addItem` implementation to pass it (GREEN). Do not touch `removeItem`, `calculateTotal`, etc. until their tests demand it.

---

## Summary

The proposed approach has 4 fundamental TDD violations:

| # | Violation | Correct approach |
|---|-----------|-----------------|
| 1 | All tests at once (horizontal slicing) | One test at a time (vertical slices) |
| 2 | All tests then all implementation (batch) | Tracer bullet: one test -> one impl -> repeat |
| 3 | Refactoring during RED (tests failing) | Refactor only when GREEN |
| 4 | Implement all methods at once | Minimal code to pass current test only |

The correct workflow for this shopping cart:
1. Write `addItem` test -> RED
2. Minimal `addItem` impl -> GREEN
3. Refactor if needed -> still GREEN
4. Write `removeItem` test -> RED
5. Minimal `removeItem` impl -> GREEN
6. ...repeat for each behavior

## Assertions Addressed

| ID | Status |
|----|--------|
| `vertical-slices` | FLAGGED - All 6 tests written at once is horizontal slicing, should be one at a time |
| `tracer-bullet` | FLAGGED - "All tests first then implement" is batch, not tracer bullet |
| `never-refactor-red` | FLAGGED - Refactoring calculateTotal while tests are RED violates RED/GREEN/REFACTOR |
| `minimal-code` | FLAGGED - "Implement all methods" at once is not minimal code per test |
