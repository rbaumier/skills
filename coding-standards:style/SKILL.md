---
name: coding-standards:style
description: Use when writing or reviewing comments, docstrings, names, control flow, or file organization. Use when evaluating readability, choosing identifiers, splitting files, or applying naming conventions. Use when removing AI tells (slop) from code prose — comments, docs, error messages, commit messages, PR descriptions. Covers the visible surface of code.
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
- **Plain English only:** The reader is a junior dev, English as second language, skimming at 2am. Pick the short Germanic word over the Latinate one.
- **30 words MAX, hard cap. Count them.** Sacrifice grammar entirely for the sake of concision. Flow is NOT the goal.
- **MANDATORY OMISSIONS:** Drop articles (`the`, `a`), copulas (`is`, `are`, `was`), auxiliaries (`would`, `will`, `can`, `has`), and pronouns (`it`, `this`, `that`) wherever meaning survives.
- **Before / After shape:**
  - ❌ 28w: *"A rewind would re-count attempts we already folded into closed groups, inflating the failure rate."*
  - ✅ 4+3w: *"Rewind double-counts closed groups. Failure rate inflates."*
- **Self-check on every comment before save:**
  1. Scan for split triggers: `and`, `so`, `but`, `—` between clauses, `then`, `, which`, `;`, `that`. Found one? Split.
  2. Count words in each sentence.
  3. Still over 10? The sentence holds 2 ideas. Split. Break lines on idea end, not column.
- **Banned words — closed list, grep-able, zero exceptions:** `tally`, `tallies`, `flapping`, `hog`, `spurious`, `singleton`, `contended`, `bookmarking`, `trailing`, `leaky`, `flush`, `starve`. Presence = violation, rewrite. **The closed list is the floor, not the ceiling** — apply the same test to every word you write: shorter-older-more-childlike wins.

### 3. Content Rules: Why over How
- **Place comments inline next to the statement they guard.** A multi-line "steps" block at the top of a function paraphrases the code, rots on the first refactor, and forces the reader to mentally re-pair abstract steps with lines. If a comment would describe N steps, write N separate inline comments next to N different statements — not one block. Function doc (above the signature) is the ONLY top-of-function prose and names consumer-visible behavior, never steps (see Section 5).
  - ❌ 6-line block atop the function: *"1. Validate input. 2. Fetch user. 3. Check permission. 4. Update record. 5. Emit event. 6. Return result."*
  - ✅ Each line lives where it applies, e.g. above `if (!isAllowed(user, record))`: *"Permission re-checked here: caller's check is advisory."*
  - **Counter-example (when a top block IS correct):** dense SQL or an atomic state-machine algorithm (Section 1, Exception 5) — walking through the invariant once at the top is the point. Outside Exception 5, this rule applies.
  - Reviews: 3+ line "what this function does" block above an ordinary function body → flag "split per-statement and move next to the relevant line, or delete if the code already says it."
- **How -> Code. Why -> Comment. Never both.** The code shows the mechanics. Dense SQL/math (Exception 5) is the only exception where you walk through invariant steps.
- **Customer/operator consequence:** Document what happens for the customer/operator. What human-visible symptom occurs if it fails?
- **Don't paraphrase the callee:**
  - **Detector:** Is the comment's first verb a synonym of the called function's name? E.g., `// Fetch subscriptions...` above `list_candidates(...)` → `fetch` paraphrases `list`. Delete the paraphrase, keep ONLY the *why-here* ("same tx as cursor advance").
