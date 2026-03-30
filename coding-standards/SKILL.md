---
name: coding-standards
description: Enforce engineering standards — readability, robustness, maintainability, type safety. ALWAYS use when writing, reviewing, or refactoring code. Use for architecture decisions, system design, component boundaries, tooling choices, and documentation conventions. Even small changes benefit from these standards.
---

## When to use
- ALWAYS when writing, refactoring, or reviewing code
- Architecture decisions, system design, component boundaries
- Choosing tools, libraries, configuration strategies
- Documentation and convention decisions

## When not to use
- Throwaway prototyping
- Legacy projects that explicitly forbid these patterns

## Core Philosophy

These principles are load-bearing — every rule below derives from one of them.

- **Single source of truth** — one write location, no exceptions. Duplication is a ticking bomb: when one copy changes and the other doesn't, you have a bug that passes all tests
- **Make Invalid States Unrepresentable** — use the type system to eliminate entire classes of bugs at compile time. If a function can't receive bad data, it can't produce bad output
- **Locality of Behavior** — keep related logic close; prefer code easy to delete. When understanding a function requires reading five other files, the abstraction failed
- **Functional Core, Imperative Shell** — business logic stays pure and deterministic; side effects (I/O, state mutation) live at the boundaries. Pure functions are trivially testable, composable, and parallelizable
- **Parse, Don't Validate** — transform untrusted data into trusted types at the boundary once. After parsing, the type guarantees correctness — no defensive checks scattered through business logic
- **Entropy is the enemy** — code is liability, not asset. Every line must earn its place. The best code is the code you didn't write
- **DRY** — duplication is a missed abstraction. Ruthlessly eliminate it. If you find yourself copying code, you've found an abstraction waiting to be extracted
- **Idiomatic** — embrace language and framework conventions. Fighting the grain creates friction for every future reader
- **Conceptual Compression** — the right abstraction hides complexity without hiding logic. If an abstraction needs explanation, it's the wrong abstraction

## Code-Level Rules

### Naming & Semantics (Ubiquitous Language)
- Intent over implementation: `closeAccount()`, not `setStatusToClosed()` — names describe the business action, not the mechanical step
- Symmetry: `get/set`, `add/remove`, `start/stop` — asymmetric pairs confuse readers
- Booleans: prefix `is`, `has`, `should`, `can`. No negations (`isEnabled` not `isNotDisabled`) — double negatives force mental gymnastics
- No mental mapping: `user`, `item` — never `u`, `i`. Single-letter names force every reader to build a lookup table
- Explicit units: `delayMs`, `fileSizeKb` — never bare `delay`, `size`. Unit confusion causes real bugs (Mars Climate Orbiter crashed because of unit mismatch)
- No acronyms, abbreviations, or "fun" names. A name that needs explanation is a bad name

### Control Flow & Complexity
- Avoid complexity at all costs — complexity is where bugs hide and understanding dies
- Fail fast — guard clauses, exit early. No `else` after `return`. The happy path reads linearly
- Max 2 indentation levels — deeper nesting signals a function doing too much. Flatten via early returns or extraction
- `switch`/object maps over `if/else` chains — exhaustive matching catches missing cases at compile time
- **No boolean flags as args** — a function with a boolean flag is two functions pretending to be one. Always split: `processUrgentOrder(order)` and `processNormalOrder(order)` — not `processOrder(order, isUrgent)`. A ternary selecting between two functions is NOT a fix; the caller still passes a boolean. The two functions must exist as separate, independently callable units
- Replace complex condition trees with validation schemas or finite state machines — state machines make transitions explicit and illegal transitions impossible
- Too much state/mutations → use a state machine
- Prefer declarative over imperative — declare the "what" (desired state), not the "how" (steps). Never mutate objects you don't own: return new data instead of modifying inputs
- Parallelize independent async operations — sequential awaits on independent work is wasted wall-clock time. Use `Promise.all` for independent fetches

### Functions & Architecture
- **Inject dependencies, never hard-import them** — every module that does I/O (database, HTTP, cache, email) must receive its dependencies as arguments via a factory function: `createService(deps)`. Hard-importing `db` or `cache` at the top of a file makes the function untestable and couples it to a specific implementation. This is the single most impactful architectural rule
- No functions above 30 lines — long functions have multiple responsibilities. If you need a comment to separate sections, extract a function instead
- Pure by default — deterministic, no hidden state. Impurity is explicit and pushed to the edges
- SRP — one reason to change. If a function parses AND saves, it has two reasons to change
- Max 3 positional args; use options object for 4+ — positional args past 3 become a guessing game at the call site
- CQS — command OR query, never both (unless atomicity requires it). Functions that read and write are hard to reason about
- Composition over inheritance — `has-a` over `is-a`; max 2 levels deep. Deep inheritance hierarchies are impossible to reason about
- Explicit interface contracts between components — no `common`/`shared` grab-bag modules. Grab-bags become dependency magnets
- Prefer existing battle-tested libraries over reimplementation — evaluate maintenance, tests, downloads before adopting
- Isolate technical debt behind interface contracts — distinguish imposed debt (legacy) from chosen debt (conscious shortcut)

