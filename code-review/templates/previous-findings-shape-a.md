## Previous findings (iteration N-1)

You emitted these last iteration. Use to avoid re-deriving.

- signature: <file:line:slug> — title — disposition: fixed | dropped-by-triage (reason) | unfixed — attempts: N
  ...

Rules:
- Match by `signature`, not line number. Lines shift after fixes; `<file>:<slug>` is stable. New analysis on same `<file>:<slug>` → same finding.
- `attempts` = fix-and-revalidate cycles survived. Orchestrator escalates at 5 — don't pad analysis to claim progress; if hallucination keeps coming back, right move is `dropped-by-triage` next round, not another fix.
- `fixed`: verify new code actually resolves failure mode. Superficial fix (comment added, code re-arranged but bug remains) → re-emit with same signature so orchestrator recognises repeat-offender.
- `dropped-by-triage`: don't re-emit unless cited code materially changed. If yes, re-verify first.
- `unfixed`: re-emit only if failure mode still applies.
- Emit genuinely new findings from fix commit with fresh signatures.
