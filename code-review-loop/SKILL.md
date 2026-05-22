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

**Always spawn** — every entry below MUST fire on every Full-tier run. Tick through this list explicitly before moving on; an unbulleted prose form is too easy to skim past and silently drop an agent:

- [ ] Funnel L1
- [ ] Funnel L2
- [ ] Occam Razor
- [ ] Correctness
- [ ] Tests
- [ ] simplify
- [ ] matt-improve-codebase-architecture
- [ ] matt-review
- [ ] thermo-nuclear-code-quality-review
- [ ] security-defensive
- [ ] coding-standards (umbrella)
- [ ] coding-standards:design
- [ ] coding-standards:errors
- [ ] coding-standards:hygiene
- [ ] coding-standards:style

**Why Occam Razor sits alongside the funnel.** L1 ("must exist?") and L2 ("smallest perimeter?") are prose, evaluated face-value, neither walks the call graph. Occam Razor is the mechanical check: for every exported symbol the diff introduces/modifies, enumerate call sites, prove shape pays rent. Past misses: 0-caller function, 1-caller wrapper, defaults reconstructed from caller's known values.

**Spawn when `CLAUDE.md` exists** (repo root or any monorepo workspace root): **claude-md-compliance** — reads file(s), extracts rules, walks diff for violations introduced. Distinct from claude-md-materiality (doc staleness); compliance flags code breaking rules. Required: most repos document conventions no language/framework skill checks for. Multiple CLAUDE.md → one agent handles all.

**Spawn by extension:** `.ts`/`.tsx` → language-typescript, `.rs` → language-rust, `.swift` → language-swift, `.vue` → vue.

**Spawn by imports** (one agent per detected skill):
`better-result-adopt`, `database`, `docker`, `drizzle-orm`, `i18n`, `kubernetes`, `react`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui-animations`, `vue`, `zod`

**Spawn by surface touched.** UI/frontend skills with no import signal — they apply to categories of code. Trigger by file-set.

**File-set** = same unified set (`"$DEFAULT_BRANCH"...HEAD` ∪ unstaged ∪ staged ∪ untracked), minus Step 0.5 APPROVED files.

| Trigger (path globs) | Skill agents | What they review |
|---|---|---|
| `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `app/**/page.*`, `pages/**`, `src/routes/**`, server actions | **ui-ux**, **frontend**, **make-interfaces-feel-better**, **web-performance** | design quality, visual hierarchy, polish, perf budgets, layout discipline, component shape |
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

**Data-capture marker — emit FIRST, before any Task spawn.** On its own line in your assistant text:

```
<crl:run_start tier="<lite|full>" trust_boundaries="<csv|none>" />
```

Substitute values resolved in Step 0. The post-process at Step 5 pairs this with `<crl:run_end>` to bound the run. Don't emit it elsewhere — only here, once per run.

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

**Data-capture marker + post-process — fire FIRST, before AFK token or summary.** In the SAME assistant turn:

```
<crl:run_end outcome="<converged|capped|aborted>" iters="<N>" />
```

Then a Bash call (still same turn, before the terminal token line for AFK or before the summary for direct mode):

```bash
node "$HOME/.claude/skills/code-review-loop/process-run.js"
```

Script is idempotent — scans recent transcripts for unprocessed `<crl:run_start>`/`<crl:run_end>` pairs, writes one raw-data report per pair to `~/.claude/data/code-review-loop/runs/`. Already-processed pairs are skipped. Failure is non-fatal: just rerun manually. **Do not pass any args** — the script auto-detects.

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

Agents anchoring findings to `file:line` emit a **lean JSON envelope** — enough for Step 2 triage and verbatim fix-prompt forwarding, nothing more. Verbose audit trails (`inspected` file lists, separate test-coverage prose, redundant scope restatements) multiply across a 12-agent fan-out and are the largest controllable drain on the orchestrator's context. Keep the payload tight.

Funnel L1/L2 stay textual (structural, not file:line-anchored). Dogfood keeps its own contract (`cleanup-complete` line load-bearing for convergence).

