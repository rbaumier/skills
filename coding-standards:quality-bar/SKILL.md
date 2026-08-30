---
name: coding-standards:quality-bar
description: Quality bar — the synthesized one-page pre-handoff checklist over the coding-standards family, cleared as you write to pre-empt review findings. Use whenever writing or refactoring source code in any language.
---

# Quality bar — clean first pass

Standards to clear *as you write*, before the code is reviewed — each one cleared
up front is a review round-trip saved. Aim for the version a senior would call
inevitable, not just code that passes: rework a messy-but-green first cut before
you call it done. Before handoff, account for every section below; any bar you
leave uncleared, name it and why — don't drop it silently. **SUBORDINATE to the
repo**: when a rule here conflicts with the repo's `CLAUDE.md`/`AGENTS.md` or
established patterns, follow the repo. `⟦repo⟧` = apply only if the repo already does it.

### Scope & necessity
- Build only what the task requires. No speculative feature/param/export/"flexibility".
- Question necessity first: framework/lib/stdlib already does this? Pattern kept by inertia → delete (in code you're touching; flag the rest, don't expand scope).
- New abstraction needs ≥1 real caller now. 0–1-caller wrapper/option = dead weight → inline/drop.
- Compat path with no caller (old mode flag/prop/wrapper/route alias/fallback) → delete, not polish. Grep callers first.
- Prefer boring/proven tech. Justify any novel dep or pattern before adding.
- **Second copy = refactor.** Grep the workspace FIRST: a block, helper, mapping or mechanism (cache, retry, redaction, truncation, HTTP-client config, test helper…) the repo already has is consumed or extended, never rewritten — not "locally", not "for now". The moment you would write the 2nd copy, extract to the shared module/crate and ship the lint lock (clippy `disallowed-methods`, oxlint rule) in the same change. There is no rule of three: two is the pattern.
- Your change touches a block that already has a copy elsewhere? Consolidate it in this change when the grep is short; when it fans wide, this change is the expand + the sites it touches and names the rest (the grep list) in the MR — never a silent Nth copy.
- Never hand-imitate platform behavior (HTML via regex, shell escaping by hand, URL string surgery): use the real parser/lib — if it's already a dep, string ops instead of it is a bug.
- Remove orphans your change creates (unused import/param/helper). Don't touch pre-existing dead code.

### Simplicity & structure
- Simplest structure that works. Delete complexity > rearrange it.
- 50-line linear fn > ten scattered 5-line helpers.
- Deep modules: simple interface hiding real complexity — absorb hard decisions internally, don't expose them as config knobs. No pass-through wrapper.
- Don't leak internals to callers just for testability (big-step > small-step).
- Single-call-site fn → inline. Exception: step-down orchestrator / own tests / repo expects unit.
- Single-use var = one indirection: keep only if it *names* (meaning the expr lacks) or *structures* (tames nesting); generic temp (`result`/`data`/`response`) used once → inline.
- Keep regardless of naming if load-bearing: capture-before-mutation, single-eval of side-effecting/non-idempotent call, short-circuit/`await` order, TS narrowing — inlining there changes behavior, not style.
- Concentrate inherent complexity (DI/routing/parsing) in named modules; rest stays simple.
- Business logic lives once. Entry points (http/cli/job/webhook) parse+delegate to one operation, no dup.
- Independent work runs concurrently — don't serialize async steps that don't depend on each other.
- No query in a loop: batch reads (`= ANY`/`UNNEST`/`IN`, dataloader). N+1 is a defect, not a style.
- Ownership/authorization filters live in the query (JOIN/WHERE), never fetch-all + in-app filter.
- Guard clauses + early return; max ~3 indent levels.
- Return new data; don't mutate inputs.
- No clever code: no nested ternaries, no implicit coercion, no multi-op one-liners.
- No globals/singletons/magic-registry state → single root state, traceable top-down.
- No ad-hoc conditional bolted on unrelated flow → own path/helper/typed dispatch.
- Feature logic out of shared/general paths. Inject policy; don't hardcode in mechanism.
- Extract by responsibility (distinct reason-to-change), not line count.
- File past repo norm (~500 LOC) → split by responsibility first.

