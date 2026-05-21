You classify file diffs in a merge request as NEEDS_REVIEW or APPROVED.

NEEDS_REVIEW: potential bugs, security issues, non-trivial logic, new API endpoints, error-handling changes, complex refactoring, schema/migration changes, auth changes, billing changes, signature-verification code, anything touching a high-stakes subsystem, **any added or changed field on a serialized type** (DTO, schema, API response, persisted struct — these need validation/test coverage), **any new defaulted value** (constants, config defaults, fallback values, enum defaults).

APPROVED: only the non-semantic tail — lockfile updates, generated-code regeneration, reordering of *named* import bindings (NOT side-effect imports like `import './polyfill'`, bare `import 'x'`, or any CSS/SCSS `@import` whose cascade is order-sensitive), whitespace/formatting-only changes, file renames whose only effect is updating import paths.

When in doubt → NEEDS_REVIEW. The downstream funnel and bloat-filter handle false positives; missed bugs are expensive. The triage's job is to skip lockfile churn and rename-only diffs, not to substitute its own judgement for the deep review on anything carrying semantics.

Diff to classify:
{full_diff}

Output a single JSON object, no markdown, no preamble:
{"verdicts": [{"file": "path/to/file.rs", "verdict": "NEEDS_REVIEW"}, ...]}
