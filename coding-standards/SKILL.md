---
name: coding-standards
description: Enforce engineering standards — readability, robustness, maintainability, type safety. ALWAYS use when writing, reviewing, or refactoring code. Use for architecture decisions, system design, component boundaries, tooling choices, and documentation conventions.
---

## Comments — first-class citizen

**Write comments like a senior explaining the code to a junior sitting next to them.** Conversational, concrete, patient. The code shows WHAT — comments tell WHY, what breaks without it, and how things connect.

### Why & consequences
- **Every comment answers "what goes wrong if I delete this?"** -- `// Apply corrections` (BAD). `// Apply corrections — without this, the frontend shows stale failure badges on healthy endpoints` (GOOD). If you can't name a consequence, the comment is a paraphrase
- **Chain cause → effect across calls** -- `// Advance cursor so the next tick skips these rows`. `// Called by the validator crate via #[validate(schema(...))]`
- **Inaction must be justified** -- every empty branch, no-op, early return: `// Already disabled — we don't touch it to avoid overriding the user's deliberate re-enable`

### Explaining concepts & domain
- **Every project/technical term gets a full explanation on first use** -- what it is, what it does, why it exists, how it connects to the rest. `// Advance the cursor (a singleton row that bookmarks the last processed delivery — the next tick reads it to know where to resume)`. Not just `// Advance the cursor`. Plain language first, jargon in parentheses: `// Find postings that have no matching entry ("dangling postings")`
- **Structs/types: describe the role, not the fields** -- `// All the data the state machine needs to decide whether to warn, disable, or resolve` not `// Contains failure_percent, last_status, and retry config`
- **State transitions: narrate the journey** -- `// Was warned but failure rate dropped below threshold — the endpoint recovered`. Past tense for what happened, present for the conclusion
- **ASCII diagram for multi-step concepts** -- when a comment needs 3+ sequential steps, state transitions, or entity relationships, draw an ASCII diagram instead of writing prose. The diagram lives in the comment block, next to the code it explains. Max 10 lines — if the diagram exceeds 10 lines, simplify it or split the module. Don't diagram what's already obvious from the code (a clean `switch` IS a diagram). Examples:
  ```
  // Data flow:
  //   Request → validateInput() → enrichWithDefaults()
  //                                       ↓
  //                                persistToDb()
  //                                       ↓
  //                                sendConfirmation()
  ```
  ```
  //  PENDING ──(payment ok)──→ ACTIVE ──(3 failures)──→ SUSPENDED
  //                              ↑                        │    │
  //                              └────(retry ok)──────────┘  (30d)
  //                                                          ↓
  //                                                        CLOSED
  ```
  Reviews: prose comment chaining 3+ "then"/"which"/"passes to" -> flag "replace with ASCII diagram"
- **Explain limits, invariants, and boundaries** -- caps: why + what happens to leftovers (`// LIMIT avoids long queries — remaining rows picked up next tick`). Invariants: state + enforcement (`// singleton row, CHECK on PK`). Transaction boundaries: what's in TX vs post-commit (`// emails sent after commit`)

### Structure & conventions
- **Module-level orientation** -- every module starts with "What it does" (1 sentence) + "How it works" (numbered overview)
- **JSDoc on every exported function** -- block description + `@example` with call AND return (`// => value`)
- **Return values: what the caller must do** -- `// Returns max_completed_at — caller should pass to advance_cursor after committing`
- **Gotcha warnings + links** -- `// WARNING: ...` / `// See: https://...`

### Tone & style
- **Conversational, not mechanical** -- `// Read the cursor — "where did I stop last time?"`. Use the reader's inner voice. Quotes, rhetorical questions, like pair programming
- **Concrete over abstract in comments** -- specific numbers, names, thresholds. `// Retry 3 times with 500ms backoff` not `// Retry with backoff`. `// Rate limited to 100 req/s per API contract` not `// Rate limited`. If there's a number, name it
- **Comments are sentences — active voice** -- capitalize, punctuate, active voice. A comment is prose, not a label. `// The cache expires after 30 minutes to avoid stale pricing data.` not `// cache expiry 30m`. `// The scheduler retries failed jobs` not `// Failed jobs are retried by the scheduler`
- **Emphatic word at end** -- the most important part of the comment goes last, where the eye lands. `// Skip validation — already checked by the middleware upstream` (the WHY lands last). Not `// Already checked upstream, so skip validation`
- **Error messages ARE comments** -- error messages explain what went wrong AND what the user should do about it. `"API key expired. Generate a new one at /settings/api-keys"` not `"Invalid API key"`. Every error message is a micro-comment for the person debugging at 2am

**Never:** code paraphrases, commented-out code, `TODO`/`FIXME` without issue link, comments that restate the function name

## Philosophy

