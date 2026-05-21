---
name: code-review-loop
description: Use when the user wants a thorough, autonomous code review of the current branch. Also use when the user asks to stress-test code quality, run a deep review, or review before merge. Spawns specialized review agents in parallel, fixes all findings, and loops until every agent has zero feedback.
---

# Code Review Loop

Specialized agents in parallel. Fix every finding. Loop until convergence. User doesn't intervene between iterations.

## When not to use

Standard = **shape, not size**. 500-line mechanical rename safer than a 3-line operator flip on permissions.

**Skip when genuinely trivial**: single-word doc typos, whitespace/comment-only, lockfile or generated-code regeneration, mechanical renames with import-path-only effect, low-risk dep patch bumps, docs-only, inert config (linter/formatter rules with no runtime effect), or user wants quick opinion not autonomous loop.

**Don't skip when small but high blast radius** — any 1-line change to SQL/regex/auth/billing/permission/signature-verification code; flipping a feature-flag default, retry/timeout, or auth callback URL; money/tax/currency/fee constants; HTTP method, redirect URL, status enum; tightening/loosening a comparison operator (`<` ↔ `<=`, `==` ↔ `!=`); renaming a public API surface; new direct dependency (supply-chain); user-facing copy that changes meaning ("approved" → "denied"); mixed diff with a semantic 1-liner buried in whitespace.

"Config-only" isn't a blanket skip — config flipping a feature-flag default, retry/timeout, auth callback URL, or secrets wiring is runtime-affecting.

Unsure → run. Spurious run costs minutes; missed billing bug costs much more.

## Tier classification

Once running, classify to pick fan-out shape. Mid-ground between "skip" and "full review" — many real diffs (≤100 lines, no high-stakes path) don't justify twelve agents.

Compute from the unified file-set (`"$DEFAULT_BRANCH"...HEAD` ∪ unstaged ∪ staged ∪ untracked):

- `total_lines` = added + removed across non-noise files (after Step 0.5 filter)
- `file_count` = unique non-noise files
- `high_stakes` = ANY subsystem trigger fires (billing, auth, schema-migration, webhook, RBAC, multi-tenant, cron) OR security-sensitive paths (`**/auth/**`, `**/crypto/**`, `**/permissions/**`, `**/migrations/**`) OR signature-verification code

| Tier | Condition | Fan-out |
|---|---|---|
| **Lite** | `total_lines ≤ 50` AND `file_count ≤ 5` AND `high_stakes = false` | Funnel L1, L2, Occam Razor, **one** Correctness, **one** language agent (dominant ext), simplify, coding-standards (umbrella only), Tests. No subsystem, no general Opus. ~8 agents. |
| **Full** | otherwise — any high_stakes, OR `file_count > 5`, OR `total_lines > 50` | Everything in Step 0. ~12+ agents. |

**Override:** explicit user request for deep review → force `Full`. Tier = default, not ceiling.

Lite shrinks Step 0's "Always spawn" to the Lite column; "Spawn by imports", "Spawn by surface touched", "Spawn by subsystem touched" don't apply (Lite ≡ no high-stakes by construction).

## The Funnel

Three levels, in order. Each gates the next.

**L1 — Question the need.** Does this code need to exist? Framework or dep already solves this? Start from problem, not existing code. What's missing?

**L2 — Reduce scope.** Smallest perimeter solving the validated need. Inline, merge, remove wrappers. Every abstraction justifies itself through concrete usage.

**L3 — Minimize code + review tests.** Shortest correct typed code. No duplicate data. Missing tests? Useless tests? Improvable tests?

**Discipline:** challenge your own proposal at each level until you can't remove anything.

## Anti-shortcut — stop if any cross mind

Past runs drift here. Skill's value = fan-out shape — collapse it and you might as well not call it.

| Temptation | Reality |
|---|---|
| "Diff petit, un seul agent suffit" | Tier decides. Lite = ~8, Full = 12+. AFK forces Full. |
| "Je review moi-même, c'est plus rapide" | You don't have rule-sets loaded (security-defensive, language-*, ui-ux, coding-standards:*). Spawn agents — they load rules at L3. |
| "Spawn un `general-purpose` avec prompt review générique" | Substitute, not skill. Templates verbatim, fan-out per tier. |
| "Step 0 long, je skip et spawn les évidents" | Step 0 detects subsystem (billing/auth/webhook), surface (UI/API), imports. Skip = miss high-stakes lenses. |
| "Drop findings 'mineurs' pour converger plus vite" | Step 4 severity-based convergence already does this. `suggestion` doesn't block; `bug`/`security`/`performance`/`error_handling` do. |
| "Step 1 dit parallel mais une par une = plus simple à debug" | Wall-time collapse = the only reason this skill exists. One turn, N Task blocks, BEFORE any result. |
| "L'itération 2 = mêmes choses, autant arrêter à 1" | Convergence is the loop's verdict, not yours. Step 4 decides. |

## Workflow

### Step 0 — Detect agents and scope files

Every `git diff` uses `"$DEFAULT_BRANCH"...HEAD`, never hardcoded `main`. If caller hasn't exported `DEFAULT_BRANCH`, detect:

```bash
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(glab repo view --output json 2>/dev/null | jq -r '.default_branch // empty')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(git for-each-ref --format='%(refname:short)' refs/heads/main refs/heads/master refs/heads/develop 2>/dev/null | head -1)
  test -n "$DEFAULT_BRANCH" || { echo "ERREUR : default branch introuvable. code-review-loop ne démarre pas." >&2; exit 1; }
fi
git fetch origin "$DEFAULT_BRANCH"
```

`fetch` keeps local tracking ref current vs concurrent pushes.

Run `git diff --name-only "$DEFAULT_BRANCH"...HEAD` → changed files. Determine agents from extensions and imports.

**Apply the tier first.** Compute tier from "Tier classification" above. Lite → spawn only Lite column agents, skip "Spawn by imports", "Spawn by surface touched", "Spawn by subsystem touched", "General Opus 4.7". Rest of Step 0 = Full only.

**Always spawn:** Funnel L1, Funnel L2, Occam Razor, coding-standards (umbrella + 4 sub-skills), simplify, matt-improve-codebase-architecture, matt-review, security-defensive, Tests, Correctness.

**Why Occam Razor sits alongside the funnel.** L1 ("must exist?") and L2 ("smallest perimeter?") are prose, evaluated face-value, neither walks the call graph. Occam Razor is the mechanical check: for every exported symbol the diff introduces/modifies, enumerate call sites, prove shape pays rent. Past misses: 0-caller function, 1-caller wrapper, defaults reconstructed from caller's known values.

**Spawn when `CLAUDE.md` exists** (repo root or any monorepo workspace root): **claude-md-compliance** — reads file(s), extracts rules, walks diff for violations introduced. Distinct from claude-md-materiality (doc staleness); compliance flags code breaking rules. Required: most repos document conventions no language/framework skill checks for. Multiple CLAUDE.md → one agent handles all.

**Spawn by extension:** `.ts`/`.tsx` → language-typescript, `.rs` → language-rust, `.swift` → language-swift, `.vue` → vue.

