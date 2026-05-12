---
name: coding-standards:hygiene
description: Use when setting up a new project, configuring CI/CD, adding linters, writing custom lint messages, deciding on structural guardrails, or auditing project health for dead code, TODOs, and complexity.
---

## Project Hygiene

- Tests, linting, CI/CD, monitoring from day 1
- Constrain first, relax later
- Codebase homogeneity -- all-at-once or keep old way
- **Custom lint error messages as remediation instructions** -- when writing custom lint rules or CI checks, write the error message as a step-by-step fix the reader (or an AI agent) can follow directly. Not `'Cross-domain import violation'` but `'features/orders imports from features/inventory/db/queries.ts — only import from features/inventory/index.ts (public API).'` This makes lints self-service and removes the human bottleneck of explaining violations.
- **Cyclomatic and cognitive complexity — linter-enforced, not line-counted** -- file length is a proxy metric. The real constraint: cognitive complexity per function. Configure linter to fail on cognitive complexity > 15 per function (`eslint-plugin-sonarjs` or equivalent). A 400-line file of sequential logic is fine. A 60-line function with 4 levels of nesting is not. Reviews: function with deep nesting or complex branching -> flag the function, not the file
- **Linter-enforced domain isolation** -- enforce cross-domain access rules in CI, not by convention. Configure your linter to fail when a domain imports internal files of another domain. Only public index exports allowed across domain boundaries. Tooling enforces the architecture — convention alone does not.
- **Dead code removal as hygiene** -- unused imports, unreachable branches, commented-out code, and unused exports are liabilities. Run dead-code detection (`ts-prune`, `knip`, `deadcode` for Go) in CI. Reviews: any unreferenced export, unused variable, or unreachable branch -> flag for removal
- **Actionable TODOs with context** -- every TODO must include a specific action AND a version target or ticket reference. Format: `// TODO(v3.0): migrate to new parser` or `// TODO(#1234): remove when upstream fix lands`. Vague TODOs ("fix later", "clean up") are violations. Reviews: TODO without issue link or version target -> flag "add context or create ticket"
- Structural guardrails over discipline. Hard cutover. Pin all versions
