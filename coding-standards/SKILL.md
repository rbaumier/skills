---
name: coding-standards
description: Enforce engineering standards — readability, robustness, maintainability, type safety. ALWAYS use when writing, reviewing, or refactoring code. Use for architecture decisions, system design, component boundaries, tooling choices, and documentation conventions.
---

## Comments

**Default: no comment.** Each = tax on every reader. 3 load-bearing beat 15 fillers.

### 1. The 5 Exceptions (ALWAYS comment)
1. **Silent correctness protections:** Fallbacks, clamps, saturating casts, `unwrap_or`. Name the protection *(e.g., "bounded upstream", "prevents verdict flip")*.
2. **State & Idempotency guards:** CAS loops, deduplication, retry blockers. State the exact consequence of a replay, rewind, or bypass.
3. **Cross-cutting invariants:** Shared `now`, "all in one TX". State what breaks if the execution is split or the assumption changes.
4. **Struct role:** ONE line naming what ONE instance represents in domain terms.
5. **Dense code / non-trivial algorithms:** Complex SQL, heavy math, atomic state machines. Name the invariant protected. Hard code with zero comment is a bug.

*Else: Delete unless absence lets a fast reader miss deliberate protection.*

### 2. Form & Style: Extreme Concision
- **10 words MAX, hard cap. Count them.** Sacrifice grammar entirely for the sake of concision. Flow is NOT the goal.
- **MANDATORY OMISSIONS:** Drop articles (`the`, `a`), copulas (`is`, `are`, `was`), auxiliaries (`would`, `will`, `can`, `has`), and pronouns (`it`, `this`, `that`) wherever meaning survives.
- **Before / After shape:**
  - ❌ 28w: *"A rewind would re-count attempts we already folded into closed groups, inflating the failure rate."*
  - ✅ 4+3w: *"Rewind double-counts closed groups. Failure rate inflates."*
- **Self-check on every comment before save:**
  1. Scan for split triggers: `and`, `so`, `but`, `—` between clauses, `then`, `, which`, `;`, `that`. Found one? Split.
  2. Count words in each sentence.
  3. Still over 10? The sentence holds 2 ideas. Split. Break lines on idea end, not column.
- **Plain English only:** The reader is a junior dev, English as second language, skimming at 2am. Pick the short Germanic word over the Latinate one.
- **Banned words — closed list, grep-able, zero exceptions:** `tally`, `tallies`, `flapping`, `hog`, `spurious`, `singleton`, `contended`, `bookmarking`, `trailing`, `leaky`, `flush`, `starve`. Presence = violation, rewrite. **The closed list is the floor, not the ceiling** — apply the same test to every word you write: shorter-older-more-childlike wins.

### 3. Content Rules: Why over How
- **How -> Code. Why -> Comment. Never both.** The code shows the mechanics. Dense SQL/math (Exception 5) is the only exception where you walk through invariant steps.
- **Customer/operator consequence:** Document what happens for the customer/operator. What human-visible symptom occurs if it fails?
- **Don't paraphrase the callee:**
  - **Detector:** Is the comment's first verb a synonym of the called function's name? E.g., `// Fetch subscriptions...` above `list_candidates(...)` → `fetch` paraphrases `list`. Delete the paraphrase, keep ONLY the *why-here* ("same tx as cursor advance").
- **Never define a language keyword:** `useMemo`, `Arc`, `ON CONFLICT`: docs exist. Comment adds *why*, never the definition.
- **Inaction needs a reason:** Empty branch, no-op, early return: state why.
- **One insight, one place:** State invariant once per file at earliest useful spot.

### 4. Domain & Boundaries
- **Domain terms:** Keep verbatim. Introduce once. NEVER use synonyms. NEVER abbreviate (`subscription` stays `subscription`, never `sub`).
- **Limits/invariants:** Caps: state why + leftovers. TX: state in-tx vs post-commit.
- **No archaeology:** History = git. Never `was`, `previously`, or `refactored`.

### 5. Documentation Structure
- **Struct doc:** ONE line exactly. Role only, not fields. No "and also" filler.
  - ❌ *"Operational knobs for the monitor. Everything the tick needs to decide."*
  - ✅ *"Tuning for one running monitor: thresholds, windows, scan caps."*
