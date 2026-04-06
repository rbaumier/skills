---
name: coding-standards
description: Enforce engineering standards — readability, robustness, maintainability, type safety. ALWAYS use when writing, reviewing, or refactoring code. Use for architecture decisions, system design, component boundaries, tooling choices, and documentation conventions.
---

## Comments — first-class citizen

**Write comments like a senior explaining the code to a junior sitting next to them.** Conversational, concrete, patient. The code shows WHAT — comments tell WHY, what breaks without it, and how things connect.

- **Every comment answers "what goes wrong if I delete this?"** -- `// Apply corrections` (BAD). `// Apply corrections — without this, the frontend shows stale failure badges on healthy endpoints` (GOOD). If you can't name a consequence, the comment is a paraphrase
- **Conversational, not mechanical** -- `// Read the cursor — "where did I stop last time?"`. Use the reader's inner voice. Quotes, rhetorical questions, like pair programming
- **Every project/technical term gets a full explanation on first use** -- what it is, what it does, why it exists, how it connects to the rest. `// Advance the cursor (a singleton row that bookmarks the last processed delivery — the next tick reads it to know where to resume)`. Not just `// Advance the cursor`. Plain language first, jargon in parentheses: `// Find postings that have no matching entry ("dangling postings")`
- **Structs/types: describe the role, not the fields** -- `// All the data the state machine needs to decide whether to warn, disable, or resolve` not `// Contains failure_percent, last_status, and retry config`
- **State transitions: narrate the journey** -- `// Was warned but failure rate dropped below threshold — the endpoint recovered`. Past tense for what happened, present for the conclusion
- **Inaction must be justified** -- every empty branch, no-op, early return: `// Already disabled — we don't touch it to avoid overriding the user's deliberate re-enable`
- **Chain cause → effect across calls** -- `// Advance cursor so the next tick skips these rows`. `// Called by the validator crate via #[validate(schema(...))]`
- **Explain limits, invariants, and boundaries** -- caps: why + what happens to leftovers (`// LIMIT avoids long queries — remaining rows picked up next tick`). Invariants: state + enforcement (`// singleton row, CHECK on PK`). Transaction boundaries: what's in TX vs post-commit (`// emails sent after commit`)
- **Return values: what the caller must do** -- `// Returns max_completed_at — caller should pass to advance_cursor after committing`
- **Module-level orientation** -- every module starts with "What it does" (1 sentence) + "How it works" (numbered overview)
- **JSDoc on every exported function** -- block description + `@example` with call AND return (`// => value`)
- **Gotcha warnings + links** -- `// WARNING: ...` / `// See: https://...`

- **Concrete over abstract in comments** -- specific numbers, names, thresholds. `// Retry 3 times with 500ms backoff` not `// Retry with backoff`. `// Rate limited to 100 req/s per API contract` not `// Rate limited`. If there's a number, name it
- **Comments are sentences** -- capitalize, punctuate. A comment is prose, not a label. `// The cache expires after 30 minutes to avoid stale pricing data.` not `// cache expiry 30m`
- **Emphatic word at end** -- the most important part of the comment goes last, where the eye lands. `// Skip validation — already checked by the middleware upstream` (the WHY lands last). Not `// Already checked upstream, so skip validation`
- **Error messages ARE comments** -- error messages explain what went wrong AND what the user should do about it. `"API key expired. Generate a new one at /settings/api-keys"` not `"Invalid API key"`. Every error message is a micro-comment for the person debugging at 2am

**Never:** code paraphrases, commented-out code, `TODO`/`FIXME` without issue link, comments that restate the function name

## Philosophy

Make invalid states unrepresentable. Functional core, imperative shell. Parse, don't validate. DRY.
- **Reuse before creating** -- search the codebase for existing equivalents before writing new code. Reviews: new code that duplicates existing functionality -> flag "reuse X instead"

## Naming

