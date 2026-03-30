---
name: coding-standards
description: Enforce engineering standards — readability, robustness, maintainability, type safety. ALWAYS use when writing, reviewing, or refactoring code. Use for architecture decisions, system design, component boundaries, tooling choices, and documentation conventions.
---

## Philosophy

- **Single source of truth** — one write location, no exceptions
- **Make Invalid States Unrepresentable** — type system eliminates bugs at compile time
- **Locality of Behavior** — related logic close; easy to delete
- **Functional Core, Imperative Shell** — pure business logic, side effects at boundaries
- **Parse, Don't Validate** — trusted types at boundary, no scattered checks
- **Entropy is the enemy** — every line must earn its place
- **DRY** — duplication is a missed abstraction. Ruthlessly eliminate
- **Idiomatic** — embrace language conventions
- **Conceptual Compression** — right abstraction hides complexity without hiding logic

## Naming

- Intent over implementation: `closeAccount()` not `setStatusToClosed()` — names describe the business action, not the mechanical step. Vague names like `process`, `data`, `handle` are almost always wrong; name what you're actually doing and what the data represents
- Symmetry: `get/set`, `add/remove`, `start/stop` — asymmetric pairs confuse readers
- Booleans: `is`/`has`/`should`/`can` prefix. No negations (`isEnabled` not `isNotDisabled`)
- No single-letter names (`user` not `u`), no abbreviations (`account` not `acct`), no acronyms. This applies to object properties too — if you receive `d.ts`, `d.buf`, `d.uid`, destructure into meaningful names: `const { timestamp, buffer, userId } = record`. Remove unused parameters entirely
- Explicit units: `delayMs`, `fileSizeKb` — never bare `delay`, `size`

## Control Flow

- Guard clauses, exit early. No `else` after `return`. Max 2 indent levels
- `switch`/object maps over `if/else` chains
- **No boolean flags as args** — split into two named functions: `processUrgentOrder()` / `processNormalOrder()`. A ternary selecting between functions is NOT a fix. Two independently callable units must exist
- Too much state → state machine
- Never mutate objects you don't own — return new data
- `Promise.all` for independent async ops

## Functions

- **Inject dependencies via factory: `createService(deps)`** — never hard-import I/O modules (db, cache, email). Composition root is the only place that knows concrete implementations. Most impactful architectural rule
- Max 30 lines. Pure by default. SRP
- Max 3 positional args; options object for 4+
- CQS — command OR query, never both
- Composition over inheritance; max 2 levels
- No `common`/`shared` grab-bags

## Data & Types

- Immutable — map/filter/reduce/spread, never mutate
- No magic numbers/strings — named constants
- Strict typing non-negotiable
- Externalize config — shipping rates, thresholds, multipliers belong in config objects, not inline constants. Business params must be changeable without editing function bodies
- **Bound every input — reject, never fallback** — every parameter from outside your trust boundary must be validated and **rejected** if invalid. `weight` must be `> 0 && < MAX_WEIGHT` or throw/return error. `country` must be in an allowed set or throw/return error — **never use `?? defaultValue` or a fallback for unknown values**. `couponCode` must match a known pattern or throw/return error. Silent defaults on invalid input hide bugs and create data corruption. Add guard clauses at the top that **stop execution** on bad input
- Pin all versions — never `latest`

## Error Handling

- No silent failures — never empty `catch`
- Result/Either for expected errors — exceptions for exceptional only
- Preserve original stack trace/cause when wrapping
- Timeout on every I/O

## Comments

**Write:** function contracts, design overviews, why-comments, domain knowledge, checklists
**Never:** trivial (`// increment i`), section dividers (`// --- Types ---`), commented-out code, `TODO`/`FIXME` without issue
**Rules:** generate API docs from code; enforce via automation; ADR for structural decisions

## File Structure

- Newspaper metaphor — high-level at top
- Colocation — tests near source, not separate tree
- Group by feature, not by type
- Max 300 lines per file — approaching this limit signals the file has multiple responsibilities. Split before it gets worse

## Architecture

- **Vertical slices** — each feature owns schema/errors/data/logic/API
- **Factory DI** — `createOrderService({ db, emailer, logger })`. No containers, no decorators
- **Crosscutting via wrapping** — `withTracing(service)` / `withLogging(service)` wrappers intercept every method. Never scatter `logger.info()` in business logic. In reviews: if logging is inside a service method, recommend the wrapper pattern by name
- **Structured API errors** — `{ type, code, status, detail }`. Always use machine-readable format instead of bare `{ message }` strings
- **Map DB entities to DTOs for API responses** — always create dedicated response types (DTOs/view models) for API outputs. Return the DTO, keep the entity internal. In reviews: if a handler returns a raw DB entity, flag "missing DTO mapping"
- **API-first** — define schema (OpenAPI, route schema) BEFORE handler. Zod for runtime parsing is NOT api-first. The contract must exist as standalone artifact clients generate types from. In reviews: if handler exists without schema, flag "missing API contract"

## Project Hygiene

- Tests, linting, CI/CD, monitoring from day 1
- Constrain first, relax later — strict schemas, least privilege
- Codebase homogeneity — migrate all-at-once or not at all
- Structural guardrails over human discipline
- Hard cutover, no backward compat
