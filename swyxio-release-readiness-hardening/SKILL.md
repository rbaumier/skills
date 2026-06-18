---
name: release-readiness-hardening
description: Prepare a repo for safe release and production deployment. Use when the user asks whether an app is ready to ship, needs deploy gates, environment validation, smoke tests, rollback planning, feature flags, migration checks, production verification, post-deploy monitoring, or a release checklist.
---

# Release Readiness Hardening

Use this skill to answer: can this ship safely, and how do we know? It turns release risk into explicit gates, evidence, and rollback paths.

## Workflow

1. **Inventory release surfaces**
   - Deployment platform, build command, runtime config, environment variables, migrations, storage, queues, providers, feature flags, health checks, monitoring, and rollback mechanism.
   - Current CI/CD, manual deploy steps, branch/tag/version policy, and production smoke path.

2. **Define release gates**
   - Required local checks: typecheck/lint/unit/build.
   - Required integration/e2e/visual checks for touched user journeys.
   - Required migration/data checks.
   - Required production-shaped smoke tests.
   - Required post-deploy verification and log review.

3. **Harden the deploy path**
   - Add startup/env validation for missing or malformed config.
   - Add health/readiness endpoints or equivalent checks.
   - Add smoke scripts with temporary records and cleanup.
   - Add feature flags or kill switches for risky new behavior.
   - Add rollback instructions for code, config, and data changes.

4. **Run the release rehearsal**
   - Execute local gates and record results.
   - Deploy to preview/staging/production as appropriate.
   - Verify routes, auth, persistence, critical workflows, logs, and metrics.
   - Clean up smoke data and confirm no residue.

5. **Ship report**
   - State shipped version/commit/deployment URL.
   - List gates passed, skipped, or blocked.
   - List known risks, rollback steps, and what to monitor next.

## Quality Bar

- Missing required env fails early with a clear message.
- Deploy verification uses production-shaped paths, not only local mocks.
- Rollback is concrete and tested or at least rehearsed.
- Smoke tests do not leave permanent test data.
- The final answer distinguishes green gates from accepted risk.

For the audit checklist, read [checklist.md](references/checklist.md).