- **Never define a language keyword:** `useMemo`, `Arc`, `ON CONFLICT`: docs exist. Comment adds *why*, never the definition.
- **Inaction needs a reason:** Empty branch, no-op, early return: state why.
- **One insight, one place — per codebase, not per file:** State each rationale ONCE, at its canonical spot (the guard's test, the shared helper, the earliest useful line). Elsewhere: nothing, or a one-line pointer. **Detector:** writing a comment whose argument you already wrote 20 lines up, in a sibling file, or in the colocated test → delete this copy, keep the canonical one. Reviews: same rationale in 2+ places → flag "keep one, point to it".
- **Cite canonical docs, never recopy them:** Mechanism explained in a project doc/ADR (`docs/agents/*`, ADRs) → comment is one line naming the hazard + the pointer. Re-explaining the full mechanism inline duplicates the doc and rots when it changes. ❌ 8-line plan-cache walkthrough above `SET LOCAL`. ✅ *"Parameterized VALUES misestimates under generic plan — see docs/agents/backend-handlers.md."*

### 4. Domain & Boundaries
- **Domain terms:** Keep verbatim. Introduce once. NEVER use synonyms. NEVER abbreviate (`subscription` stays `subscription`, never `sub`).
- **Limits/invariants:** Caps: state why + leftovers. TX: state in-tx vs post-commit.
- **No archaeology:** History = git. Never `was`, `previously`, or `refactored`. **Trap — archaeology without the trigger words:** a comment explaining absent code (*"No preliminary X row: it would never be observable"*, *"no TS reshape needed"*) narrates the refactor to the reviewer. Post-merge readers never saw that code; the justification belongs in the MR description / commit message. **Detector:** comment only makes sense compared against code NOT in the file (a removed step, a rejected alternative, the old implementation) → delete. Reviews: comment defending the change instead of stating a live constraint → flag "move to MR description".

### 5. Documentation Structure
- **Struct doc:** JSDoc/Rustdoc/etc. Role only, not fields. No "and also" filler.
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

  **A multi-step function/pipeline (3+ sequential steps) MUST carry this doc — write it, do not delete it and do not collapse it into one prose sentence.** Worked example:
  ```ts
  /**
   * Places an order and confirms it to the buyer.
   * Buyer sees a confirmation email; their next profile load shows the order without a DB hit.
   * How:
   * - price the cart and persist the order row
   * - email the buyer their confirmation
   * - warm the per-user cache with the new order id
   */
  export async function placeOrder(userId: string, items: CartItem[]): Promise<Order> { /* ... */ }
  ```
  This names the consumer-visible outcome (1-2) then lists the *phases* as bullets (3). It is NOT a line-by-line code paraphrase — it survives refactors, so it is the one top-of-function comment you KEEP, not delete.

### 6. EXCEPTION: Logs and Errors
- Error and log messages are a separate class, NOT comments. The telegraphic 10-word rule DOES NOT apply.
- Go detailed and helpful. Name what went wrong, relevant identifiers, and the user's/operator's next action.
- See `coding-standards:errors` for the full diagnostic-complete rule.

### 7. Workaround Comments with Upstream Link
- When code contains a workaround, hack, or edge-case bypass, the comment MUST include a link to the upstream issue/PR documenting the problem.
- Prefix with `HACK:` or `WORKAROUND:` for greppability. This enables knowing when the workaround can be removed.
- Format: `// WORKAROUND(rustc#12345): remove when MSRV >= 1.78` or `// HACK: esbuild doesn't tree-shake enums, see https://...`

### 8. Lint Suppressions Must Be Justified
- Every lint suppression (`#[allow]`, `// eslint-disable`, `@ts-ignore`, `@ts-expect-error`) requires a comment explaining WHY.
- In Rust, prefer `#[expect]` over `#[allow]` — `expect` breaks compilation when the warning disappears, forcing cleanup.
- Reviews: bare suppression without justification -> flag "add reason for suppression"

**Never**: code paraphrases, commented-out code, `TODO`/`FIXME` without issue link, name-restating. **Reviews**: any bullet violated → flag with bullet name.

## Prose & Anti-Slop

Comments and docstrings already get the telegraphic concision above — that terseness is itself anti-slop. This section adds the AI *tells* to scrub, and governs the **longer prose a coding agent emits**: function/module docs, error & log messages (Section 6), commit messages, PR/MR descriptions, ADRs.

**Two regimes:**
- **Telegraphic** (comments, docstrings): concision wins — fragments fine, no subject required. Still scrub the *content tells* below: false agency, vague declaratives, throat-clearing, jargon, hedge adverbs.
- **Full prose** (docs, errors, logs, commits, PRs, ADRs): complete sentences, active voice, a named actor. The whole regime below applies.

### 1. Content tells — banned in ALL prose, grep-able
- **Throat-clearing openers — cut, state the point:** `Here's the thing`, `Here's what/why/how`, `It turns out`, `The truth is`, `Note that`, `It's worth noting`, `At its core`, `When it comes to`, `The reality is`.
- **Emphasis crutches — cut:** `Full stop.`, `Period.`, `Let that sink in.`, `This matters because`, `Make no mistake`.
- **Hedge / intensifier adverbs — cut:** `really`, `just`, `simply`, `actually`, `literally`, `genuinely`, `honestly`, `truly`, `fundamentally`, `inherently`, `basically`, `essentially`. Extends the comment word-ban (§2); same shorter-older-plainer test.
- **Business jargon — plain verb instead:** `leverage`→use, `navigate`→handle, `unpack`→explain, `deep dive`→analysis, `lean into`→accept, `circle back`→revisit, `moving forward`→next, `game-changer`→significant.
- **Lazy extremes — name the real scope:** `every`, `always`, `never`, `everyone`, `nobody` doing vague work → the actual count or case.
- **Vague declaratives — name the specific thing:** ❌ *"The implications are significant."* / *"The reasons are structural."* ✅ *"Replays now double-charge the buyer."*

### 2. Structural tells — every artifact
- **No false agency — name the actor.** Inanimate nouns don't perform human verbs. ❌ *"the decision emerges from config"* ✅ *"`loadConfig` picks the tier"*. ❌ *"the data tells us"* ✅ *"the p99 query returns 800ms"*. **Detector:** subject is a noun that can't act (decision, data, complaint, market, culture) + a human verb → rewrite with the real actor, or `you`.
- **No binary contrast — state Y.** Kill `not X, it's Y` / `isn't X, it's Y` / `the question isn't X, it's Y`. ❌ *"Not a cache bug. A lifetime bug."* ✅ *"The bug is in the lifetime."*
- **No rhetorical setup / negative listing.** Cut `What if…?`, `Think about it`, `Here's what I mean`, and `Not X… Not Y… Z` runways — make the point.
- **No meta-commentary.** Code prose never announces its own structure: `Let me walk you through`, `In this section`, `As we'll see`, `but that's another story`.

### 3. Full-prose regime — errors, logs, commits, PR/MR, ADRs
- **Active voice, named actor.** ❌ *"The decision was reached to retry."* ✅ *"`fetchOrder` retries on 503 because the gateway is flaky."* Passive hides who acts. Telegraphic comments are exempt — they carry no subject by design.
- **No em-dash for drama** — comma or two sentences. In comments `—` is already a split trigger (§2).
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