### Data & Types
- Immutable by default — use non-mutating transforms (map/filter/reduce/spread), never mutate in place. Mutation creates invisible coupling between distant code
- No magic numbers/strings — extract to named constants. Every magic value is a decision that lost its context
- Strict typing is non-negotiable — `any` and untyped code opt out of the compiler's help
- Every constant is a decision at a point in time — externalize to config (env vars, defaults file, or DB) so decisions can change without code changes
- **Bound every input — reject, never fallback** — every parameter from outside your trust boundary must be validated and **rejected** if invalid. `weight` must be `> 0 && < MAX_WEIGHT` or throw/return error. `country` must be in an allowed set or throw/return error — never silently fall back to a default. `couponCode` must match a known pattern or throw/return error. Silent defaults on invalid input hide bugs. Add guard clauses at the top that **stop execution** on bad input
- Pin all dependency/image/package versions — `latest` is a different thing every day

### Error Handling
- No silent failures — never empty `catch` blocks. A swallowed error is the hardest bug to find
- Use Result/Either types for expected errors — exceptions for truly exceptional cases only. Expected errors are data, not control flow
- Preserve original stack trace/cause when wrapping errors — lost context turns a 5-minute fix into a 2-hour investigation
- Define timeout on every I/O (HTTP, RPC, SQL) — unbounded I/O is a cascading failure waiting to happen

### Comments

Comments lower cognitive load. Good comments prevent reading code at all.

**Write these:**
- **Function** — contract at top of exported functions/classes. Reader skips the body
- **Design** — file-top overview: algorithms, tradeoffs, why simple > complex
- **Why** — reason behind non-obvious code. "What" is readable; "why" is invisible
- **Teacher** — domain knowledge (math, protocol, data structure) the reader lacks
- **Checklist** — "if you modify X, also update Y" when language can't enforce coupling
- **Guide** — section dividers for long functions with multiple phases. Never for type/const/import grouping — language keywords are the guide

**Never write these:**
- **Trivial** — cognitive load >= code's (`i++ // increment i`, `// --- Types ---`)
- **Backup** — commented-out code. Version control is your backup
- **Debt** — `TODO`/`FIXME` without a tracking issue

**Rules:**
- Writing comments surfaces bugs — rubber-duck debugging on steroids
- Generate API docs from code (OpenAPI, annotations) — manual docs decay
- Enforce conventions via automation (linter, CI, hook) — unenforced = wishes
- ADR for structural decisions (title, status, context, decision, consequences)

### File Structure
- Newspaper metaphor — high-level at top, details at bottom. A reader should understand the module from the first 20 lines
- Colocation — tests, types, styles near their component, not in separate trees. Separation by type forces you to jump between directories to understand one feature
- Group by feature, not by type — `users/` with all user files beats `controllers/` + `models/` + `services/` with one user file each

### Architecture & Patterns
- **Feature modules as vertical slices** — each feature owns its schema, errors, data access, business logic, and API surface. Self-contained, independently deployable. No feature should import from another feature's internals
- **Factory-function DI everywhere** — `createOrderService({ db, emailer, logger })` returns a plain object. No container, no decorators, no framework magic. The composition root (entry point) is the only place that knows about concrete implementations. This makes every service testable with simple stubs
- **Crosscutting concerns via wrapping** — when reviewing, ask: "Is logging/tracing scattered inside business logic, or applied via a wrapper?" The correct pattern: `const traced = withTracing(orderService)` — a wrapper that intercepts every method call. If you see `logger.info()` inside a service method, the fix is always: "Extract logging into a `withTracing(service)` or `withLogging(service)` wrapper." Always recommend this specific pattern by name in reviews
- **Structured errors for APIs** — machine-readable error format with type, code, status, detail. Domain errors map exhaustively to API errors via a single mapping function. Never return bare `{ message: "..." }` strings
- **API-first design** — when reviewing, ask: "Does each endpoint have a schema defined BEFORE its handler?" If not, the recommendation is always: "Define the API contract (OpenAPI spec, route schema) before writing the handler implementation." This is distinct from runtime validation — Zod for parsing request bodies is good but is NOT api-first. Api-first means the contract exists as a standalone artifact that clients can generate types from

### Project & Codebase Hygiene
- Start projects with tests, linting, CI/CD, monitoring from day 1 — constraints upfront are cheaper than retrofitting
- Constrain first, relax later — strict schemas (whitelist > blacklist), least privilege, low quotas. Relaxing is backward-compatible; tightening breaks clients
- Prefer codebase homogeneity over partial migration — migrate all-at-once or not at all. Two ways of doing the same thing is worse than either one alone
- Choose intentionally limited tools to prevent bad practices — structural guardrails over human discipline
- Production code is the only truth — lock business rules in tests; read dependency source code
- Hard cutover, no backward compatibility — backward compat is maintenance debt that compounds forever
