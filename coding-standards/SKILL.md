---
name: coding-standards
description: Enforce engineering standards — readability, robustness, maintainability, type safety. ALWAYS use when writing, reviewing, or refactoring code. Use for architecture decisions, system design, component boundaries, tooling choices, and documentation conventions.
---

## Philosophy

Single source of truth. Make invalid states unrepresentable. Locality of behavior. Functional core, imperative shell. Parse don't validate. DRY. Idiomatic. Entropy is the enemy.
- **Reuse before creating** -- before writing a new function, component, or module, search the codebase for existing code that does the same thing or something close. Extend or compose existing code rather than duplicating. Reviews: new code that duplicates existing functionality -> flag "reuse X instead"

## Naming

- **Intent over implementation**: `closeAccount()` not `setStatusToClosed()`. **Banned function-name words: `process`, `handle`, `data`, `do`, `execute`, `run`, `perform`** -- vague mechanics. Replace: `processOrder` -> `fulfillOrder`, `handlePayment` -> `chargeCustomer`. Reviews: any function with banned word -> rename
- Symmetry: `get/set`, `add/remove`, `start/stop`
- Booleans: `is`/`has`/`should`/`can` prefix, positive form
- Full words always (`user` not `u`, `account` not `acct`). Destructure abbreviations: `const { timestamp, buffer, userId } = record`. Remove unused params
- Explicit units: `delayMs`, `fileSizeKb`

## Control Flow

- Guard clauses, early return, max 3 indent levels
- `switch`/object maps over `if/else` chains
- **Split boolean flags into two named functions**: `sendUrgentNotification()` / `sendNormalNotification()` not `sendNotification(msg, isUrgent)`. **A ternary, if/else, or options object is NOT a fix** -- boolean still exists as param. Result: two independently callable functions with zero boolean params. Reviews: boolean controlling branch -> split
- Return new data, don't mutate inputs
- `Promise.all` for independent async ops

## Functions

- **Inject deps via factory: `createService(deps)`** -- pass all I/O (db, cache, email) as args. Composition root = only place knowing concretions. Most impactful architectural rule
- Max 30 lines. Pure by default. SRP
- Max 3 positional args; options object for 4+
- CQS -- command OR query. Composition over inheritance
- Focused modules -- no `common`/`shared` grab-bags

## Data & Types

- Immutable -- map/filter/reduce/spread
- Extract literals to named constants
- Strict typing everywhere
- Externalize config -- rates, thresholds, multipliers in config objects, not inline. Business params changeable without editing function bodies
- **Bound every input -- reject, always reject** -- every external param validated and **rejected** if invalid. `weight` must be `> 0 && < MAX_WEIGHT` or throw. `country` must be in allowed set or throw. **NEVER `?? defaultValue`, `?? 0`, `|| fallback` for invalid inputs** -- silent-failure bugs. Only correct response: **throw or return Result error**. Reviews: `?? value` or `|| default` on external input -> flag as bug, replace with throw/guard

## Error Handling

- Surface all failures -- every `catch` handles or propagates
- **Result for ALL errors, no exceptions** -- expected, unexpected, unrecoverable. Never `throw`. Error boundaries at the edge (middleware, main) convert Result errors to HTTP 500 / process exit / log + restart
- Preserve original stack trace/cause when wrapping
- Timeout on every I/O

## Readability

**Write code a low-IQ junior understands on the first pass.** Recipe style — clear steps, named ingredients, no magic.

- **Intermediate variables for every compound expression** -- 2+ operations = extract to named variable. Reviews: compound inlined -> flag
- **One blank line between logical blocks** -- group: setup, validation, transform, return
- **No clever code** -- no nested ternaries, no multi-operation one-liners, no implicit coercion (`+[]`, `!!value`). 5-line inline block -> extract as named function

## Comments

**Comment generously. When in doubt, comment.** A 5-line comment explaining a subtle algorithm is better than no comment. You need a reason NOT to comment, not a reason to comment.

- **JSDoc on every export** -- plain block description on functions, types, constants when not self-evident. `@example` with call AND return (`// => value`) only on functions that return something. Not optional for functions
- **Step-by-step for multi-stage logic** -- `// 1. Validate`, `// 2. Transform`, `// 3. Persist`. Reader understands the algorithm WITHOUT reading the code
- **Why-comments on every non-obvious choice** -- why this approach, why not the obvious alternative, why this order
- **Domain knowledge** -- business rules, regulatory constraints, external system quirks a new dev wouldn't know
- **Gotcha warnings + links** -- `// WARNING: this API returns null on weekends` / `// See: https://github.com/org/repo/issues/123` for workarounds

**Never write:** trivial restating (`// increment i`), commented-out code, `TODO`/`FIXME` without tracking issue. **Rules:** API docs from code; ADR for structural decisions

## File Structure

- Newspaper metaphor -- high-level at top
- Tests next to source. Group by feature not type
- **Max 200 lines per file** -- if a file approaches this limit, split by responsibility. A file doing two things is two files. Reviews: file > 200 lines -> flag "split this file"

## Architecture

- **Vertical slices** -- each feature owns schema/errors/data/logic/API
- **Factory DI** -- `createOrderService({ db, emailer, logger })`. Plain functions, framework-free
- **Crosscutting via wrapping** -- `withTracing(service)` / `withLogging(service)` intercept every method. No `logger.info()` in business logic. Reviews: logging inside service method -> recommend wrapper pattern
- **Structured API errors** -- `{ type, code, status, detail }` not bare `{ message }` strings
- **Map DB entities to DTOs** -- dedicated response types for API outputs. Reviews: raw DB entity returned -> flag "missing DTO mapping"
- **API-first** -- define schema (OpenAPI, route schema) BEFORE handler. Zod is complementary but not api-first. Contract must exist as standalone artifact. Reviews: handler without schema -> flag "missing API contract"

## Project Hygiene

- Tests, linting, CI/CD, monitoring from day 1
- Constrain first, relax later
- Codebase homogeneity -- all-at-once or keep old way
- Structural guardrails over discipline. Hard cutover. Pin all versions
