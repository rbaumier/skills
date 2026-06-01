# Grade — testing skill, eval 2, iter 1

Output is a code-review document critiquing a TDD plan. PASS requires the
assertion's violation to be CLEARLY corrected/addressed in the actual text (cited).

| id | verdict | evidence | reasoning |
|----|---------|----------|-----------|
| vertical-slices | PASS | Issue #1 (L5-8): "Writing all 6 tests simultaneously means you won't get RED-GREEN-REFACTOR feedback". Fix (L8): "Write ONE test, implement, pass. Then move to the next test." Revised approach L48-59 enforces one-method-at-a-time vertical slices. | The horizontal-slicing trap (all 6 tests at once) is explicitly named and corrected toward one test → one impl → repeat. |
| tracer-bullet | PASS | Issue #1 title (L5): "All tests first violates tracer-bullet TDD"; rule cited (L6): "Vertical slices via tracer bullets... Never all tests first." Issue #3 (L15-18) reinforces "Never all tests first." | The "all tests first then all implementation" trap is directly identified and rejected, prescribing thin end-to-end slices. |
| never-refactor-red | PASS | Issue #2 (L10-13): "Refactoring during RED phase"; "You should not refactor the implementation until ALL tests pass (GREEN phase)"; Fix (L13): "Never refactor during RED." Reinforced L18, L55. | The refactor-during-RED trap (calculateTotal) is explicitly called out and corrected to refactor only when GREEN. |
| minimal-code | PASS | Issue #3 fix (L18): "implement minimally (GREEN)". Revised approach L50: "Implement addItem minimally (just store the item)". Counters the "implement all methods at once" trap (L17: "stacking all tests, then all implementation"). | The all-at-once-implementation trap is named and corrected to writing only enough code to pass the current test. |

## Summary
4/4 PASS. All four behavioral traps are explicitly identified and corrected with
concrete fixes in the review document.
