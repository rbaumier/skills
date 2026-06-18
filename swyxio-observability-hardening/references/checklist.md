# Observability Hardening Checklist

## Signals

- Structured logs with event name, route/action, status, duration, request/operation id.
- Error classes and safe user/developer messages.
- Metrics: latency, error rate, throughput, retry count, queue time, cost.
- Traces/spans for multi-step operations and provider calls.
- Product analytics for funnels and feature usage when appropriate.

## Redaction

- No secrets, tokens, cookies, auth headers.
- No raw private content by default.
- Prompt/LLM payloads local-only or explicitly gated.
- Bounded payload sizes and safe serialization.

## Debuggability

- Request id visible in logs and optionally user support surfaces.
- Provider/model/region/version labels.
- Stage history for long-running operations.
- Dashboards or saved queries for top incidents.
- Runbook links for common alerts.

## Validation

- Success path emits expected telemetry.
- Failure path emits sanitized diagnostics.
- Cancel/timeout/retry paths are distinguishable.
- Duplicate events are avoided.
- Production smoke verifies telemetry path when practical.
