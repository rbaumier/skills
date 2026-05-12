---
name: coding-standards
description: Engineering standards umbrella — core philosophy and routing to focused sub-skills. ALWAYS load this when writing, reviewing, or refactoring code. The sub-skills (coding-standards:style, :design, :errors, :hygiene) hold the detailed rules; load them on demand based on the task.
---

This is the umbrella skill. It states the load-bearing **philosophy** and the meta-rule that **rules vary by boundary**, then routes to focused sub-skills. The detailed rules live in the sub-skills — load them based on what you're doing.

## Philosophy

Make invalid states unrepresentable. Functional core, imperative shell. Parse, don't validate. DRY.

- **Optional markers are banned** -- never use `?:` in TypeScript types or `.optional()` in Zod schemas. Every property is required and always present on the object. If a value can be absent, use `| null` (or `.nullable()` in Zod) — the key exists, the value is null. No shape ambiguity. Rationalizations ("caller might not have it", "safer", "more flexible", "API doesn't always return it") are all wrong — fix the caller, narrow the type, validate at the boundary, or default. Applies to types, schemas, Drizzle columns, function params, return types. Reviews: any `?:` or `.optional()` -> reject, demand `| null` or required field
- **Reuse before creating** -- search the codebase for existing equivalents before writing new code. Reviews: new code that duplicates existing functionality -> flag "reuse X instead"
- **Rule of Three -- don't abstract until 3+ occurrences** -- two similar snippets are coincidence, three are a pattern. Premature abstraction couples unrelated callers. When a shared function accumulates `if (options.X)` branches to serve diverging callers, it became a wrong abstraction. Fix: inline into every call site, delete what each caller doesn't need, re-extract only when a true shared pattern emerges. Reviews: shared function with 3+ option flags controlling branches -> flag "inline and re-extract"
- **Prefer boring technology** -- choose well-understood tools over novel ones. Novel solutions carry hidden costs in debugging, hiring, and documentation. Reviews: new dependency or pattern introduced when a well-known equivalent exists -> flag "justify why the boring option won't work"
- **State machines as enums** -- workflows with discrete states use an enum with a dedicated struct per state and a single `handle()`/`step()` method. Transitions via dedicated methods. Centralized dispatch via exhaustive match with uniform branches. Reviews: `status: string` with scattered `if (status === "...")` -> flag "model as state machine enum"
- **Cancellation as first-class citizen** -- every long-running async operation accepts a `CancellationToken` or `AbortSignal` parameter. Propagate through the entire call chain. Reviews: long async operation with no cancellation mechanism -> flag "add cancellation support"
- **Concentrate complexity in identified modules** -- inherent complexity (DI, routing, parsing, optimization) is intentionally concentrated in a small number of clearly identified files. The rest of the codebase stays simple. Only these critical files are allowed to exceed usual size limits. Reviews: complexity diluted across the entire codebase instead of isolated -> flag "concentrate in dedicated module"
- **Immutable configuration resolution** -- configuration is resolved once at boot into an immutable object. Two distinct types: `Config` (raw, nullable fields) and `SanitizedConfig` (resolved, required fields with defaults applied). Runtime code never works with the raw type. Reviews: `config.field ?? fallback` in runtime code -> flag "resolve at boot, not at use site"
- **Separation mechanism / policy** -- core implements the mechanism (how to do), policy (what to do) is injected via traits/interfaces. Allows changing policy without touching the mechanism. Reviews: business logic hardcoded in core infrastructure -> flag "inject as policy"
- **Symmetric sibling implementations** -- when a pattern is repeated for N variants (transports, adapters, drivers), each variant follows exactly the same file structure, same skeleton, same method names in the same order. Reviews: one variant with a different structure than its siblings -> flag "enforce symmetry"
- **Minimal main function** -- `main()` in 15 lines max. All logic in separate functions/modules. Main parses args, builds config, delegates. Reviews: main with 100+ lines containing business logic -> flag "extract to dedicated module"

## Rules vary by boundary

**Most rules in the sub-skills are strict at system boundaries, lax internally.** A "boundary" is anywhere code outside your control reads/writes: HTTP handlers, library exports, persisted records, message contracts, IPC, plugins. DRY, no-boolean-params, named options, exhaustive validation, sealed interfaces — these earn their cost at boundaries because consumers can't be updated atomically. Internally (one team, one repo, atomic refactor possible), the same rules become friction without benefit. When a rule says "boundary", apply it strictly; otherwise apply it as taste. Reviews: rule applied uniformly without distinguishing boundary status -> flag "scope the rule to its applicable surface"

## Sub-skills — load on demand

This umbrella contains only the core philosophy. The detailed rules are split into focused sub-skills:

| Sub-skill | What it covers | Load when |
|---|---|---|
| **`coding-standards:style`** | Comments, naming, control flow, readability, file structure | Writing or reviewing visible code surface — choosing a name, writing a comment, structuring control flow, organizing files |
| **`coding-standards:design`** | Functions, data & types, architecture, modularity | Designing a function/module/type, drawing boundaries, deciding what depends on what |
| **`coding-standards:errors`** | Error handling (Result/Option), assertions, user-facing messages | Handling errors, choosing between Result/throw/assert, writing user-visible error messages |
| **`coding-standards:hygiene`** | Project tooling, lint enforcement, CI checks, dead code, TODOs | Setting up a new project, configuring CI, adding linters, auditing project health |

Related skills (separate concerns, not coding-standards sub-skills):
- **`api-design`** — public surface, contracts, versioning, Hyrum's Law, pagination. Different concept than internal style (load instead of `:style`/`:design` when designing public APIs)
- **`testing`** + **`matt-tdd`** — test strategy and TDD workflow
- **`debugging`** — systematic root-cause investigation
- **`documentation`** — Diataxis, ADRs, docs structure

## Reading order for code review

When reviewing a PR, load sub-skills based on what the diff touches — not all of them at once. A diff that's purely renaming variables doesn't need `:errors`; a diff that's adding new error types doesn't need `:style`'s file structure rules. Match the skill to the diff.