### Module boundaries & vertical slices
- Organize by domain/operation, not role. One op file = full vertical (handler+logic+query+types). Read feature = open 1 file, scroll. No use-case split across `services/`/`repositories/`/`handlers/`. Repo already structured → match it.
- Public API = forever cost on consumers (Hyrum's Law). Default private, minimize observable surface.
- Pit of success: obvious call = correct call. Push the invariant into the seam — safe API > narrow type > rename/split the dangerous path > helper last (only if all natural callers use it). A helper you must remember to call ≠ fix.
- Wrap third-party types at the boundary; keep the dep private. No vendor types in your signatures.
- One module = one absorbed assumption (Parnas). Name the change it hides. No nameable assumption → just a folder.
- Domain-shared helper: extract only on real reuse, never by anticipation. No `shared/` for domain logic (only pure tech utils, 3+ domains).
- Cross-domain: public API only, never internals/DB tables. 3+ domains react → domain event, not N imports.
- Port/seam only with ≥2 real adapters — in-memory test fake counts as the 2nd. External/remote dep → inject as port (fake in test, real in prod).
- Pass library options explicitly at call site (timeout/creds/redirect) — survive default-drift.
- Moving internals with external consumers → keep a compat barrel/facade. In-repo only → just update call sites.

### Types & data-model
- Illegal states unrepresentable. Domain forbids combo → type forbids it, not runtime check.
- Workflow/status = one discriminated union/enum (1 variant/state); unhandled variant fails at compile time (e.g. TS assertNever). No status strings, no parallel booleans.
- Parse untrusted input → typed domain object at boundary. Then trust inside; no re-validation in loops.
- Domain-closed value (country, plan, channel) validates against the product's explicit allowlist — the reject names the allowed values. Shape-only validation (regex, length) is not validation.
- Contract-first: typed input/output schema before the handler. Separate Input (no server-set fields) from Output.
- No silent fallback masking invalid input (`?? 0`, `|| ''`).
- No escape-hatch type erasing the contract (e.g. TS `any`/`unknown`, untyped cast) → make boundary explicit.
- Generated API/client types are the source of truth: consume them directly — no local alias, mirror type, or convenience Pick/Omit of a generated type. Missing shape → expose it server-side, don't re-declare it client-side.
- Don't re-model state a library already exposes (query `status`, form/router state): switch on the library's discriminant, never a parallel homemade union or boolean flags.
- Return-type ladder: `void` < `bool` < `T` < `Option<T>` < `Result<T,E>`. Pick simplest; each step up forces a branch at every call site.
- Options object > 4+ positional args / 2+ same-type adjacent (swap-proof).
- Behavior-branching bool/enum param → split into named fns.
- Bool return carrying business meaning → 2-variant enum (`Applied`/`AlreadyApplied`): `true` teaches the caller nothing.
- Same 3+ fields always travel together → named value object.

### Error handling
- Error says: what op, why, remediation, blast radius. Preserve cause.
- Assert only invariants the type can't encode (don't re-check already-parsed boundary data). Positive AND negative space.
- Declare specific error types at lib/api boundary, not bare throw/`any`.
- Design error out of existence (redefine contract) > handle after.
- Bound every loop/queue/retry/buffer. No unbounded `while`.
- Timeout every I/O (db/net/fs). Validate env/config at boot, fail fast.
- Release every acquired resource (file/conn/lock/listener/subscription) on ALL paths, errors included.
- Handle or propagate every error — never catch-and-ignore.
- Multi-step mutation: atomic or recoverable — no half-applied state on failure.
- No secret/token/PII in logs, error messages, test fixtures, or commits.
- Raw error from a credential-holding dep (DB pool, authed HTTP client) can replay the connection string/token → wrap and redact before logging, never log the driver error raw.
- Long-running service: fail the unit of work, not the process (exit the process only at boot).
- Barricade exception: auth/crypto/PII checks never skipped, even inside the trusted zone.
- Error crossing the boundary back to caller/user strips stack trace + raw provider payload (cause preserved internally).
- User-facing message: reassure what's NOT affected, never blame user/third-party, no jargon.
- Match repo error idiom: Result/tagged where used, exceptions where it throws. No mixing.

### Tests
- Test behavior via public interface, not impl. Survives refactor.
- Each test earns its weight: "what bug slips if this breaks?" Kill no-op smokes / broad snapshots.
- Aim confidence-per-minute, not coverage%. Pyramid ~70/20/10.
- Target unit tests at far-from-boundary high-bug code (parsers, edge-math, state-machines, retry/backoff).
- Characterization test before a refactor or deletion (lock baseline over fuzzed inputs). Delete internal scaffold tests once covered at the boundary.
- Contract test at external/provider boundary (catch format/api drift before bad data spreads).
- Cover edges (ZOMBIES: zero/one/many/boundary/interface/exception) + new trust-boundary crossings.
- No tautological/framework-semantics/passthrough test. Specific matchers > truthiness.
- Snapshots only for deterministic output (formatters/codegen); trap for UI.
- Regression test per bug fix. Mark known-bug as expected-fail + tracking note (e.g. `it.fails`/xfail), never silent skip.
- Mock only real boundaries (net/fs/db/time/rand), not internal collaborators.
- Fixture of a parsed/branded value = the parser on a literal (`schema.parse({...})`), never `as Brand`; a cast in a test hides the contract the type exists to prove.
- Tests deterministic + independent: no sleep, no wall-clock/network/shared mutable state across tests.

### Naming & hygiene
- Name intent not mechanics (`closeAccount` not `setStatusToClosed`). Avoid filler-only names (process/handle/do/run); fine as part of a specific name.
- Full words. Bool reads is/has/should/can, positive form.
- Explicit units (`delayMs`/`sizeKb`).
- Don't add a 2nd meaning for a verb already used here. No overloaded validate/build/resolve, no synonym aliases.
- Escape hatches honest: `dangerous_`/`unsafe_`/`experimental_`.
- Comments: tag-led (`why:` / `gotcha:` / `TODO(#n):`) or absent — rule, shape and examples in `coding-standards:style` § Comments.
- A comment failing the tag test is deleted, not rewritten; a doc comment is one line stating what the name doesn't.
- Exports/public API top, private helpers bottom (stepdown).

### Docs & method
- Verify third-party API from official docs, never assume from memory.
- Every factual claim you ship (version, "unused", "already fixed") is re-verified today against registry/code, with its scope: "orphan declaration in X; real usages in Y". "The schema allows it" ≠ "the code does it".
- Removing config/env/flag: the MR proves death (zero readers, file:line) and states the reintroduction plan. Removing a colleague's WIP/scaffold: say it in the MR and notify the author — "dead code" is not a reason for someone else's scaffold.
- Don't guess performance — measure before optimizing.
- Behavior change → update touched docs/comments/README/CLAUDE.md, same diff.
- Verify your change matches any stated domain model/invariants; surface contradictions.
- Read repo `CLAUDE.md`/`AGENTS.md` first, obey (commit format/layout/banned imports/naming).
- Don't mix broad cleanup with behavioral change in one commit. Commit only intended files; never revert/format a pre-existing dirty worktree.
- Each commit leaves repo buildable + reviewable; small enough to test/review/revert.
- Deliver full spec. No scope creep, nothing asked-for dropped.
