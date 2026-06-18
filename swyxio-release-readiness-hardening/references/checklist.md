# Release Readiness Hardening Checklist

## Pre-Deploy

- Git status clean or intended dirty files documented.
- Typecheck/lint/unit/build pass.
- E2E/visual checks for touched surfaces.
- Migrations reviewed for forward/backward compatibility.
- Required env documented and validated.
- Feature flags or kill switches ready for risky changes.

## Deploy

- Preview/staging deploy when available.
- Production deploy command documented.
- Health/readiness route checked.
- Critical route/API status checked.
- Auth/session/persistence checked.
- Provider integrations checked or safely mocked with clear limits.

## Post-Deploy

- Smoke data created and cleaned up.
- Logs reviewed for boot errors, 4xx/5xx spikes, provider failures.
- Metrics/dashboards checked where available.
- Rollback command/path documented.
- Known risks and watch items listed.

## Output

- Commit/deployment URL.
- Gate table: passed/skipped/failed.
- Smoke evidence.
- Rollback plan.
- Post-deploy monitoring plan.