- **Function doc:** ~5 lines max. Must answer "what does the system's consumer observe?". **The consumer depends strictly on the module type:**
  - API handler → end user (visible HTTP response, screen)
  - Background job / cron → operator (reading logs) + side effect (event emitted, endpoint disabled)
  - Library → caller (return value meaning, contract guarantees)

  **Banned opening verbs:** `reads`, `pulls`, `fetches`, `loads`, `sums`, `counts`, `aggregates`, `iterates`, `loops`, `processes`, `handles`, `computes`, `calculates`. Three or more of these verbs and zero outward sentence naming a consumer-visible effect → rewrite.
- **Module doc — mandatory shape:**
  (1) What, one sentence.
  (2) Consumer consequence, one sentence (using the mapping above).
  (3) How, as a **bullet list**. *A single prose paragraph is NOT a module doc.*

### 6. EXCEPTION: Logs and Errors
- Error and log messages are a separate class, NOT comments. The telegraphic 10-word rule DOES NOT apply.
- Go detailed and helpful. Name what went wrong, relevant identifiers, and the user's/operator's next action.

### 7. Workaround Comments with Upstream Link
- When code contains a workaround, hack, or edge-case bypass, the comment MUST include a link to the upstream issue/PR documenting the problem.
- Prefix with `HACK:` or `WORKAROUND:` for greppability. This enables knowing when the workaround can be removed.
- Format: `// WORKAROUND(rustc#12345): remove when MSRV >= 1.78` or `// HACK: esbuild doesn't tree-shake enums, see https://...`

### 8. Lint Suppressions Must Be Justified
- Every lint suppression (`#[allow]`, `// eslint-disable`, `@ts-ignore`, `@ts-expect-error`) requires a comment explaining WHY.
- In Rust, prefer `#[expect]` over `#[allow]` — `expect` breaks compilation when the warning disappears, forcing cleanup.
- Reviews: bare suppression without justification -> flag "add reason for suppression"

**Never**: code paraphrases, commented-out code, `TODO`/`FIXME` without issue link, name-restating. **Reviews**: any bullet violated → flag with bullet name.

## Philosophy

Make invalid states unrepresentable. Functional core, imperative shell. Parse, don't validate. DRY.
- **Reuse before creating** -- search the codebase for existing equivalents before writing new code. Reviews: new code that duplicates existing functionality -> flag "reuse X instead"
- **Rule of Three -- don't abstract until 3+ occurrences** -- two similar snippets are coincidence, three are a pattern. Premature abstraction couples unrelated callers. When a shared function accumulates `if (options.X)` branches to serve diverging callers, it became a wrong abstraction. Fix: inline into every call site, delete what each caller doesn't need, re-extract only when a true shared pattern emerges. Reviews: shared function with 3+ option flags controlling branches -> flag "inline and re-extract"
- **Prefer boring technology** -- choose well-understood tools over novel ones. Novel solutions carry hidden costs in debugging, hiring, and documentation. Reviews: new dependency or pattern introduced when a well-known equivalent exists -> flag "justify why the boring option won't work"
- **State machines as enums** -- workflows with discrete states use an enum with a dedicated struct per state and a single `handle()`/`step()` method. Transitions via dedicated methods. Centralized dispatch via exhaustive match with uniform branches. Reviews: `status: string` with scattered `if (status === "...")` -> flag "model as state machine enum"
- **Cancellation as first-class citizen** -- every long-running async operation accepts a `CancellationToken` or `AbortSignal` parameter. Propagate through the entire call chain. Reviews: long async operation with no cancellation mechanism -> flag "add cancellation support"
- **Concentrate complexity in identified modules** -- inherent complexity (DI, routing, parsing, optimization) is intentionally concentrated in a small number of clearly identified files. The rest of the codebase stays simple. Only these critical files are allowed to exceed usual size limits. Reviews: complexity diluted across the entire codebase instead of isolated -> flag "concentrate in dedicated module"
- **Immutable configuration resolution** -- configuration is resolved once at boot into an immutable object. Two distinct types: `Config` (raw, optional fields) and `SanitizedConfig` (resolved, required fields with defaults applied). Runtime code never works with the raw type. Reviews: `config.field ?? fallback` in runtime code -> flag "resolve at boot, not at use site"
- **Separation mechanism / policy** -- core implements the mechanism (how to do), policy (what to do) is injected via traits/interfaces. Allows changing policy without touching the mechanism. Reviews: business logic hardcoded in core infrastructure -> flag "inject as policy"
- **Symmetric sibling implementations** -- when a pattern is repeated for N variants (transports, adapters, drivers), each variant follows exactly the same file structure, same skeleton, same method names in the same order. Reviews: one variant with a different structure than its siblings -> flag "enforce symmetry"
- **Minimal main function** -- `main()` in 15 lines max. All logic in separate functions/modules. Main parses args, builds config, delegates. Reviews: main with 100+ lines containing business logic -> flag "extract to dedicated module"