- **Intent over implementation**: `closeAccount()` not `setStatusToClosed()`. **Banned function-name words: `process`, `handle`, `data`, `do`, `execute`, `run`, `perform`** -- vague mechanics. Replace: `processOrder` -> `fulfillOrder`, `handlePayment` -> `chargeCustomer`. Reviews: any function with banned word -> rename
- Symmetry: `get/set`, `add/remove`, `start/stop`
- Booleans: `is`/`has`/`should`/`can` prefix, positive form
- Full words always (`user` not `u`, `account` not `acct`). Destructure abbreviations: `const { timestamp, buffer, userId } = record`. Remove unused params
- **Code smell detection table for reviews** -- flag common naming smells during review: single-letter names (`const d = new Date()` -> `const createdAt = new Date()`), generic names (`data`, `info`, `temp`, `result` -> name by what it represents), misleading names (`userList` but it's a Set -> `userSet`), encoding types (`strName` -> `name`). Reviews: any variable matching these patterns -> flag with fix
- Explicit units: `delayMs`, `fileSizeKb`

## Control Flow

- Guard clauses, early return, max 3 indent levels
- `switch`/object maps over `if/else` chains
- **Split boolean flags into two named functions**: `sendUrgentNotification()` / `sendNormalNotification()` not `sendNotification(msg, isUrgent)`. **A ternary, if/else, or options object is NOT a fix** -- boolean still exists as param. Result: two independently callable functions with zero boolean params. Reviews: boolean controlling branch -> split
- Return new data, don't mutate inputs
- `Promise.all` for independent async ops

## Functions

- **Inject deps via factory: `createService(deps)`** -- pass all I/O (db, cache, email) as args. Composition root = only place knowing concretions
- **Max 30 lines per function — extract a named helper at line 30.** Pure by default. SRP
- Max 3 positional args; options object for 4+
- CQS -- command OR query. Composition over inheritance
- Focused modules -- no `common`/`shared` grab-bags
- **No default parameters -- use explicit factory methods** -- default params hide behavior and create invisible coupling. `createUser(name, role = 'viewer')` -> `createViewer(name)` / `createAdmin(name)`. Each factory is self-documenting and independently testable. Reviews: function with default params controlling behavior -> flag 'extract named factory'

## Data & Types

- Immutable -- map/filter/reduce/spread
- Extract literals to named constants
- Strict typing everywhere
- Externalize config -- rates, thresholds, multipliers in config objects, not inline. Business params changeable without editing function bodies
- **Bound every input -- reject, always reject** -- every external param validated and **rejected** if invalid. `weight` must be `> 0 && < MAX_WEIGHT` or return Result error. **NEVER `?? defaultValue`, `?? 0`, `|| fallback` for invalid inputs** -- silent-failure bugs. Only correct response: **return Result error**. Reviews: `?? value` or `|| default` on external input -> flag as bug
- **Boundary condition awareness** -- every function handling collections, indices, or numeric ranges must address: null/undefined input, empty collection, single element, off-by-one at boundaries, numeric overflow/underflow. Reviews: loop or index access without boundary check -> flag

## Error Handling

- Surface all failures -- every `catch` handles or propagates
- **Result for ALL errors, no exceptions** -- never `throw`, not in public functions, not in private helpers, not anywhere. `if (!user) throw new Error('not found')` → `if (!user) return err({ type: 'NOT_FOUND' })`. Every function returns `Result<T, E>`. Error boundaries at the edge (middleware, main) convert Result errors to HTTP 500 / process exit / log + restart
- Preserve original stack trace/cause when wrapping
- Timeout on every I/O
- **Option<T> for absence, Result<T,E> for errors** -- distinguish between 'value might not exist' (Optional/Option) and 'operation can fail' (Result). `findUser(id)` returns `Option<User>` (user may not exist, that's normal). `chargeCustomer(id)` returns `Result<Receipt, PaymentError>` (failure is an error). Reviews: Result used for normal absence -> flag 'use Option'; Option used for operation failure -> flag 'use Result'

## Readability

**Write code any newcomer understands on first read.** Recipe style — clear steps, named ingredients, no magic.

- **Intermediate variables for every compound expression** -- 2+ operations = extract to named variable. Reviews: compound inlined -> flag
- **One blank line between logical blocks** -- group: setup, validation, transform, return
- **No clever code** -- no nested ternaries, no multi-operation one-liners, no implicit coercion (`+[]`, `!!value`). 5-line inline block -> extract as named function

## File Structure

- Exports/public API at top, private helpers at bottom
- Tests next to source. Group by feature not type
- **Max 200 lines per file** -- if a file approaches this limit, split by responsibility. A file doing two things is two files. Reviews: file > 200 lines -> flag "split this file"

## Architecture

- **Vertical slices** -- each feature owns schema/errors/data/logic/API
- **Factory DI** -- `createOrderService({ db, emailer, logger })`. Plain functions, framework-free
- **Crosscutting via wrapping** -- `withTracing(service)` / `withLogging(service)` intercept every method. No `logger.info()` in business logic. Reviews: logging inside service method -> recommend wrapper pattern
- **Structured API errors** -- `{ type, code, status, detail }` not bare `{ message }` strings
- **Map DB entities to DTOs** -- dedicated response types for API outputs. Reviews: raw DB entity returned -> flag "missing DTO mapping"
- **API-first** -- define schema (OpenAPI, route schema) BEFORE handler. Zod is complementary but not api-first. Contract must exist as standalone artifact. Reviews: handler without schema -> flag "missing API contract"
- **Security review checklist in reviews** -- every code review must check: no exposed secrets/credentials, input validation on all external boundaries, authorization checks on all state-changing operations, no PII in logs, no SQL/XSS injection vectors. Reviews: state-changing endpoint without auth check -> P0 blocker

## Project Hygiene

- Tests, linting, CI/CD, monitoring from day 1
- Constrain first, relax later
- Codebase homogeneity -- all-at-once or keep old way
- **Custom lint error messages as remediation instructions** -- when writing custom lint rules or CI checks, write the error message as a step-by-step fix the reader (or an AI agent) can follow directly. Not `'File too large'` but `'File exceeds 200 lines. Split by extracting the helper functions below line 120 into a separate module.'` This makes lints self-service and removes the human bottleneck of explaining violations.
- **Dead code removal as hygiene** -- unused imports, unreachable branches, commented-out code, and unused exports are liabilities. Run dead-code detection (`ts-prune`, `knip`, `deadcode` for Go) in CI. Reviews: any unreferenced export, unused variable, or unreachable branch -> flag for removal
- Structural guardrails over discipline. Hard cutover. Pin all versions
