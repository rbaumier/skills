# Iteration 2 — ASCII Diagram Rule Grading

**Date:** 2026-04-10
**Change:** Added `fs-ascii-diagram` assertion to existing eval suite
**Grading model:** Opus (cross-model grading — executor is Sonnet)

## Focus: fs-ascii-diagram assertion only

This iteration tests a single new assertion added to the existing full-sweep eval.

### Assertion

| ID | Description | Category |
|---|---|---|
| `fs-ascii-diagram` | Multi-step order pipeline (3+ steps) gets an ASCII diagram in comments showing the flow, not just prose | format |

### Results

| Run | Skill loaded? | ASCII diagram present? | Evidence | Verdict |
|---|---|---|---|---|
| Baseline | No | No diagram anywhere in output | Only prose comments like `// --- Types ---`, `// --- Discount logic ---` | **FAIL** |
| Run 1 | Yes | Yes — in `placeOrder` JSDoc | `validateUser() → calculateLineTotal() per item → verifyStock() per item (parallel) → persistOrder() → notifyBigOrder() → notifyUrgent() → sendConfirmationEmail() → return OrderDto` with vertical arrows | **PASS** |
| Run 2 | Yes | Yes — in factory block comment | `findUser() → computeLineTotals() → verifyStock() (parallel) → persistOrder() → notifyIfBigOrder() → updateCache()` with vertical arrows and ↓ connectors | **PASS** |
| Run 3 | Yes | Yes — in factory block comment | `validateUser() → computeLineItems() → verifyStock() → insertOrder() → flagHighValueOrder() + sendNotifications()` with vertical arrows | **PASS** |

### Summary

| Metric | Value |
|---|---|
| With skill pass rate | 3/3 (100%) |
| Without skill pass rate | 0/1 (0%) |
| Delta | +100% |
| Classification | **Discriminating** — with-skill passes, baseline fails |

### Notes

- All 3 with-skill runs chose a data-flow diagram (vertical arrows style), which is the most natural fit for this code
- None used box diagrams or state machine diagrams — the code doesn't have state transitions so this is correct
- The diagram placement varied: JSDoc (run 1), factory-level comment (run 2, 3) — both are valid per the rule (inline + module-level)
- Baseline didn't even attempt to visualize the flow — it used section labels (`// --- Types ---`) instead
- The rule wording "3+ sequential steps, state transitions, or entity relationships" correctly triggered on the 5+ step order pipeline
