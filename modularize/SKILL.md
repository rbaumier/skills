---
name: modularize
description: Extract and organize existing code into reusable modules, functions, and components with thoughtful APIs.
---

# Modularize

Use this when the user wants to refactor, extract, or organize code into reusable units (functions, modules, classes, components).

## Activation

### Use For

- modularizing an existing file, feature, or prototype
- extracting logic into functions, modules, or classes
- extracting repeated code into reusable utilities
- reducing duplication in a codebase
- turning a draft implementation into production-ready code structure
- splitting a large file into smaller, focused modules

### Do Not Use For

- brand-new feature or design work
- cosmetic changes (naming, formatting) without structural extraction
- style/lint cleanup without code extraction
- performance tuning or behavior changes only

## Load First

- No companion modules are required.

## Progress Updates

Keep the user informed so longer runs do not look stuck.

- One-line status update before each major phase.
- Concrete and lightweight: what you are doing now, not verbose logs.

## Workflow

1. Inspect existing project conventions (structure, naming, patterns) before
   creating new modules.
2. Identify repeated patterns, logical sections, and self-contained blocks of
   logic.
3. Extract units with clear, minimal APIs — explicit inputs/outputs, no hidden
   coupling.
4. Reuse or extend existing project utilities and modules where available.
5. Re-scan extracted code for remaining duplication.

## Rules

- Break large files into small, focused units instead of keeping everything in
  one place — extract repeated patterns, logical sections, and self-contained
  blocks into their own functions or modules
- Never bake caller-specific concerns into extracted units — configuration,
  context, and side effects belong at the call site; pass them in as
  parameters or options instead of hardcoding them
- Design APIs around inputs and outputs: prefer pure functions, explicit
  parameters, and return values over shared mutable state or globals
- When two or more blocks share the same structure and logic but differ only
  in values (labels, keys, endpoints, types) — extract them into a single
  reusable unit parameterized by those differences
- Group related extractions logically — one generic unit per responsibility,
  parameterized by variants, rather than near-duplicate specialized versions
  (e.g. one `formatDate(format)` instead of `formatShortDate` and
  `formatLongDate`); check the project for existing ones before creating new
  ones
- After extracting, scan the new units for duplicated patterns and extract
  shared logic into reusable helpers — e.g. repeated validation, repeated
  error handling, repeated data transformations, repeated wrappers
- Always use existing project utilities when they are available — reuse or
  extend them instead of creating new ones; helpers, validators, and shared
  types are especially common candidates
- Preserve public APIs and behavior — refactoring must not change what callers
  observe

## Verify

- Run relevant formatting, lint, typecheck, or tests when available.
- Confirm extracted code preserves the original behavior and public API.
