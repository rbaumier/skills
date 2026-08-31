---
name: coding-standards:style
description: Use when writing or reviewing comments, docstrings, names, control flow, or file organization. Use when evaluating readability, choosing identifiers, splitting files, or applying naming conventions. Use when removing AI tells (slop) from code prose — comments, docs, error messages, commit messages, PR descriptions. Covers the visible surface of code.
---

## Comments

**Default: no comment.** The name and the types carry the what. A comment earns its place by one test — **which bug or misreading does a reader make without it?** No answer, no comment. What earns it:

- a decision the code cannot show. `// 404 means the version was purged; fall back to the latest one.`
- a trap that bit or will bite. `// getSession() returns null for ~200 ms after a refresh.`
- an action or a bypass with its link: `TODO(#n):` / `WORKAROUND(upstream#n):` / `HACK(upstream#n):`.
- A lint suppression (`#[expect]` over `#[allow]`, `eslint-disable`, `@ts-expect-error`) carries its justification on the same line.

Shape: one idea, one short plain sentence, placed on the statement it guards, never a step list atop the function. One exception: dense SQL, math or a state machine may carry one block naming the invariant. Public symbol (`///`, `/** */`, docstring): state what the name doesn't (contract, unit, surprise), else nothing — never a step inventory of the body. Module doc (`//!`, file header): role + consumer-visible effect. Domain terms verbatim, never abbreviated. Errors and logs are not comments: they go detailed (`coding-standards:errors`).

A comment that fails the bug test is **deleted, not rewritten** — rewrite only when a rationale survives the test. From real diffs:

- ❌ 63 words above a zod schema: *"One schema for both POST … and GET …: the read is the POST body minus cache_hit …, so both are optional here rather than split across two schemas. Left non-strict on purpose: the server grows the payload additively …"* → `// shared by POST /synthesis and GET /versions/{id}; non-strict, the server adds fields.`
- ❌ *"Refetch the mounted list for this key either way: a stored run added or reshuffled a version, and an empty run may still leave older archives to show."* → delete: the call reads alone; "either way" narrates a branch that no longer exists.
- ❌ *"First refetchInterval of the app"*, *"the card's helpers are a verbatim move"*, *"no setState in an effect"* → delete: delivery narration and rejected options belong to the MR description.
- ❌ *"A true result also guarantees at least two entries"* → delete: the signature says it.
- ❌ *"Fetch subscriptions …"* above `listCandidates(...)` → delete: paraphrase of the callee.
- ✅ `// parameterized VALUES misestimates under the generic plan; see docs/agents/backend-handlers.md` — one line, the doc holds the mechanism.

**Reviews:** paraphrase (the comment shares its identifiers with the next line), delivery narration (`this MR`, `previously`, `now`, `no longer`, `first … of the app`), rejected option (`rather than`, `instead of`, `on purpose`), type restated, rationale parked atop the function instead of on the statement it guards → flag "delete". Missing comment where the diff clearly learned something (a workaround, a fragile ordering, a non-obvious fallback) → flag "record it". Same rationale in 2+ places (per codebase, not per file) → keep one, point to it.

## Prose & Anti-Slop

Comments follow the bug test above. This section adds the AI *tells* to scrub, and governs the **longer prose a coding agent emits**: function/module docs, error & log messages (Section 6), commit messages, PR/MR descriptions, ADRs.

**Two regimes:**
- **Comments** (bug-test-gated, one idea): still scrub the *content tells* below: false agency, vague declaratives, throat-clearing, jargon, hedge adverbs.
- **Full prose** (docs, errors, logs, commits, PRs, ADRs): complete sentences, active voice, a named actor. The whole regime below applies.