Zero findings → respond exactly `No findings.` (textual, not JSON — preserves convergence signal Step 4 reads).

Else **respond with ONLY the JSON object**: first character `{`, last character `}`. No prose preamble, no reasoning narration, no markdown fence. The reasoning belongs in `analysis_chain` and nowhere else — a walkthrough before the JSON is pure wasted context across a 12-agent fan-out.

```json
{
  "findings": [
    {
      "file": "src/auth/session.rs",
      "line": 42,
      "severity": "bug",
      "confidence": "high",
      "signature": "src/auth/session.rs:42:unwrap-on-user-header",
      "title": "unwrap() on user-supplied header",
      "analysis_chain": [
        ".unwrap() on req.headers.get(\"X-Token\") — Option, missing header panics the handler",
        "X-Token is attacker-controlled",
        "no caller-site guard"
      ],
      "fix_prompt": "In src/auth/session.rs line 42, replace .unwrap() with .ok_or(AuthError::MissingToken)? to propagate instead of panic. Add a non-regression test: POST /session without X-Token expects 401, not 500."
    }
  ]
}
```

**Field rationales:**

- `analysis_chain` — auditable trace, **≤ 3 bullets, each ≤ 25 words**. Step 2 re-reads the cited code; a chain that doesn't survive that re-read = hallucination → dropped. This is the *only* reasoning channel — there is no separate prose section.
- `fix_prompt` — consumed verbatim by per-file fix agents; state the concrete line and concrete replacement. For `bug`/`security`/`performance`/`error_handling`, **append the non-regression test to add** in the same string (`Add a test: …`) — the fix agent's TDD step reads it from here.
- `signature` — dedup key `<file>:<line>:<failure-mode-slug>`. Controlled vocabulary when applicable: `panic-on-none` · `missing-validation` · `injection-sql` · `injection-shell` · `injection-template` · `missing-tenant-filter` · `secret-leak-log` · `unawaited-promise` · `dropped-future` · `race-shared-state` · `missing-timeout` · `unbounded-retry` · `path-traversal` · `toctou` · `wrong-role-check` · `missing-permission-check` · `n-plus-one` · `missing-transaction` · `replay-attack` · `session-fixation` · `zero-callers-dead` · `single-caller-inlinable` · `unused-param` · `derivable-default` · `redundant-overload`. Else free 3-5 kebab-token slug. Step 2 dedup matcher: same file, line ±3, same slug OR title-token Jaccard ≥ 0.6.
- `confidence` — `high|medium|low`, separate from severity. `severity: bug, confidence: low` survives Step 2 only with airtight analysis_chain. Low-confidence security findings still warrant 2nd look — don't merge with severity.

Severity: `bug` | `security` | `performance` | `error_handling` | `suggestion`. Suggestions usually dropped at Context verification step 1.

Confidence: `high` | `medium` | `low`. Default `high` only when analysis_chain survives independent re-derivation.

**Two checks done silently — discipline kept, fields dropped** (were `why_tests_dont_cover` / `inspected`):

- *Test coverage* — before emitting a `bug`/`security`/`performance`/`error_handling` finding, grep the test suite. A test already exercising this exact failure mode means it's covered → drop the finding.
- *Read what you flag* — only flag a file you have actually read in full this session. A finding inferred from the diff slice without reading the implementation is a hallucination → don't emit it.

---

## Agent Prompt Templates

Each template lives in its own file under `templates/`. The runner reads only the templates for the agents Step 0 detected — parallel reads, ~zero wall-time cost. Substitute placeholders before passing as the Agent's `prompt`.

**Line-anchored templates** (Skill, Tests, Subsystem, Correctness, CLAUDE.md Compliance, Occam Razor) require Context verification + Output format JSON blocks appended verbatim before spawning. **Funnel L1/L2, Materiality, Matt Review, Dogfood** are self-contained — don't append.

**Model assignment.** Heavy reasoning → `sonnet`, structural/textual lifts → `haiku`. Orchestrator (you) stays on session model.

