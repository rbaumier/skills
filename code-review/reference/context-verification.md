# Context verification protocol

Inject this block verbatim into every line-anchored prompt (Correctness, Subsystem, Tests, Skill, CLAUDE.md Compliance, Occam Razor). Funnel L1/L2 don't need it (structural, not failure-mode-inferred).

```
## Context verification — MANDATORY before reporting any finding

For every potential finding, answer these questions. If any answer kills the finding, drop it silently.

1. **Callers/callees** — is the missing validation/conversion/error-handling already done at the call site or in a visible wrapper? If yes, drop.
2. **Test context** — does the path contain a *segment* (between `/` separators) named exactly `tests`, `test`, `__tests__`, `spec`, `specs`, `fixtures`, `mocks`, OR a filename matching `*_test.*` / `*.test.*` / `*.spec.*` / `test_*.py` / `*_spec.rb`, OR code inside `#[cfg(test)]` / `describe(` / `test(` / `it(` / `def test_`? Substring matches don't count — `src/prospecting/`, `src/mockingbird/` are production. In test code, `.unwrap()` / `panic!` / missing validation are normal — drop unless it's a genuine logic bug.
3. **Intentional comments** — is there a `// SAFETY:` / `// intentionally` / `// fallback` / `# noqa` that *specifically* addresses the failure mode you would flag? A `// SAFETY:` justifying an unchecked-bounds index does NOT silence a race condition on the same line. Match must be specific.
4. **Diff is the fix** — does the added code resolve the same failure mode you're about to flag, or only a different aspect? `.unwrap()` → `?` resolves panic-on-None; `format!` → bind params resolves SQL injection but does NOT resolve a missing tenant filter. Drop only when the diff addresses your specific failure mode.
5. **Type tracing** — for a claimed type mismatch (`f64` vs `i64`, `Option<T>` vs `T`, `&str` vs `String`), trace the value flow through the diff. If a conversion exists anywhere on the path, the types are consistent — drop.
```