## Naming

- **Intent over implementation**: `closeAccount()` not `setStatusToClosed()`. **Banned function-name words: `process`, `handle`, `data`, `do`, `execute`, `run`, `perform`** -- vague mechanics. Replace: `processOrder` -> `fulfillOrder`, `handlePayment` -> `chargeCustomer`. Reviews: any function with banned word -> rename
- **Specific verbs with fixed semantics** -- each verb has one documented meaning project-wide: `sanitize` = cleanup at boot, `validate` = data validation at runtime, `build` = assembly, `create` = instantiation, `resolve` = lookup with resolution, `is`/`has` = predicates. Never use one verb with two different meanings. Reviews: two functions with same prefix but different semantics -> flag "inconsistent verb usage"
- **Name dangerous options defensively** -- prefix security-bypassing options with `dangerous_`/`unsafe_`/`insecure_`. Prefix workarounds with `_hack`/`_workaround`/`_compat` plus explanatory comment. Prefix unstable features with `experimental_`. Reviews: dangerous option with a neutral name -> flag "prefix with `dangerous_`"
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

- **Inject deps via factory: `createOperation(deps)`** -- pass all I/O (db, cache, email) as args to the operation function directly. `createOrder({ db, emailer })`, not a monolithic `createOrderService` that wraps all operations. Composition root = only place knowing concretions
- **Extract by responsibility, not by line count** — a function is "too long" when it mixes concerns (orchestration + low-level parsing + I/O + formatting), NOT when it crosses a line threshold. A 50-line linear workflow that reads top-to-bottom as "step 1 → step 2 → step 3" is BETTER than ten 5-line helpers the reader has to jump between. Splitting by line count produces "spaghetti of indirections". Extract a helper ONLY when: (a) it's used 3+ times (Rule of Three), (b) it's at a genuinely different abstraction level than the caller (e.g., `validateOrder(order)` then a 20-line inline regex parser), OR (c) it's independently testable as a unit. No line-count ceiling. Pure by default. SRP. Reviews: function split into 5+ helpers each called once from one place -> flag "inline back, this is over-fragmented"; function mixing I/O orchestration with inline byte/regex/date manipulation -> flag "extract the low-level piece"
- **One level of abstraction per function** -- don't mix high-level orchestration with low-level details. A function that calls `validateOrder(order)` then inlines a regex to parse a date string is mixing levels. Reviews: function body mixing domain calls with raw string/regex/byte manipulation -> flag "extract low-level detail to named helper"
- **Single call site = inline** -- a function with exactly ONE caller anywhere in the codebase is indirection without benefit. Paste the body at the call site, delete the function. Applies regardless of location: same file, helper file, `shared/`, `utils/`. The reader shouldn't jump to a named helper just to discover it's specific to its caller. **Exceptions** (must be real, not hypothetical): (a) step-down orchestrator helper named by business intent (`applyPromotions`, `convertCurrency`) that lets the caller read as a top-level map, (b) function has dedicated unit tests, (c) function lives inside a slice-folder as an isolated independently-testable concern. Reviews: function with exactly 1 call site + no dedicated test + not a business-named step-down helper -> flag "inline at call site, delete the function"
- **Stepdown Rule — orchestrator first, details below** -- write the top-level function first (names each step at business level), then its helpers below in the same file. Reader follows intent top-to-bottom, reads details only when needed. This is why a long well-structured file beats five small scattered ones: top = map, bottom = territory.
- **Max 3 positional args; objects to prevent same-type swaps** -- options object for 4+ args. Also use objects when 2+ consecutive params share the same type — positional same-type args compile even when swapped: `sendEmail("Welcome!", "Hi there")` silently inverts subject/body. Reviews: 2+ consecutive params of same type -> flag "use named object to prevent silent swap"
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
- **Workflow-first — code features top-to-bottom in ONE file** -- when building a new feature (user registration, order checkout, data import), write the whole flow in a single file: validation, core logic, helpers, types, all of it. Reading the feature means opening one file and scrolling, not jumping across `validators/`, `services/`, `helpers/`, `utils/`, `types/`. A 500-line file that reads like a book top-to-bottom is better than ten 50-line files scattered across 4 directories. Two valid reasons to split: (1) a second module genuinely imports part of it — extract that part to a sibling file; (2) the operation grows complex with multiple independent concerns — promote to a Slice-as-folder (see below). Never split by size alone. Reviews: new feature split across 4+ files on day one -> flag "collapse into a single workflow file"
- **Slice-as-folder for complex operations** -- when a single workflow file contains multiple isolated concerns (promotion engine, currency conversion, fraud scoring), promote it to a folder: `createOrder/index.ts` (pure orchestrator, Stepdown Rule) + `applyPromotions.ts` + `convertCurrency.ts`. From the outside the slice is still one unit. Trigger: concerns are independently testable and have distinct reasons to change — not just "the file is long". Reviews: sub-files created solely because the file is long -> flag "merge back unless concerns are genuinely independent"
- **Locality of Behavior (LoB) — single-use helpers stay with their caller** -- code used in exactly one place belongs NEXT to that place. If a function has exactly one call site in the whole codebase, it does NOT belong in a separate `utils.ts` / `helpers.ts` / `*-helpers.ts` / `shared/*.ts` file. Put it at the bottom of the caller's file. Separate files are for code with 2+ real consumers RIGHT NOW, not 1 imagined future consumer. Every reader pays a navigation tax forever for a reuse that may never come. **"Shared primitive" is NOT an exception**: Result types, `ok`/`err` helpers, `withTimeout`, date utilities, string helpers — if there is exactly ONE caller today, they live inlined in the caller's file. Move them to `shared/` only when a SECOND caller genuinely appears and imports them. "I'm going to need this elsewhere" is not a second caller. **Exception — slice-folder sub-files**: within a promoted slice-folder (`createOrder/`), sub-files (`applyPromotions.ts`, `convertCurrency.ts`) may have a single caller (the orchestrator) when they contain complex, independently-testable logic with a distinct reason to change. The folder boundary is organizational, not a reuse boundary. Reviews: imported helper with exactly 1 caller outside a slice-folder -> flag "inline to the bottom of the caller's file and delete the helper file"
- **Colocate extracted helpers** -- when you extract a sub-function from a long function, put it at the BOTTOM of the SAME file, not in a new file. The reader keeps a single file open for the whole workflow. Promote a helper to its own file only when a second module genuinely imports it. Reviews: new file created for a helper used once -> flag "move to the bottom of the caller's file"
- **Inline single-use when reviewing** -- in code review, if you open an external file for a function called from exactly one place in the entire codebase, pull the function's body back (either to the call site or to the bottom of the caller's file) and delete the external file. One-call-site extractions are indirection without benefit. Reviews: imported function with exactly 1 caller -> flag "inline it back and delete the file"
- **File length is a readability test, not a hard cap** -- there is NO hard maximum line count. A file is too long when a new reader can't follow the workflow top-to-bottom in one pass — not when it crosses an arbitrary threshold. The test: open the file cold and scroll top-to-bottom once — can you understand what the feature does? If yes, leave it. If no, split — but split by **responsibility** (two unrelated features = two files), never by **size alone**. A 500-line coherent feature file is fine. A 120-line file doing three unrelated things is not. Reviews: file split solely for size with no responsibility boundary -> flag "merge back"; file doing multiple unrelated things regardless of size -> flag "split by feature"