| Agent | Template | Model | Output | Trust boundaries | Prev-findings shape |
|---|---|---|---|---|---|
| Pre-triage (Step 0.5) | `templates/pre-triage.md` | haiku | JSON | — | — |
| Revalidation (Step 3) | `templates/revalidation.md` | haiku | JSON | — | — |
| Funnel L1 | `templates/funnel-l1.md` | haiku | prose tagged | — | B |
| Funnel L2 | `templates/funnel-l2.md` | haiku | prose tagged | — | B |
| Occam Razor | `templates/occam-razor.md` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Correctness | `templates/correctness.md` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| matt-review | `templates/matt-review.md` | sonnet | prose Standards/Spec | — | B |
| thermo-nuclear-code-quality-review | `templates/thermo-nuclear-review.md` | sonnet | prose tagged | — | B |
| Subsystem (billing/auth/schema-migration/webhook/RBAC/multi-tenant/cron) | `templates/subsystem-agent.md` + `{subsystem_name}` + `{failure_modes}` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Tests | `templates/tests-agent.md` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Skill — heavy | `templates/skill-agent.md` + `{skill_name}` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Skill — light | `templates/skill-agent.md` + `{skill_name}` | haiku | JSON line-anchored | `{trust_boundaries}` | A |
| coding-standards (umbrella + 4 sub-skills) | `templates/skill-agent.md` + `{skill_name}` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| claude-md-materiality | `templates/materiality.md` | haiku | prose tagged | — | B |
| claude-md-compliance | `templates/claude-md-compliance.md` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Dogfood — Happy-path | `templates/dogfood-agent.md` + Happy-path persona | sonnet | first-line convergence signal | — | — |
| Dogfood — Adversarial | `templates/dogfood-agent.md` + Adversarial persona | opus | first-line convergence signal | — | — |
| Dogfood — Regression | `templates/dogfood-agent.md` + Regression persona | sonnet | first-line convergence signal | — | — |
| General Opus 4.7 | (no template, generalist prompt) | opus | line-anchored or prose | — | — |
| Fix agents (Step 2) | (composed on-the-fly from `fix_prompt`) | sonnet | code changes | — | — |

**Heavy vs light Skill agents:**
- **Heavy:** `security-defensive`, `language-rust`, `language-typescript`, `language-swift`, `react`, `database`, `drizzle-orm`, `frontend`, `web-performance`, `api-design`, `simplify`, `matt-improve-codebase-architecture`
- **Light:** `i18n`, `tailwind`, `ui-animations`, `ui-ux`, `make-interfaces-feel-better`, `shadcn`, `vue`, `tanstack-query`, `tanstack-start-best-practices`, `better-result-adopt`, `docker`, `kubernetes`, `zod`

**Subsystem Agent.** Substitute `{subsystem_name}` from the Step 0 subsystem-trigger row (e.g. `billing-subsystem`) and `{failure_modes}` from that row's "Failure modes" column. Doesn't load a skill — it's a framing label only.

**Dogfood Agent.** 3 personas in parallel, same scaffolding (`templates/dogfood-agent.md`), differ only in `{persona_focus}` from `templates/dogfood-personas.md`. Substitute both `{persona}` and `{persona_focus}` before spawning. Dogfood receives no previous-findings (empirical output, fresh each run).

**Shared diff file.** Step 0.2 wrote full diff to `/tmp/review-diff-{branch}.patch`. Templates use `{diff_file}`. Agents grep/filter patch rather than re-running `git diff`. File-set with uncommitted files → agent reads directly per Step 0.

**Trust-boundaries placeholder.** Line-anchored templates use `{trust_boundaries}` for comma-separated list from Step 0 (e.g. `secrets, network, auth`) or literal `none`. Substitute before spawning; never leave placeholder literal.

**Previous findings injection** (iteration N>1 only). Step 4 incremental re-review builds `{previous_findings_block}` per agent. At iteration 1, placeholder = empty string (no header).

- **Shape A** (line-anchored agents): `templates/previous-findings-shape-a.md`
- **Shape B** (prose agents): `templates/previous-findings-shape-b.md`
