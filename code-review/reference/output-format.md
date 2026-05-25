# Output format for line-anchored findings

Agents anchoring findings to `file:line` emit a **lean JSON envelope** — enough for downstream triage and verbatim fix-prompt forwarding, nothing more. Verbose audit trails (`inspected` file lists, separate test-coverage prose, redundant scope restatements) multiply across a 12-agent fan-out and are the largest controllable drain on the orchestrator's context. Keep the payload tight.

Funnel L1/L2 stay textual (structural, not file:line-anchored). Dogfood (run by the composing loop) keeps its own contract.

Zero findings → respond exactly `No findings.` (textual, not JSON — preserves the convergence signal the consumer reads).

Else **respond with ONLY the JSON object**: first character `{`, last character `}`. No prose preamble, no reasoning narration, no markdown fence. The reasoning belongs in `analysis_chain` and nowhere else — a walkthrough before the JSON is pure wasted context across a 12-agent fan-out.

```json
{
  "findings": [
    {
      "file": "src/auth/session.rs",
      "line": 42,
      "severity": "bug",
      "confidence": "high",
      "signature": "src/auth/session.rs:42:unwrap-on-user-header",
      "title": "unwrap() on user-supplied header",
      "analysis_chain": [
        ".unwrap() on req.headers.get(\"X-Token\") — Option, missing header panics the handler",
        "X-Token is attacker-controlled",
        "no caller-site guard"
      ],
      "fix_prompt": "In src/auth/session.rs line 42, replace .unwrap() with .ok_or(AuthError::MissingToken)? to propagate instead of panic. Add a non-regression test: POST /session without X-Token expects 401, not 500."
    }
  ]
}
```

## Field rationales

- `analysis_chain` — auditable trace, **≤ 3 bullets, each ≤ 25 words**. The triage pass re-reads the cited code; a chain that doesn't survive that re-read = hallucination → dropped. This is the *only* reasoning channel — there is no separate prose section.
- `fix_prompt` — consumed verbatim by per-file fix agents; state the concrete line and concrete replacement. For `bug`/`security`/`performance`/`error_handling`, **append the non-regression test to add** in the same string (`Add a test: …`) — the fix agent's TDD step reads it from here.
- `signature` — dedup key `<file>:<line>:<failure-mode-slug>`. Controlled vocabulary when applicable: `panic-on-none` · `missing-validation` · `injection-sql` · `injection-shell` · `injection-template` · `missing-tenant-filter` · `secret-leak-log` · `unawaited-promise` · `dropped-future` · `race-shared-state` · `missing-timeout` · `unbounded-retry` · `path-traversal` · `toctou` · `wrong-role-check` · `missing-permission-check` · `n-plus-one` · `missing-transaction` · `replay-attack` · `session-fixation` · `zero-callers-dead` · `single-caller-inlinable` · `unused-param` · `derivable-default` · `redundant-overload`. Else a free 3-5 kebab-token slug. The downstream dedup matcher: same file, line ±3, same slug OR title-token Jaccard ≥ 0.6.
- `confidence` — `high|medium|low`, separate from severity. `severity: bug, confidence: low` survives downstream triage only with an airtight analysis_chain. Low-confidence security findings still warrant a 2nd look — don't merge with severity.

Severity: `bug` | `security` | `performance` | `error_handling` | `suggestion`. Suggestions are usually dropped at Context verification question 1.

Confidence: `high` | `medium` | `low`. Default `high` only when analysis_chain survives independent re-derivation.

## Two checks done silently — discipline kept, fields dropped

(Were `why_tests_dont_cover` / `inspected`.)

- *Test coverage* — before emitting a `bug`/`security`/`performance`/`error_handling` finding, grep the test suite. A test already exercising this exact failure mode means it's covered → drop the finding.
- *Read what you flag* — only flag a file you have actually read in full this session. A finding inferred from the diff slice without reading the implementation is a hallucination → don't emit it.