### 1. Content tells — banned in ALL prose, grep-able
- **Throat-clearing openers — cut, state the point:** `Here's the thing`, `Here's what/why/how`, `It turns out`, `The truth is`, `Note that`, `It's worth noting`, `At its core`, `When it comes to`, `The reality is`.
- **Emphasis crutches — cut:** `Full stop.`, `Period.`, `Let that sink in.`, `This matters because`, `Make no mistake`.
- **Hedge / intensifier adverbs — cut:** `really`, `just`, `simply`, `actually`, `literally`, `genuinely`, `honestly`, `truly`, `fundamentally`, `inherently`, `basically`, `essentially`.
- **Business jargon — plain verb instead:** `leverage`→use, `navigate`→handle, `unpack`→explain, `deep dive`→analysis, `lean into`→accept, `circle back`→revisit, `moving forward`→next, `game-changer`→significant.
- **Lazy extremes — name the real scope:** `every`, `always`, `never`, `everyone`, `nobody` doing vague work → the actual count or case.
- **Vague declaratives — name the specific thing:** ❌ *"The implications are significant."* / *"The reasons are structural."* ✅ *"Replays now double-charge the buyer."*

### 2. Structural tells — every artifact
- **No false agency — name the actor.** Inanimate nouns don't perform human verbs. ❌ *"the decision emerges from config"* ✅ *"`loadConfig` picks the tier"*. ❌ *"the data tells us"* ✅ *"the p99 query returns 800ms"*. **Detector:** subject is a noun that can't act (decision, data, complaint, market, culture) + a human verb → rewrite with the real actor, or `you`.
- **No binary contrast — state Y.** Kill `not X, it's Y` / `isn't X, it's Y` / `the question isn't X, it's Y`. ❌ *"Not a cache bug. A lifetime bug."* ✅ *"The bug is in the lifetime."*
- **No rhetorical setup / negative listing.** Cut `What if…?`, `Think about it`, `Here's what I mean`, and `Not X… Not Y… Z` runways — make the point.
- **No meta-commentary.** Code prose never announces its own structure: `Let me walk you through`, `In this section`, `As we'll see`, `but that's another story`.

