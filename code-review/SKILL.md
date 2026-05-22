---
name: code-review
description: Use when you need a thorough multi-agent review of a code diff (current branch, staged changes, or a specific changeset) that returns structured findings without modifying any code. Also use when another skill or an orchestrator needs a single read-only review pass as a composable building block. To also fix findings and loop to convergence, use code-review-loop instead.
---

# Code Review

One read-only review pass over a diff. Detect which review lenses apply, fan specialized agents out in parallel, collect every finding into one structured object. The working tree is never modified — `diff in → findings out`.

`code-review-loop` composes this skill: it runs the pass, fixes the findings, and re-runs to convergence. Invoke `code-review` directly when you want the findings and will act on them yourself.

## Inputs

All optional — `code-review` detects everything else from the working tree.

| Input | Purpose |
|---|---|
| `DEFAULT_BRANCH` (env) | Base ref for every diff. Auto-detected in Step 0 if unset. |
| `RUN_ID` (env) | Optional. Identifies this pass and names its output files. `code-review` mints one when unset, and always returns it in the review object. |
| `previous_findings_file` | Path to the prior pass's findings (re-review only) — drives `{previous_findings_block}` injection. |
| `only_agents` | Restrict the fan-out to a named subset of agents (re-review narrows the panel). Full tier-derived panel if absent. |

The *When not to use* gate runs on every invocation, including programmatic ones — there is no `force` override. A caller that has already decided to review will, on the same diff, get the same gate verdict.

## Output

The **review object** — returned in context and written to `/tmp/code-review-findings-<sanitized-branch>-<run_id>.json`. Schema in Step 2.

## When not to use

Standard = **shape, not size**. 500-line mechanical rename safer than a 3-line operator flip on permissions.

**Skip when genuinely trivial**: single-word doc typos, whitespace/comment-only, lockfile or generated-code regeneration, mechanical renames with import-path-only effect, low-risk dep patch bumps, docs-only, inert config (linter/formatter rules with no runtime effect), or user wants quick opinion not a full review.

**Don't skip when small but high blast radius** — any 1-line change to SQL/regex/auth/billing/permission/signature-verification code; flipping a feature-flag default, retry/timeout, or auth callback URL; money/tax/currency/fee constants; HTTP method, redirect URL, status enum; tightening/loosening a comparison operator (`<` ↔ `<=`, `==` ↔ `!=`); renaming a public API surface; new direct dependency (supply-chain); user-facing copy that changes meaning ("approved" → "denied"); mixed diff with a semantic 1-liner buried in whitespace.

"Config-only" isn't a blanket skip — config flipping a feature-flag default, retry/timeout, auth callback URL, or secrets wiring is runtime-affecting.

Unsure → run. Spurious run costs minutes; missed billing bug costs much more.

When the gate decides skip, do not abandon the contract: still build the review object with `tier: "trivial"`, empty `agent_roster`, empty `findings` (Step 2), so a programmatic caller gets a consistent shape. Then stop.

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

Past runs drift here. This skill's value = the fan-out shape — collapse it and you might as well not call it.

| Temptation | Reality |
|---|---|
| "Diff petit, un seul agent suffit" | Tier decides. Lite = ~8, Full = 12+. AFK forces Full. |
| "Je review moi-même, c'est plus rapide" | You don't have rule-sets loaded (security-defensive, language-*, ui-ux, coding-standards:*). Spawn agents — they load rules at L3. |
| "Spawn un `general-purpose` avec prompt review générique" | Substitute, not skill. Templates verbatim, fan-out per tier. |
| "Step 0 long, je skip et spawn les évidents" | Step 0 detects subsystem (billing/auth/webhook), surface (UI/API), imports. Skip = miss high-stakes lenses. |
| "Step 1 dit parallel mais une par une = plus simple à debug" | Wall-time collapse = the only reason this skill exists. One turn, N Task blocks, BEFORE any result. |

## Workflow

### Step 0 — Detect agents and scope files

**Establish `RUN_ID`** — honor a `RUN_ID` exported by a script-driven caller, else mint one:

```bash
RUN_ID="${RUN_ID:-$(git rev-parse --short=8 HEAD)-$(date +%s)-$(openssl rand -hex 2)}"
```

Every `git diff` uses `"$DEFAULT_BRANCH"...HEAD`, never hardcoded `main`. If the caller hasn't exported `DEFAULT_BRANCH`, detect:

