---
name: coding-standards
description: Use when writing, reviewing, or refactoring code in any language. Use for architecture decisions, system design, component boundaries, and code quality judgment. Always relevant when touching source code.
---

This is the umbrella skill. It states the load-bearing **philosophy** and the meta-rule that **rules vary by boundary**, then routes to focused sub-skills. The detailed rules live in the sub-skills — load them based on what you're doing.

## Philosophy

Make invalid states unrepresentable. Functional core, imperative shell. Parse, don't validate. DRY.

- **Three-level simplicity funnel — descend before writing any code** -- (1) **Question the need**: what does this actually solve, can it be removed entirely, does the framework/lib already do it, is a pattern being reproduced by inertia when a fundamentally different approach is simpler? Start from the need, not from existing code. (2) **Reduce scope to the minimum**: separate files inline into functions, three queries become one, wrapper types disappear if the underlying type suffices. Every abstraction, file, function, or intermediate type must justify itself with concrete usage, not hypothetical flexibility. (3) **Minimize the code**: shortest correct typed version, no duplicate data when it already exists in usable form, prefer `if`+`return` over monadic patterns when as clear, don't revalidate data you control at entry. Iterate internally — challenge your own proposal at each level until nothing else can be removed, then present the result. Never wait for external pushback to simplify. Reviews: PR adding a layer (file/function/type/abstraction) without a concrete second use site -> flag "run the funnel; what level did this fail?"
- **Consult official library docs before proposing a solution** -- never assume third-party library behavior from training data or by reading source code. Before suggesting an API call, config option, or integration pattern for a library (auth, ORM, framework, router, validation, etc.), verify against the official docs via WebFetch/WebSearch. Source code is a last resort when docs are insufficient or wrong. Reviews: solution that names a library API without a doc reference -> flag "verify against docs first"
- **Optional markers are banned** -- never use `?:` in TypeScript types or `.optional()` in Zod schemas. Every property is required and always present on the object. If a value can be absent, use `| null` (or `.nullable()` in Zod) — the key exists, the value is null. No shape ambiguity. Rationalizations ("caller might not have it", "safer", "more flexible", "API doesn't always return it") are all wrong — fix the caller, narrow the type, validate at the boundary, or default. Applies to types, schemas, Drizzle columns, function params, return types. Reviews: any `?:` or `.optional()` -> reject, demand `| null` or required field
- **Reuse before creating** -- search the codebase for existing equivalents before writing new code. Reviews: new code that duplicates existing functionality -> flag "reuse X instead"
- **Rule of Three -- don't abstract until 3+ occurrences** -- two similar snippets are coincidence, three are a pattern. Premature abstraction couples unrelated callers. When a shared function accumulates `if (options.X)` branches to serve diverging callers, it became a wrong abstraction. Fix: inline into every call site, delete what each caller doesn't need, re-extract only when a true shared pattern emerges. **Exception — second case already known and concrete**: if a second call site is already specified (open ticket, named product constraint, defined roadmap slice), prepare the ground now — coordinating later costs more than extracting now. Test: can you **name** the second case and its timing? If yes -> prepare. If it's "maybe someday" / "could be useful" -> wait. Reviews: shared function with 3+ option flags controlling branches -> flag "inline and re-extract"; extraction justified by "we'll need it" without a named ticket/case -> flag "name the second case or wait"
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

## Pre-output checklist — run before returning ANY refactor

**LOUD GATE.** When the task is "refactor", "clean up", "fix everything wrong", or any multi-rule rewrite, you are under a *capacity trap*: it is easy to apply five obvious rules and silently drop twenty. **Do not return code until you have walked this list top-to-bottom and acted on every trigger you can see in the diff.** Each line is `trigger → required transform`. Generic by design — applies to any language, any module. (Full rationale lives in the sub-skill named in brackets; this is the recall surface, not the teaching.)

**Naming & comments** [`:style`]
- Function name contains `handle`/`process`/`data`/`do`/`run`/`execute`/`perform` → rename to intent (`handleOrderData` → `placeOrder`). The options-object rename does NOT save the verb.
- Abbreviated locals (`u`, `usr`, `itm`, `ct`, `amt`, `s`) → full words (`user`, `item`, `count`, `amount`, `stock`).
- Boolean without `is`/`has`/`should`/`can`, positive form → add prefix (`sendEmail` → `shouldNotify`).
- Comment restates the next line's mechanics (`// get user`, `// update cache`, `// create order`) → rewrite as the consumer/operator *consequence* or delete. "Update cache" → "next profile read sees this order without a DB hit."
- Early return / no-op / `continue` with no reason → add the *why* inline ("blocked users can't transact — reject before any I/O").
- Magic number / threshold (`1000`, `50`) → named constant AND a comment stating *why that value* ("orders over $1000 trip manual fraud review").
- Domain term used cold (`big_orders`, a status string) → one-line definition on first use.
- Archaeology (`was`, `previously`, `originally`, `refactored from`, `in Q3`) → delete; history lives in git.
- Comment anchored to ONE caller ("exposed because the admin dashboard needs it") → rewrite to the stable domain purpose, name no caller.
- Exported function → a function doc (~5 lines) naming the consumer-visible effect / return-value meaning. NOT a bare label, NOT a 6-line "steps" block, NOT `@example` filler.
- Multi-step pipeline (3+ steps) → module/function doc with the steps as a **bullet list** (what / consumer consequence / how-as-bullets). Not a dense prose paragraph.

