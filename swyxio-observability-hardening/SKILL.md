---
name: observability-hardening
description: Make a production application observable and debuggable with privacy-safe telemetry. Use when the user asks for structured logging, error classes, request IDs, traces, metrics, dashboards, alerts, product analytics, LLM/media operation visibility, user-visible operation status, or production debugging improvements.
---

# Observability Hardening

Use this skill when the product works but failures are opaque. The output should make production behavior explainable without leaking private data.

## Workflow

1. **Map what must be understood**
   - Identify critical user journeys, API routes, background jobs, provider calls, long-running operations, deploy/boot failures, and high-cost paths.
   - List current logs, error reporting, analytics, metrics, traces, request IDs, and dashboards.

2. **Define telemetry contracts**
   - Choose event names, log levels, error classes, span names, route labels, operation IDs, and redaction policy.
   - Separate product analytics from engineering diagnostics.
   - Keep user/prompt/content-heavy payloads local or redacted unless explicitly allowed.

3. **Instrument high-value paths**
   - Add request IDs/correlation IDs at entrypoints.
   - Add structured logs for start/success/failure of critical operations.
   - Add typed error classes or safe error envelopes.
   - Add metrics for latency, failure rate, retries, queue time, token/cost, cache, and provider/model behavior where relevant.
   - Add user-visible operation state for long-running or retryable workflows.

4. **Make it usable**
   - Add dashboards, log queries, or developer/admin views that answer real questions.
   - Define alert thresholds only for actionable failures.
   - Document how to debug top incidents.

5. **Validate**
   - Run local and production-shaped smokes.
   - Verify logs/events are emitted, correlated, redacted, and not duplicated.
   - Test representative failure paths.

## Quality Bar

- A failure can be traced from user action to route/job/provider and back.
- Logs are structured and low-cardinality where needed.
- Sensitive content is redacted by default.
- Alerts map to actions, not noise.
- Long-running operations show honest progress, elapsed time, and failure state.

For the audit checklist, read [checklist.md](references/checklist.md).
