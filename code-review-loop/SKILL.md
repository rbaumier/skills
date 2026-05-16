---
name: code-review-loop
description: Use when the user wants a thorough, autonomous code review of the current branch. Also use when the user asks to stress-test code quality, run a deep review, or review before merge. Spawns specialized review agents in parallel, fixes all findings, and loops until every agent has zero feedback.
---

# Code Review Loop

Specialized review agents in parallel. Fix every finding. Loop until convergence. The user does not intervene between iterations.

## When not to use

The right standard is **shape, not size**. A 500-line mechanical rename is safer than a 3-line operator flip on a permissions check.

**Skip when the diff is genuinely trivial** (regardless of how many lines it touches):

- single-word doc typo, whitespace/format-only, or comment-only
- lockfile or generated-code regeneration
- mechanical rename whose only effect is import-path updates
- low-risk dependency patch bump
- docs-only changes (markdown, no runtime effect)
- inert config changes (linter/formatter rules, editor settings, build-tool flags with no runtime effect)
- the user wants a quick opinion, not an autonomous fix loop

Note: "config-only" is NOT a blanket skip. A diff that touches only config files but flips a feature-flag default, retry/timeout, auth callback URL, deployment target, or secrets wiring **is** runtime-affecting and falls under "looks trivial but isn't" below.

**Do NOT skip when the diff looks trivial but isn't** — small diff, big blast radius:

- any 1-line change to SQL, regex, auth, billing, permission, or signature-verification code
- flipping a feature-flag default, a config default, or a retry/timeout constant
- changing a money, tax, currency, or fee constant by any amount
- changing an HTTP method, redirect URL, response code, or status enum
- tightening or loosening a comparison operator (`<` ↔ `<=`, `==` ↔ `!=`)
- renaming a public API surface (the shape is trivial; the blast radius is not)
- adding a new direct dependency (supply-chain surface)
- a "typo fix" in user-facing copy that changes meaning ("approved" → "denied")
- mixed diffs where a semantic 1-liner is buried in whitespace/formatting changes

When unsure, run the loop. A spurious run costs a few minutes of agent time; a missed billing bug costs much more.

## Tier classification

Once you've decided the loop runs, classify the diff to pick the fan-out shape. This is the **mid-ground between "skip" and "full review"** — many real diffs (≤100 lines, no high-stakes path) don't justify burning twelve agents.

Compute the inputs once from the unified file-set (`main...HEAD` ∪ unstaged ∪ staged ∪ untracked):

- `total_lines` = sum of added + removed across non-noise files (after the diff filter — see Step 0.5)
- `file_count` = unique non-noise files
- `high_stakes` = ANY subsystem trigger fires (billing, auth, schema-migration, webhook, RBAC, multi-tenant, cron) OR security-sensitive paths (`**/auth/**`, `**/crypto/**`, `**/permissions/**`, `**/migrations/**`) OR signature-verification code

| Tier | Condition | Fan-out |
|---|---|---|
| **Lite** | `total_lines ≤ 100` AND `file_count ≤ 20` AND `high_stakes = false` | Funnel L1, Funnel L2, **one** Correctness agent, **one** language agent (dominant ext), simplify, coding-standards (umbrella only — skip the 4 sub-skills), Tests. No subsystem agents (high_stakes is false). No general Opus. ~7 agents. |
| **Full** | otherwise — incl. any high_stakes trigger, OR `file_count > 50`, OR `total_lines > 100` | Current behavior (everything in Step 0 below). ~12+ agents. |

**Override:** if the user explicitly asks for a deep review, force `Full` regardless of size. The tier is a default, not a ceiling.

The classification result feeds Step 0's agent selection. If `Lite`, Step 0's "Always spawn" list shrinks to the Lite column above, and the "Spawn by imports" / "Spawn by subsystem touched" tables don't apply (Lite tier ≡ no high-stakes path, by construction).

## The Funnel

Three levels, in order. Each gates the next.

**Level 1 — Question the need.** Does this code need to exist? Does the framework or a dependency already solve this? Start from the problem, not from the existing code. What's missing?

**Level 2 — Reduce scope.** Smallest perimeter that solves the validated need. Inline, merge, remove wrappers. Every abstraction justifies itself through concrete usage.

**Level 3 — Minimize code + review tests.** Shortest correct typed code. No duplicate data. Then: missing tests? Useless tests? Improvable tests?

**Discipline:** challenge your own proposal at each level until you can't remove anything.

## Workflow

### Step 0 — Detect agents and scope files

Run `git diff --name-only main...HEAD` to get all changed files. Determine which agents to spawn based on file extensions and imports.

**Apply the tier first.** Compute the tier from the "Tier classification" section above. If `Lite`, only spawn the agents listed in the Lite column — skip the "Spawn by imports", "Spawn by subsystem touched", "Spawn by interface touched", and "General Opus 4.7" rules below. Everything else in this Step 0 applies only to `Full`.

**Always spawn:** Funnel L1, Funnel L2, coding-standards (umbrella + 4 sub-skills), simplify, matt-improve-codebase-architecture, security-defensive, Tests, Correctness.

**Spawn by extension:** `.ts`/`.tsx` → language-typescript, `.rs` → language-rust, `.swift` → language-swift, `.vue` → vue.

