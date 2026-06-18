---
name: test-strategy-hardening
description: Audit and harden a repository test suite so tests carry their weight. Use when the user asks whether tests are useful, flaky, duplicated, slow, under-covering critical behavior, missing contract/regression coverage, or when a codebase needs a test strategy before major refactors, releases, security work, or production hardening.
---

# Test Strategy Hardening

Use this skill to turn a decorative or fragile test suite into a trustworthy engineering control. Optimize for confidence per minute, not raw coverage count.

## Workflow

1. **Inventory the test system**
   - Discover test commands, frameworks, e2e harnesses, fixtures, mocks, snapshots, CI config, coverage tooling, and runtime.
   - Classify tests by layer: pure unit, contract/schema, integration, e2e/browser, visual, smoke, load/perf, migration/data.
   - Record current pass/fail/flaky/skip status and approximate runtime.

2. **Judge whether tests carry their weight**
   - Identify tests that pin real product contracts, past regressions, critical user journeys, external/provider parsing, migrations, permissions, and failure modes.
   - Flag broad snapshots, duplicate happy paths, brittle implementation assertions, no-op smoke tests, overmocked tests, and tests whose names exceed their proof.
   - Keep valuable slow tests, but move them to explicit suites if they block normal development.

3. **Write a decision-complete test plan**
   - Define the critical behaviors that must not regress.
   - Pick the minimum suite shape: fast local default, focused changed-surface suites, e2e golden paths, release smoke, and optional nightly/heavy checks.
   - Specify deletions, rewrites, new characterization tests, and fixtures before touching behavior.

4. **Harden in green slices**
   - Add characterization tests before refactors.
   - Replace low-value tests with narrower tests that fail for the right reason.
   - Build contract tests around external/API/provider boundaries.
   - Add e2e/visual coverage only for user-critical journeys; visually inspect screenshots when UI matters.
   - Keep fixtures small, named, deterministic, and close to the behavior they prove.

5. **Report the result**
   - Summarize tests added, removed, merged, skipped, or quarantined.
   - Report runtime before/after and what confidence improved.
   - Leave explicit gaps and next target suites.

## Quality Bar

- A normal developer can run the fast suite frequently.
- Critical product journeys have at least one high-signal regression path.
- External contracts fail loudly before bad data reaches UI or business logic.
- Tests have clear names, minimal mocks, deterministic fixtures, and useful failure messages.
- The final report answers: "What bugs would this suite catch that it used to miss?"

For the audit checklist, read [checklist.md](references/checklist.md).