**Control flow & data** [`:style` + `:design`]
- Nested `if` inside loop, >3 indent levels → flatten with guard clauses + early `continue`/`return`.
- `x === 'A' ? .. : x === 'B' ? .. : ..` ternary chain → object map or `switch`.
- Compound expression (2+ ops: tax × qty − discount) → extract named intermediate vars.
- `let acc = 0; acc += ...` / `arr.push(...)` accumulator in a loop → `map`/`filter`/`reduce`, return new data.
- Independent `await` inside a `for` loop (per-item stock check) → `Promise.all(items.map(...))`.
- Boolean param that branches the body (`isUrgent`, `sendEmail`) → split into two named functions. An options object is NOT a fix — the flag still branches.
- 4+ positional args, or 2+ same-typed neighbours → options object.

**Types & errors** [`:design` + `:errors`]
- `any` / untyped param / `type X = string` for a status → explicit interface; union (`'pending' | 'paid' | ...`) for finite states (make illegal states unrepresentable).
- Untyped external input flowing inward → parse at the boundary into a typed domain object (parse, don't validate).
- ANY external input enters the function (array, number, string from a param/request/row) → at the very top, BEFORE any I/O, emit explicit bound checks that **reject** (return a Result error), never skip/clamp/default: empty collection → reject; number that must be positive (`qty`, count, amount) → reject if `<= 0`; required string blank → reject. A `?? 0` / `|| ''` fallback or a `continue` that silently drops a bad item is a FAIL, not a fix — the invalid value must produce a Result error. If you wrote zero reject-on-invalid guards, you skipped this rule.
- `throw` anywhere → return `Result<T,E>`; convert at the edge only.
- Any error value you return or define (`new Error('msg')`, or a Result error type / discriminated union) → it MUST carry ALL FOUR fields `{ type, code, status, detail }` and preserve the cause. `{ type, detail }` or `{ type, code, detail }` is INCOMPLETE — `status` is mandatory. After removing `throw`, re-open every error variant and confirm all four fields are present; a typed union missing `code` or `status` still fails this rule.
- "Impossible" guard (`total <= 0` after summing valid prices) → return `err({ type:'INVARIANT_VIOLATION' })` + a comment stating why it should never happen. Don't `throw`.
- Function throws on a condition the caller can't prevent (`removeCartItem` on absent item) → redefine so the call succeeds idempotently (postcondition: "item not in cart").
- EVERY I/O call without exception (`db.query`, `fetch`, `mailer.send`, `cache.get/set`, any network/disk await) → wrap it so it cannot hang: `withTimeout(db.query(...), MS)` or pass `{ signal: AbortSignal.timeout(MS) }`. Count your I/O calls, then count your timeouts — the two counts MUST match. A single un-timed `await db.query(...)` is a FAIL. If you wrote any raw `await someIo(...)` with no timeout/signal, you skipped this rule.
- Caller forced to pass mechanism config (`retryCount`, `retryDelayMs`) → pull that complexity down into the module or drop it.

**Architecture & structure** [`:design`]
- `import { db }` / `cache` / `mailer` as module globals → inject via factory `createOp({ db, cache, mailer })`.
- `console.log` / tracing inside business logic → move to a crosscutting wrapper / middleware.
- Raw DB row returned (`return rows[0]`, column names like `user_id`) → map to a DTO response type.
- Magic codes/thresholds inline in the body → a config object resolved once, not scattered literals.
- One function mixing many concerns (fetch + price + persist + notify + cache) → split by **responsibility** into named operations.
- One function/module mixing unrelated business domains (fulfillment + document formatting + shipping + validation) → separate into distinct named sections/modules; one reason-to-change each.
- File has 2+ `export`s, or any `export` sits below a non-exported helper → enforce this exact top-to-bottom order: (1) imports, (2) shared types/constants, (3) ALL exported/public functions grouped together, (4) private helpers last. An exported function declared at the bottom of the file, or public functions interleaved with private ones, is a FAIL — move every `export` up so a reader sees the whole public API before any helper.
- 3+ functions with the same signature + similar body (`formatEmail`/`formatReceipt`/`formatInvoice`) → one parameterized function (Rule of Three). The shared param group (`to, name, amount, currency`) → a named Value Object.
- Validation re-checked deep inside a loop after it was already checked at entry → barricade once at the boundary, trust inside.

**After the walk:** if any trigger fired and you did NOT transform it, either fix it or state explicitly which rules you skipped and why. Silent partial application is the failure mode this gate exists to stop.

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
