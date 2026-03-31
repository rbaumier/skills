# TDD Workflow Review

## Issues Found

### 1. Writing all 6 tests at once violates Red-Green-Refactor

TDD follows a strict cycle: write ONE failing test, make it pass, refactor, repeat. Writing all 6 tests upfront is "test-first development," not TDD. The difference matters because TDD's value comes from the tight feedback loop -- each test drives the next design decision incrementally. With 6 failing tests, you lose that feedback and end up batch-implementing, which is waterfall with tests written first.

**Fix**: Write one test (e.g., `addItem`), make it pass, refactor. Then write the next test.

### 2. Fixing `calculateTotal` rounding is not refactoring -- it is a bug fix

The rounding issue means `calculateTotal` produces wrong results. That is a Red phase problem (test fails because implementation is incorrect), not a Refactor phase problem. Refactoring changes structure without changing behavior. Fixing incorrect output changes behavior.

**Fix**: Stay in the Red-Green cycle for `calculateTotal`. Fix the implementation so the test goes green. Only then refactor (e.g., extract a helper, rename variables).

### 3. No evidence of incremental design

TDD should drive design decisions. Starting with a full list of 6 methods (`addItem`, `removeItem`, `updateQuantity`, `calculateTotal`, `applyDiscount`, `checkout`) suggests the API was designed upfront rather than emerging from tests. This defeats TDD's purpose of letting tests inform the interface.

## Correct TDD Flow for This Module

```
1. Test: addItem adds product to cart          -> RED
2. Implement addItem minimally                 -> GREEN
3. Refactor if needed                          -> REFACTOR
4. Test: removeItem removes product            -> RED
5. Implement removeItem minimally              -> GREEN
6. Refactor if needed                          -> REFACTOR
7. ... repeat for each behavior ...
```

## Summary

| Problem | Severity |
|---|---|
| All tests written before any implementation | High -- breaks the TDD cycle |
| Rounding fix misclassified as refactoring | Medium -- conflates bug fix with refactoring |
| API designed upfront instead of test-driven | Medium -- loses TDD's design benefit |
