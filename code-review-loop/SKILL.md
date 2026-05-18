---
name: code-review-loop
description: Use when the user wants a thorough, autonomous code review of the current branch. Also use when the user asks to stress-test code quality, run a deep review, or review before merge. Spawns specialized review agents in parallel, fixes all findings, and loops until every agent has zero feedback.
---

# Code Review Loop

Specialized review agents in parallel. Fix every finding. Loop until convergence. The user does not intervene between iterations.

## When not to use

The right standard is **shape, not size** — a 500-line mechanical rename is safer than a 3-line operator flip on a permissions check.

**Skip when the diff is genuinely trivial**: single-word doc typos, whitespace/comment-only, lockfile or generated-code regeneration, mechanical renames whose only effect is import-path updates, low-risk dependency patch bumps, docs-only changes, inert config changes (linter/formatter rules with no runtime effect), or when the user wants a quick opinion not an autonomous fix loop.

**Do NOT skip when the diff looks trivial but isn't** — small diff, big blast radius. Examples: any 1-line change to SQL/regex/auth/billing/permission/signature-verification code; flipping a feature-flag default, retry/timeout, or auth callback URL; changing a money/tax/currency/fee constant; changing an HTTP method, redirect URL, or status enum; tightening or loosening a comparison operator (`<` ↔ `<=`, `==` ↔ `!=`); renaming a public API surface; adding a new direct dependency (supply-chain surface); user-facing copy that changes meaning ("approved" → "denied"); mixed diffs where a semantic 1-liner is buried in whitespace.

"Config-only" is not a blanket skip — if the config flips a feature-flag default, retry/timeout, auth callback URL, or secrets wiring, it's runtime-affecting and falls under the second list.

When unsure, run the loop. A spurious run costs a few minutes of agent time; a missed billing bug costs much more.

## Tier classification

Once you've decided the loop runs, classify the diff to pick the fan-out shape. This is the **mid-ground between "skip" and "full review"** — many real diffs (≤100 lines, no high-stakes path) don't justify burning twelve agents.

Compute the inputs once from the unified file-set (`"$DEFAULT_BRANCH"...HEAD` ∪ unstaged ∪ staged ∪ untracked):

- `total_lines` = sum of added + removed across non-noise files (after the diff filter — see Step 0.5)
- `file_count` = unique non-noise files
- `high_stakes` = ANY subsystem trigger fires (billing, auth, schema-migration, webhook, RBAC, multi-tenant, cron) OR security-sensitive paths (`**/auth/**`, `**/crypto/**`, `**/permissions/**`, `**/migrations/**`) OR signature-verification code

| Tier | Condition | Fan-out |
|---|---|---|
| **Lite** | `total_lines ≤ 50` AND `file_count ≤ 5` AND `high_stakes = false` | Funnel L1, Funnel L2, Occam Razor, **one** Correctness agent, **one** language agent (dominant ext), simplify, coding-standards (umbrella only — skip the 4 sub-skills), Tests. No subsystem agents (high_stakes is false). No general Opus. ~8 agents. |
| **Full** | otherwise — incl. any high_stakes trigger, OR `file_count > 5`, OR `total_lines > 50` | Current behavior (everything in Step 0 below). ~12+ agents. |

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

Every `git diff` below uses `"$DEFAULT_BRANCH"...HEAD`, never a hardcoded `main`. If the caller (e.g. the `afk` skill) hasn't already exported `DEFAULT_BRANCH`, detect it now using the same fallback chain:

```bash
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(glab repo view --output json 2>/dev/null | jq -r '.default_branch // empty')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(git for-each-ref --format='%(refname:short)' refs/heads/main refs/heads/master refs/heads/develop 2>/dev/null | head -1)
  test -n "$DEFAULT_BRANCH" || { echo "ERREUR : default branch introuvable. code-review-loop ne démarre pas." >&2; exit 1; }
fi
git fetch origin "$DEFAULT_BRANCH"
```

The `fetch` keeps the local tracking ref current against concurrent pushes; recipes below reference `"$DEFAULT_BRANCH"` for readability.

Run `git diff --name-only "$DEFAULT_BRANCH"...HEAD` to get all changed files. Determine which agents to spawn based on file extensions and imports.

**Apply the tier first.** Compute the tier from the "Tier classification" section above. If `Lite`, only spawn the agents listed in the Lite column — skip the "Spawn by imports", "Spawn by subsystem touched", "Spawn by interface touched", and "General Opus 4.7" rules below. Everything else in this Step 0 applies only to `Full`.

**Always spawn:** Funnel L1, Funnel L2, Occam Razor, coding-standards (umbrella + 4 sub-skills), simplify, matt-improve-codebase-architecture, security-defensive, Tests, Correctness.

**Why Occam Razor sits alongside the funnel.** L1 asks "does this code need to exist" and L2 asks "what's the smallest perimeter" — both prose, both evaluated face-value against the abstraction's surface. Neither walks the call graph. In practice L1 will validate a wrapper that *looks* justifiable when read in isolation, even when grep would reveal one caller (or zero). Occam Razor is the mechanical check: for every exported symbol the diff introduces or modifies, enumerate call sites and prove the shape pays rent. Past misses this would have caught: a function with 0 callers, a wrapper with 1 caller, defaults reconstructed from values the caller already had.

**Spawn when `CLAUDE.md` exists at repo root or any monorepo workspace root:** **claude-md-compliance** agent. Reads the file(s), extracts the rules, walks the diff to flag any rule violation the diff introduces. Distinct from `claude-md-materiality` (which flags staleness of the doc) — compliance flags the *code* breaking the doc's rules. Required because most repos document conventions there that no language/framework skill checks for (commit-message rules, project-specific naming, "we use X not Y"). If multiple `CLAUDE.md` exist, one agent handles all of them.

**Spawn by extension:** `.ts`/`.tsx` → language-typescript, `.rs` → language-rust, `.swift` → language-swift, `.vue` → vue.