Make invalid states unrepresentable. Functional core, imperative shell. Parse, don't validate. DRY.
- **Reuse before creating** -- search the codebase for existing equivalents before writing new code. Reviews: new code that duplicates existing functionality -> flag "reuse X instead"
- **Rule of Three -- don't abstract until 3+ occurrences** -- two similar snippets are coincidence, three are a pattern. Premature abstraction couples unrelated callers. When a shared function accumulates `if (options.X)` branches to serve diverging callers, it became a wrong abstraction. Fix: inline into every call site, delete what each caller doesn't need, re-extract only when a true shared pattern emerges. Reviews: shared function with 3+ option flags controlling branches -> flag "inline and re-extract"
- **Prefer boring technology** -- choose well-understood tools over novel ones. Novel solutions carry hidden costs in debugging, hiring, and documentation. Reviews: new dependency or pattern introduced when a well-known equivalent exists -> flag "justify why the boring option won't work"

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
- **Law of Demeter -- max one dot deep** -- a method should only call methods on: its own fields, its parameters, objects it creates, or its direct dependencies. `order.getCustomer().getAddress().getCity()` couples the caller to the entire object graph -- expose `order.shippingCity()` instead. Reviews: chained property access 2+ levels deep on a dependency -> flag "Law of Demeter violation, add direct accessor"
- **Split boolean flags into two named functions**: `sendUrgentNotification()` / `sendNormalNotification()` not `sendNotification(msg, isUrgent)`. **A ternary, if/else, or options object is NOT a fix** -- boolean still exists as param. Result: two independently callable functions with zero boolean params. Reviews: boolean controlling branch -> split
- Return new data, don't mutate inputs
- **`Promise.all` for independent async ops** -- even when using Result types: run all async calls with `Promise.all`, then check each Result. `const results = await Promise.all(items.map(i => checkStock(i)))` → `const firstError = results.find(r => !r.ok)`. Never sequential `for...await` when calls are independent

## Functions

- **Inject deps via factory: `createService(deps)`** -- pass all I/O (db, cache, email) as args. Composition root = only place knowing concretions
- **Max 30 lines per function — extract a named helper at line 30.** Pure by default. SRP
- **One level of abstraction per function** -- don't mix high-level orchestration with low-level details. A function that calls `validateOrder(order)` then inlines a regex to parse a date string is mixing levels. Reviews: function body mixing domain calls with raw string/regex/byte manipulation -> flag "extract low-level detail to named helper"
- Max 3 positional args; options object for 4+
- CQS -- command OR query. Composition over inheritance
- Focused modules -- no `common`/`shared` grab-bags
- **No default parameters -- use explicit factory methods** -- default params hide behavior and create invisible coupling. `createUser(name, role = 'viewer')` -> `createViewer(name)` / `createAdmin(name)`. Each factory is self-documenting and independently testable. Reviews: function with default params controlling behavior -> flag 'extract named factory'

## Data & Types

- Immutable -- map/filter/reduce/spread
- Extract literals to named constants
- Strict typing everywhere
- **Data clumps -> extract Value Object** -- when the same 3+ fields appear together across multiple functions, parameters, or types (`street, city, zipCode, country` or `amount, currency`), extract a Value Object. Reviews: same 3+ fields repeated in 2+ locations -> flag "extract Value Object"
- Externalize config -- rates, thresholds, multipliers in config objects, not inline. Business params changeable without editing function bodies
- **Bound every input -- reject, always reject** -- every external param validated and **rejected** if invalid. `weight` must be `> 0 && < MAX_WEIGHT` or return Result error. **NEVER `?? defaultValue`, `?? 0`, `|| fallback` for invalid inputs** -- silent-failure bugs. Only correct response: **return Result error**. Reviews: `?? value` or `|| default` on external input -> flag as bug
- **Boundary condition awareness** -- every function handling collections, indices, or numeric ranges must address: null/undefined input, empty collection, single element, off-by-one at boundaries, numeric overflow/underflow. Reviews: loop or index access without boundary check -> flag

## Error Handling