## Architecture

- **Vertical slices — organize by domain/operation, not by role** -- structure: `src/features/{domain}/{operation}.ts`. Each operation file owns its full vertical: handler, business logic, DB query, types — everything that changes together for that use case. Never split by technical role (`services/`, `repositories/`, `handlers/`) on day one. Read the feature = open one file and scroll. Reviews: new feature split by role across multiple directories -> flag "collapse into a feature slice"
- **Domain shared — extract on second real usage, never by anticipation** -- a helper stays in the operation file until a second operation in the same domain genuinely needs it. Then extract to `features/{domain}/shared/`. Never create a `src/shared/` for domain business logic — only for purely technical utilities (date formatting, pagination) used across 3+ unrelated domains. Reviews: logic in shared/ with only one caller -> flag "inline back, premature extraction"
- **Cross-domain access — public API only** -- a slice imports from another domain's public exports (`features/inventory/index.ts`) only, never from its internal files or its DB tables directly. 1-2 external domains: direct import of their public use case. 3+ domains react to the same operation: emit a domain event (`OrderCreated`) and let each domain react independently. Reviews: import from `features/X/internal/` or direct DB query into another domain's tables -> flag "use X's public API"
- **Store ownership (frontend)** -- each domain owns its store (`features/cart/store.ts`). Other domains read via exported selectors. Write via explicitly exported actions only — never mutate another domain's state directly. Reviews: domain mutating state it doesn't own -> flag "call the owning domain's exported action"
- **Factory DI** -- `createOrder({ db, emailer, logger })`. Per-operation, plain functions, framework-free. No monolithic service objects wrapping all operations of a domain
- **Crosscutting via middleware** -- crosscutting concerns (tracing, logging, auth) belong at the HTTP middleware layer, not inside operation logic. No `logger.info()` in business logic — log at handler entry/exit. Reviews: logging or tracing inside operation business logic -> flag "move to middleware"
- **Structured API errors** -- `{ type, code, status, detail }` not bare `{ message }` strings
- **Map DB entities to DTOs** -- dedicated response types for API outputs. Reviews: raw DB entity returned -> flag "missing DTO mapping"
- **API-first** -- define schema (OpenAPI, route schema) BEFORE handler. Zod is complementary but not api-first. Contract must exist as standalone artifact. Reviews: handler without schema -> flag "missing API contract"
- **Shotgun Surgery detection** -- when a single logical change requires edits in 5+ unrelated files, the responsibility is scattered. Complementary smell: **Divergent Change** -- one module changes for multiple unrelated **business reasons** (e.g. a `CustomerModule` that changes when billing rules change AND when loyalty program changes AND when address format changes — three distinct business domains sharing one file). "Business reasons" means distinct domain concerns (billing, loyalty, shipping, auth), NOT technical refactors or bug fixes. Reviews: change touching 5+ files for one concept -> flag "consolidate into one module"; one module changing for 2+ unrelated business domains -> flag "split by business responsibility"
- **Module depth over shallow wrappers** -- a module's interface should be simpler than its implementation. Pass-through methods that forward calls with identical signatures add no value. Reviews: public API as complex as internal logic -> flag "shallow module, merge or deepen"; method forwarding to another with same signature -> flag "pass-through, inline or add value"
- **Information leakage detection** -- when the same design decision (file format, protocol details, serialization logic) is duplicated across modules, a change forces edits everywhere. This is knowledge duplication, distinct from code duplication. Reviews: same format/protocol knowledge in 2+ modules -> flag "information leakage, encapsulate in one module"
- **Security review checklist in reviews** -- every code review must check: no exposed secrets/credentials, input validation on all external boundaries, authorization checks on all state-changing operations, no PII in logs, no SQL/XSS injection vectors. Reviews: state-changing endpoint without auth check -> P0 blocker

