---
name: coding-standards:quality-bar-review
description: Use whenever reviewing code, a diff, a PR, or staged changes in any language — always apply when assessing a code change. The synthesized one-page review checklist mirroring coding-standards:quality-bar (author side): flags scope, simplicity, module boundaries, types, error handling, tests, naming — plus the correctness, completeness, and security passes review adds. Invoke as /coding-standards:quality-bar-review.
---

# Quality bar — review checklist

What to flag in a diff. Mirror of `coding-standards:quality-bar` (author side):
each item is the review-side catch for a bar the author should have cleared.
**SUBORDINATE to the repo**: a flag that conflicts with the repo's
`CLAUDE.md`/`AGENTS.md` or established patterns → defer to the repo. Prefer few
high-conviction findings over many nits; don't flag pre-existing debt unless the
diff materially worsens it; skip machine-enforced style. `⟦repo⟧` = only if the repo uses it.

### Scope & necessity
- Flag anything built beyond what the task needs — speculative feature/param/export/"flexibility".
- Flag reinvented framework/lib/stdlib; pattern kept by inertia.
- Flag abstraction with 0–1 real callers (wrapper/option = dead weight) → inline.
- Flag DRY-ing before the 3rd occurrence (premature; 2 = coincidence).
- Flag novel dep/pattern added over a boring/proven one without justification.
- Flag near-duplicate helper that belongs in an existing module.
- Flag orphans the diff creates (unused import/param/helper). Don't flag pre-existing dead code unless the diff worsens it.

### Simplicity & structure
- Flag complexity rearranged where it could be deleted.
- Flag ten scattered 5-line helpers where one linear fn reads better.
- Flag shallow module (interface ≈ implementation); pass-through wrapper; deletion-test failure (delete it, complexity vanishes not scatters); hard decision exposed as a config knob instead of absorbed.
- Flag internals leaked to callers just for testability.
- Flag single-call-site fn not inlined (unless step-down / own tests / repo expects unit).
- Flag single-use var that only renames the op (generic name, one adjacent use) → inline; not one that names intent or tames nesting.
- Flag an inline that changes behavior — capture-before-mutation, double/lost eval of a side-effecting call, short-circuit/`await` order, lost TS narrowing — these stay even if single-use.
- Flag inherent complexity (DI/routing/parsing) smeared instead of concentrated in a named module.
- Flag business logic duplicated across entry points (http/cli/job/webhook) instead of one operation.
- Flag independent async work serialized where it could run concurrently.
- Flag >~3 indent levels / missing guard clauses; input mutation where new data should be returned.
- Flag clever code: nested ternaries, implicit coercion, multi-op one-liners.
- Flag global/singleton/magic-registry state not traceable from a single root.
- Flag ad-hoc conditional bolted onto an unrelated flow → own path/helper/typed dispatch.
- Flag feature logic in a shared/general path; policy hardcoded into mechanism.
- Flag a file pushed past repo norm (~500 LOC / 1k) without strong reason → decompose.