**Spawn by imports** (one agent per detected skill):
`better-auth-best-practices`, `better-result-adopt`, `database`, `docker`, `drizzle-orm`, `frontend`, `i18n`, `kubernetes`, `react`, `react-native`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui`, `ui-animations`, `ui-ux`, `vue`, `web-performance`, `zod`

**Spawn by subsystem touched.** When the diff touches a high-stakes subsystem, spawn an extra **subsystem-framed agent** alongside the generic Correctness agent. The framing primes the agent for domain-specific failure modes a generic "correctness" lens misses (double-charges, refund races, signature replay, cross-tenant leaks).

**File-set for subsystem detection** matches the Dogfood rule: union `git diff --name-only main...HEAD` with `git diff --name-only` (unstaged), `git diff --name-only --staged` (staged), and `git ls-files --others --exclude-standard` (untracked). Otherwise uncommitted edits to auth/billing/schema files silently bypass the high-stakes lenses.

**Pass the unified file-set to the spawned agent**, not just the `main...HEAD` slice. When uncommitted files trigger the lens, the agent must see those files' contents. In the agent's prompt, instruct it to read the file directly (not via `git diff main...HEAD`), since the diff may not yet exist for unstaged/untracked work. Concretely: replace the standard `rtk proxy git diff main...HEAD -- {files}` line in the subsystem prompt with `read the current contents of {files} directly, and run \`git diff -- {files}\` to see the unstaged delta on top`.

Each trigger is specific enough to avoid firing on UI tokens, ARIA roles, job listings, or generic "workspace" UI. A row fires only when **at least one** of its concrete signals is present in the changed file set.

All path globs below are **recursive** — `**/billing/**` matches `apps/api/src/billing/prices.ts` as well as `billing/index.ts`. Modern monorepos rarely place subsystem code at the repo root.

| Trigger (recursive path globs, imports, or code patterns) | Subsystem agent | Failure modes it should hunt |
|---|---|---|
| files under `**/billing/**`, `**/payments/**`, `**/invoices/**`, `**/subscriptions/**`; OR imports of `stripe`, `@paddle/`, `@lemonsqueezy/`; OR code with `chargeAmount`, `refundAmount`, `idempotencyKey`, `invoice.*total` | **billing-subsystem** | double-charge, refund races, currency rounding, dispute flows, idempotency keys |
| files under `**/auth/**`, `**/session/**`; OR imports of `better-auth`, `next-auth`, `lucia`, `@clerk/`, `@auth/`; OR code with `signIn(`, `signUp(`, `getSession(`, `verifyJwt`, `bcrypt`, `argon2` | **auth-subsystem** | session fixation, token leak, replay, MFA bypass, account takeover |
| files under `**/migrations/**`, `**/drizzle/migrations/**`, `**/prisma/migrations/**`; OR `**/*.sql` schema files; OR Drizzle/Prisma `**/schema.ts` edits that alter columns | **schema-migration-subsystem** | forward + rollback safety, column-nullability flips, data loss, downtime |
| files with `webhook` anywhere in the path (`**/webhook*/**`, `**/*webhook*.ts`); OR code with `verifySignature`, `crypto.createHmac`, `crypto.timingSafeEqual` | **webhook-subsystem** | signature verification, replay protection, timing-attack-safe compare |
| files under `**/policies/**`, `**/permissions/**`, `**/rbac/**`; OR imports of `casl`, `@casl/`; OR code with `hasPermission(`, `canAccess(`, `authorize(`, `Policy.` | **rbac-subsystem** | privilege escalation, cross-role data leaks, policy drift |
| code that filters DB queries by `tenantId`, `organizationId`, or `workspaceId`; OR middleware that resolves a current tenant/org/workspace | **multi-tenant-subsystem** | cross-tenant leaks, missing tenant filters on shared tables |
| files under `**/cron/**`, `**/jobs/**`, `**/workers/**`; OR imports of `bullmq`, `bull`, `agenda`, `node-cron`, `@trigger.dev/`, `inngest`; OR code with `defineJob(`, `enqueue(`, `.cron(` | **cron-subsystem** | duplicate execution, missed runs, ordering, dead-letter handling |

The subsystem agent **adds to** (does not replace) the generic Correctness agent. Use the **Subsystem Agent** prompt template below — not the Skill Agent template, which would try to load a non-existent skill of that name.

**Spawn by interface touched.** If the diff changes a user-facing surface, also spawn a **Dogfood** agent. Detect broadly — *err on the side of triggering*. Categories and signals:

- **Web UI**: `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `*.html`, CSS / design-token files (`*.css`, `*.scss`, `tokens.*`, theme files), `app/**/page.*`, `pages/**`, `src/routes/**`, server actions, i18n copy files, public/static assets that change observable behaviour.
- **HTTP / API**: `app/**/route.*`, `middleware.*`, `server/api/**`, `api/**`, `routes/**`, tRPC routers, GraphQL resolvers/schema, WebSocket handlers, route definitions imported from `next`/`express`/`fastify`/`hono`/`koa`.
- **CLI**: `bin/**`, `cli/**`, `src/cli/**`, files importing `commander`, `yargs`, `oclif`, `clipanion`, `cac`, `meow`.
- **Native / desktop / mobile**: Electron/Tauri main or renderer entrypoints, React Native / Expo screens, native iOS/Android files.

If you are unsure, spawn Dogfood. A spurious dogfood run is cheap; a missed runtime bug is expensive. Dogfood runs **after Step 4 static convergence**, not in parallel with the static agents — it needs the code to actually work.

**Don't rely on `git diff main...HEAD` alone for the dogfood trigger.** That misses uncommitted work. When deciding to spawn Dogfood, also union in `git diff --name-only` (unstaged), `git diff --name-only --staged` (staged), and `git ls-files --others --exclude-standard` (untracked). Any of these touching a category above flags Dogfood.

**Codex:** only if the user explicitly requests it.

**General Opus 4.7:** always spawn. Same role as Codex (generalist reviewer, no skill loaded). Spawn via `general-purpose` subagent with `model: opus`.

**Spawn by materiality.** If the diff touches anything that should be reflected in `CLAUDE.md` / `AGENTS.md` but those files are unchanged, spawn the **claude-md-materiality** agent (model: `haiku`). High-materiality signals: package manager switch (`package.json` `packageManager` field, lockfile family change), test framework swap (new `vitest.config.*` / `jest.config.*` / removed equivalent), build tool change (`vite.config.*`, `tsconfig.json` paths/targets, bundler config), new top-level dir, new required env var (`.env.example` additions), CI/CD workflow change. The agent's only job is to flag the gap — not to write the missing doc.

### Step 0.2 — Write shared diff to disk

Write the full diff once to `/tmp/review-diff-{branch}.patch` using `rtk proxy git diff main...HEAD > /tmp/review-diff-{branch}.patch`. Pass this path to every agent in their prompt. Agents read the file instead of re-running git diff per-spawn.

**Why:** on large diffs (>500 lines) with 10+ agents, the per-agent `git diff` invocation duplicates the same bytes through every subagent's context window. Writing once, reading N times, saves token cost and avoids repeated subprocess overhead. The path replaces the `rtk proxy git diff main...HEAD -- {files}` line in each agent template — agents `grep` the patch file scoped to their files.

If the file-set for an agent includes untracked or unstaged files (subsystem agents triggered by uncommitted edits), the agent still reads those files directly per Step 0's rule — the patch file only covers the `main...HEAD` slice.

**Scope files per agent:**
- Language agents: only files matching the extension
- Framework/lib agents: only files that import the framework
- Tests agent: only test files + the source files they test
- All other agents: all changed files

### Step 0.5 — Pre-triage with a cheap model

Many diffs contain a long tail of routine files — config additions, pure renames, formatting, generated regeneration, simple field additions. Sending those to 10+ specialized agents wastes wall time and tokens. Filter them out with one cheap pass before the expensive fan-out.

Spawn ONE `general-purpose` subagent with `model: haiku` (fallback `sonnet` if Haiku is unavailable) using this prompt:

```
You classify file diffs in a merge request as NEEDS_REVIEW or APPROVED.

NEEDS_REVIEW: potential bugs, security issues, non-trivial logic, new API endpoints, error-handling changes, complex refactoring, schema/migration changes, auth changes, billing changes, signature-verification code, anything touching a high-stakes subsystem, **any added or changed field on a serialized type** (DTO, schema, API response, persisted struct — these need validation/test coverage), **any new defaulted value** (constants, config defaults, fallback values, enum defaults).

APPROVED: only the non-semantic tail — lockfile updates, generated-code regeneration, reordering of *named* import bindings (NOT side-effect imports like `import './polyfill'`, bare `import 'x'`, or any CSS/SCSS `@import` whose cascade is order-sensitive), whitespace/formatting-only changes, file renames whose only effect is updating import paths.

When in doubt → NEEDS_REVIEW. The downstream funnel and bloat-filter handle false positives; missed bugs are expensive. The triage's job is to skip lockfile churn and rename-only diffs, not to substitute its own judgement for the deep review on anything carrying semantics.

Diff to classify:
{full_diff}

Output a single JSON object, no markdown, no preamble:
{"verdicts": [{"file": "path/to/file.rs", "verdict": "NEEDS_REVIEW"}, ...]}
```

**Subtract APPROVED files from every agent's scoped file list before Step 1.** Exception: a file that matched any subsystem trigger (billing, auth, schema-migration, webhook, RBAC, multi-tenant, cron) or any Dogfood category in Step 0 stays in the review set regardless of the triage verdict. Cheap-model + high-stakes path = trust the path, not the model.

Triage is one shared round for the whole diff, not per agent. Run it once, apply the subtraction, then fan out. The point isn't to replace the funnel's "is this code necessary" question — only to stop paying for agents to look at lockfile churn and one-line rename diffs.

### Step 1 — Spawn all agents in a single message block

**Parallelism is the only reason this skill exists.** The default tool-call behavior is serial: emit one Task call, await the result, emit the next. That collapses your fan-out into `N × (think-time + agent-time)` of wall time and defeats the whole point. **Override the default.** Emit ALL Task tool_use blocks in the SAME assistant message, BEFORE reading ANY result from ANY of them.

- ✅ **Right pattern:** one assistant turn with N parallel Task blocks → wait → N results arrive together → aggregate.
- ❌ **Wrong pattern:** turn 1 = Task(L1) → turn 2 (after L1 result) = Task(L2) → turn 3 (after L2 result) = Task(L3). If you catch yourself doing this, stop and re-issue everything together.

You can also include your own `read` / `grep` / `webfetch` calls in the SAME turn as the parallel Task dispatches — concurrent context-pulling runs in parallel with the fan-out and costs zero extra wall time.

Use the prompt templates below. Pass each agent its scoped file list.

### Step 2 — Process findings, drop bloat, then fix

Read all reports. Process in funnel order:
1. L1 findings first. If L1 says "delete this module," discard findings about that module from other agents.
2. L2 findings next. If L2 says "merge these files," discard file-level findings on the originals.
3. All other findings. Contradictions: the simpler option wins.

**Filter bloat-shaped findings before doing anything else.** Review agents — including these — bias toward *recommending additions*. The bar for every kept finding is **sound + correct + elegant**. Two-out-of-three is a signal to look harder for a fix that gets all three, not to mechanically apply the proposed change.

For each finding, do a two-step triage:

1. **Is the underlying failure mode real?** Verify by reading the cited code — does the described scenario actually occur, or is it imagined? If the failure mode is imagined (e.g. a null guard on a type-guaranteed value), drop the finding entirely.

2. **If the failure mode is real but the proposed remedy is bloated**, keep the finding and rewrite the fix. A real race condition with a "just add a mutex everywhere" remedy is still a real race condition — look for a smaller fix (remove the shared state, narrow the lock, switch to an atomic primitive). Never drop a real defect just because its proposed fix is ugly.

Bloat-shaped remedies typically propose:

- defensive checks for cases that can't happen (e.g. null guards on values the type system already proves non-null)
- abstractions used only once
- comments restating obvious code
- tests asserting tautologies (language semantics, type guards, "it returns a string when given a string")
- "just-in-case" guards added without an identified failure mode

A change that nominally improves correctness by degrading elegance usually makes the codebase worse, not better. The smallest diff that fixes the real defect almost always wins.

For the findings that survive: fix every one, regardless of how many agents reported it. A single-agent finding is just as valid as one from seven agents; overlap is a signal of higher confidence, not of higher priority.

**Use the JSON envelope.** Line-anchored agents return `{findings: [{file, line, severity, title, analysis_chain, fix_prompt, ...}]}`. The `analysis_chain` is your auditable artifact: if a chain doesn't survive a re-read of the cited code, the finding is a hallucination — drop it without re-deriving from scratch.

**`fix_prompt` is the orchestrator's draft, not the reviewer's final word.** The bloat-filter applies to fix prompts too: if triage accepts a real finding but the reviewer's `fix_prompt` proposes a bloated remedy (mutex everywhere, defensive guard for an impossible case, one-shot abstraction), rewrite the `fix_prompt` before forwarding it. The verbatim contract is between **you (orchestrator) and the fix agent**, not between the reviewer and the fix agent — fix agents receive a `fix_prompt` you have accepted as-is or rewritten. Once forwarded, they apply it without re-interpretation.

**Parallelize fixes.** Group findings by file. Spawn one fix agent (model: `sonnet`) per file group, in parallel. Each fix agent receives the list of (post-triage) `fix_prompt` strings for its file, in order. Fix agents do not load skills, do not re-derive fixes from the original code, and do not use `isolation: "worktree"` — they work directly on the current working tree.

**Bugs get TDD treatment.** Write a non-regression test that fails first, then fix the code so the test passes.

**Re-read your own fixes.** After the fix agents return, re-read each changed file. If any fix you accepted now reads as bloat in context (a guard for an impossible case, a one-use abstraction, a tautological test), revert it. Catching bloat in your own diff is cheaper than catching it on the next review.

### Step 3 — Verify and commit

1. Run the test suite
2. Run the linter
3. Fix failures
4. Commit describing what was fixed and why

### Step 4 — Loop or stop

**Convergence is measured on findings that survived the Step 2 triage, not raw agent output.** An agent that returned only imagined-failure-mode findings — all of which were dropped at step 1 of the triage — counts as converged. Otherwise the same imagined findings would resurface on the next iteration and the loop would never terminate.

**Severity-based convergence.** Convergence is reached when every agent meets one of:
- (a) returned `No findings.`, OR
- (b) had all findings dropped at step 1 of the Step 2 triage, OR
- (c) all surviving findings are `severity: suggestion`.

Suggestions are **not auto-fixed in the loop** — they're collected and listed in Step 5 for the user to decide. Auto-fixing every suggestion is what gives review tools their reputation for noisy churn; the bias is explicitly toward stopping. Bugs / security / performance / error_handling findings still block convergence and must be fixed.

If converged: proceed to Step 4.5 (if Dogfood was flagged) or Step 5.

Otherwise, re-spawn only agents whose non-suggestion findings survived the Step 2 triage OR whose scoped files were touched by a fix.

**Incremental re-review: inject the previous iteration's findings.** When re-spawning an agent at iteration N>1, append a `<previous_findings>` block to its prompt containing every finding it emitted last iteration, with its disposition: `fixed` (commit touched the cited line), `dropped-by-triage` (orchestrator dropped — reason: imagined / bloat), or `unfixed` (still present, real, re-flag if still applicable). Agents must:
- not re-emit `dropped-by-triage` findings unless the cited code has materially changed since the last iteration (re-verify against the new diff before re-emitting),
- verify `fixed` findings are actually resolved by the new code (catch superficial fixes),
- continue to emit genuinely new findings introduced by the fix commit.

Without this, agents re-derive the same imagined failure modes every iteration and the loop only terminates because the orchestrator keeps re-dropping them — wasting one full round-trip per loop.

Continue fixing, committing, and re-launching until convergence.

### Step 4.5 — Runtime dogfood (only if flagged in Step 0)

Spawn the Dogfood agent once static review has converged. When it returns:

1. Process its findings the same way as static findings: spawn fix agents per file group. Dogfood emits a textual contract (one-line summary, repro steps, observed vs expected, `suspected files:`) — **not** the JSON `fix_prompt` envelope. Before fanning out, the orchestrator forges a `fix_prompt` for each bug from those fields (`In {suspected_file}, {one-line summary}. Reproduce by {steps}. Expected {expected}, observed {observed}. Fix the code path so the expected behavior holds.`) and groups by suspected file. The "verbatim contract is orchestrator → fix agent" rule from Step 2 applies — fix agents still receive a single uniform `fix_prompt` shape.
2. **Re-run the full Step 3 gate** (tests + linter, then commit) on the fixes.
3. **Re-run static review** on the touched files until it re-converges (Step 4's discipline applies — no shortcuts because "it's just a small fix").
4. Re-spawn Dogfood.

Loop until Dogfood's **first line** is exactly `No findings.` **AND** the final line starts with `cleanup-complete:`. A `cleanup-incomplete` line is itself a finding — re-run Dogfood (or have the user intervene) so the run leaves no orphan processes or test data behind. A working happy path is **not** sufficient — edge-case and runtime bugs count and block convergence the same way static findings do.

### Step 5 — Brief conversation summary

Print a short summary directly in the conversation. No file artifact.

Format:
- Tier: trivial / lite / full
- Iterations: N (converged on iteration K)
- Agents per iteration: N₁ → N₂ → … (e.g. 12 → 4 → 0)
- Findings fixed: total count, grouped by agent
- Non-regression tests added: one bullet per bug (description → test name)
- **Open suggestions (not auto-fixed):** one bullet per surviving `severity: suggestion`, with `file:line` and one-line rationale. Empty section if none. The user picks which to address.

Keep it under ~15 lines plus the suggestions list. The diff is the source of truth; the summary just locates it.

---

## Context verification protocol

Before any agent reports a finding it MUST run these five checks. Filtering imagined failure modes at the source is faster (fewer loop iterations) and cheaper (agents stop emitting findings that Step 2 will drop anyway).

Inject this block verbatim into every prompt that emits line-anchored findings (Correctness, Subsystem, Tests, Skill agents). Funnel L1/L2 don't need it — their findings are structural ("delete this module"), not failure-mode-anchored. Dogfood doesn't need it — its findings are empirical (the UI either broke or didn't), not inferred.

```
## Context verification — MANDATORY before reporting any finding

For every potential finding, answer these questions. If any answer kills the finding, drop it silently — do not emit it.

1. **Callers/callees**: is the missing validation/conversion/error-handling already done at the call site or in a visible wrapper? If yes, drop.
2. **Test context**: does the path contain a *segment* (between `/` separators) named exactly `tests`, `test`, `__tests__`, `spec`, `specs`, `fixtures`, `mocks`, OR does the filename match `*_test.*` / `*.test.*` / `*.spec.*` / `test_*.py` / `*_spec.rb`, OR is the code inside `#[cfg(test)]` / `describe(` / `test(` / `it(` / `def test_`? Substring matches don't count — `src/prospecting/`, `src/mockingbird/`, `src/special/` are production. If the strict criteria match, `.unwrap()` / `panic!` / missing validation / unsafe patterns are normal — drop unless it's a genuine logic bug.
3. **Intentional comments**: is there a `// SAFETY:`, `// intentionally`, `// fallback`, `# noqa`, or equivalent that *specifically* explains the failure mode you would flag? A generic "this is intentional" nearby is not enough — the comment must address the exact failure mode (a `// SAFETY:` justifying an unchecked-bounds index does NOT silence a race condition on the same line). If the comment matches the failure mode you'd flag, drop.
4. **Diff is the fix**: does the added code *resolve the same failure mode* you're about to flag, or does it improve a different aspect? Replacing `.unwrap()` with `?` resolves a panic-on-None failure; replacing `format!` with bind parameters resolves SQL injection but does NOT resolve a missing tenant filter on the same query. Drop only when the diff fixes the specific failure mode you would have flagged — partial improvements still leave their unaddressed failure modes flaggable.
5. **Type tracing**: for a claimed type mismatch (`f64` vs `i64`, `Option<T>` vs `T`, `&str` vs `String`), trace the value flow through the diff. If a conversion exists at any visible point on the path, the types are consistent — drop.
```

## Output format for line-anchored findings

Agents that anchor findings to `file:line` emit JSON. The structure carries an auditable reasoning chain and a fix prompt that the per-file fix agent consumes verbatim — no re-interpretation between finding and fix.

Funnel L1/L2 stay textual — their findings are structural, not file:line-anchored. Dogfood keeps its own contract (the `cleanup-complete` line is load-bearing for convergence).

If zero findings, respond exactly `No findings.` (textual, not JSON — preserves the convergence signal Step 4 reads).

Otherwise, respond with a single JSON object, no markdown, no preamble:

```json
{
  "findings": [
    {
      "file": "src/auth/session.rs",
      "line": 42,
      "end_line": 45,
      "severity": "bug",
      "title": "unwrap() on user-supplied header",
      "analysis_chain": [
        "Line 42 calls .unwrap() on req.headers.get(\"X-Token\")",
        "HeaderMap::get returns Option<&HeaderValue>",
        "Header is attacker-controlled — missing header panics the handler"
      ],
      "fix_prompt": "In src/auth/session.rs line 42, replace .unwrap() with .ok_or(AuthError::MissingToken)? to propagate instead of panic."
    }
  ]
}
```

**Why `analysis_chain`**: the chain is auditable. A finding whose chain doesn't survive a re-read of the cited code is a hallucination — Step 2 triage can drop it by reading the chain, without re-reading the diff. This complements the Context verification block: that one filters before emission; this one filters after.

**Why `fix_prompt`**: the per-file fix agents in Step 2 consume it verbatim. They no longer re-interpret the finding or re-derive the fix — they apply what's written.

Severity values: `bug` | `security` | `performance` | `error_handling` | `suggestion`. Suggestion-only findings should usually have been dropped at Context verification step 1 — emit them only when the pattern actively harms correctness or readability.

---

## Agent Prompt Templates

Every agent follows: role → context → task → constraints → output format.

**Line-anchored templates (Skill, Tests, Subsystem, Correctness) require the Context verification block AND the Output format block to be appended verbatim at the bottom before spawning.** Funnel L1/L2 and Dogfood are self-contained — do not append.

**Model assignment.** Spawn each agent with the model below — heavy reasoning gets `sonnet`, structural/textual lifts get `haiku`. The orchestrator (you) handles the coordinator role and stays on its session model.

| Agent | Model | Rationale |
|---|---|---|
| Pre-triage (Step 0.5) | `haiku` | classification only |
| Funnel L1, Funnel L2 | `haiku` | structural reasoning, short prompts |
| Correctness | `sonnet` | bug-hunting needs depth |
| Subsystem (billing, auth, schema-migration, webhook, RBAC, multi-tenant, cron) | `sonnet` | domain reasoning |
| Tests | `sonnet` | coverage gaps need code understanding |
| Skill Agent — heavy (security-defensive, language-rust, language-typescript, language-swift, react, react-native, database, drizzle-orm, frontend, web-performance, simplify, matt-improve-codebase-architecture) | `sonnet` | dense rules, code-level violations |
| Skill Agent — light (i18n, tailwind, ui, ui-animations, ui-ux, shadcn, vue, tanstack-query, tanstack-start-best-practices, better-auth-best-practices, better-result-adopt, docker, kubernetes, zod) | `haiku` | mostly style/usage rules, low ambiguity |
| coding-standards (umbrella + 4 sub-skills) | `sonnet` | judgement-heavy |
| claude-md-materiality | `haiku` | yes/no classification, no fix to derive |
| Dogfood | `sonnet` | needs to drive a real UI/CLI |
| General Opus 4.7 | `opus` | generalist, by design |
| Fix agents (Step 2) | `sonnet` | already specified |

**Shared diff file.** Step 0.2 wrote the full diff to `/tmp/review-diff-{branch}.patch`. Every template below uses `{diff_file}` to refer to it. Agents grep / filter the patch file rather than re-running `git diff`. When an agent's file-set includes uncommitted files (subsystem agents triggered by unstaged work), the agent additionally reads those files directly per the Step 0 rule.

**Previous findings injection (iteration N>1 only).** Step 4's incremental re-review requires building a `{previous_findings_block}` per agent before re-spawning. At iteration 1, this placeholder is replaced by the empty string — do not emit a header for an empty block. At iteration N>1, replace it with:

```
## Previous findings (iteration N-1)

You emitted these findings last iteration. Use them to avoid re-deriving the same conclusions.

- file:line — title — disposition: fixed | dropped-by-triage (reason) | unfixed
  ...

Rules for this iteration:
- For `fixed`: verify the new code actually resolves the failure mode. If the fix is superficial (comment added, code re-arranged but bug remains), re-emit.
- For `dropped-by-triage`: do not re-emit unless the cited code has materially changed since last iteration. If it has, re-verify against the new code before re-emitting.
- For `unfixed`: re-emit only if the failure mode still applies to the current code.
- Emit any genuinely new findings introduced by the fix commit as usual.
```

Funnel L1/L2 and Materiality agents accept the same block format — Dogfood does not (its findings are empirical, not inference-based, so each run starts fresh).

### Funnel L1

```
You review code for necessity and completeness.

Read the project's CLAUDE.md for conventions. Read CONTEXT.md for domain terms, roles, and invariants.

Read the diff from {diff_file}, filtered to {file_list}. For every role, type, or constant referenced in the diff, grep the codebase to verify it exists.

Your task: does each piece of code need to exist? Does the framework or a dependency already solve this? Is there a simpler approach? What's missing?

## What NOT to flag
- Style, naming, formatting — that's other agents' job
- Specific bug claims with line numbers — Correctness owns those
- Test coverage gaps — Tests owns those
- "Consider extracting X for reusability" without a concrete second caller in the diff

Stay within these files: {file_list}

{previous_findings_block}  ← only injected at iteration N>1; otherwise empty

Output: a flat list of findings. If zero findings, say exactly: "No findings."
```

### Funnel L2

```
You review code for scope reduction.

Read the project's CLAUDE.md for conventions.

Read the diff from {diff_file}, filtered to {file_list}. Read full files when context is needed.

Your task: find the smallest perimeter. Can files be inlined? Can queries be merged? Can wrapper types be removed? Every abstraction must justify itself through concrete usage.

## What NOT to flag
- Naming or style improvements — out of scope
- New abstractions that the diff doesn't already introduce — only flag existing abstractions that don't pay rent
- Anything requiring a file-level rewrite the user didn't ask for — propose a smaller perimeter, not a refactor of the whole module
- Defensive "factor this out in case we need it later" reasoning — concrete current usage only

Stay within these files: {file_list}

{previous_findings_block}  ← only injected at iteration N>1; otherwise empty

Output: a flat list of findings. If zero findings, say exactly: "No findings."
```

### Skill Agent (coding-standards, coding-standards:*, security-defensive, language-*, framework/lib, simplify, matt-improve-codebase-architecture)

```
You enforce a single skill's rules on changed code.

Read the project's CLAUDE.md for conventions. Then load the skill `{skill_name}` via the Skill tool.

Read the diff from {diff_file}, filtered to {file_list}. Read full files when context is needed.

Your task:
1. After loading the skill, list every rule and its review standard (the "flag when..." patterns)
2. Read the diff
3. Walk through each rule. For each rule, scan every changed line and check if it violates. When a rule has a review standard, apply it literally.
4. Report all violations found

## What NOT to flag
- Anything outside this skill's rules — other agents own their domains
- Patterns the skill doesn't explicitly prescribe — if you're inferring a rule from "best practices" rather than reading it in the skill, drop it
- Pre-existing patterns in unchanged code — only flag what the diff introduces or modifies
- Theoretical risks requiring unlikely preconditions when the primary defense in the diff is adequate

Stay within these files: {file_list}

{previous_findings_block}  ← only injected at iteration N>1; otherwise empty
```

### Tests Agent

```
You review test quality and coverage.

Read the project's CLAUDE.md for conventions. Load the skills `testing` and `matt-tdd` via the Skill tool.

Read the diff from {diff_file}, filtered to {file_list}. Read full files when context is needed.

Your task:
- Missing tests: what behavior is untested?
- Useless tests: trivial type guards, tests that verify language semantics, no real behavior tested
- Improvable tests: tests that test implementation instead of behavior, tests that would break on refactor

## What NOT to flag
- Missing tests for trivial accessors / passthrough wrappers / pure type re-exports
- "Add a test for X" without naming the specific behavior X — vague coverage asks are noise
- Missing 100% line coverage as a goal — coverage is a side effect of testing the right behaviors
- E2E tests when the change is pure logic — match test shape to the change
- Tests for code that's deleted in this diff

Stay within these files: {file_list}

{previous_findings_block}  ← only injected at iteration N>1; otherwise empty
```

### Subsystem Agent (billing-subsystem, auth-subsystem, schema-migration-subsystem, etc.)

```
You review changed code under a specific domain frame — NOT a skill. The frame primes you to remember domain-specific failure modes a generic correctness lens misses.

You are framed as the **{subsystem_name}** reviewer. The failure modes you should hunt: {failure_modes}.

Do NOT attempt to load a skill named "{subsystem_name}" — this is a framing label, not a registered skill. Read the project's CLAUDE.md for conventions.

Read the diff from {diff_file}, filtered to {file_list}. Read full files when context is needed. Grep the codebase for related call sites, schemas, and tests when a finding's correctness depends on them.

Your task: walk the diff and, for each listed failure mode, ask whether the change plausibly introduces or amplifies it. Report only concrete instances — never a generic "consider adding handling for X" without a specific line that exhibits the gap.

## What NOT to flag
- Generic correctness issues outside your failure-mode list — the Correctness agent owns those
- Style or naming concerns — out of scope
- "Defense in depth" suggestions when the primary defense in the diff is already adequate
- Theoretical attack chains requiring multiple unlikely preconditions to land
- Pre-existing failure modes in unchanged code — only what the diff introduces or amplifies counts

Stay within these files: {file_list}

{previous_findings_block}  ← only injected at iteration N>1; otherwise empty
```

### Correctness Agent

```
You hunt bugs.

Read the project's CLAUDE.md for conventions.

Read the diff from {diff_file}, filtered to {file_list}. Read full files when context is needed.

Your task: check the implementation against the apparent intent. Look for bugs, missing edge cases, race conditions, incomplete error handling, logic gaps. For every permission check, verify the role is correct for the operation.

## What NOT to flag
- Style, naming, formatting — other agents own those
- "Consider adding error handling" on code that already propagates errors (e.g. `?` in Rust, awaited Promises with downstream `.catch` or top-level rejection)
- Defensive null checks on values the type system already proves non-null
- Edge cases requiring conditions that the calling contract already prevents (read the call sites before flagging)
- Theoretical race conditions without a concrete two-thread interleaving demonstrating the bug

Stay within these files: {file_list}

{previous_findings_block}  ← only injected at iteration N>1; otherwise empty
```

### Materiality Agent (claude-md-materiality)

```
You check whether the project's AI instructions are stale relative to the diff.

Read `CLAUDE.md` and `AGENTS.md` at the repo root if they exist. Read the diff from {diff_file}.

Your task: answer ONE question — does this diff make any line in CLAUDE.md/AGENTS.md misleading or incomplete? Examples of high-materiality changes that warrant an update:
- Package manager change (npm → pnpm, lockfile family swap)
- Test framework change (added vitest.config, removed jest.config, etc.)
- Build tool change (new vite/webpack/rollup config, tsconfig target shift, bundler swap)
- New top-level directory (apps/, packages/, services/)
- New required env var (additions in .env.example)
- CI/CD workflow change (.github/workflows/*, .gitlab-ci.yml)
- Major dependency upgrade that changes API surface (e.g. React 18 → 19, Next 14 → 15)

Low materiality (do NOT flag): bug fixes, feature additions using existing patterns, CSS-only changes, dep patch bumps, internal refactors.

## What NOT to flag
- Generic "consider updating docs" — only concrete claims that became false
- Missing CLAUDE.md when none exists — only flag staleness, not absence (unless the diff is itself a new project scaffold)
- Wording improvements to CLAUDE.md — your job is staleness detection, not editing

Stay within these files: {file_list} plus CLAUDE.md / AGENTS.md.

Output: if CLAUDE.md/AGENTS.md is unchanged but the diff is high-materiality, one finding per stale claim, each with: which file, which line/section, what the diff makes false, and a one-sentence proposed correction. If zero findings, say exactly: "No findings."
```

### Dogfood Agent (runtime, post-static-convergence)

```
You exercise a user-facing surface to find runtime bugs that static review can't catch.

Load the `dogfood` skill via the Skill tool. Read the project's CLAUDE.md for run instructions, dev credentials, and conventions.

The changed surface(s) to exercise: {file_list}

Your task — in this exact order:

1. **Verify you are NOT in production.** Before doing anything, confirm the environment: read `.env`/`.env.local`, check the database connection string, look for `NODE_ENV`/`APP_ENV`. If the active database, API host, or any service URL looks like a real production system, **abort immediately** and report it as a finding ("refused to run: target appears to be production"). Never mutate data on a non-dev environment.

2. **Start the dev server / CLI with PID capture.** Find the command in package.json scripts, Makefile, justfile, or CLAUDE.md. Start it as a tracked background process so we can stop *every* child it spawns:

   ```bash
   # setsid puts the server in its own process group whose leader's PID we can capture.
   setsid <run-command> &
   SERVER_PID=$!
   # The PGID equals the leader's PID for a setsid leader, but read it explicitly to be safe.
   SERVER_PGID=$(ps -o pgid= "$SERVER_PID" 2>/dev/null | tr -d ' ')
   ```

   **If `setsid` is not available** (some shells/platforms): the fallback `<run-command> &` puts the child in the SAME process group as the agent shell. Negative-PGID kill in that case would terminate the agent itself. Therefore, **without `setsid`, never `kill -TERM -"$SERVER_PGID"`** — set `SERVER_PGID=""`, kill `SERVER_PID` directly with `kill -TERM "$SERVER_PID"` followed by `kill -KILL "$SERVER_PID"`, and rely on the port/pgrep checks in cleanup to catch escaped watchers and children. Note this limitation in the output's "How I authenticated" section.

   Register a cleanup trap **before** running the test interactions:
   ```bash
   cleanup() {
     # Prefer process-group kill (covers children/watchers/queue workers). Falls back to PID-only
     # if SERVER_PGID is empty (e.g., setsid unavailable) — never negative-PGID kill on the parent group.
     if [ -n "$SERVER_PGID" ]; then
       kill -TERM -"$SERVER_PGID" 2>/dev/null
       sleep 1
       kill -KILL -"$SERVER_PGID" 2>/dev/null
     elif [ -n "$SERVER_PID" ]; then
       kill -TERM "$SERVER_PID" 2>/dev/null
       sleep 1
       kill -KILL "$SERVER_PID" 2>/dev/null
     fi
     # Verify nothing is still listening on the project's ports.
     # Portable: pipe lsof output to a while-read loop (avoids `xargs -r`, which is GNU-only).
     for port in <project-ports>; do
       lsof -ti :"$port" 2>/dev/null | while IFS= read -r pid; do
         [ -n "$pid" ] && kill -KILL "$pid" 2>/dev/null
       done
     done
   }
   trap cleanup EXIT INT TERM
   ```

   Wait for readiness (poll the port, watch for the "ready" line, etc.).

3. **Authenticate if needed.** Check CLAUDE.md for test credentials first. If absent, in this order:
   - run a seed script if one exists,
   - drive the signup flow yourself,
   - request a magic-link / dev-only auth bypass,
   - direct DB insert as a last resort, against the **confirmed-dev** database only.

   **Use a unique identifier you can clean up later** — e.g., `email = afk-dogfood-<YYYYMMDD-HHMMSS>-<rand>@example.invalid`. Record exactly what you created in a list (`/tmp/dogfood-created.txt`): the table(s), the row ids, and the unique identifier. The next run reads this list; you must too.

4. **Exercise the changed surface.** Drive the new code path end-to-end via the actual interface (browser for UI, terminal invocation for CLI, HTTP for API). Hit the happy path, then push it: empty inputs, oversized inputs, malformed inputs, rapid clicks, race conditions, refresh mid-flow, browser back, permission boundaries.

5. **Capture evidence.** For every bug: a one-line summary, the steps to reproduce, the observed vs expected behaviour, and any console / network / server-log artifact you saw.

6. **Cleanup is mandatory.** Even on bugs, even on errors, even on your own crash — the trap from step 2 fires and stops the server's process group. Then:
   - Delete every row listed in `/tmp/dogfood-created.txt`. Report exact counts (`deleted: 3 users, 7 sessions`).
   - Verify ports are free: `lsof -i :<port>` returns nothing.
   - Verify no orphan processes: `pgrep -f <server-command>` returns nothing.
   - If anything you created cannot be cleanly deleted, list it in the output under "cleanup-incomplete" — do **not** hide it.

Output (the **first line** is the convergence signal — keep header lines after it):
- If zero bugs: line 1 is exactly `No findings.`
- Otherwise: line 1 is a one-line count (e.g. `3 findings.`), then a flat list of bugs. Every bug entry MUST include a `suspected files:` field listing the paths/components most likely owning the defect — Step 4.5 groups fix agents by file, so this attribution is required, not optional.
- A short "How I authenticated" note so the next run can reuse it.
- A final line: `cleanup-complete: server stopped (PID/PGID killed and verified), N rows deleted` OR `cleanup-incomplete: <what's left>`.
```