```bash
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(glab repo view --output json 2>/dev/null | jq -r '.default_branch // empty')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(git for-each-ref --format='%(refname:short)' refs/heads/main refs/heads/master refs/heads/develop 2>/dev/null | head -1)
  test -n "$DEFAULT_BRANCH" || { echo "ERREUR : default branch introuvable. code-review ne démarre pas." >&2; exit 1; }
fi
git fetch origin "$DEFAULT_BRANCH"
```

`fetch` keeps the local tracking ref current vs concurrent pushes. The resolved `DEFAULT_BRANCH` goes into the review object (Step 2) — env vars don't survive a skill boundary, so a caller that needs it must read it from the object or re-derive it with this same snippet.

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

**Spawn by subsystem touched.** Diff touches high-stakes subsystem → spawn **subsystem-framed agent** alongside generic Correctness. Framing primes for domain failure modes a generic lens misses (double-charges, refund races, signature replay, cross-tenant leaks).

**File-set for subsystem detection** = same Dogfood rule: union `"$DEFAULT_BRANCH"...HEAD` + unstaged + staged + untracked. Else uncommitted auth/billing/schema edits silently bypass lenses.

**Pass unified file-set to agent**, not just the `"$DEFAULT_BRANCH"...HEAD` slice. Uncommitted files → agent must read directly. Replace `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD -- {files}` in the subsystem prompt with `read current contents of {files} directly, and run \`git diff -- {files}\` for unstaged delta`.

Triggers specific enough to avoid UI tokens / ARIA roles / job listings / generic "workspace" UI. A row fires only when ≥1 concrete signal is present.

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

