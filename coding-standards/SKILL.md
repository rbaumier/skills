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

- **Intent over implementation**: `closeAccount()` instead of `setStatusToClosed()` — names describe the business action, not the mechanical step. **Banned words in function names: `process`, `handle`, `data`, `do`, `execute`, `run`, `perform`** — these are vague verbs that describe mechanics. Replace with the specific business action: `processOrder` → `fulfillOrder`, `handlePayment` → `chargeCustomer`, `processData` → `scoreCustomers`. In reviews: if any function contains a banned word, rename it
- Symmetry: `get/set`, `add/remove`, `start/stop` — asymmetric pairs confuse readers
- Booleans: `is`/`has`/`should`/`can` prefix. Use positive form (`isEnabled` instead of `isNotDisabled`)
- Use full words for all names (`user` instead of `u`, `account` instead of `acct`). This applies to object properties too — if you receive `d.ts`, `d.buf`, `d.uid`, destructure into meaningful names: `const { timestamp, buffer, userId } = record`. Remove unused parameters entirely
- Explicit units: `delayMs`, `fileSizeKb` — always include the unit in the name

## Control Flow

- Guard clauses, exit early. Keep `return` paths flat. Max 2 indent levels
- `switch`/object maps over `if/else` chains
- **Split boolean flags into two named functions**: `sendUrgentNotification()` / `sendNormalNotification()` instead of `sendNotification(msg, isUrgent)`. **A single function with a ternary, if/else, or options object is NOT a fix** — the boolean flag still exists as a parameter. The result must be two independently callable functions with zero boolean parameters. In reviews: if a function accepts a boolean that controls branching, split it into two functions
- Too much state → state machine
- Return new data instead of mutating input objects
- `Promise.all` for independent async ops

## Functions

- **Inject dependencies via factory: `createService(deps)`** — pass all I/O modules (db, cache, email) as arguments. Composition root is the only place that knows concrete implementations. Most impactful architectural rule
- Max 30 lines. Pure by default. SRP
- Max 3 positional args; options object for 4+
- CQS — command OR query, keep them separate
- Composition over inheritance; max 2 levels
- Keep modules focused — extract shared code into purpose-named modules instead of `common`/`shared` grab-bags

## Data & Types

- Immutable — map/filter/reduce/spread for all transforms
- Extract all literals to named constants
- Strict typing required everywhere
- Externalize config — shipping rates, thresholds, multipliers belong in config objects, not inline constants. Business params must be changeable without editing function bodies
- **Bound every input — reject, always reject** — every parameter from outside your trust boundary must be validated and **rejected** if invalid. `weight` must be `> 0 && < MAX_WEIGHT` or throw/return error. `country` must be in an allowed set or throw/return error. `couponCode` must match a known pattern or throw/return error. **NEVER use `?? defaultValue`, `?? 0`, `|| fallback`, or any silent default for unknown/invalid inputs** — these hide bugs. The only correct response to invalid input is to **throw an error or return a Result error that stops execution**. In reviews: if you see `?? value` or `|| default` on an external input, flag it as a silent-failure bug and replace with a throw/guard clause
- Pin all versions — lock exact versions in lockfile

## Error Handling

- Surface all failures — every `catch` must handle or propagate
- Result/Either for expected errors — reserve exceptions for truly unexpected cases
- Preserve original stack trace/cause when wrapping
- Timeout on every I/O

## Comments

**Write:** function contracts, design overviews, why-comments, domain knowledge, checklists
**Skip:** trivial restating of code (`// increment i`), section dividers (`// --- Types ---`), commented-out code, `TODO`/`FIXME` without tracking issue
**Rules:** generate API docs from code; enforce via automation; ADR for structural decisions

## File Structure

- Newspaper metaphor — high-level at top
- Colocation — tests next to source files
- Group by feature, not by type
- Max 300 lines per file — approaching this limit signals the file has multiple responsibilities. Split before it gets worse

## Architecture

- **Vertical slices** — each feature owns schema/errors/data/logic/API
- **Factory DI** — `createOrderService({ db, emailer, logger })`. Use plain functions, keep it framework-free
- **Crosscutting via wrapping** — `withTracing(service)` / `withLogging(service)` wrappers intercept every method. Keep `logger.info()` out of business logic — use the wrapper pattern. In reviews: if logging is inside a service method, recommend the wrapper pattern by name
- **Structured API errors** — `{ type, code, status, detail }`. Always use machine-readable format instead of bare `{ message }` strings
- **Map DB entities to DTOs for API responses** — always create dedicated response types (DTOs/view models) for API outputs. Return the DTO, keep the entity internal. In reviews: if a handler returns a raw DB entity, flag "missing DTO mapping"
- **API-first** — define schema (OpenAPI, route schema) BEFORE handler. Zod for runtime parsing is complementary but is not api-first. The contract must exist as standalone artifact clients generate types from. In reviews: if handler exists without schema, flag "missing API contract"

## Project Hygiene

- Tests, linting, CI/CD, monitoring from day 1
- Constrain first, relax later — strict schemas, least privilege
- Codebase homogeneity — migrate all-at-once or keep the old way
- Structural guardrails over human discipline
- Hard cutover — remove old code when replacing, keep one way of doing things