### Module boundaries & vertical slices
- Flag organize-by-role split (`services/`/`repositories/`/`handlers/`) where a vertical slice reads better.
- Flag public surface wider than necessary (Hyrum's Law) — should default private.
- Flag vendor/third-party type in a signature; dep not wrapped at the boundary.
- Flag module with no nameable absorbed assumption (just a folder).
- Flag domain logic in `shared/`; helper extracted by anticipation, not real reuse.
- Flag cross-domain reach into internals/DB tables instead of public API; N imports where a domain event fits.
- Flag a port/seam with a single real adapter (hypothetical seam — test fake counts as the 2nd).
- Flag library options left implicit (timeout/creds/redirect) — default-drift risk.
- Flag internals moved without a compat facade where external consumers exist.

### Types & data-model
- Flag a representable-but-illegal state — name the union/brand/parser that removes it.
- Flag status strings / parallel booleans instead of one discriminated union; missing exhaustiveness guard.
- Flag untrusted input consumed without parsing to a typed domain object at the boundary; re-validation in loops.
- Flag handler with no input/output schema; Input not separated from Output (server-set fields accepted).
- Flag silent fallback masking invalid input (`?? 0`, `|| ''`).
- Flag escape-hatch type erasing the contract (`any`/`unknown`/untyped cast) with no nearby runtime check.
- Flag return type heavier than needed (ladder `void` < `bool` < `T` < `Option<T>` < `Result<T,E>`).
- Flag 4+ positional args / 2+ same-type adjacent (swap risk) → options object.
- Flag behavior-branching bool/enum param → split into named fns.
- Flag the same 3+ fields traveling together → value object.

### Error handling
- Flag error missing any of: what op, why, remediation, blast radius; cause dropped on wrap.
- Flag assert re-checking already-parsed boundary data; positive-only invariant (no negative-space check).
- Flag bare throw/`any` at a lib/api boundary instead of a declared error type.
- Flag an error the caller can't prevent, or one patched after the fact where redefining the contract would design it out of existence.
- Flag unbounded loop/queue/retry/buffer (no ceiling); I/O with no timeout; env/config not validated at boot.
- Flag acquired resource (file/conn/lock/listener/subscription) not released on every path incl. error.
- Flag swallowed error (catch that neither handles nor propagates).
- Flag multi-step mutation with no atomicity/rollback (half-applied state on failure).
- Flag secret/token/PII in logs, error messages, test fixtures, or commits.
- Flag the process killed from a work unit (`process.exit` outside boot).
- Flag auth/crypto/PII check skipped inside the trust zone.
- Flag stack trace / raw provider payload leaked in a boundary-crossing error.
- Flag user-facing message that blames the user/third-party, leaks jargon, or omits what's NOT affected.
- Flag mixed error idioms (Result + exceptions) against the repo's idiom.

### Tests
- Flag untested behavior, prioritizing crossed trust boundaries over pure logic.
- Flag tests asserting implementation not behavior (break on refactor).
- Flag tautological/framework-semantics/passthrough tests; truthiness over specific matchers.
- Flag missing edge coverage (ZOMBIES: zero/one/many/boundary/interface/exception).
- Flag missing characterization test before a refactor/deletion; missing contract test at a provider boundary.
- Flag mocks of internal collaborators (mock only real boundaries: net/fs/db/time/rand).
- Flag bug fix with no regression test; known-bug silently skipped instead of expected-fail + issue.
- Flag flaky test: sleep/wall-clock/network/random or shared mutable state across tests (order-dependent).
- Flag snapshot on non-deterministic output / broad UI snapshot.

### Naming & hygiene
- Flag name describing mechanics not intent (`setStatusToClosed`); filler-only name (process/handle/do/run).
- Flag abbreviations / negative-form booleans (should read is/has/should/can, positive); missing units (`delayMs`/`sizeKb`).
- Flag a verb given a 2nd meaning; overloaded validate/build/resolve; synonym aliases.
- Flag dishonest escape hatch (no `dangerous_`/`unsafe_`/`experimental_` prefix).
- Flag comment paraphrasing the next line instead of why/consequence; TODO with no action/issue link.
- Flag same rationale across 2+ comments (per codebase, not per file) → keep one, point to it.
- Flag unreferenced export / unused import / unreachable branch / commented-out code → remove.

### Docs & method
- Flag third-party API used from memory instead of verified against official docs.
- Flag perf claim/optimization with no measurement.
- Flag behavior change leaving touched docs/comments/README/CLAUDE.md stale. Materiality: don't flag on internal refactors, dep bumps, CSS-only.
- Flag a change contradicting a stated domain model/invariant.
- Flag a violation of the repo's `CLAUDE.md`/`AGENTS.md` (commit format/layout/banned imports/naming) — outranks this list.
- Flag broad cleanup mixed with behavioral change in one commit; unintended files committed.

### Detection-only — what review adds (can't shift-left)
These have no author-side mirror: you can't pre-empt finding a bug you didn't write.
- **Correctness**: bugs, missed edges, races (with a concrete interleaving), logic gaps, off-by-one; permission/role correct for the operation. Don't flag null checks on type-proven non-null, or edges the calling contract already prevents — read the call sites first.
- **Completeness**: what's MISSING vs the intent — an unhandled case, an absent error path, a symmetric counterpart (`encode` without `decode`, `create` without `delete`).
- **Security taint-trace**: untrusted input → dangerous sink (injection/XSS/SSRF/path-traversal/deserialization); authorization on every state-changing op; IDOR (ownership enforced in the query, not just the UI).