## Project Hygiene

- Tests, linting, CI/CD, monitoring from day 1
- Constrain first, relax later
- Codebase homogeneity -- all-at-once or keep old way
- **Custom lint error messages as remediation instructions** -- when writing custom lint rules or CI checks, write the error message as a step-by-step fix the reader (or an AI agent) can follow directly. Not `'Cross-domain import violation'` but `'features/orders imports from features/inventory/db/queries.ts — only import from features/inventory/index.ts (public API).'` This makes lints self-service and removes the human bottleneck of explaining violations.
- **Cyclomatic and cognitive complexity — linter-enforced, not line-counted** -- file length is a proxy metric. The real constraint: cognitive complexity per function. Configure linter to fail on cognitive complexity > 15 per function (`eslint-plugin-sonarjs` or equivalent). A 400-line file of sequential logic is fine. A 60-line function with 4 levels of nesting is not. Reviews: function with deep nesting or complex branching -> flag the function, not the file
- **Linter-enforced domain isolation** -- enforce cross-domain access rules in CI, not by convention. Configure your linter to fail when a domain imports internal files of another domain. Only public index exports allowed across domain boundaries. Tooling enforces the architecture — convention alone does not.
- **Dead code removal as hygiene** -- unused imports, unreachable branches, commented-out code, and unused exports are liabilities. Run dead-code detection (`ts-prune`, `knip`, `deadcode` for Go) in CI. Reviews: any unreferenced export, unused variable, or unreachable branch -> flag for removal
- **Actionable TODOs with context** -- every TODO must include a specific action AND a version target or ticket reference. Format: `// TODO(v3.0): migrate to new parser` or `// TODO(#1234): remove when upstream fix lands`. Vague TODOs ("fix later", "clean up") are violations. Reviews: TODO without issue link or version target -> flag "add context or create ticket"
- Structural guardrails over discipline. Hard cutover. Pin all versions