- Surface all failures -- every `catch` handles or propagates
- **Result for ALL errors, no exceptions** -- never `throw`, not in public functions, not in private helpers, not anywhere. `if (!user) throw new Error('not found')` → `if (!user) return err({ type: 'NOT_FOUND' })`. Every function returns `Result<T, E>`. Error boundaries at the edge (middleware, main) convert Result errors to HTTP 500 / process exit / log + restart
- Preserve original stack trace/cause when wrapping
- **Timeout on every I/O** -- wrap with `AbortSignal.timeout(ms)` or a `withTimeout` helper: `await withTimeout(db.query(...), 5_000)`. No bare `await fetch()` / `await db.query()` without a timeout. Default: 5s for DB, 10s for external APIs, 30s for file ops
- **Option<T> for absence, Result<T,E> for errors** -- distinguish between 'value might not exist' (Optional/Option) and 'operation can fail' (Result). `findUser(id)` returns `Option<User>` (user may not exist, that's normal). `chargeCustomer(id)` returns `Result<Receipt, PaymentError>` (failure is an error). Reviews: Result used for normal absence -> flag 'use Option'; Option used for operation failure -> flag 'use Result'
- **Define errors out of existence** -- redesign API semantics so the error condition cannot arise. `unset(key)` succeeds even if key absent (guarantees "after call, key doesn't exist"). `substring(start, end)` clips out-of-bounds instead of throwing. This is NOT ignoring errors — it's designing better contracts. Apply before reaching for Result/try-catch. Reviews: function that throws on a condition the caller can't prevent -> flag "redefine semantics so this isn't an error"
- **Pull complexity downward** -- when complexity is unavoidable, the module absorbs it internally rather than pushing it to callers via config params, exceptions, or "you figure it out" interfaces. A module has more users than developers — better for the implementer to suffer once than for every caller to suffer repeatedly. Reviews: hard decision turned into a config parameter -> flag "pull this decision into the module"; exception thrown for uncertain condition -> flag "handle internally or define out of existence"
- **Barricade pattern for trust boundaries** -- designate specific interfaces as validation boundaries. All data crossing a barricade is validated and sanitized; code inside the barricade assumes inputs are clean. This prevents both over-validation (redundant checks in every function) and under-validation (missed checks deep in call chains). Security-critical paths (auth, crypto, PII) are never exempt regardless of barricade position. Reviews: validation scattered throughout inner logic -> flag "move validation to the barricade boundary"
- **Document impossible states, still use Result** -- when a condition should never occur if code is correct (e.g., negative total after summing valid prices), return `err({ type: 'INVARIANT_VIOLATION' })` with a comment explaining why this state is impossible. Don't use `assert`/`throw` — keep Result as the single error mechanism. The comment is the real value: `// Impossible: valid prices can't sum to negative — indicates a bug in price calculation`

## Readability

**Write code any newcomer understands on first read.** Recipe style — clear steps, named ingredients, no magic.

- **Intermediate variables for every compound expression** -- 2+ operations = extract to named variable. Reviews: compound inlined -> flag
- **One blank line between logical blocks** -- group: setup, validation, transform, return
- **No clever code** -- no nested ternaries, no multi-operation one-liners, no implicit coercion (`+[]`, `!!value`). 5-line inline block -> extract as named function
- **No hidden control flow** -- decorators, middleware chains, event emitters, and magic auto-registration that make call paths untraceable are complexity in disguise. Every call path must be traceable top-down. Reviews: answering "what happens when this endpoint is hit?" requires reading 3+ files of middleware/decorator plumbing -> flag "make control flow explicit"

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
- **Temporal decomposition** red flag -- splitting modules by execution order (read → parse → validate → store) instead of by information hiding causes steps to share excessive knowledge. Each step knows about the data format, coupling them tightly. Reviews: module boundaries that mirror execution steps rather than encapsulating design decisions -> flag "regroup by information hiding, not execution order"
- **Shotgun Surgery detection** -- when a single logical change requires edits in 5+ unrelated files, the responsibility is scattered. Complementary smell: **Divergent Change** -- one module changes for multiple unrelated reasons. Reviews: change touching 5+ files for one concept -> flag "consolidate into one module"; one module changing for unrelated reasons -> flag "split by responsibility"
- **Module depth over shallow wrappers** -- a module's interface should be simpler than its implementation. Pass-through methods that forward calls with identical signatures add no value. Reviews: public API as complex as internal logic -> flag "shallow module, merge or deepen"; method forwarding to another with same signature -> flag "pass-through, inline or add value"
- **Information leakage detection** -- when the same design decision (file format, protocol details, serialization logic) is duplicated across modules, a change forces edits everywhere. This is knowledge duplication, distinct from code duplication. Reviews: same format/protocol knowledge in 2+ modules -> flag "information leakage, encapsulate in one module"
- **Security review checklist in reviews** -- every code review must check: no exposed secrets/credentials, input validation on all external boundaries, authorization checks on all state-changing operations, no PII in logs, no SQL/XSS injection vectors. Reviews: state-changing endpoint without auth check -> P0 blocker

## Project Hygiene

- Tests, linting, CI/CD, monitoring from day 1
- Constrain first, relax later
- Codebase homogeneity -- all-at-once or keep old way
- **Custom lint error messages as remediation instructions** -- when writing custom lint rules or CI checks, write the error message as a step-by-step fix the reader (or an AI agent) can follow directly. Not `'File too large'` but `'File exceeds 200 lines. Split by extracting the helper functions below line 120 into a separate module.'` This makes lints self-service and removes the human bottleneck of explaining violations.
- **Dead code removal as hygiene** -- unused imports, unreachable branches, commented-out code, and unused exports are liabilities. Run dead-code detection (`ts-prune`, `knip`, `deadcode` for Go) in CI. Reviews: any unreferenced export, unused variable, or unreachable branch -> flag for removal
- Structural guardrails over discipline. Hard cutover. Pin all versions
