---
name: coding-standards
description: Enforce engineering standards — readability, robustness, maintainability, type safety.
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

- **Single source of truth** — one write location, no exceptions
- **Make Invalid States Unrepresentable** — Discriminated Unions, Branded Types; bugs can't exist at runtime
- **Locality of Behavior** — keep related logic close; prefer code easy to delete; no spooky action at a distance
- **Functional Core, Imperative Shell** — side effects at boundaries only; business logic stays pure & immutable
- **Parse, Don't Validate** — parse into trusted types at the boundary; never just "check" data
- **Entropy is the enemy** — code is liability. Add value, not weight. Every line must earn its place
- **DRY** — duplication is a missed abstraction. Ruthlessly eliminate it
- **Idiomatic** — embrace language/framework conventions. Don't write Java in Python or C in JavaScript
- **Conceptual Compression** — the right abstractions hide complexity without hiding logic. If an abstraction needs explanation, it's the wrong abstraction

## Code-Level Rules

### Naming & Semantics (Ubiquitous Language)
- Intent over implementation: `closeAccount()`, not `setStatusToClosed()`
- Symmetry: `get/set`, `add/remove`, `start/stop`
- Booleans: prefix `is`, `has`, `should`, `can`. No negations (`isEnabled` not `isNotDisabled`)
- No mental mapping: `user`, `item` — never `u`, `i`
- Explicit units: `delayMs`, `fileSizeKb` — never bare `delay`, `size`
- No acronyms, abbreviations, or "fun" names (Marvel, Star Wars, planets). A name that needs explanation is a bad name

### Control Flow & Complexity
- Avoid complexity at all costs
- Fail fast — guard clauses, exit early. No `else` after `return`
- Max 2 indentation levels. Flatten via early returns or extraction
- `switch`/object maps over `if/else` chains
- No boolean flags as args — two functions or named options object
- Replace complex condition trees with validation schemas or finite state machines
- Too much state/mutations -> use a state machine
- Prefer declarative over imperative — declare the "what" (desired state), not the "how" (steps); extract business rules into schemas or DSL
- Parallelize async operations as much as possible

### Functions & Architecture
- No functions above 30 lines of code
- Pure by default — deterministic, no hidden state
- SRP — one reason to change. Split parsing from saving
- Max 3 positional args; use options object for 4+
- CQS — command OR query, never both (unless atomicity requires it)
- Composition over inheritance — `has-a`; max 2 levels deep
- Single source of truth — one write location per data type; replicas are ephemeral and reconstructible
- Explicit interface contracts between components (ports & adapters); no `common`/`shared` grab-bag modules
- Prefer existing battle-tested libraries over reimplementation; evaluate maintenance, tests, downloads/stars before adopting
- Isolate technical debt behind interface contracts; distinguish imposed debt (legacy) from chosen debt (conscious shortcut)
- Short functions are good. Long functions are bad.

### Data & Types
- Immutable — `.map`/`.filter`/`.reduce`/spread, never `.push` or direct mutation
- No magic numbers/strings — extract to `const` or `enum` with clear names
- Strict typing is non-negotiable
- Every constant is a decision at a point in time — externalize to config (env vars, defaults file, or DB+backoffice)
- Bound every input: `minLength`, `maxLength`, format, allowed characters on every parameter; rate-limit exposed operations
- Pin all dependency/image/package versions — never use `latest`

### Error Handling
- No silent failures — never empty `catch` blocks
- Exceptions for exceptional cases only — use `Result` types for expected errors
- Preserve original stack trace/cause when wrapping errors
- Define timeout on every I/O (HTTP, RPC, SQL). Handle error cases systematically

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
- **Backup** — commented-out code. Git is your backup
- **Debt** — `TODO`/`FIXME` without tracking issue

**Rules:**
- Writing comments surfaces bugs — rubber-duck debugging on steroids
- Generate API docs from code (OpenAPI, annotations) — manual docs decay
- Enforce conventions via automation (linter, CI, hook) — unenforced = wishes
- ADR for structural decisions (title, status, context, decision, consequences)

### File Structure
- Newspaper metaphor — high-level at top, details at bottom
- Colocation — tests, types, styles near their component, not in separate trees
- Group by feature, not by type

### Architecture & Patterns
- Feature module structure: `schema.ts` → `errors.ts` → `repository.ts` → `service.ts` → `routes.ts` → `index.ts` (composition root). Each feature is a self-contained vertical slice
- DI via factory functions — `createService(repository, gitService)` returns a plain object. No container, no decorators, no framework. Type derived from factory: `type RepoService = ReturnType<typeof createRepoService>`
- Auto-instrumentation via object wrapping: `withTracing(namespace, service)` wraps every method in an OTel span — crosscutting concern without decorators. Handles sync/async, errors-as-values
- RFC 7807 ProblemDetail for all API errors: `{ type, title, status, code, detail, instance, timestamp }` — standard `application/problem+json` content type. Domain errors map to ProblemDetail via exhaustive `matchError()` — each error type gets a specific HTTP status and problem code
- API-first design: generate OpenAPI spec from code (e.g. `hono-openapi` + `describeRoute`), then generate client types with `openapi-typescript` → consume via `openapi-fetch` for fully type-safe API calls. The spec is the contract — types flow from it, not the other way around

### Project & Codebase Hygiene
- Start projects with tests, linting, CI/CD, monitoring from day 1 — constraints upfront are cheaper than retrofitting
- Constrain first, relax later — strict API schemas (whitelist > blacklist), least privilege, low quotas; relaxing is backward-compatible
- Prefer codebase homogeneity over partial migration — migrate all-at-once or not at all
- Choose intentionally limited tools to prevent bad practices — structural guardrails over human discipline
- Production code is the only truth — lock business rules in tests (BDD); read dependency source code (RTFMC)
- Use a hard cutover approach and never implement backward compatibility.
