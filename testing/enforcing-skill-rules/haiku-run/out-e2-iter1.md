# Issues Found in TDD Approach

## Critical Issues

### 1. **All tests first violates tracer-bullet TDD (Line 3-4 of prompt)**
- **Rule violated**: "Vertical slices via tracer bullets. One test → one impl → repeat. Never all tests first."
- **Issue**: Writing all 6 tests simultaneously means you won't get RED-GREEN-REFACTOR feedback until the entire implementation is complete. You lose the benefit of failing tests guiding design incrementally.
- **Fix**: Write ONE test, implement, pass. Then move to the next test. This keeps you in tight feedback loops.

### 2. **Refactoring during RED phase (Line 5 of prompt)**
- **Rule violated**: "RED: write test → fail. GREEN: minimal code → pass. Refactor only when GREEN."
- **Issue**: The calculateTotal test failing due to rounding is still in RED. You should not refactor the implementation until ALL tests pass (GREEN phase).
- **Fix**: Once all tests are GREEN, then refactor for rounding issues. Never refactor during RED.

### 3. **Mixing implementation phases (Lines 2-4 of prompt)**
- **Rule violated**: "Never all tests first." "One test → one impl → repeat."
- **Issue**: You're stacking all tests, then all implementation, then debugging. This divorces tests from implementation and hides design errors. If test #3 reveals that your test #1 design was wrong, you now have to rewrite everything.
- **Fix**: Strictly follow the cycle: write one test (RED) → implement minimally (GREEN) → refactor (if needed, while GREEN) → commit → repeat.

---

## Secondary Issues

### 4. **No description of test names (Line 12-18 of prompt)**
- **Rule violated**: "Test Naming as Specification — Names follow `should [action] when [condition]`."
- **Issue**: Test names like `it('addItem adds product')` are vague. They don't specify the scenario or expected behavior clearly.
- **Fix**: Use format: `should add item when cart is empty`, `should increment quantity when item already exists`, etc.

### 5. **No ZOMBIES coverage analysis mentioned (Testing Strategy section)**
- **Rule violated**: "ZOMBIES mnemonic for edge-case coverage: Zero/empty, One, Many, Boundaries, Interfaces, Exceptions, Simple/edge."
- **Issue**: The 6 tests proposed are happy-path only. No tests for edge cases like empty cart, max quantity, invalid discount, failed checkout.
- **Fix**: For each method, design tests covering ZOMBIES categories before writing code:
  - `addItem`: empty cart (Z), single item (O), many items (M), duplicate item (I), null/invalid product (E)
  - `calculateTotal`: empty cart (Z), one item (O), many items (M), rounding boundary (B)
  - etc.

### 6. **calculateTotal rounding failure is a design smell (Line 5-6 of prompt)**
- **Rule violated**: Tight RED-GREEN-REFACTOR loops prevent late-stage failures.
- **Issue**: If rounding is failing only after implementation, your test design didn't adequately specify the precision requirement.
- **Fix**: Before writing code, write the test with explicit precision requirements (e.g., `expect(total).toBeCloseTo(19.99, 2)`). This forces the design contract upfront.

---

## Recommended Revised Approach

```
1. Pick ONE method (e.g., addItem)
2. Write ONE test covering the happy path: `should add item when cart is empty`
3. Implement addItem minimally (just store the item)
4. Test passes (GREEN)
5. Write next test for addItem: `should increment quantity when item already exists`
6. Implement the logic to handle duplicate items
7. Repeat until addItem is complete with ZOMBIES coverage
8. Move to removeItem, repeat process
9. (Only refactor when ALL tests for a method are GREEN)
10. Ship when all 6 methods have full coverage
```

Each method is a "vertical slice" — fully tested, implemented, shipped before moving on.