**Spawn by imports** (one agent per detected skill):
`better-auth-best-practices`, `better-result-adopt`, `database`, `docker`, `drizzle-orm`, `frontend`, `i18n`, `kubernetes`, `react`, `react-native`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui`, `ui-animations`, `ui-ux`, `vue`, `web-performance`, `zod`

**Spawn by subsystem touched.** When the diff touches a high-stakes subsystem, spawn an extra **subsystem-framed agent** alongside the generic Correctness agent. The framing primes the agent for domain-specific failure modes a generic "correctness" lens misses (double-charges, refund races, signature replay, cross-tenant leaks).

**File-set for subsystem detection** matches the Dogfood rule: union `git diff --name-only "$DEFAULT_BRANCH"...HEAD` with `git diff --name-only` (unstaged), `git diff --name-only --staged` (staged), and `git ls-files --others --exclude-standard` (untracked). Otherwise uncommitted edits to auth/billing/schema files silently bypass the high-stakes lenses.

**Pass the unified file-set to the spawned agent**, not just the `"$DEFAULT_BRANCH"...HEAD` slice. When uncommitted files trigger the lens, the agent must see those files' contents. In the agent's prompt, instruct it to read the file directly (not via `git diff "$DEFAULT_BRANCH"...HEAD`), since the diff may not yet exist for unstaged/untracked work. Concretely: replace the standard `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD -- {files}` line in the subsystem prompt with `read the current contents of {files} directly, and run \`git diff -- {files}\` to see the unstaged delta on top`.

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

**Compute active trust boundaries.** Even when the diff doesn't fire a full subsystem agent, the same triggers identify which boundaries the diff crosses. Compute the union — zero or more of `user-input | network | filesystem | secrets | process-exec | database | auth | permissions | concurrency | external-api | serialization` — and pass it as `{trust_boundaries}` into every line-anchored template (Correctness, Tests, Skill, Subsystem). When no boundary is crossed, pass `none`. **Computation runs for both Lite and Full tiers** — Lite diffs that touch `network` / `serialization` / `external-api` get the same lens (those boundaries don't gate high_stakes, so they survive Lite filtering).

| Boundary | Signals (path globs / imports / code patterns) | Failure modes (used by line-anchored agents when boundary is in `{trust_boundaries}`) |
|---|---|---|
| `user-input` | HTTP handlers, form parsers, CLI argv, request-body deserialization, `req.body`/`req.query`/`params` | injection (SQL/command/template), unsanitized rendering, missing length/shape validation |
| `network` | `fetch(`, `http.get(`, `axios`, `got`, `undici`, `reqwest`, raw sockets | unbounded retries, missing timeouts, leaked credentials in URLs/headers, silent failure on non-2xx |
| `filesystem` | `fs.readFile`/`writeFile`, `std::fs`, `path.join` from user input, archive extraction | path traversal, symlink races, missing `O_NOFOLLOW`, unbounded reads |
| `secrets` | `.env*`, env reads of `*_KEY`/`*_SECRET`/`*_TOKEN`, JWT secret loading, KMS/Vault | secret printed to logs/errors, secret committed to fixtures, secret in URL query string |
| `process-exec` | `child_process.exec`/`spawn`, `std::process::Command`, shell-string concatenation | shell-string concatenation, missing arg array, unescaped user input as command parts |
| `database` | ORM imports (drizzle, prisma, typeorm, sqlx, sea-orm), `db.query`/`pool.execute`, SQL templates | missing tenant/owner filter, raw SQL with interpolation, N+1, missing transaction on multi-step writes |
| `auth` | session lookup, `getSession(`, JWT verification, `bcrypt`/`argon2`, OAuth callback handlers | session fixation, missing rotation, JWT verification skipped or with wrong key, replay |
| `permissions` | role checks, RBAC predicates, `can(`/`authorize(`, policy lookups | check-then-use TOCTOU, wrong role for the operation, missing check on shared resource |
| `concurrency` | `Promise.all` with side effects, mutexes, atomics, worker threads, channels, `tokio::spawn` | unsynchronized shared state, dropped futures, non-atomic compound ops, deadlock potential |
| `external-api` | third-party SDK imports (Stripe, Twilio, S3 client, OpenAI, etc.) | missing rate-limit handling, retry-without-idempotency-key, sensitive payload not redacted |
| `serialization` | `JSON.parse` of untrusted input, `serde` derives, protobuf encode/decode, `pickle.loads`, YAML loaders | trusting parsed shape without validation, prototype pollution, deserialization of untrusted blobs |

The "Failure modes" column is the **single source of truth** for what line-anchored agents prioritize when a boundary is active. Templates reference this table rather than duplicating the list — saves bytes per spawn over a multi-iteration loop.

**Spawn by interface touched.** If the diff changes a user-facing surface, also spawn a **Dogfood** agent. Detect broadly — *err on the side of triggering*. Categories and signals:

- **Web UI**: `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `*.html`, CSS / design-token files (`*.css`, `*.scss`, `tokens.*`, theme files), `app/**/page.*`, `pages/**`, `src/routes/**`, server actions, i18n copy files, public/static assets that change observable behaviour.
- **HTTP / API**: `app/**/route.*`, `middleware.*`, `server/api/**`, `api/**`, `routes/**`, tRPC routers, GraphQL resolvers/schema, WebSocket handlers, route definitions imported from `next`/`express`/`fastify`/`hono`/`koa`.
- **CLI**: `bin/**`, `cli/**`, `src/cli/**`, files importing `commander`, `yargs`, `oclif`, `clipanion`, `cac`, `meow`.
- **Native / desktop / mobile**: Electron/Tauri main or renderer entrypoints, React Native / Expo screens, native iOS/Android files.

If you are unsure, spawn Dogfood. A spurious dogfood run is cheap; a missed runtime bug is expensive. Dogfood runs **after Step 4 static convergence**, not in parallel with the static agents — it needs the code to actually work.

**Don't rely on `git diff "$DEFAULT_BRANCH"...HEAD` alone for the dogfood trigger.** That misses uncommitted work. When deciding to spawn Dogfood, also union in `git diff --name-only` (unstaged), `git diff --name-only --staged` (staged), and `git ls-files --others --exclude-standard` (untracked). Any of these touching a category above flags Dogfood.

**Codex:** only if the user explicitly requests it.

**General Opus 4.7:** always spawn. Same role as Codex (generalist reviewer, no skill loaded). Spawn via `general-purpose` subagent with `model: opus`.

**Spawn by materiality.** If the diff touches anything that should be reflected in `CLAUDE.md` / `AGENTS.md` but those files are unchanged, spawn the **claude-md-materiality** agent (model: `haiku`). High-materiality signals — kept deliberately tight to avoid firing on routine config tweaks:

- package manager switch (`package.json` `packageManager` field changed, OR lockfile family added/removed: `pnpm-lock.yaml` ↔ `package-lock.json` ↔ `yarn.lock` ↔ `bun.lock`)
- test framework swap (a `vitest.config.*` / `jest.config.*` / `playwright.config.*` file added or removed — not edited)
- build tool added or removed (new `vite.config.*` / `webpack.config.*` / `rollup.config.*` / `next.config.*` file, OR an existing one deleted)
- `tsconfig.json` change to `module`, `moduleResolution`, or addition of a *new top-level alias prefix* in `paths` (NOT path tweaks, NOT `target`/`lib`/`strict` flag toggles)
- new top-level dir (root of repo or root of a monorepo workspace)
- new required env var (additions in `.env.example` — not removals, not renames)
- CI/CD workflow file added or removed (NOT edited — workflow tweaks rarely invalidate docs)

The agent's only job is to flag the gap — not to write the missing doc. Skip materiality entirely under the `Lite` tier (cost is low but consistency matters — Lite ≡ no structural change).

### Step 0.2 — Write shared diff to disk

Write the full diff once to `/tmp/review-diff-{branch}.patch` using `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD > /tmp/review-diff-{branch}.patch`. Pass this path to every agent in their prompt. Agents read the file instead of re-running git diff per-spawn.

**Why:** on large diffs (>500 lines) with 10+ agents, the per-agent `git diff` invocation duplicates the same bytes through every subagent's context window. Writing once, reading N times, saves token cost and avoids repeated subprocess overhead. The path replaces the `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD -- {files}` line in each agent template — agents `grep` the patch file scoped to their files.

If the file-set for an agent includes untracked or unstaged files (subsystem agents triggered by uncommitted edits), the agent still reads those files directly per Step 0's rule — the patch file only covers the `"$DEFAULT_BRANCH"...HEAD` slice.

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

**Dedupe by signature before triaging.** Each line-anchored finding carries a `signature: <file>:<line>:<failure-mode-slug>`. When the same defect is flagged by N agents (Correctness + a subsystem agent + a language agent all spotting the same `unwrap()` on user input), they emit equivalent signatures. Use the tolerant matcher defined in the JSON envelope spec — same file, line within ±3, same slug OR title-token Jaccard ≥ 0.6 — to group:

- Keep the emission with the highest `confidence`. Tiebreak: the one whose `fix_prompt` is most specific (cites a concrete line and a concrete replacement, not a paraphrase).
- Annotate the kept finding with `reported_by: [agent_name, ...]` (orchestrator-added — agents do not emit this field). Three independent agents converging on the same signature is a strong triage signal.
- Discard the duplicates entirely. They've voted; their fix_prompts are redundant and risk having the per-file fix agent apply the same change twice.

Run dedup once before the bloat filter. Without it, the fix fan-out receives N copies of the same `fix_prompt` and rewrites the same line twice (sometimes inconsistently when the prompts paraphrase differently).

**Audit `inspected.files` against `finding.file`.** For every line-anchored finding, check that `finding.file` appears in the emitting agent's `inspected.files`. If a finding cites a file the agent never claimed to read, the agent is generalizing from the diff slice rather than from the code — drop it. This catches a common hallucination shape (agent infers a bug from grep results without reading the actual implementation). The audit applies only to line-anchored agents; prose findings (Funnel L1/L2, Materiality) are scoped by structural claims, not by cited files, and are exempt.

**Filter bloat-shaped findings before doing anything else.** Review agents bias toward recommending additions. The bar for every kept finding is **sound + correct + elegant** — two-out-of-three is a signal to look harder, not to mechanically apply the proposed change.

Two-step triage per finding:

1. **Is the failure mode real?** Read the cited code. If the scenario is imagined (e.g. a null guard on a type-guaranteed value), drop. For `confidence: low`, re-read and re-derive the analysis_chain before accepting — low confidence is a request for a second look.
2. **Is the remedy bloated?** If yes but the failure mode is real, keep the finding and rewrite the `fix_prompt` for the smallest fix that resolves the defect. A real race with a "mutex everywhere" remedy is still a real race — look for the narrow lock, the removed shared state, the atomic primitive. Never drop a real defect over an ugly proposal.

Bloat-shaped remedies typically propose: defensive checks for impossible cases, abstractions used once, comments restating obvious code, tautological tests, "just-in-case" guards with no identified failure mode. The smallest diff that fixes the real defect almost always wins.

For the findings that survive: fix every one, regardless of how many agents reported it. A single-agent finding is just as valid as one from seven agents; overlap is a signal of higher confidence, not of higher priority.

**Use the JSON envelope.** Line-anchored agents return `{findings: [{file, line, severity, title, analysis_chain, fix_prompt, ...}]}`. The `analysis_chain` is your auditable artifact: if a chain doesn't survive a re-read of the cited code, the finding is a hallucination — drop it without re-deriving from scratch.

**`fix_prompt` is the orchestrator's draft, not the reviewer's final word.** The bloat-filter applies to fix prompts too: if triage accepts a real finding but the reviewer's `fix_prompt` proposes a bloated remedy (mutex everywhere, defensive guard for an impossible case, one-shot abstraction), rewrite the `fix_prompt` before forwarding it. The verbatim contract is between **you (orchestrator) and the fix agent**, not between the reviewer and the fix agent — fix agents receive a `fix_prompt` you have accepted as-is or rewritten. Once forwarded, they apply it without re-interpretation.

**Parallelize fixes.** Group findings by file. Spawn one fix agent (model: `sonnet`) per file group, in parallel. Each fix agent receives the list of (post-triage) `fix_prompt` strings for its file, in order. Fix agents do not load skills, do not re-derive fixes from the original code, and do not use `isolation: "worktree"` — they work directly on the current working tree.

**Bugs get TDD treatment.** Write a non-regression test that fails first, then fix the code so the test passes.

**Re-read your own fixes.** After the fix agents return, re-read each changed file. If any fix you accepted now reads as bloat in context (a guard for an impossible case, a one-use abstraction, a tautological test), revert it. Catching bloat in your own diff is cheaper than catching it on the next review.

### Step 3 — Revalidate, verify, and commit

1. **Revalidate the fixed findings before running the test suite.** Scope: only findings of `severity: bug | security | performance | error_handling` that entered the fix queue. Suggestions and `[suggestion]`-tagged prose are never fixed in the loop, so never revalidated. Spawn ONE `general-purpose` subagent with `model: haiku` that receives, for each fixed finding, its `signature`, `file`, `line`, `analysis_chain`, and the fix diff. Prompt:

   ```
   You revalidate code-review findings against the fixes applied to them.

   For each finding below, read the cited file at its current state and the fix diff. Answer one of: `fixed` (the original failure mode is no longer reachable in the new code), `open` (original failure mode still reachable — fix is superficial: comment added, variable renamed, guard placed before the wrong line, or change in unrelated location), or `uncertain` (the fix is plausible but you cannot confirm without running it).

   ## What NOT to do
   - Do NOT flag new defects. Stay strictly within the listed signatures.
   - Do NOT mark `open` for stylistic disagreement with the fix — `open` is reserved for the original failure mode still being reachable.
   - If the fix lives in a different file than the signature's file (caller-site fix), follow the diff and revalidate against the actual changed code.
   - If the signature's file was deleted by the fix (L1/L2 structural delete), mark `fixed`.

   Return strict JSON, no markdown:
   {"revalidations": [{"signature": "...", "status": "fixed|open|uncertain", "why": "one sentence"}]}

   Findings to revalidate:
   {findings_with_diffs}
   ```

   A single agent handles all of them — one Haiku call is cheaper than N parallel ones for what amounts to a checklist.

2. **Findings marked `open` or `uncertain` re-enter the fix queue.** Build a new round of fix prompts from their original `fix_prompt` plus a one-line note (`previous attempt failed revalidation: <why>`), spawn the per-file fix agents again, and revalidate. Bound this micro-cycle: max 3 attempts total within a single Step 3 call (1 initial + 2 re-fixes). Track `attempts: N` per signature **across outer iterations** — when total attempts ≥ 5, stop fix-looping that finding and surface it in Step 5's open-suggestions list with the failure trail. This is the only safeguard against an outer loop spinning forever on a stubborn finding.
3. Run the test suite.
4. Run the linter.
5. Fix failures.
6. Commit describing what was fixed and why.

**Why a dedicated revalidation pass.** Tests catch regressions, but they don't catch superficial fixes that pass-by-coincidence (a comment added next to the bug, a guard placed before the defective line instead of replacing it, a rename that suppresses a linter warning without fixing the logic). A fresh model that didn't write the fix re-reads it against the original `analysis_chain` and asks: "is the failure mode gone?" Cheaper than letting the bug slip through to the next iteration, where the original reviewer would have to re-derive its own chain.

### Step 4 — Loop or stop

**Convergence is measured on findings that survived the Step 2 triage, not raw agent output.** An agent that returned only imagined-failure-mode findings — all of which were dropped at step 1 of the triage — counts as converged. Otherwise the same imagined findings would resurface on the next iteration and the loop would never terminate.

**Severity-based convergence.** Convergence is reached when every agent meets one of:
- (a) returned `No findings.`, OR
- (b) had all findings dropped at step 1 of the Step 2 triage, OR
- (c) all surviving findings are `severity: suggestion` (line-anchored JSON agents) **or** all carry the `[suggestion]` tag (prose agents — Funnel L1/L2, Materiality).

Suggestions are **not auto-fixed in the loop** — they're collected and listed in Step 5 for the user to decide. Auto-fixing every suggestion is what gives review tools their reputation for noisy churn; the bias is explicitly toward stopping. Bugs / security / performance / error_handling findings still block convergence and must be fixed.

**Prose agents tag their findings.** Funnel L1/L2 and Materiality emit text, not JSON, so the convergence checker can't read `severity:`. Their templates require each finding to be prefixed with either `[must]` (concrete action required — blocks convergence) or `[suggestion]` (worth considering but not required — qualifies under (c)). The orchestrator reads the tag, not its own interpretation of the prose.

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

Inject verbatim into every line-anchored prompt (Correctness, Subsystem, Tests, Skill, CLAUDE.md Compliance, Occam Razor). Funnel L1/L2 and Dogfood don't need it — their findings are structural or empirical, not failure-mode-inferred.

```
## Context verification — MANDATORY before reporting any finding

For every potential finding, answer these questions. If any answer kills the finding, drop it silently.

1. **Callers/callees** — is the missing validation/conversion/error-handling already done at the call site or in a visible wrapper? If yes, drop.
2. **Test context** — does the path contain a *segment* (between `/` separators) named exactly `tests`, `test`, `__tests__`, `spec`, `specs`, `fixtures`, `mocks`, OR a filename matching `*_test.*` / `*.test.*` / `*.spec.*` / `test_*.py` / `*_spec.rb`, OR code inside `#[cfg(test)]` / `describe(` / `test(` / `it(` / `def test_`? Substring matches don't count — `src/prospecting/`, `src/mockingbird/` are production. In test code, `.unwrap()` / `panic!` / missing validation are normal — drop unless it's a genuine logic bug.
3. **Intentional comments** — is there a `// SAFETY:` / `// intentionally` / `// fallback` / `# noqa` that *specifically* addresses the failure mode you would flag? A `// SAFETY:` justifying an unchecked-bounds index does NOT silence a race condition on the same line. Match must be specific.
4. **Diff is the fix** — does the added code resolve the same failure mode you're about to flag, or only a different aspect? `.unwrap()` → `?` resolves panic-on-None; `format!` → bind params resolves SQL injection but does NOT resolve a missing tenant filter. Drop only when the diff addresses your specific failure mode.
5. **Type tracing** — for a claimed type mismatch (`f64` vs `i64`, `Option<T>` vs `T`, `&str` vs `String`), trace the value flow through the diff. If a conversion exists anywhere on the path, the types are consistent — drop.
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
      "confidence": "high",
      "signature": "src/auth/session.rs:42:unwrap-on-user-header",
      "title": "unwrap() on user-supplied header",
      "analysis_chain": [
        "Line 42 calls .unwrap() on req.headers.get(\"X-Token\")",
        "HeaderMap::get returns Option<&HeaderValue>",
        "Header is attacker-controlled — missing header panics the handler"
      ],
      "why_tests_dont_cover": "tests/auth/session_test.rs only covers the happy path with X-Token present; no test sends a request without the header",
      "minimum_fix_scope": "replace .unwrap() with .ok_or(AuthError::MissingToken)? on line 42",
      "suggested_regression_test": "POST /session without X-Token header expects 401, not 500",
      "fix_prompt": "In src/auth/session.rs line 42, replace .unwrap() with .ok_or(AuthError::MissingToken)? to propagate instead of panic."
    }
  ],
  "inspected": {
    "files": ["src/auth/session.rs", "src/auth/errors.rs", "tests/auth/session_test.rs"],
    "symbols": ["validate_session", "AuthError"],
    "notes": ["middleware in src/middleware/auth.rs already returns 401 on AuthError; no double-handling risk"]
  }
}
```

**Field rationales (each field earns its line):**

- `analysis_chain` — auditable trace. A chain that doesn't survive a re-read of the cited code is a hallucination; Step 2 can drop it without re-reading the diff.
- `fix_prompt` — consumed verbatim by per-file fix agents. No re-interpretation between reviewer and fix agent.
- `signature` — dedup key `<file>:<line>:<failure-mode-slug>`. Use a slug from this controlled vocabulary when applicable: `panic-on-none` · `missing-validation` · `injection-sql` · `injection-shell` · `injection-template` · `missing-tenant-filter` · `secret-leak-log` · `unawaited-promise` · `dropped-future` · `race-shared-state` · `missing-timeout` · `unbounded-retry` · `path-traversal` · `toctou` · `wrong-role-check` · `missing-permission-check` · `n-plus-one` · `missing-transaction` · `replay-attack` · `session-fixation` · `zero-callers-dead` · `single-caller-inlinable` · `unused-param` · `derivable-default` · `redundant-overload`. Otherwise emit a free 3-5 kebab-token slug. Step 2 dedupes with a tolerant matcher (same file, line within ±3, same slug OR title-token Jaccard ≥ 0.6).
- `confidence` — `high|medium|low`, separate from severity. `severity: bug, confidence: low` survives Step 2 only when the analysis_chain is airtight. Low-confidence security findings still warrant a second look — don't merge with severity.
- `why_tests_dont_cover` — forces the agent to grep the test suite before emitting. If existing tests cover the failure mode, your finding is the test, not the bug — drop it. The field is your proof that you looked.
- `suggested_regression_test` — consumed by the fix agent for the TDD step (Step 2 mandates a non-regression test for bugs). Pre-articulating it here saves the fix agent re-deriving it.
- `minimum_fix_scope` — anti-bloat discipline at emission, not just at triage. If you can't state a small scope, the finding probably isn't ready.
- `inspected` — audit surface. If `finding.file` isn't in `inspected.files`, the agent claimed insight without reading the code — drop. `symbols` and `notes` carry the supporting context considered.

`why_tests_dont_cover`, `suggested_regression_test`, `minimum_fix_scope` apply to `bug` / `security` / `performance` / `error_handling`. For `suggestion` findings, set them to `null`.

Severity values: `bug` | `security` | `performance` | `error_handling` | `suggestion`. Suggestion findings should usually have been dropped at Context verification step 1.

Confidence values: `high` | `medium` | `low`. Default to `high` only when the analysis_chain survives independent re-derivation from the cited code.

---

## Agent Prompt Templates

Every agent follows: role → context → task → constraints → output format.

**Line-anchored templates (Skill, Tests, Subsystem, Correctness, CLAUDE.md Compliance, Occam Razor) require the Context verification block AND the Output format block to be appended verbatim at the bottom before spawning.** Funnel L1/L2, Materiality, and Dogfood are self-contained — do not append.

**Model assignment.** Spawn each agent with the model below — heavy reasoning gets `sonnet`, structural/textual lifts get `haiku`. The orchestrator (you) handles the coordinator role and stays on its session model.

| Agent | Model | Rationale |
|---|---|---|
| Pre-triage (Step 0.5) | `haiku` | classification only |
| Revalidation (Step 3) | `haiku` | checklist over a small structured input |
| Funnel L1, Funnel L2 | `haiku` | structural reasoning, short prompts |
| Occam Razor | `sonnet` | grep is mechanical, but "is this default derivable from the caller?" needs reading call sites with judgement |
| Correctness | `sonnet` | bug-hunting needs depth |
| Subsystem (billing, auth, schema-migration, webhook, RBAC, multi-tenant, cron) | `sonnet` | domain reasoning |
| Tests | `sonnet` | coverage gaps need code understanding |
| Skill Agent — heavy (security-defensive, language-rust, language-typescript, language-swift, react, react-native, database, drizzle-orm, frontend, web-performance, simplify, matt-improve-codebase-architecture) | `sonnet` | dense rules, code-level violations |
| Skill Agent — light (i18n, tailwind, ui, ui-animations, ui-ux, shadcn, vue, tanstack-query, tanstack-start-best-practices, better-auth-best-practices, better-result-adopt, docker, kubernetes, zod) | `haiku` | mostly style/usage rules, low ambiguity |
| coding-standards (umbrella + 4 sub-skills) | `sonnet` | judgement-heavy |
| claude-md-materiality | `haiku` | yes/no classification, no fix to derive |
| claude-md-compliance | `sonnet` | rule walk requires judgement and code-level matching |
| Dogfood | `sonnet` | needs to drive a real UI/CLI |
| General Opus 4.7 | `opus` | generalist, by design |
| Fix agents (Step 2) | `sonnet` | already specified |

**Shared diff file.** Step 0.2 wrote the full diff to `/tmp/review-diff-{branch}.patch`. Every template below uses `{diff_file}` to refer to it. Agents grep / filter the patch file rather than re-running `git diff`. When an agent's file-set includes uncommitted files (subsystem agents triggered by unstaged work), the agent additionally reads those files directly per the Step 0 rule.

**Trust-boundaries placeholder.** Every line-anchored template uses `{trust_boundaries}` to receive the comma-separated list computed in Step 0 (e.g. `secrets, network, auth`) or the literal `none` when the diff crosses no boundary. Substitute before spawning; never leave the placeholder literal in the prompt.

**Previous findings injection (iteration N>1 only).** Step 4's incremental re-review requires building a `{previous_findings_block}` per agent before re-spawning. At iteration 1, this placeholder is replaced by the empty string — do not emit a header for an empty block.

Two block shapes — pick the one that matches the agent's output contract. Dogfood never receives previous findings (its output is empirical, each run starts fresh).

**Shape A — line-anchored agents (Correctness, Subsystem, Tests, Skill):**

```
## Previous findings (iteration N-1)

You emitted these findings last iteration. Use them to avoid re-deriving the same conclusions.

- signature: <file:line:slug> — title — disposition: fixed | dropped-by-triage (reason) | unfixed — attempts: N
  ...

Rules for this iteration:
- Match by `signature`, not by line number. Lines may have shifted after fixes; the `<file>:<slug>` portion is the stable key. If your new analysis lands on the same `<file>:<slug>` as a listed entry, treat it as the same finding.
- `attempts` counts how many fix-and-revalidate cycles this signature has survived. The orchestrator escalates at 5 — do not pad your analysis to claim progress on a high-attempts finding; if it's a hallucination that keeps coming back, the right move is `dropped-by-triage` next round, not another fix attempt.
- `fixed`: verify the new code actually resolves the failure mode. If the fix is superficial (comment added, code re-arranged but bug remains), re-emit with the same signature so the orchestrator can recognise it as a repeat-offender.
- `dropped-by-triage`: do not re-emit unless the cited code has materially changed since last iteration. If it has, re-verify against the new code before re-emitting.
- `unfixed`: re-emit only if the failure mode still applies to the current code.
- Emit any genuinely new findings introduced by the fix commit as usual, with fresh signatures.
```

**Shape B — prose agents (Funnel L1, Funnel L2, Materiality):**

```
## Previous findings (iteration N-1)

You emitted these findings last iteration. Use them to avoid re-deriving the same conclusions.

- scope (file / module / claim) — your previous one-line summary — disposition: addressed | rejected-by-orchestrator (reason) | still-stands
  ...

Rules for this iteration:
- `addressed`: the orchestrator accepted your structural change and a commit reflects it. Re-emit only if the commit didn't actually resolve your concern (e.g. you said "delete this module" and only the export changed).
- `rejected-by-orchestrator`: the orchestrator judged the finding as bloat / out-of-scope / over-reach. Do not re-emit unless the cited scope materially changed since last iteration.
- `still-stands`: the orchestrator accepted the finding but chose not to act this iteration (often because it was `[suggestion]`-tagged). Re-emit verbatim only if the underlying scope is unchanged. If the diff has moved on, re-evaluate from scratch.
- Emit any genuinely new findings introduced by the fix commit as usual, with the `[must]` / `[suggestion]` tag.
```

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

## Output format

Each finding starts with `[must]` (the code as-is shouldn't ship — concrete necessity or completeness gap) or `[suggestion]` (worth considering but the change can ship without it). A finding without a tag is invalid.

Example: `[must] The new helpers in src/utils/fmt.ts duplicate the formatting passes already done in src/io/render.ts — consolidate into the existing module instead of adding a second one.`

If zero findings, say exactly: "No findings."
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

## Output format

Each finding starts with `[must]` (the diff actively carries unused/wasted scope that should be reduced before shipping) or `[suggestion]` (a smaller perimeter is possible but the current shape is defensible). A finding without a tag is invalid.

Example: `[must] BillingProvider wraps only the existing useBilling() hook — inline the hook into its sole caller and delete the provider.`

If zero findings, say exactly: "No findings."
```

### Skill Agent (coding-standards, coding-standards:*, security-defensive, language-*, framework/lib, simplify, matt-improve-codebase-architecture)

```
You enforce a single skill's rules on changed code.

Read the project's CLAUDE.md for conventions. Then load the skill `{skill_name}` via the Skill tool.

Read the diff from {diff_file}, filtered to {file_list}. Read full files when context is needed.

The diff crosses these trust boundaries: {trust_boundaries}. Skill rules that touch these boundaries take precedence when you have to choose between violations to flag.

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

The diff crosses these trust boundaries: {trust_boundaries}. Untested code on a crossed boundary is a higher-priority gap than untested pure logic — prioritize accordingly.

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

This diff crosses these trust boundaries: {trust_boundaries}. Your subsystem failure modes already overlap with one of them by construction; if other boundaries are present, weigh interactions (e.g. an auth-subsystem review on a diff that also crosses `network` should watch for token leakage in outbound calls, not just session logic).

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

This diff crosses these trust boundaries: {trust_boundaries}. For each boundary present, apply the failure modes listed in the trust-boundaries table at Step 0 (column "Failure modes") as a prioritized lens — they're more likely than generic bugs and deserve the closer read. When `{trust_boundaries}` is `none`, focus on generic correctness only. When a subsystem agent was also spawned for one of these boundaries, that agent owns depth on its failure modes; you still skim them for cross-cutting interactions but defer primary defect ownership.

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

### Occam Razor Agent

```
You audit the call graph of code introduced or modified by the diff. For every exported function, method, type, or constant the diff touches, ask: do the callers justify the shape?

Read the project's CLAUDE.md for conventions. Read the diff from {diff_file}, filtered to {file_list}. Read full files when context is needed.

This diff crosses these trust boundaries: {trust_boundaries}. Trust boundaries don't change your method — they only mean dead code on an auth/billing path is the same severity as dead code anywhere else (do not downgrade because "it's only a wrapper").

## Method (mechanical — follow in order)

Scope: **exported** functions, methods, types, and constants the diff introduces *or* whose signature it modifies. Pre-existing exports with unchanged signatures are out of scope unless the diff *adds* a new call site for them (i.e. you're auditing the new caller, not the export).

For each in-scope symbol:

1. **Enumerate callers.** Grep the whole repo (not just the diff slice) for the identifier. Count distinct call sites — both direct calls and re-exports that forward the symbol unchanged. List every site with its file:line and the literal arg-tuple passed.
2. **Bin by caller count:**
   - `0 callers` → emit `zero-callers-dead`. `severity: bug`.
   - `1 caller` AND function body < 20 lines → emit `single-caller-inlinable`. `severity: suggestion` (the wrapper may be deliberate for testability or clarity; the user decides at Step 5).
   - `≥ 2 callers` → proceed to step 3.
3. **Walk each formal param.** For every param, list the value each caller passes:
   - If no caller passes a non-default value → emit `unused-param`. `severity: suggestion`.
   - If every caller computes the default's input *before* calling, and the function uses that input only to reconstruct what the caller already had → emit `derivable-default`. `severity: suggestion`.
4. **Cross-check siblings.** If the diff introduces two or more exported functions whose bodies share ≥ 80% of their lines and whose callers are disjoint → emit `redundant-overload`. `severity: bug` (the diff is the source of the duplication — fixing it later is harder than not introducing it).

Use the controlled-vocabulary slugs above for `signature`. Step 2's dedup will collapse cross-agent overlap.

## What NOT to flag

- Internal (non-exported) helpers — `simplify` and Funnel L2 own readability of those. Stay on exports.
- Public API surfaces with external consumers — library exports re-exported from `index.ts`, framework lifecycle hooks, plugin contracts, anything in a package's `exports` map, anything with a JSDoc `@public` tag. A 0-caller export there means external callers exist; not dead.
- Test helpers — tests legitimately scope helpers per-test-file, and 1-caller test utilities are normal. Apply the Context verification "test context" question before emitting.
- Pre-existing 1-caller functions in unchanged code — only what the diff introduces or whose signature it changes counts.
- Truly generic utilities at 1 current caller — a `pick<T, K>` or `clamp(n, min, max)` with one current consumer is not inlinable; the shape *is* the contract.
- Bodies < 5 lines where the function name is more informative than the body — the inline cost (loss of name) exceeds the wrapper cost. Keep the wrapper.
- Params that look unused but are required by an interface / trait / abstract class the function implements — the signature is fixed by the contract. Grep for the interface before emitting `unused-param`.
- Intentional-comment signals: `// keep: testability`, `// future caller in <branch>`, `// API surface — do not inline`. The Context verification "intentional comments" question must specifically match the failure mode you'd flag.

## Severity guide

- `zero-callers-dead`, `redundant-overload` → `bug`. These block convergence — the diff ships unreachable or duplicated code.
- `single-caller-inlinable`, `unused-param`, `derivable-default` → `suggestion`. These surface in Step 5's open-suggestions list; the user decides. Auto-deleting a 1-caller wrapper every iteration is too aggressive — many are deliberate.

`why_tests_dont_cover`, `suggested_regression_test`, `minimum_fix_scope` apply when severity is `bug`. For `suggestion`, set them to `null`.

## A worked example (what good looks like)

Diff introduces `enumFilter(values, options, opts = defaults)` in `src/filters/enum.ts`.

1. Enumerate callers: `grep -rn 'enumFilter\b'` returns 2 hits — the definition itself and one usage in `src/search/buildQuery.ts:88`. Distinct call sites: **1**.
2. Body is 14 lines (< 20). Not a re-export. Not in a package `exports` map. No `@public` tag.
3. Emit `single-caller-inlinable`, severity `suggestion`, signature `src/filters/enum.ts:12:single-caller-inlinable`, fix_prompt: "In src/filters/enum.ts the exported `enumFilter` has one caller (src/search/buildQuery.ts:88). Inline its body at the call site and delete the export."

If instead the grep had returned 0 distinct call sites (only the definition), severity would be `bug` with slug `zero-callers-dead`.

Stay within these files: {file_list}

{previous_findings_block}  ← only injected at iteration N>1; otherwise empty
```

### Materiality Agent (claude-md-materiality)

```
You check whether the project's AI instructions are stale relative to the diff.

Read `CLAUDE.md` and `AGENTS.md` at the repo root if they exist. Read the diff from {diff_file}.

Your task: answer ONE question — does this diff make any line in CLAUDE.md/AGENTS.md misleading or incomplete? High-materiality changes that warrant an update (the orchestrator only spawns you when at least one of these triggers fires — be ready to confirm or refute):
- Package manager change (`packageManager` field changed in package.json, OR lockfile family added/removed)
- Test framework swap (a *new* `vitest.config.*` / `jest.config.*` / `playwright.config.*` file, OR an existing one removed — not edited)
- Build tool added or removed (new `vite.config.*` / `webpack.config.*` / `rollup.config.*` / `next.config.*`, OR an existing one deleted)
- `tsconfig.json` change to `module`, `moduleResolution`, or a *new top-level alias prefix* in `paths`
- New top-level directory at the repo root or at a monorepo workspace root
- New required env var (additions in .env.example — not removals, not renames)
- CI/CD workflow file added or removed (not edited)
- Major dependency upgrade that changes API surface (e.g. React 18 → 19, Next 14 → 15)

Low materiality (do NOT flag): bug fixes, feature additions using existing patterns, CSS-only changes, dep patch bumps, internal refactors, tsconfig `target`/`lib`/`strict` flag flips, CI workflow tweaks that don't add/remove a file, path-alias *additions* under an existing root.

## What NOT to flag
- Generic "consider updating docs" — only concrete claims that became false
- Missing CLAUDE.md when none exists — only flag staleness, not absence (unless the diff is itself a new project scaffold)
- Wording improvements to CLAUDE.md — your job is staleness detection, not editing

Stay within these files: {file_list} plus CLAUDE.md / AGENTS.md.

## Output format

If CLAUDE.md/AGENTS.md is unchanged but the diff is high-materiality, one finding per stale claim. Each finding starts with `[must]` (a stated fact is now factually wrong — e.g. "we use npm" after a pnpm migration) or `[suggestion]` (a vague convention that's drifted but didn't break — e.g. "tests live in __tests__" after some moved to colocated `.test.ts`). Then: which file, which line/section, what the diff makes false, and a one-sentence proposed correction. A finding without a tag is invalid.

Example: `[must] CLAUDE.md line 14: "Run npm install" is now wrong — the diff switched to pnpm. Replace with "Run pnpm install".`

If zero findings, say exactly: "No findings."
```

### CLAUDE.md Compliance Agent

```
You enforce the project's own conventions as written in its CLAUDE.md / AGENTS.md.

Read every `CLAUDE.md` and `AGENTS.md` at the repo root and at each monorepo workspace root. List every rule, convention, or constraint they state — commit message format, file layout, naming conventions, banned imports, mandatory patterns, "we always do X" / "we never do Y" lines.

Read the diff from {diff_file}, filtered to {file_list}. Read full files when context is needed.

For each rule, scan every changed line and check if it violates. A rule fires only when the diff introduces or modifies code that breaks it — pre-existing violations in unchanged code are out of scope.

This diff crosses these trust boundaries: {trust_boundaries}. Rules that touch these boundaries (auth conventions, secret-handling rules, etc.) take precedence when you have to choose between violations to flag.

## What NOT to flag
- Rules from skills loaded by other agents (language-typescript, security-defensive, etc.) — those agents own their domains
- Inferences from "best practices" not literally stated in the doc — only flag what the doc actually says
- Pre-existing violations in unchanged code
- Style preferences the doc mentions in passing without a rule — "we tend to..." is not "you must..."

Stay within these files: {file_list}

{previous_findings_block}  ← only injected at iteration N>1; otherwise empty
```

### Dogfood Agent (runtime, post-static-convergence)

```
You exercise a user-facing surface to find runtime bugs static review can't catch.

Load the `dogfood` skill via the Skill tool. Read the project's CLAUDE.md for run instructions, dev credentials, and conventions.

Changed surface(s) to exercise: {file_list}

Run in this exact order:

1. **Verify you are NOT in production.** Read `.env`/`.env.local`, check the DB connection string, look for `NODE_ENV`/`APP_ENV`. If the active database, API host, or any service URL looks like a real production system, **abort** and emit one finding: `refused to run: target appears to be production`. Never mutate data on non-dev.

2. **Start the dev server with PID capture and a cleanup trap.** Find the command in `package.json` scripts, Makefile, justfile, or CLAUDE.md. Use `setsid` so the server gets its own process group:

   ```bash
   setsid <run-command> &
   SERVER_PID=$!
   SERVER_PGID=$(ps -o pgid= "$SERVER_PID" 2>/dev/null | tr -d ' ')

   cleanup() {
     if [ -n "$SERVER_PGID" ]; then
       kill -TERM -"$SERVER_PGID" 2>/dev/null; sleep 1; kill -KILL -"$SERVER_PGID" 2>/dev/null
     elif [ -n "$SERVER_PID" ]; then
       kill -TERM "$SERVER_PID" 2>/dev/null; sleep 1; kill -KILL "$SERVER_PID" 2>/dev/null
     fi
     for port in <project-ports>; do
       lsof -ti :"$port" 2>/dev/null | while IFS= read -r pid; do
         [ -n "$pid" ] && kill -KILL "$pid" 2>/dev/null
       done
     done
   }
   trap cleanup EXIT INT TERM
   ```

   If `setsid` is unavailable, the fallback `<run-command> &` puts the child in the agent's own process group — negative-PGID kill would terminate the agent. Set `SERVER_PGID=""`, kill `SERVER_PID` directly, and rely on the port/pgrep checks to catch escaped watchers. Note the limitation in the "How I authenticated" output section.

   Wait for readiness (poll the port, watch for a "ready" line).

3. **Authenticate.** Check CLAUDE.md for test credentials first. Otherwise in order: seed script → signup flow → magic-link / dev auth bypass → direct DB insert (confirmed-dev DB only). Use a unique identifier (`email = afk-dogfood-<YYYYMMDD-HHMMSS>-<rand>@example.invalid`). Record everything created — tables, row ids, unique identifier — to `/tmp/dogfood-created.txt`. Next run reads this list; you must too.

4. **Exercise.** Drive the new code path end-to-end via the actual interface (browser for UI, terminal for CLI, HTTP for API). Happy path, then push: empty/oversized/malformed inputs, rapid clicks, race conditions, refresh mid-flow, browser back, permission boundaries.

5. **Capture evidence.** Per bug: one-line summary, repro steps, observed vs expected, any console/network/server-log artifact.

6. **Cleanup is mandatory** — bugs, errors, crashes, anything. The trap fires; then delete every row in `/tmp/dogfood-created.txt` (report exact counts: `deleted: 3 users, 7 sessions`). Verify ports free (`lsof -i :<port>` returns nothing) and no orphans (`pgrep -f <server-command>` returns nothing). List uncleanable items under `cleanup-incomplete` — never hide them.

Output (the **first line** is the convergence signal):
- Zero bugs: line 1 is exactly `No findings.`
- Otherwise: line 1 is `N findings.`, then a flat list. Every entry MUST include `suspected files:` (Step 4.5 groups fix agents by file — attribution is required).
- A short "How I authenticated" note for the next run.
- Final line: `cleanup-complete: server stopped (PID/PGID killed and verified), N rows deleted` OR `cleanup-incomplete: <what's left>`.
```