**Spawn by imports** (one agent per detected skill):
`better-auth-best-practices`, `better-result-adopt`, `coss`, `database`, `docker`, `drizzle-orm`, `i18n`, `kubernetes`, `react`, `react-native`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui-animations`, `vue`, `zod`

**Spawn by surface touched.** UI/frontend skills with no import signal — they apply to categories of code. Trigger by file-set.

**File-set** = same unified set (`"$DEFAULT_BRANCH"...HEAD` ∪ unstaged ∪ staged ∪ untracked), minus Step 0.5 APPROVED files.

| Trigger (path globs) | Skill agents | What they review |
|---|---|---|
| `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `app/**/page.*`, `pages/**`, `src/routes/**`, server actions | **ui-ux**, **frontend**, **ui**, **make-interfaces-feel-better**, **web-performance**, **web-interface-guidelines** | design quality, visual hierarchy, polish, perf budgets, layout discipline, component shape, Vercel WIG conformance |
| `*.css`, `*.scss`, design-token files (`tokens.*`, `theme.*`), tailwind config when it changes design tokens (colors, spacing, typography) | **ui-ux**, **make-interfaces-feel-better** | spacing/color/typography rules, optical alignment, design-system drift |
| `app/**/route.*`, `middleware.*`, `server/api/**`, `api/**`, `routes/**`, tRPC routers (files importing `@trpc/server`), GraphQL resolvers / schema files (`*.graphql`, `*.gql`, files with `buildSchema(` or `createSchema(`), OpenAPI specs (`openapi.*`, `swagger.*`) | **api-design** | contract stability, error semantics, versioning, pagination, Hyrum's Law, response shape consistency |

These skills overlap with framework agents (`react`, `vue`) — different lenses (design vs. framework idioms), coexist. One agent per skill per matching row; dedup across rows.

**Spawn by subsystem touched.** Diff touches high-stakes subsystem → spawn **subsystem-framed agent** alongside generic Correctness. Framing primes for domain failure modes generic lens misses (double-charges, refund races, signature replay, cross-tenant leaks).

**File-set for subsystem detection** = same Dogfood rule: union `"$DEFAULT_BRANCH"...HEAD` + unstaged + staged + untracked. Else uncommitted auth/billing/schema edits silently bypass lenses.

**Pass unified file-set to agent**, not just `"$DEFAULT_BRANCH"...HEAD` slice. Uncommitted files → agent must read directly. Replace `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD -- {files}` in subsystem prompt with `read current contents of {files} directly, and run \`git diff -- {files}\` for unstaged delta`.

Triggers specific enough to avoid UI tokens / ARIA roles / job listings / generic "workspace" UI. Row fires only when ≥1 concrete signal present.

Path globs recursive — `**/billing/**` matches `apps/api/src/billing/prices.ts` AND `billing/index.ts`. Modern monorepos rarely place subsystem code at repo root.

| Trigger (recursive path globs, imports, or code patterns) | Subsystem agent | Failure modes it should hunt |
|---|---|---|
| files under `**/billing/**`, `**/payments/**`, `**/invoices/**`, `**/subscriptions/**`; OR imports of `stripe`, `@paddle/`, `@lemonsqueezy/`; OR code with `chargeAmount`, `refundAmount`, `idempotencyKey`, `invoice.*total` | **billing-subsystem** | double-charge, refund races, currency rounding, dispute flows, idempotency keys |
| files under `**/auth/**`, `**/session/**`; OR imports of `better-auth`, `next-auth`, `lucia`, `@clerk/`, `@auth/`; OR code with `signIn(`, `signUp(`, `getSession(`, `verifyJwt`, `bcrypt`, `argon2` | **auth-subsystem** | session fixation, token leak, replay, MFA bypass, account takeover |
| files under `**/migrations/**`, `**/drizzle/migrations/**`, `**/prisma/migrations/**`; OR `**/*.sql` schema files; OR Drizzle/Prisma `**/schema.ts` edits that alter columns | **schema-migration-subsystem** | forward + rollback safety, column-nullability flips, data loss, downtime |
| files with `webhook` anywhere in the path (`**/webhook*/**`, `**/*webhook*.ts`); OR code with `verifySignature`, `crypto.createHmac`, `crypto.timingSafeEqual` | **webhook-subsystem** | signature verification, replay protection, timing-attack-safe compare |
| files under `**/policies/**`, `**/permissions/**`, `**/rbac/**`; OR imports of `casl`, `@casl/`; OR code with `hasPermission(`, `canAccess(`, `authorize(`, `Policy.` | **rbac-subsystem** | privilege escalation, cross-role data leaks, policy drift |
| code that filters DB queries by `tenantId`, `organizationId`, or `workspaceId`; OR middleware that resolves a current tenant/org/workspace | **multi-tenant-subsystem** | cross-tenant leaks, missing tenant filters on shared tables |
| files under `**/cron/**`, `**/jobs/**`, `**/workers/**`; OR imports of `bullmq`, `bull`, `agenda`, `node-cron`, `@trigger.dev/`, `inngest`; OR code with `defineJob(`, `enqueue(`, `.cron(` | **cron-subsystem** | duplicate execution, missed runs, ordering, dead-letter handling |

