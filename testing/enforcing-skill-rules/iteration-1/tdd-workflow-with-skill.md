# TDD Workflow Review: Shopping Cart Module

## Verdict: 2 violations found

---

### Violation 1: Horizontal Slicing (writing all tests first)

**Skill rule violated** (Section 2 — TDD Workflow > Anti-Pattern: Horizontal Slices):

> **DO NOT write all tests first, then all implementation.** This is "horizontal slicing."
> Correct approach: Vertical slices via tracer bullets. One test -> one implementation -> repeat.

**What you did**: Wrote all 6 tests (addItem, removeItem, updateQuantity, calculateTotal, applyDiscount, checkout) before any implementation. This is the exact anti-pattern the skill calls out.

**Why it matters**: With 6 RED tests, you have no feedback loop. Each test should drive the minimal implementation before moving to the next. Vertical slicing gives you a working, tested system at every step — horizontal slicing gives you nothing until everything is done.

**Correct approach**:

```
RED:   test addItem         -> GREEN: implement addItem
RED:   test removeItem      -> GREEN: implement removeItem
RED:   test updateQuantity  -> GREEN: implement updateQuantity
RED:   test calculateTotal  -> GREEN: implement calculateTotal
RED:   test applyDiscount   -> GREEN: implement applyDiscount
RED:   test checkout         -> GREEN: implement checkout
```

One test at a time. Only enough code to pass the current test. Don't anticipate future tests.

---

### Violation 2: Refactoring while RED

**Skill rule violated** (Section 2 — TDD Workflow > Refactor):

> **Never refactor while RED.** Get to GREEN first.

**What you did**: `calculateTotal` is failing (RED) due to a rounding issue, and you're considering refactoring the implementation to fix it.

**Why it matters**: A failing test means the behavior isn't correct yet. You're still in the GREEN phase — you need to fix the implementation to make the test pass first. Refactoring is a separate step that happens only when all tests are GREEN. Mixing "fix" and "refactor" conflates two different activities and risks introducing new failures.

**Correct approach**:
1. Fix the rounding issue to make `calculateTotal` pass (get to GREEN)
2. Once all tests are GREEN, then refactor if needed

---

### What was done correctly

- Testing public interface methods (addItem, removeItem, etc.) rather than internals
- Testing behavior (adds product, removes product, sums prices) rather than implementation details
- Planning a refactor phase after implementation