A subsystem agent **adds to** (doesn't replace) Correctness. Use the **Subsystem Agent** template — not Skill Agent (which would try to load a non-existent skill).

**Compute active trust boundaries.** The same triggers identify the boundaries the diff crosses, even without a full subsystem agent. Union: zero or more of `user-input | network | filesystem | secrets | process-exec | database | auth | permissions | concurrency | external-api | serialization`. Pass as `{trust_boundaries}` into every line-anchored template (Correctness, Tests, Skill, Subsystem). No boundary → `none`. **Runs for Lite and Full** — Lite diffs touching `network`/`serialization`/`external-api` get the lens (boundaries don't gate high_stakes, survive Lite filtering).

The trust-boundaries table:

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

The "Failure modes" column is the **single source of truth** for line-anchored agents when a boundary is active. Templates reference this table, don't duplicate it.

**Record the dogfood gate.** Diff changes a user-facing surface → set `dogfood_required: true` in the review object and list the matching categories in `dogfood_surfaces[]`. `code-review` only *detects and records*; running the runtime 3-persona gate is the consuming loop's job (it runs after static convergence, on signed-off code). Detect broadly, *err toward triggering*. Categories:

- **web-ui**: `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `*.html`, CSS / design-token files (`*.css`, `*.scss`, `tokens.*`, theme files), `app/**/page.*`, `pages/**`, `src/routes/**`, server actions, i18n copy files, public/static assets that change observable behaviour.
- **http-api**: `app/**/route.*`, `middleware.*`, `server/api/**`, `api/**`, `routes/**`, tRPC routers, GraphQL resolvers/schema, WebSocket handlers, route definitions imported from `next`/`express`/`fastify`/`hono`/`koa`.
- **cli**: `bin/**`, `cli/**`, `src/cli/**`, files importing `commander`, `yargs`, `oclif`, `clipanion`, `cac`, `meow`.
- **native**: Electron/Tauri main or renderer entrypoints, React Native / Expo screens, native iOS/Android files.

Unsure → set the flag. A spurious persona run is cheap (personas dedup); a missed runtime bug is expensive.

**Don't rely on `git diff "$DEFAULT_BRANCH"...HEAD` alone for dogfood detection.** It misses uncommitted work. Union in unstaged + staged + untracked too.

**Codex:** only if the user explicitly requests it.

**General Opus 4.7:** always spawn. Generalist reviewer, no skill loaded. `general-purpose` subagent, `model: opus`.

**Spawn by materiality.** Diff touches something that should be in `CLAUDE.md` / `AGENTS.md` but those files are unchanged → spawn **claude-md-materiality** (haiku). Tight signals to avoid firing on routine config tweaks:

- package manager switch (`package.json` `packageManager` field changed, OR lockfile family added/removed: `pnpm-lock.yaml` ↔ `package-lock.json` ↔ `yarn.lock` ↔ `bun.lock`)
- test framework swap (a `vitest.config.*` / `jest.config.*` / `playwright.config.*` file added or removed — not edited)
- build tool added or removed (new `vite.config.*` / `webpack.config.*` / `rollup.config.*` / `next.config.*` file, OR an existing one deleted)
- `tsconfig.json` change to `module`, `moduleResolution`, or addition of a *new top-level alias prefix* in `paths` (NOT path tweaks, NOT `target`/`lib`/`strict` flag toggles)
- new top-level dir (root of repo or root of a monorepo workspace)
- new required env var (additions in `.env.example` — not removals, not renames)
- CI/CD workflow file added or removed (NOT edited — workflow tweaks rarely invalidate docs)

The agent's only job: flag the gap, don't write the doc. Skip materiality entirely under Lite (cost low but consistency matters — Lite ≡ no structural change).

### Step 0.2 — Write shared diff to disk

Write the full diff once to `/tmp/review-diff-<sanitized-branch>-<run_id>.patch`. Sanitize the branch name (a `/` in `feature/x` breaks the path); the `RUN_ID` keeps concurrent runs on the same branch from colliding; write to a `.tmp` sibling then rename so an agent never reads a half-written patch:

```bash
SANITIZED_BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
DIFF_FILE="/tmp/review-diff-$SANITIZED_BRANCH-$RUN_ID.patch"
rtk proxy git diff "$DEFAULT_BRANCH"...HEAD > "$DIFF_FILE.tmp" && mv "$DIFF_FILE.tmp" "$DIFF_FILE"
```

Pass `$DIFF_FILE` to every agent as `{diff_file}`. Agents read the file instead of re-running `git diff`.

**Why:** on large diffs (>500 lines) with 10+ agents, a per-agent `git diff` duplicates the same bytes through every subagent context. Write once, read N times → saves tokens, avoids subprocess overhead. Replaces `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD -- {files}` in templates — agents `grep` the patch scoped to their files.

If the file-set includes untracked/unstaged content (subsystem agents on uncommitted edits), the agent reads those directly per Step 0 — the patch file only covers the `"$DEFAULT_BRANCH"...HEAD` slice.

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

**Subtract APPROVED files from every agent's scoped file list before Step 1.** Exception: a file matching any subsystem trigger or any Dogfood category in Step 0 stays regardless of triage verdict. Cheap-model + high-stakes path = trust the path, not the model.

Triage = one shared round for the whole diff, not per agent. Run once, subtract, fan out. Not a replacement for the funnel's "is this code necessary" — only to skip lockfile churn and rename-only diffs.

### Step 1 — Spawn all agents in a single message block

**`code-review` emits no `<crl:...>` data-capture markers.** Those bound a *loop* run and must pair within one session; a composing loop owns them. Invoked standalone, this skill emits none.

**Parallelism is the only reason this skill exists.** Default tool-call behavior is serial: one Task → await → next. That collapses the fan-out into `N × (think-time + agent-time)` and defeats the point. **Override it.** Emit ALL Task tool_use blocks in the SAME assistant message, BEFORE any result.

- ✅ **Right:** one turn, N parallel Tasks → wait → N results → assemble.
- ❌ **Wrong:** turn 1 = Task(L1) → turn 2 = Task(L2) → … If you catch yourself, stop and re-issue together.

Your own `read`/`grep`/`webfetch` calls go in the SAME turn — concurrent, zero extra wall time.

Use the templates below. Pass each agent its scoped file list. When `only_agents` was supplied, spawn only those agents; otherwise the full tier-derived panel.

### Step 2 — Assemble and emit the review object

Every agent has returned. Build one structured object — the single contract every caller (a human, `code-review-loop`, or a script-driven orchestrator) consumes.

**Build `agent_roster`.** One entry per agent you spawned in Step 1:

`{"agent": "correctness", "template": "templates/correctness.md", "model": "sonnet", "result": "findings" | "no-findings" | "error"}`

- `no-findings` — the agent returned exactly `No findings.`
- `findings` — the agent returned ≥1 finding.
- `error` — the agent failed, timed out, or returned unparseable output.

The roster is load-bearing: it lets a caller's convergence check tell "agent ran, clean" apart from "agent never spawned". Never omit an agent that was spawned.

**Collect `findings`.** Flatten every finding from every agent into one array. Tag each with the emitting `agent`. Line-anchored findings keep their full JSON-envelope shape (see *Output format* below); a prose finding becomes `{"agent": "...", "kind": "prose", "tag": "must" | "suggestion", "text": "..."}`. Do not dedupe, triage, or drop here — assembly is lossless; triage belongs to the consumer.

**Assemble the object:**

```json
{
  "run_id": "<this run's id>",
  "branch": "<current branch>",
  "head_sha": "<full HEAD sha>",
  "default_branch": "<branch detected in Step 0>",
  "tier": "lite | full | trivial",
  "trust_boundaries": ["network", "auth"],
  "changed_files": ["src/a.ts", "src/b.ts"],
  "dogfood_required": true,
  "dogfood_surfaces": ["web-ui", "http-api"],
  "agent_roster": [ ... ],
  "findings": [ ... ]
}
```

`trust_boundaries` is `[]` when none; `dogfood_surfaces` is `[]` when `dogfood_required` is false. `changed_files` is the unified file-set from Step 0 (committed ∪ unstaged ∪ staged ∪ untracked) — a consumer that needs the changed surfaces (e.g. a dogfood gate) reads it from here rather than re-deriving the union and risking a miss on uncommitted files.

**Write it atomically to `/tmp/`.** Sanitize the branch name (a `/` breaks the path); the `run_id` keeps concurrent runs from colliding. Write to a `.tmp` sibling first, then rename — a reader must never see a half-written file:

```bash
SANITIZED_BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
FINDINGS_FILE="/tmp/code-review-findings-$SANITIZED_BRANCH-$RUN_ID.json"
# Write the review object with the Write tool to "$FINDINGS_FILE.tmp", then:
mv "$FINDINGS_FILE.tmp" "$FINDINGS_FILE"
```

**Surface both** the object (an in-context caller reads it directly) and `$FINDINGS_FILE` (a cross-session caller reads the file — and must verify the file's `run_id` field matches the `run_id` it expects before trusting possibly-stale `/tmp/` content).

When the *When not to use* gate skipped the review, this object is still built — `tier: "trivial"`, empty `agent_roster`, empty `findings` — and written. The caller reads `tier: "trivial"` and does nothing further.

---

## Context verification protocol

Inject verbatim into every line-anchored prompt (Correctness, Subsystem, Tests, Skill, CLAUDE.md Compliance, Occam Razor). Funnel L1/L2 don't need it (structural, not failure-mode-inferred).

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

Agents anchoring findings to `file:line` emit a **lean JSON envelope** — enough for downstream triage and verbatim fix-prompt forwarding, nothing more. Verbose audit trails (`inspected` file lists, separate test-coverage prose, redundant scope restatements) multiply across a 12-agent fan-out and are the largest controllable drain on the orchestrator's context. Keep the payload tight.

Funnel L1/L2 stay textual (structural, not file:line-anchored). Dogfood (run by the composing loop) keeps its own contract.

Zero findings → respond exactly `No findings.` (textual, not JSON — preserves the convergence signal the consumer reads).

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

- `analysis_chain` — auditable trace, **≤ 3 bullets, each ≤ 25 words**. The triage pass re-reads the cited code; a chain that doesn't survive that re-read = hallucination → dropped. This is the *only* reasoning channel — there is no separate prose section.
- `fix_prompt` — consumed verbatim by per-file fix agents; state the concrete line and concrete replacement. For `bug`/`security`/`performance`/`error_handling`, **append the non-regression test to add** in the same string (`Add a test: …`) — the fix agent's TDD step reads it from here.
- `signature` — dedup key `<file>:<line>:<failure-mode-slug>`. Controlled vocabulary when applicable: `panic-on-none` · `missing-validation` · `injection-sql` · `injection-shell` · `injection-template` · `missing-tenant-filter` · `secret-leak-log` · `unawaited-promise` · `dropped-future` · `race-shared-state` · `missing-timeout` · `unbounded-retry` · `path-traversal` · `toctou` · `wrong-role-check` · `missing-permission-check` · `n-plus-one` · `missing-transaction` · `replay-attack` · `session-fixation` · `zero-callers-dead` · `single-caller-inlinable` · `unused-param` · `derivable-default` · `redundant-overload`. Else a free 3-5 kebab-token slug. The downstream dedup matcher: same file, line ±3, same slug OR title-token Jaccard ≥ 0.6.
- `confidence` — `high|medium|low`, separate from severity. `severity: bug, confidence: low` survives downstream triage only with an airtight analysis_chain. Low-confidence security findings still warrant a 2nd look — don't merge with severity.

Severity: `bug` | `security` | `performance` | `error_handling` | `suggestion`. Suggestions are usually dropped at Context verification question 1.

Confidence: `high` | `medium` | `low`. Default `high` only when analysis_chain survives independent re-derivation.

**Two checks done silently — discipline kept, fields dropped** (were `why_tests_dont_cover` / `inspected`):

- *Test coverage* — before emitting a `bug`/`security`/`performance`/`error_handling` finding, grep the test suite. A test already exercising this exact failure mode means it's covered → drop the finding.
- *Read what you flag* — only flag a file you have actually read in full this session. A finding inferred from the diff slice without reading the implementation is a hallucination → don't emit it.

---

## Agent Prompt Templates

Each template lives in its own file under `templates/`. Read only the templates for the agents Step 0 detected — parallel reads, ~zero wall-time cost. Substitute placeholders before passing the text as the Agent's `prompt`.

**Line-anchored templates** (Skill, Tests, Subsystem, Correctness, CLAUDE.md Compliance, Occam Razor) require the Context verification + Output format blocks appended verbatim before spawning. **Funnel L1/L2, Materiality, Matt Review** are self-contained — don't append.

**Model assignment.** Heavy reasoning → `sonnet`, structural/textual lifts → `haiku`. The orchestrator (you) stays on the session model.

| Agent | Template | Model | Output | Trust boundaries | Prev-findings shape |
|---|---|---|---|---|---|
| Pre-triage (Step 0.5) | `templates/pre-triage.md` | haiku | JSON | — | — |
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
| General Opus 4.7 | (no template, generalist prompt) | opus | line-anchored or prose | — | — |

**Heavy vs light Skill agents:**
- **Heavy:** `security-defensive`, `language-rust`, `language-typescript`, `language-swift`, `react`, `database`, `drizzle-orm`, `frontend`, `web-performance`, `api-design`, `simplify`, `matt-improve-codebase-architecture`
- **Light:** `i18n`, `tailwind`, `ui-animations`, `ui-ux`, `make-interfaces-feel-better`, `shadcn`, `vue`, `tanstack-query`, `tanstack-start-best-practices`, `better-result-adopt`, `docker`, `kubernetes`, `zod`

**Subsystem Agent.** Substitute `{subsystem_name}` from the Step 0 subsystem-trigger row (e.g. `billing-subsystem`) and `{failure_modes}` from that row's "Failure modes" column. It doesn't load a skill — it's a framing label only.

**Shared diff file.** Step 0.2 wrote the full diff to `/tmp/review-diff-<sanitized-branch>-<run_id>.patch`. Templates use `{diff_file}` — substitute the resolved path. Agents grep/filter the patch rather than re-running `git diff`. File-set with uncommitted files → agent reads those directly per Step 0.

**Trust-boundaries placeholder.** Line-anchored templates use `{trust_boundaries}` for the comma-separated list from Step 0 (e.g. `secrets, network, auth`) or literal `none`. Substitute before spawning; never leave the placeholder literal.

**Previous findings injection** (re-review only). When invoked with `previous_findings_file`, read it — a JSON array of the prior pass's findings, each a **full finding object** annotated with `disposition` (`fixed` | `dropped-by-triage` | `unfixed`) and a cumulative `attempts` counter. For each agent you re-spawn, build `{previous_findings_block}` from *that agent's own* prior findings, using its shape from the table's last column:

- **Shape A** (line-anchored agents): `templates/previous-findings-shape-a.md`
- **Shape B** (prose agents): `templates/previous-findings-shape-b.md`

No `previous_findings_file` (first pass) → `{previous_findings_block}` is the empty string, no header. The cumulative `attempts` counter must survive every hop — it is what lets a consumer escalate a finding that has failed too many fix attempts. The consumer (e.g. `code-review-loop`) produces `previous_findings_file`; `code-review` only reads and injects it.