Subsystem agent **adds to** (doesn't replace) Correctness. Use **Subsystem Agent** template — not Skill Agent (would try to load non-existent skill).

**Compute active trust boundaries.** Same triggers identify boundaries the diff crosses, even without full subsystem agent. Union: zero or more of `user-input | network | filesystem | secrets | process-exec | database | auth | permissions | concurrency | external-api | serialization`. Pass as `{trust_boundaries}` into every line-anchored template (Correctness, Tests, Skill, Subsystem). No boundary → `none`. **Runs for Lite and Full** — Lite diffs touching `network`/`serialization`/`external-api` get the lens (boundaries don't gate high_stakes, survive Lite filtering).

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

"Failure modes" column = **single source of truth** for line-anchored agents when boundary active. Templates reference this table, don't duplicate.

**Flag the dogfood gate.** Diff changes a user-facing surface → flag **dogfood gate** for Step 4.5 (3 personas: happy-path, adversarial, regression). Detect broadly, *err toward triggering*. Categories:

- **Web UI**: `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `*.html`, CSS / design-token files (`*.css`, `*.scss`, `tokens.*`, theme files), `app/**/page.*`, `pages/**`, `src/routes/**`, server actions, i18n copy files, public/static assets that change observable behaviour.
- **HTTP / API**: `app/**/route.*`, `middleware.*`, `server/api/**`, `api/**`, `routes/**`, tRPC routers, GraphQL resolvers/schema, WebSocket handlers, route definitions imported from `next`/`express`/`fastify`/`hono`/`koa`.
- **CLI**: `bin/**`, `cli/**`, `src/cli/**`, files importing `commander`, `yargs`, `oclif`, `clipanion`, `cac`, `meow`.
- **Native / desktop / mobile**: Electron/Tauri main or renderer entrypoints, React Native / Expo screens, native iOS/Android files.

Unsure → flag. Spurious run cheap (personas dedup); missed runtime bug expensive. Gate runs **after Step 4 static convergence**, not in parallel — needs code that actually works, don't waste personas on intermediate states.

**Don't rely on `git diff "$DEFAULT_BRANCH"...HEAD` alone for dogfood trigger.** Misses uncommitted work. Union in unstaged + staged + untracked too.

**Codex:** only if user explicitly requests.

**General Opus 4.7:** always spawn. Generalist reviewer, no skill loaded. `general-purpose` subagent, `model: opus`.

**Spawn by materiality.** Diff touches something that should be in `CLAUDE.md` / `AGENTS.md` but those files unchanged → spawn **claude-md-materiality** (haiku). Tight signals to avoid firing on routine config tweaks:

- package manager switch (`package.json` `packageManager` field changed, OR lockfile family added/removed: `pnpm-lock.yaml` ↔ `package-lock.json` ↔ `yarn.lock` ↔ `bun.lock`)
- test framework swap (a `vitest.config.*` / `jest.config.*` / `playwright.config.*` file added or removed — not edited)
- build tool added or removed (new `vite.config.*` / `webpack.config.*` / `rollup.config.*` / `next.config.*` file, OR an existing one deleted)
- `tsconfig.json` change to `module`, `moduleResolution`, or addition of a *new top-level alias prefix* in `paths` (NOT path tweaks, NOT `target`/`lib`/`strict` flag toggles)
- new top-level dir (root of repo or root of a monorepo workspace)
- new required env var (additions in `.env.example` — not removals, not renames)
- CI/CD workflow file added or removed (NOT edited — workflow tweaks rarely invalidate docs)

Agent's only job: flag the gap, don't write the doc. Skip materiality entirely under Lite (cost low but consistency matters — Lite ≡ no structural change).

### Step 0.2 — Write shared diff to disk

Write full diff once to `/tmp/review-diff-{branch}.patch` via `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD > /tmp/review-diff-{branch}.patch`. Pass path to every agent. Agents read the file instead of re-running git diff.

**Why:** on large diffs (>500 lines) with 10+ agents, per-agent `git diff` duplicates same bytes through every subagent context. Write once, read N times → saves tokens, avoids subprocess overhead. Replaces `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD -- {files}` in templates — agents `grep` the patch scoped to their files.

If file-set includes untracked/unstaged (subsystem agents on uncommitted edits), agent reads those directly per Step 0 — patch file only covers `"$DEFAULT_BRANCH"...HEAD` slice.

**Scope files per agent:**
- Language agents: files matching the extension
- Framework/lib agents: files importing the framework
- Tests agent: test files + source files they test
- Other: all changed files

### Step 0.5 — Pre-triage with cheap model

Many diffs have a long tail of routine files (config additions, pure renames, formatting, generated regeneration, simple field additions). Sending those to 10+ specialized agents wastes wall time + tokens. Filter once cheaply before fan-out.

Spawn ONE `general-purpose` subagent, `model: haiku` (fallback `sonnet` if Haiku unavailable), with prompt:

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

**Subtract APPROVED files from every agent's scoped file list before Step 1.** Exception: file matching any subsystem trigger or any Dogfood category in Step 0 stays regardless of triage verdict. Cheap-model + high-stakes path = trust path, not model.

Triage = one shared round for whole diff, not per agent. Run once, subtract, fan out. Not a replacement for the funnel's "is this code necessary" — only to skip lockfile churn and rename-only diffs.

### Step 1 — Spawn all agents in a single message block

**Parallelism = the only reason this skill exists.** Default tool-call behavior is serial: one Task → await → next. Collapses fan-out into `N × (think-time + agent-time)`, defeats the point. **Override.** Emit ALL Task tool_use blocks in the SAME assistant message, BEFORE any result.

- ✅ **Right:** one turn, N parallel Tasks → wait → N results → aggregate.
- ❌ **Wrong:** turn 1 = Task(L1) → turn 2 = Task(L2) → … If you catch yourself, stop and re-issue together.

Your own `read`/`grep`/`webfetch` calls go in the SAME turn — concurrent, zero extra wall time.

Use templates below. Pass each agent its scoped file list.

### Step 2 — Process findings, drop bloat, then fix

Read all reports. Process in funnel order:
1. L1 first. L1 says "delete this module" → discard findings about that module from other agents.
2. L2 next. L2 says "merge these files" → discard file-level findings on the originals.
3. Rest. Contradictions: simpler wins.

**Dedupe by signature before triaging.** Each line-anchored finding has `signature: <file>:<line>:<failure-mode-slug>`. Same defect flagged by N agents (Correctness + subsystem + language all spotting same `unwrap()` on user input) → equivalent signatures. Tolerant matcher (per JSON envelope spec): same file, line within ±3, same slug OR title-token Jaccard ≥ 0.6. Group:

- Keep emission with highest `confidence`. Tiebreak: most specific `fix_prompt` (concrete line + concrete replacement).
- Annotate kept finding with `reported_by: [agent_name, ...]` (orchestrator-added). 3 independent agents converging = strong triage signal.
- Discard duplicates entirely. Their fix_prompts are redundant; risk of double-apply.

Dedup before bloat filter. Else fix fan-out gets N copies of same `fix_prompt`, rewrites same line N times (sometimes inconsistently).

**Audit `inspected.files` against `finding.file`.** Line-anchored finding citing a file not in `inspected.files` = agent generalizing from diff slice, not code → drop. Catches common hallucination (agent infers bug from grep without reading the implementation). Audit applies to line-anchored only; prose findings (Funnel L1/L2, Materiality) exempt.

**Filter bloat-shaped findings first.** Review agents bias toward additions. Bar = **sound + correct + elegant** — 2/3 is a signal to look harder, not to mechanically apply.

Two-step triage per finding:

1. **Failure mode real?** Read cited code. Imagined scenario (e.g. null guard on type-guaranteed value) → drop. `confidence: low` → re-derive analysis_chain before accepting.
2. **Remedy bloated?** Real defect + bloated remedy → keep finding, rewrite `fix_prompt` for smallest fix. Real race + "mutex everywhere" = still real race — find the narrow lock. Never drop a real defect over an ugly proposal.

Bloat shapes: defensive checks for impossible cases, abstractions used once, comments restating obvious code, tautological tests, "just-in-case" guards with no identified failure mode. Smallest diff fixing the real defect wins.

Survivors: fix every one regardless of vote count. Single-agent finding = as valid as one from seven; overlap = confidence signal, not priority.

**Use the JSON envelope.** Line-anchored agents return `{findings: [{file, line, severity, title, analysis_chain, fix_prompt, ...}]}`. `analysis_chain` is the auditable artifact: chain that doesn't survive a re-read of cited code → hallucination → drop without re-deriving.

**`fix_prompt` is orchestrator's draft, not reviewer's final word.** Bloat-filter applies to fix prompts: real finding + bloated remedy (mutex everywhere, defensive guard for impossible case, one-shot abstraction) → rewrite before forwarding. Verbatim contract is between **you and the fix agent**, not reviewer and fix agent. Once forwarded, fix agents apply without re-interpretation.

**Parallelize fixes.** Group findings by file. Spawn one fix agent (`sonnet`) per file group, in parallel. Each receives list of post-triage `fix_prompt` strings for its file, in order. Fix agents don't load skills, don't re-derive from original code, don't use `isolation: "worktree"` — work directly on current tree.

**Bugs get TDD.** Non-regression test that fails first, then fix until test passes.

**Re-read your own fixes.** After fix agents return, re-read each changed file. Fix that now reads as bloat in context (guard for impossible case, one-use abstraction, tautological test) → revert. Cheaper than catching it next review.

### Step 3 — Revalidate, verify, and commit

1. **Revalidate fixed findings before tests.** Scope: only `severity: bug | security | performance | error_handling` that entered the fix queue. Suggestions never fixed in loop → never revalidated. Spawn ONE `general-purpose` subagent (`haiku`) receiving `signature`, `file`, `line`, `analysis_chain`, and fix diff per finding. Prompt:

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

   One agent handles all — single Haiku call cheaper than N parallel for a checklist.

2. **`open`/`uncertain` re-enter fix queue.** Build new fix prompts from original `fix_prompt` + one-line note (`previous attempt failed revalidation: <why>`), spawn per-file fix agents, revalidate. Bound: max 3 attempts within single Step 3 call (1 initial + 2 re-fixes). Track `attempts: N` per signature **across outer iterations** — total ≥ 5 → stop fix-looping that finding, surface in Step 5's open-suggestions with failure trail. Only safeguard against outer loop spinning on a stubborn finding.
3. Run test suite.
4. Run linter.
5. Fix failures.
6. Commit describing what + why.

**Why dedicated revalidation.** Tests catch regressions but not pass-by-coincidence fixes (comment next to bug, guard before wrong line, rename suppressing linter warning without fixing logic). Fresh model re-reads against original `analysis_chain` and asks: "failure mode gone?" Cheaper than slipping to next iteration where original reviewer re-derives its chain.

### Step 4 — Loop or stop

**Convergence measured on Step-2-triage survivors, not raw agent output.** Agent that returned only imagined-failure-mode findings (all dropped at triage step 1) counts as converged. Else same imagined findings resurface every iteration, loop never terminates.

**Severity-based convergence.** Every agent meets one of:
- (a) returned `No findings.`, OR
- (b) all findings dropped at Step 2 triage step 1, OR
- (c) all survivors are `severity: suggestion` (line-anchored) **or** carry `[suggestion]` tag (prose: Funnel L1/L2, Materiality).

Suggestions **not auto-fixed in loop** — collected for Step 5, user decides. Auto-fixing every suggestion = the noisy-churn reputation of review tools. Bias toward stopping. Bug/security/performance/error_handling still block convergence.

**Prose agents tag findings.** Funnel L1/L2 and Materiality emit text not JSON → convergence checker can't read `severity:`. Templates require each finding prefixed with `[must]` (blocks convergence) or `[suggestion]` (qualifies under (c)). Orchestrator reads tag, not its own interpretation.

Converged → Step 4.5 (if Dogfood flagged) or Step 5.

Else re-spawn only agents whose non-suggestion findings survived triage OR whose scoped files were touched by a fix.

**Incremental re-review: inject previous iteration's findings.** Re-spawning at iteration N>1 → append `<previous_findings>` block to prompt, listing every finding emitted last iteration with disposition: `fixed` (commit touched cited line), `dropped-by-triage` (reason: imagined/bloat), `unfixed` (still present, re-flag if still applicable). Agents must:
- not re-emit `dropped-by-triage` unless cited code materially changed (re-verify first),
- verify `fixed` actually resolved (catch superficial fixes),
- emit genuinely new findings introduced by fix commit.

Without this, agents re-derive same imagined modes every iteration; loop terminates only because orchestrator keeps dropping — wastes one round-trip per loop.

Continue fixing, committing, re-launching until convergence.

### Step 4.5 — Runtime dogfood gate (3 personas parallel — only if flagged in Step 0)

Static converged. **Dogfood gate = final validation.** Runs only after static convergence so personas test signed-off code, never intermediate fixes rewritten next iteration.

**Spawn 3 personas in parallel** (one turn, 3 Agent calls):

- **Happy-path** — `general-purpose`, **`sonnet`**. Walks documented golden path end-to-end. Recipe execution, no creativity. Sonnet = right cost/quality.
- **Adversarial** — `general-purpose`, **`opus`**. Hunts non-obvious failures: race conditions, refresh mid-flow, broken state machines, permission-boundary crossings, weird input combos. Creativity = deliverable; Opus earns its cost.
- **Regression** — `general-purpose`, **`sonnet`**. Scripted checklist of behaviors that must keep working across releases. Deterministic, low ambiguity.

All 3 load `dogfood` skill, share verify-not-prod / dev-server / authenticate / cleanup scaffolding, differ only in **Exercise focus** (see persona blocks in *Dogfood Agent* template). Independent dev-server instances on different ports. Only one port free → sequential Happy-path → Regression → Adversarial (Adversarial last — hardest findings, absorb cheaper personas' findings first).

#### Merging and triage (orchestrator, no fourth subagent)

All 3 return:

1. **Dedupe.** Same observable bug from 2 personas = one finding. Match by `suspected_file` + one-line summary slug.

2. **Classify in-scope vs out-of-scope.**
   - **In-scope** — bug in code path diff touches, OR bug wouldn't reproduce on `origin/$DEFAULT_BRANCH`. Verify via `git diff --name-only origin/$DEFAULT_BRANCH...HEAD` or call-graph reasoning. **Uncertain → in-scope** (false in-scope = cheap no-op fix attempt; false out-of-scope = ship a bug).
   - **Out-of-scope** — bug in code untouched by diff AND reproduces on `origin/$DEFAULT_BRANCH`. File new issue:
     ```bash
     glab issue create --label ready-for-agent \
       --title "<one-line summary>" \
       --description "Found during dogfood gate on branch <BRANCH> while validating <parent issue or feature>. Suspected file(s): <files>. Reproduces on $DEFAULT_BRANCH — not introduced by this diff. Repro: <steps>. Observed: <…>. Expected: <…>."
     ```
     Out-of-scope doesn't block convergence.
   - **Cleanup-incomplete** — persona's final line starting `cleanup-incomplete:` is itself blocking (no process/data leak allowed). In-scope regardless of bug location.

3. **Fix in-scope, loop back.**
   - Forge `fix_prompt` from textual findings:
     `In {suspected_file}, {one-line summary}. Reproduce by {steps}. Expected {expected}, observed {observed}. Fix the code path so the expected behavior holds.`
   - Group by file, spawn fix agents.
   - Re-run Step 3 gate (tests + linter, commit).
   - **Re-enter Step 2-4 static review on new commits.** Dogfood-driven fix introducing Correctness/Subsystem/Skill violation = regression. 8-iter static cap applies — don't reset for dogfood-triggered re-review.
   - Once static re-converges, **re-run full dogfood gate** (3 personas from scratch — no previous findings injected per Step 4 rule).

4. **File out-of-scope and move on.** They land in queue for AFK or human triage. Not your problem for this branch.

#### Convergence

All 3 personas return exactly `No findings.` (or only out-of-scope, filed) AND every persona's final line is `cleanup-complete:`.

#### When to bail (orchestrator judgment, no fixed cap)

Loops that look like convergence but aren't = how overnight runs burn hours producing nothing. Bail into non-convergence failure family on any signal:

| Signal | Why "not converging" |
|---|---|
| Same finding (matched on `suspected_file` + summary slug) reappears unchanged after fix attempt — survives full loop through static + dogfood | Fix didn't fix. 2nd occurrence = stop. |
| Round N+1 produces NEW finding whose cited line is inside round N's fix commit | Fixes introducing regressions faster than they resolve. |
| Round N has ≥ in-scope count vs N-1, twice consecutively | Regressing on count. |
| Static hits 8-iter cap while fixing dogfood findings | Already `failed-by-agent` from static — propagate. |

Bail → finalize as `failed-by-agent` (family: non-convergence) with last 3 rounds of merged findings + bail signal + diff stats.

**Dogfood findings themselves never produce `failed-by-agent`.** In-scope fixed; out-of-scope → new issue. Only `failed-by-agent` from this phase = non-convergence or static-cap propagation.

### Step 5 — Final output

**If invoked from AFK** (instruction string starts with `AFK invocation`): return exactly ONE single-line token as last assistant text. Nothing else.

- Static converged, MR ready: `READY_FOR_MR iter=<N> findings_fixed=<C>`
- 8-iter cap reached: `READY_FOR_FAIL_LABEL iter=8 dump=<absolute path to findings-dump>`

Tokens named `READY_FOR_X`, not `CONVERGED`/`DONE`/`CAP_HIT`/`STOP`, intentionally. Terminal-sounding words trip the layer above into "task complete, stop" even when surrounding instructions say otherwise. `READY_FOR_X` points at next action (open MR, or apply fail-label and move to next issue). **Neither token signals end-of-run.** End-of-run owned exclusively by AFK Phase 1 returning zero issues.

From AFK, this skill runs inside a runner subagent — AFK spawns a L2 Agent to host this skill, so "emit token, nothing else" terminates the subagent's turn cleanly without leaking recency into AFK's orchestration. You don't need to know that; just emit the right token.

Surviving `severity: suggestion` NOT surfaced to AFK — noise for auto-merge. Worth keeping → orchestrator (or separate /afk pass) files as `ready-for-agent` from diff comments later. Don't append to token.

**Otherwise** (direct user invocation): short summary in conversation. No file artifact.

Format:
- Tier: trivial / lite / full
- Iterations: N (converged on K)
- Agents per iteration: N₁ → N₂ → … (e.g. 12 → 4 → 0)
- Findings fixed: total count, grouped by agent
- Non-regression tests added: one bullet per bug (description → test name)
- **Open suggestions (not auto-fixed):** one bullet per surviving `severity: suggestion`, `file:line` + one-line rationale. Empty section if none.

≤15 lines + suggestions list. Diff is source of truth; summary just locates it.

---

## Context verification protocol

Inject verbatim into every line-anchored prompt (Correctness, Subsystem, Tests, Skill, CLAUDE.md Compliance, Occam Razor). Funnel L1/L2 and Dogfood don't need it (structural/empirical, not failure-mode-inferred).

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

Agents anchoring findings to `file:line` emit JSON. Carries auditable reasoning chain + fix prompt consumed verbatim by per-file fix agent — no re-interpretation between finding and fix.

Funnel L1/L2 stay textual (structural, not file:line-anchored). Dogfood keeps its own contract (`cleanup-complete` line load-bearing for convergence).

Zero findings → respond exactly `No findings.` (textual, not JSON — preserves convergence signal Step 4 reads).

Else single JSON object, no markdown, no preamble:

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

**Field rationales:**

- `analysis_chain` — auditable trace. Chain not surviving re-read of cited code = hallucination; Step 2 drops without re-reading diff.
- `fix_prompt` — consumed verbatim by per-file fix agents. No re-interpretation.
- `signature` — dedup key `<file>:<line>:<failure-mode-slug>`. Controlled vocabulary when applicable: `panic-on-none` · `missing-validation` · `injection-sql` · `injection-shell` · `injection-template` · `missing-tenant-filter` · `secret-leak-log` · `unawaited-promise` · `dropped-future` · `race-shared-state` · `missing-timeout` · `unbounded-retry` · `path-traversal` · `toctou` · `wrong-role-check` · `missing-permission-check` · `n-plus-one` · `missing-transaction` · `replay-attack` · `session-fixation` · `zero-callers-dead` · `single-caller-inlinable` · `unused-param` · `derivable-default` · `redundant-overload`. Else free 3-5 kebab-token slug. Step 2 dedup matcher: same file, line ±3, same slug OR title-token Jaccard ≥ 0.6.
- `confidence` — `high|medium|low`, separate from severity. `severity: bug, confidence: low` survives Step 2 only with airtight analysis_chain. Low-confidence security findings still warrant 2nd look — don't merge with severity.
- `why_tests_dont_cover` — forces agent to grep test suite before emitting. Existing tests cover failure mode → finding = test, not bug → drop. Proof you looked.
- `suggested_regression_test` — consumed by fix agent for TDD step (Step 2 mandates non-regression test for bugs). Pre-articulating saves re-derivation.
- `minimum_fix_scope` — anti-bloat at emission, not just triage. Can't state small scope → finding probably not ready.
- `inspected` — audit surface. `finding.file` not in `inspected.files` → agent claimed insight without reading → drop.

`why_tests_dont_cover`, `suggested_regression_test`, `minimum_fix_scope` apply to `bug`/`security`/`performance`/`error_handling`. `suggestion` → `null`.

Severity: `bug` | `security` | `performance` | `error_handling` | `suggestion`. Suggestions usually dropped at Context verification step 1.

Confidence: `high` | `medium` | `low`. Default `high` only when analysis_chain survives independent re-derivation.

---

## Agent Prompt Templates

Every agent follows: role → context → task → constraints → output format.

**Line-anchored templates (Skill, Tests, Subsystem, Correctness, CLAUDE.md Compliance, Occam Razor) require Context verification + Output format blocks appended verbatim at the bottom before spawning.** Funnel L1/L2, Materiality, Dogfood self-contained — don't append.

**Model assignment.** Heavy reasoning → `sonnet`, structural/textual lifts → `haiku`. Orchestrator (you) stays on session model.

| Agent | Model | Rationale |
|---|---|---|
| Pre-triage (Step 0.5) | `haiku` | classification only |
| Revalidation (Step 3) | `haiku` | checklist over a small structured input |
| Funnel L1, Funnel L2 | `haiku` | structural reasoning, short prompts |
| Occam Razor | `sonnet` | grep is mechanical, but "is this default derivable from the caller?" needs reading call sites with judgement |
| Correctness | `sonnet` | bug-hunting needs depth |
| matt-review | `sonnet` | two-axis review (Standards + Spec) — fans out 2 internal sub-agents; spec-drift detection needs Sonnet's reasoning |
| Subsystem (billing, auth, schema-migration, webhook, RBAC, multi-tenant, cron) | `sonnet` | domain reasoning |
| Tests | `sonnet` | coverage gaps need code understanding |
| Skill Agent — heavy (security-defensive, language-rust, language-typescript, language-swift, react, react-native, database, drizzle-orm, frontend, web-performance, api-design, simplify, matt-improve-codebase-architecture) | `sonnet` | dense rules, code-level violations |
| Skill Agent — light (i18n, tailwind, ui, ui-animations, ui-ux, make-interfaces-feel-better, web-interface-guidelines, shadcn, coss, vue, tanstack-query, tanstack-start-best-practices, better-auth-best-practices, better-result-adopt, docker, kubernetes, zod) | `haiku` | mostly style/usage rules, low ambiguity |
| coding-standards (umbrella + 4 sub-skills) | `sonnet` | judgement-heavy |
| claude-md-materiality | `haiku` | yes/no classification, no fix to derive |
| claude-md-compliance | `sonnet` | rule walk requires judgement and code-level matching |
| Dogfood — Happy-path | `sonnet` | recipe execution end-to-end, no creativity needed |
| Dogfood — Adversarial | `opus` | creative failure-mode hunting, state reasoning |
| Dogfood — Regression | `sonnet` | deterministic checklist against documented behaviors |
| General Opus 4.7 | `opus` | generalist, by design |
| Fix agents (Step 2) | `sonnet` | already specified |

**Shared diff file.** Step 0.2 wrote full diff to `/tmp/review-diff-{branch}.patch`. Templates use `{diff_file}`. Agents grep/filter patch rather than re-running `git diff`. Agent file-set with uncommitted files → reads directly per Step 0.

**Trust-boundaries placeholder.** Line-anchored templates use `{trust_boundaries}` for comma-separated list from Step 0 (e.g. `secrets, network, auth`) or literal `none`. Substitute before spawning; never leave placeholder literal.

**Previous findings injection (iteration N>1 only).** Step 4 incremental re-review builds `{previous_findings_block}` per agent. At iteration 1, placeholder = empty string — no header for empty block.

Two block shapes — match the agent's output contract. Dogfood never receives previous findings (empirical output, fresh each run).

**Shape A — line-anchored agents (Correctness, Subsystem, Tests, Skill):**

```
## Previous findings (iteration N-1)

You emitted these last iteration. Use to avoid re-deriving.

- signature: <file:line:slug> — title — disposition: fixed | dropped-by-triage (reason) | unfixed — attempts: N
  ...

Rules:
- Match by `signature`, not line number. Lines shift after fixes; `<file>:<slug>` is stable. New analysis on same `<file>:<slug>` → same finding.
- `attempts` = fix-and-revalidate cycles survived. Orchestrator escalates at 5 — don't pad analysis to claim progress; if hallucination keeps coming back, right move is `dropped-by-triage` next round, not another fix.
- `fixed`: verify new code actually resolves failure mode. Superficial fix (comment added, code re-arranged but bug remains) → re-emit with same signature so orchestrator recognises repeat-offender.
- `dropped-by-triage`: don't re-emit unless cited code materially changed. If yes, re-verify first.
- `unfixed`: re-emit only if failure mode still applies.
- Emit genuinely new findings from fix commit with fresh signatures.
```

**Shape B — prose agents (Funnel L1, Funnel L2, Materiality):**

```
## Previous findings (iteration N-1)

You emitted these last iteration. Use to avoid re-deriving.

- scope (file / module / claim) — your previous one-line summary — disposition: addressed | rejected-by-orchestrator (reason) | still-stands
  ...

Rules:
- `addressed`: orchestrator accepted, commit reflects it. Re-emit only if commit didn't actually resolve concern (e.g. you said "delete this module" and only export changed).
- `rejected-by-orchestrator`: judged as bloat / out-of-scope / over-reach. Don't re-emit unless cited scope materially changed.
- `still-stands`: accepted but didn't act this iter (often `[suggestion]`). Re-emit verbatim only if scope unchanged. Diff moved on → re-evaluate from scratch.
- Emit genuinely new findings from fix commit with `[must]` / `[suggestion]` tag.
```

### Funnel L1

```
You review code for necessity and completeness.

Read CLAUDE.md for conventions. Read CONTEXT.md for domain terms, roles, and invariants.

Read the diff from {diff_file}, filtered to {file_list}. For every role, type, or constant referenced in the diff, grep the codebase to verify it exists.

Your task: does each piece of code need to exist? Does the framework or a dependency already solve this? Is there a simpler approach? What's missing?

## What NOT to flag
- Style, naming, formatting — that's other agents' job
- Specific bug claims with line numbers — Correctness owns those
- Test coverage gaps — Tests owns those
- "Consider extracting X for reusability" without a concrete second caller in the diff

Stay within these files: {file_list}

{previous_findings_block}  ← injected at iter N>1 only; else empty

## Output format

Each finding starts with `[must]` (the code as-is shouldn't ship — concrete necessity or completeness gap) or `[suggestion]` (worth considering but the change can ship without it). Untagged finding = invalid.

Example: `[must] The new helpers in src/utils/fmt.ts duplicate the formatting passes already done in src/io/render.ts — consolidate into the existing module instead of adding a second one.`

Zero findings → say exactly: "No findings."
```

### Funnel L2

```
You review code for scope reduction.

Read CLAUDE.md for conventions.

Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

Your task: find the smallest perimeter. Can files be inlined? Can queries be merged? Can wrapper types be removed? Every abstraction must justify itself through concrete usage.

## What NOT to flag
- Naming or style improvements — out of scope
- New abstractions that the diff doesn't already introduce — only flag existing abstractions that don't pay rent
- Anything requiring a file-level rewrite the user didn't ask for — propose a smaller perimeter, not a refactor of the whole module
- Defensive "factor this out in case we need it later" reasoning — concrete current usage only

Stay within these files: {file_list}

{previous_findings_block}  ← injected at iter N>1 only; else empty

## Output format

Each finding starts with `[must]` (the diff actively carries unused/wasted scope that should be reduced before shipping) or `[suggestion]` (a smaller perimeter is possible but the current shape is defensible). Untagged finding = invalid.

Example: `[must] BillingProvider wraps only the existing useBilling() hook — inline the hook into its sole caller and delete the provider.`

Zero findings → say exactly: "No findings."
```

### Skill Agent (coding-standards, coding-standards:*, security-defensive, language-*, framework/lib, simplify, matt-improve-codebase-architecture)

```
You enforce a single skill's rules on changed code.

Read CLAUDE.md for conventions. Then load the skill `{skill_name}` via the Skill tool.

Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

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

{previous_findings_block}  ← injected at iter N>1 only; else empty
```

### Tests Agent

```
You review test quality and coverage.

Read CLAUDE.md for conventions. Load the skills `testing` and `matt-tdd` via the Skill tool.

Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

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

{previous_findings_block}  ← injected at iter N>1 only; else empty
```

### Subsystem Agent (billing-subsystem, auth-subsystem, schema-migration-subsystem, etc.)

```
You review changed code under a specific domain frame — NOT a skill. The frame primes you to remember domain-specific failure modes a generic correctness lens misses.

You are framed as the **{subsystem_name}** reviewer. The failure modes you should hunt: {failure_modes}.

Do NOT attempt to load a skill named "{subsystem_name}" — this is a framing label, not a registered skill. Read CLAUDE.md for conventions.

Read diff from {diff_file}, filtered to {file_list}. Read full files as needed. Grep the codebase for related call sites, schemas, and tests when a finding's correctness depends on them.

This diff crosses these trust boundaries: {trust_boundaries}. Your subsystem failure modes already overlap with one of them by construction; if other boundaries are present, weigh interactions (e.g. an auth-subsystem review on a diff that also crosses `network` should watch for token leakage in outbound calls, not just session logic).

Your task: walk the diff and, for each listed failure mode, ask whether the change plausibly introduces or amplifies it. Report only concrete instances — never a generic "consider adding handling for X" without a specific line that exhibits the gap.

## What NOT to flag
- Generic correctness issues outside your failure-mode list — the Correctness agent owns those
- Style or naming concerns — out of scope
- "Defense in depth" suggestions when the primary defense in the diff is already adequate
- Theoretical attack chains requiring multiple unlikely preconditions to land
- Pre-existing failure modes in unchanged code — only what the diff introduces or amplifies counts

Stay within these files: {file_list}

{previous_findings_block}  ← injected at iter N>1 only; else empty
```

### Correctness Agent

```
You hunt bugs.

Read CLAUDE.md for conventions.

Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

Trust boundaries crossed: {trust_boundaries}. For each boundary, apply failure modes from Step 0's trust-boundaries table ("Failure modes" column) as prioritized lens — more likely than generic bugs. `none` → focus generic correctness. Subsystem agent spawned for a boundary → it owns depth there; you skim for cross-cutting interactions only.

Task: check implementation vs apparent intent. Bugs, missing edge cases, race conditions, incomplete error handling, logic gaps. Permission checks → verify role is correct for the operation.

## What NOT to flag
- Style, naming, formatting — other agents own those
- "Consider adding error handling" on code that already propagates errors (e.g. `?` in Rust, awaited Promises with downstream `.catch` or top-level rejection)
- Defensive null checks on values the type system already proves non-null
- Edge cases requiring conditions that the calling contract already prevents (read the call sites before flagging)
- Theoretical race conditions without a concrete two-thread interleaving demonstrating the bug

Stay within these files: {file_list}

{previous_findings_block}  ← injected at iter N>1 only; else empty
```

### Matt Review Agent (matt-review)

Prose output — Shape B for `{previous_findings_block}`. No `{trust_boundaries}`. No Context verification or JSON Output format blocks appended (prose by design).

```
Two-axis review (Standards + Spec). Standards = does code follow documented conventions? Spec = does code faithfully implement originating issue/PRD/spec?

Load skill `matt-review` via Skill tool, follow its full process — pin fixed point, identify spec source, identify standards sources, spawn both sub-agents in parallel, aggregate.

Fixed point: `$DEFAULT_BRANCH`. Diff: `git diff "$DEFAULT_BRANCH"...HEAD`. Commits: `git log "$DEFAULT_BRANCH"..HEAD --oneline`.

Read diff from {diff_file}. Read CLAUDE.md / AGENTS.md / CONTEXT.md / docs/adr/ for standards sources. Spec source: scan commits for issue refs (`#123`, `Closes #45`, GitLab `!67`), resolve via project's issue tracker. None discoverable → skip Spec axis, note "no spec available".

## What NOT to flag
- Findings covered by Correctness / Skill / Funnel / Subsystem — focus on what only two-axis lens catches: spec drift (missing asked-for behavior, scope creep), high-level standards not enforced by tooling.
- Linter/formatter-enforced style — note as machine-enforced, move on.
- Pre-existing violations in unchanged code.

Stay within these files: {file_list}

{previous_findings_block}  ← injected at iter N>1 only; else empty

## Output format

Two sections — `## Standards` and `## Spec` — verbatim or lightly cleaned from sub-agents. Each finding starts with `[must]` (concrete violation/spec drift that must be addressed) or `[suggestion]` (ship-able without). Untagged finding = invalid.

Example:
- `[must] Spec asked for "rate-limit auth endpoints to 5 req/min" (issue #142) — diff adds endpoints but no rate limiter wired up.`
- `[suggestion] CONTEXT.md describes domain term as "subscriber" but new code uses "user" — align terminology.`

Spec axis skipped → emit `## Standards` only; note "Spec axis skipped — no spec available" under `## Spec`.

Both axes zero findings → say exactly: "No findings."
```

### Occam Razor Agent

```
Audit the call graph of code the diff introduces/modifies. For every exported function/method/type/constant the diff touches, ask: do callers justify the shape?

Read CLAUDE.md for conventions. Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

Trust boundaries crossed: {trust_boundaries}. Doesn't change method — only means dead code on auth/billing path has same severity as elsewhere (don't downgrade "it's only a wrapper").

## Method (mechanical, in order)

Scope: **exported** functions/methods/types/constants the diff introduces *or* whose signature it modifies. Pre-existing exports with unchanged signatures are out of scope unless diff *adds* a new call site (you're auditing the caller, not the export).

For each in-scope symbol:

1. **Enumerate callers.** Grep whole repo (not just diff slice) for the identifier. Count distinct call sites — direct calls + re-exports forwarding unchanged. List every site with file:line + literal arg-tuple.
2. **Bin by caller count:**
   - `0 callers` → emit `zero-callers-dead`. `severity: bug`.
   - `1 caller` AND function body < 20 lines → emit `single-caller-inlinable`. `severity: suggestion` (wrapper may be deliberate for testability/clarity; user decides at Step 5).
   - `≥ 2 callers` → step 3.
3. **Walk each formal param.** For every param, list value each caller passes:
   - No caller passes non-default → emit `unused-param`. `severity: suggestion`.
   - Every caller computes default's input *before* calling, function uses it only to reconstruct what caller already had → emit `derivable-default`. `severity: suggestion`.
4. **Cross-check siblings.** Diff introduces ≥2 exported functions whose bodies share ≥80% lines and whose callers are disjoint → emit `redundant-overload`. `severity: bug` (diff is the source — fixing later harder than not introducing).

Use controlled-vocabulary slugs for `signature`. Step 2 dedup collapses cross-agent overlap.

## What NOT to flag

- Internal (non-exported) helpers — `simplify` and Funnel L2 own those. Stay on exports.
- Public API surfaces with external consumers — `index.ts` re-exports, framework lifecycle hooks, plugin contracts, package `exports` maps, JSDoc `@public`. 0-caller there = external callers exist, not dead.
- Test helpers — tests legitimately scope helpers per-test-file. Apply Context verification "test context" question first.
- Pre-existing 1-caller functions in unchanged code — only what diff introduces or whose signature it changes counts.
- Truly generic utilities at 1 caller — `pick<T, K>`, `clamp(n, min, max)` with one current consumer are not inlinable; shape *is* contract.
- Bodies < 5 lines where name is more informative than body — inline cost (loss of name) exceeds wrapper cost.
- Params looking unused but required by interface/trait/abstract class — signature fixed by contract. Grep interface before emitting `unused-param`.
- Intentional-comment signals: `// keep: testability`, `// future caller in <branch>`, `// API surface — do not inline`. Context verification "intentional comments" question must specifically match.

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

{previous_findings_block}  ← injected at iter N>1 only; else empty
```

### Materiality Agent (claude-md-materiality)

```
Check whether project's AI instructions are stale vs the diff.

Read `CLAUDE.md` and `AGENTS.md` at repo root if they exist. Read diff from {diff_file}.

ONE question: does this diff make any line in CLAUDE.md/AGENTS.md misleading or incomplete? High-materiality triggers (orchestrator spawns you only when at least one fires — confirm/refute):
- Package manager change (`packageManager` field changed, OR lockfile family added/removed)
- Test framework swap (NEW `vitest.config.*` / `jest.config.*` / `playwright.config.*`, OR existing one removed — not edited)
- Build tool added/removed (new `vite.config.*` / `webpack.config.*` / `rollup.config.*` / `next.config.*`, OR existing one deleted)
- `tsconfig.json` change to `module`, `moduleResolution`, OR new top-level alias prefix in `paths`
- New top-level dir (repo root or monorepo workspace root)
- New required env var (additions in .env.example — not removals, not renames)
- CI/CD workflow file added/removed (not edited)
- Major dep upgrade changing API surface (React 18→19, Next 14→15)

Low materiality (don't flag): bug fixes, feature additions using existing patterns, CSS-only, dep patch bumps, internal refactors, tsconfig `target`/`lib`/`strict` flag flips, CI tweaks without file add/remove, path-alias additions under existing root.

## What NOT to flag
- Generic "consider updating docs" — only concrete claims that became false
- Missing CLAUDE.md when none exists — flag staleness, not absence (unless diff is new scaffold)
- Wording improvements — your job is staleness, not editing

Stay within these files: {file_list} plus CLAUDE.md / AGENTS.md.

## Output format

CLAUDE.md/AGENTS.md unchanged but diff high-materiality → one finding per stale claim. Each starts with `[must]` (stated fact now factually wrong — e.g. "we use npm" after pnpm migration) or `[suggestion]` (vague convention drifted but didn't break — e.g. "tests live in __tests__" after moves to colocated `.test.ts`). Then: file, line/section, what the diff makes false, one-sentence correction. Untagged finding = invalid.

Example: `[must] CLAUDE.md line 14: "Run npm install" is now wrong — diff switched to pnpm. Replace with "Run pnpm install".`

Zero findings → say exactly: "No findings."
```

### CLAUDE.md Compliance Agent

```
Enforce project's own conventions from CLAUDE.md / AGENTS.md.

Read every `CLAUDE.md` and `AGENTS.md` at repo root + each monorepo workspace root. List every rule/convention/constraint — commit message format, file layout, naming, banned imports, mandatory patterns, "we always do X" / "we never do Y".

Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

For each rule, scan changed lines for violations. Rule fires only when diff introduces/modifies code that breaks it — pre-existing violations in unchanged code out of scope.

Trust boundaries crossed: {trust_boundaries}. Rules touching these (auth conventions, secret-handling) take precedence.

## What NOT to flag
- Rules from other agents' skills (language-typescript, security-defensive, etc.) — they own their domains
- Inferences from "best practices" not literally stated — only flag what doc says
- Pre-existing violations in unchanged code
- "We tend to..." mentions without a rule (not "you must...")

Stay within these files: {file_list}

{previous_findings_block}  ← injected at iter N>1 only; else empty
```

### Dogfood Agent (3 personas, post-static-convergence)

One shared template. 3 personas in parallel, same scaffolding (verify-not-prod, dev-server, authenticate, cleanup), differ only in **Exercise focus** (Step 4). Orchestrator substitutes `{persona}` and `{persona_focus}` — see per-persona blocks below template.

```
You are the {persona} dogfood persona — one of three runtime validators (happy-path, adversarial, regression) running in parallel against the same changed surface. You exercise a user-facing surface to find runtime bugs static review can't catch.

Load the `dogfood` skill via the Skill tool. Read the project's CLAUDE.md for run instructions, dev credentials, and conventions.

Changed surface(s) to exercise: {file_list}
Your dedicated dev-server port: {port}

Run in this exact order:

1. **Verify you are NOT in production.** Read `.env`/`.env.local`, check the DB connection string, look for `NODE_ENV`/`APP_ENV`. If the active database, API host, or any service URL looks like a real production system, **abort** and emit one finding: `refused to run: target appears to be production`. Never mutate data on non-dev.

2. **Start the dev server on your dedicated port with PID capture and a cleanup trap.** Find the command in `package.json` scripts, Makefile, justfile, or CLAUDE.md. The three personas run in parallel, so each MUST bind to its assigned `{port}` — read the project's dev-server docs for the env var or flag that overrides the default port (commonly `PORT={port}` or `--port {port}`). Use `setsid` so the server gets its own process group:

   ```bash
   PORT={port} setsid <run-command> &
   SERVER_PID=$!
   SERVER_PGID=$(ps -o pgid= "$SERVER_PID" 2>/dev/null | tr -d ' ')

   cleanup() {
     if [ -n "$SERVER_PGID" ]; then
       kill -TERM -"$SERVER_PGID" 2>/dev/null; sleep 1; kill -KILL -"$SERVER_PGID" 2>/dev/null
     elif [ -n "$SERVER_PID" ]; then
       kill -TERM "$SERVER_PID" 2>/dev/null; sleep 1; kill -KILL "$SERVER_PID" 2>/dev/null
     fi
     lsof -ti :{port} 2>/dev/null | while IFS= read -r pid; do
       [ -n "$pid" ] && kill -KILL "$pid" 2>/dev/null
     done
   }
   trap cleanup EXIT INT TERM
   ```

   If `setsid` is unavailable, the fallback `<run-command> &` puts the child in the agent's own process group — negative-PGID kill would terminate the agent. Set `SERVER_PGID=""`, kill `SERVER_PID` directly, and rely on the port/pgrep checks to catch escaped watchers. Note the limitation in the "How I authenticated" output section.

   Wait for readiness (poll `{port}`, watch for a "ready" line).

3. **Authenticate.** Check CLAUDE.md for test credentials first. Otherwise in order: seed script → signup flow → magic-link / dev auth bypass → direct DB insert (confirmed-dev DB only). Use a unique identifier that encodes your persona so the three parallel runs don't collide:
   `email = afk-dogfood-{persona}-<YYYYMMDD-HHMMSS>-<rand>@example.invalid`. Record everything created — tables, row ids, unique identifier — to `/tmp/dogfood-created-{persona}.txt`. Next run of your persona reads this list; you must too.

4. **Exercise — {persona_focus}**

5. **Capture evidence.** Per bug: one-line summary, repro steps, observed vs expected, any console/network/server-log artifact, `suspected files:` (the orchestrator groups fix agents by file — attribution is required).

6. **Cleanup is mandatory** — bugs, errors, crashes, anything. The trap fires; then delete every row in `/tmp/dogfood-created-{persona}.txt` (report exact counts: `deleted: 3 users, 7 sessions`). Verify your port is free (`lsof -i :{port}` returns nothing) and no orphans (`pgrep -f <server-command>` returns nothing). List uncleanable items under `cleanup-incomplete` — never hide them.

Output (the **first line** is the convergence signal):
- Zero bugs: line 1 is exactly `No findings.`
- Otherwise: line 1 is `N findings.`, then a flat list. Every entry MUST include `suspected files:`.
- A short "How I authenticated" note for the next run of this persona.
- Final line: `cleanup-complete: server stopped (PID/PGID killed and verified), N rows deleted` OR `cleanup-incomplete: <what's left>`.
```

**Per-persona Exercise focus** (substitute into `{persona_focus}` in Step 4):

- **Happy-path** — *Drive the new code path end-to-end via the actual interface (browser for UI, terminal for CLI, HTTP for API), following the documented or obvious golden path. The user signing up, the form submitting, the file uploading, the data displaying. No creativity, no destruction — execute the recipe and verify each step lands. If the documented happy path is broken, that is your headline finding.*

- **Adversarial** — *Assume a hostile or careless user. Push every edge that the diff's code path could possibly hit: empty/oversized/malformed inputs, copy-paste of multi-line text into single-line fields, rapid double-clicks, race conditions between concurrent actions, refresh mid-flow, browser back/forward, opening the same flow in two tabs, expired sessions, permission-boundary crossings (try to read/write resources you don't own), uploading files of the wrong type, network drops mid-request. Your deliverable is the failure mode a recipe-following test would never find.*

- **Regression** — *Walk a scripted checklist of behaviors that must keep working across releases, in this order: (a) login/logout flows, (b) the project's documented "core flows" if any are listed in CLAUDE.md or README, (c) any feature listed in the last 5 closed MRs touching files adjacent to the diff (`git log --oneline -5 -- <dir of changed files>`), (d) any behavior the diff's commits mention preserving in their messages. For each checklist item, the question is binary: does it still work as it did before this branch? If yes, no finding. If no, that's a regression — flag it with the specific MR or commit that documents the prior behavior so the orchestrator can confirm in-scope vs out-of-scope.*