### 3. Full-prose regime — errors, logs, commits, PR/MR, ADRs
- **Active voice, named actor.** ❌ *"The decision was reached to retry."* ✅ *"`fetchOrder` retries on 503 because the gateway is flaky."* Passive hides who acts.
- **No em-dash for drama** — comma or two sentences. In a comment `—` chains two ideas: split or delete.
- **Vary rhythm, trust the reader.** Don't stack three same-length punchy fragments. Drop permission tails (`And that's okay.`) and pull-quotes — if a line reads like a tweet, rewrite it. Two items beat three.
- **Reader in the seat.** `you` over `people` / `one`; specifics over `the system handles the cases`.
- **Self-score before shipping a PR/MR description or ADR** — rate 1–10: **Directness** (states, not announces), **Rhythm** (varied), **Trust** (no hand-holding), **Authenticity** (human), **Density** (nothing cuttable). Below 35/50 → revise.

**Reviews:** banned phrase, false-agency subject, binary contrast, vague declarative, passive voice in full prose, or em-dash drama → flag with the pattern name.

## Naming

- **Intent over implementation**: `closeAccount()` not `setStatusToClosed()`. **Banned function-name words: `process`, `handle`, `data`, `do`, `execute`, `run`, `perform`** -- vague mechanics. Replace: `processOrder` -> `fulfillOrder`, `handlePayment` -> `chargeCustomer`. Reviews: any function with banned word -> rename
- **Specific verbs with fixed semantics** -- each verb has one documented meaning project-wide: `sanitize` = cleanup at boot, `validate` = data validation at runtime, `build` = assembly, `create` = instantiation, `resolve` = lookup with resolution, `is`/`has` = predicates. Never use one verb with two different meanings. Reviews: two functions with same prefix but different semantics -> flag "inconsistent verb usage"
- **Name dangerous options defensively** -- prefix security-bypassing options with `dangerous_`/`unsafe_`/`insecure_`. Prefix workarounds with `_hack`/`_workaround`/`_compat` plus explanatory comment. Prefix unstable features with `experimental_`. Reviews: dangerous option with a neutral name -> flag "prefix with `dangerous_`"
- Symmetry: `get/set`, `add/remove`, `start/stop`
- Booleans: `is`/`has`/`should`/`can` prefix, positive form
- Full words always (`user` not `u`, `account` not `acct`). Destructure abbreviations: `const { timestamp, buffer, userId } = record`. Remove unused params
- **Code smell detection table for reviews** -- flag common naming smells during review: single-letter names (`const d = new Date()` -> `const createdAt = new Date()`), generic names (`data`, `info`, `temp`, `result` -> name by what it represents), misleading names (`userList` but it's a Set -> `userSet`), encoding types (`strName` -> `name`). Reviews: any variable matching these patterns -> flag with fix
- Explicit units: `delayMs`, `fileSizeKb`
- **Qualifiers last, sorted by descending significance** -- `latency_ms_max` not `max_latency_ms`. Related variables align vertically and group by topic at sort: `latency_ms_max` / `latency_ms_min` / `latency_ms_p99`. Reviews: qualifier prefix breaking up a topic family -> flag "move qualifier to suffix"
- **Match character counts for paired names** -- `source` / `target` over `src` / `dest` so derived names (`source_offset` / `target_offset`) align in source. Tiny readability win, free.

## Control Flow

- Guard clauses, early return, max 3 indent levels
- `switch`/object maps over `if/else` chains
- **Split boolean flags into two named functions**: `sendUrgentNotification()` / `sendNormalNotification()` not `sendNotification(msg, isUrgent)`. **A ternary, if/else, or options object is NOT a fix** -- boolean still exists as param. Result: two independently callable functions with zero boolean params. Reviews: boolean controlling branch -> split
- Return new data, don't mutate inputs
- **`Promise.all` for independent async ops** -- even when using Result types: run all async calls with `Promise.all`, then check each Result. `const results = await Promise.all(items.map(i => checkStock(i)))` → `const firstError = results.find(r => !r.ok)`. Never sequential `for...await` when calls are independent
- **Split compound conditions** -- prefer nested `if/else` over `if (a && b && c)`. Reader can verify each case is handled; failure tells you which condition fell. Same applies to assertions: `assert(a); assert(b);` not `assert(a && b)`. Reviews: 3-clause boolean in a condition or assert -> flag "split for diagnosable failure"
- **State invariants positively** -- `if (index < length) { ... ok branch }` beats `if (!(index >= length))`. Avoid double negatives; name the condition that holds, not the one that doesn't. Reviews: condition with leading `!` over a comparison -> flag "invert to positive form"
- **Push ifs up, push fors down** -- when splitting a function, keep branches (`if`/`switch`) in the parent and move branch-free computation into helpers. State mutation also lives in the parent. Branches concentrated at the top of the call tree are inspectable; branches scattered through leaves are not. Pairs with the Stepdown Rule (high-level above, leaves below; see `coding-standards:design`). Reviews: extracted helper that itself branches over a different state than its parent -> flag "lift the branch to the parent"

## Readability

**Write code any newcomer understands on first read.** Recipe style — clear steps, named ingredients, no magic.

- **Intermediate variables for every compound expression** -- 2+ operations = extract to named variable. Reviews: compound inlined -> flag
- **One blank line between logical blocks** -- group: setup, validation, transform, return
- **No clever code** -- no nested ternaries, no multi-operation one-liners, no implicit coercion (`+[]`, `!!value`). 5-line inline block -> extract as named function
- **No hidden control flow** -- decorators, middleware chains, event emitters, and magic auto-registration that make call paths untraceable are complexity in disguise. Every call path must be traceable top-down. Reviews: answering "what happens when this endpoint is hit?" requires reading 3+ files of middleware/decorator plumbing -> flag "make control flow explicit"
- **Minimize POCPOU — Place-Of-Check to Place-Of-Use** -- distance in code between checking a value and using it is a bug opportunity (the value might be re-bound, mutated, invalidated, or used in a stale branch). Declare variables next to first use, validate next to the operation that needs validity, not at the top of a 40-line function. Cousin to TOCTOU at runtime. Reviews: validated value used 30+ lines below the check, with mutations between -> flag "move the check to the use site"

## File Structure

- Exports/public API at top, private helpers at bottom
- Tests next to source. Group by feature not type
- **Workflow-first — code features top-to-bottom in ONE file** -- when building a new feature (user registration, order checkout, data import), write the whole flow in a single file: validation, core logic, helpers, types, all of it. Reading the feature means opening one file and scrolling, not jumping across `validators/`, `services/`, `helpers/`, `utils/`, `types/`. A 500-line file that reads like a book top-to-bottom is better than ten 50-line files scattered across 4 directories. Two valid reasons to split: (1) a second module genuinely imports part of it — extract that part to a sibling file; (2) the operation grows complex with multiple independent concerns — promote to a Slice-as-folder (see below). Never split by size alone. Reviews: new feature split across 4+ files on day one -> flag "collapse into a single workflow file"
- **Slice-as-folder for complex operations** -- when a single workflow file contains multiple isolated concerns (promotion engine, currency conversion, fraud scoring), promote it to a folder: `createOrder/index.ts` (pure orchestrator, Stepdown Rule) + `applyPromotions.ts` + `convertCurrency.ts`. From the outside the slice is still one unit. Trigger: concerns are independently testable and have distinct reasons to change — not just "the file is long". Reviews: sub-files created solely because the file is long -> flag "merge back unless concerns are genuinely independent"
- **Locality of Behavior (LoB) — single-use helpers stay with their caller** -- code used in exactly one place belongs NEXT to that place. If a function has exactly one call site in the whole codebase, it does NOT belong in a separate `utils.ts` / `helpers.ts` / `*-helpers.ts` / `shared/*.ts` file. Put it at the bottom of the caller's file. Separate files are for code with 2+ real consumers RIGHT NOW, not 1 imagined future consumer. Every reader pays a navigation tax forever for a reuse that may never come. **"Shared primitive" is NOT an exception**: Result types, `ok`/`err` helpers, `withTimeout`, date utilities, string helpers — if there is exactly ONE caller today, they live inlined in the caller's file. Move them to `shared/` only when a SECOND caller genuinely appears and imports them. "I'm going to need this elsewhere" is not a second caller. **Exception — slice-folder sub-files**: within a promoted slice-folder (`createOrder/`), sub-files (`applyPromotions.ts`, `convertCurrency.ts`) may have a single caller (the orchestrator) when they contain complex, independently-testable logic with a distinct reason to change. The folder boundary is organizational, not a reuse boundary. Reviews: imported helper with exactly 1 caller outside a slice-folder -> flag "inline to the bottom of the caller's file and delete the helper file"
- **Colocate extracted helpers** -- when you extract a sub-function from a long function, put it at the BOTTOM of the SAME file, not in a new file. The reader keeps a single file open for the whole workflow. Promote a helper to its own file only when a second module genuinely imports it. Reviews: new file created for a helper used once -> flag "move to the bottom of the caller's file"
- **Inline single-use when reviewing** -- in code review, if you open an external file for a function called from exactly one place in the entire codebase, pull the function's body back (either to the call site or to the bottom of the caller's file) and delete the external file. One-call-site extractions are indirection without benefit. Reviews: imported function with exactly 1 caller -> flag "inline it back and delete the file"
- **File length is a readability test, not a hard cap** -- there is NO hard maximum line count. A file is too long when a new reader can't follow the workflow top-to-bottom in one pass — not when it crosses an arbitrary threshold. The test: open the file cold and scroll top-to-bottom once — can you understand what the feature does? If yes, leave it. If no, split — but split by **responsibility** (two unrelated features = two files), never by **size alone**. A 500-line coherent feature file is fine. A 120-line file doing three unrelated things is not. Reviews: file split solely for size with no responsibility boundary -> flag "merge back"; file doing multiple unrelated things regardless of size -> flag "split by feature"
