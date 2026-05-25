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

Standard = **shape, not size**. A 500-line mechanical rename is safer than a 3-line operator flip on permissions. Skip on the genuinely trivial tail (doc typos, lockfile regen, mechanical renames, dep patch bumps, inert config); never skip a small change with high blast radius (SQL/auth/billing/permission/feature-flag/money constants/HTTP method/comparison-operator flips/new direct deps).

Full catalogue of skip-vs-keep cases and the must-build-object-on-skip rule: `reference/skip-gate.md`. **Unsure → run.**

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

**Override:** explicit user request for deep review → force `Full`. Tier = default, not ceiling. The Lite-vs-Full breakdown of what gets spawned lives in `reference/always-spawn.md`.

## The Funnel

Three levels, in order. Each gates the next.

**L1 — Question the need.** Does this code need to exist? Framework or dep already solves this? Start from problem, not existing code. What's missing?

**L2 — Reduce scope.** Smallest perimeter solving the validated need. Inline, merge, remove wrappers. Every abstraction justifies itself through concrete usage.

**L3 — Minimize code + review tests.** Shortest correct typed code. No duplicate data. Missing tests? Useless tests? Improvable tests?

**Discipline:** challenge your own proposal at each level until you can't remove anything.

## Anti-shortcut — stop if any cross mind

This skill's value = the fan-out shape. Collapse it and you might as well not call it.

| Temptation | Reality |
|---|---|
| "Diff petit, un seul agent suffit" | Tier decides — Lite ≈ 8 agents, Full ≥ 12. |
| "Je review moi-même, plus rapide" | You don't have the rule-sets loaded (security-defensive, language-*, ui-ux, coding-standards:*). The agents do, at L3. |
| "Step 0 long, je skip les évidents" | Step 0 detects subsystem (billing/auth/webhook), surface (UI/API), imports. Skipping = missed high-stakes lenses. |
| "Parallel one-by-one = plus simple à debug" | Serialising collapses wall-time gains, the only reason this skill exists. One turn, N Task blocks, **before** any result. |

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

**Apply the tier first**, then walk the spawn list. Tier `Lite` cuts most conditional rows by construction (no high-stakes path).

**Always spawn** (Full tier) — the full check-the-boxes list lives in `reference/always-spawn.md`. Read it now and tick through every box; an unbulleted prose form is too easy to skim past and silently drop an agent. Includes Funnel L1/L2, Occam Razor, Correctness, Tests, simplify, matt-improve-codebase-architecture, matt-review, thermo-nuclear, security-defensive, the coding-standards umbrella + 4 sub-skills, and the General Opus 4.7 generalist pass.

Occam Razor sits alongside the Funnel: L1/L2 are prose evaluated face-value, Occam mechanically walks call sites for every exported symbol the diff introduces/modifies (catches 0-caller funcs, 1-caller wrappers, derivable defaults).

**Conditional spawns:**

- **`claude-md-compliance`** — when any `CLAUDE.md` exists (repo root or monorepo workspace root). Reads file(s), extracts rules, walks diff for violations introduced. Distinct from claude-md-materiality (doc staleness); compliance flags code breaking rules. Multiple `CLAUDE.md` → one agent handles all.
- **By extension** — `.ts`/`.tsx` → language-typescript, `.rs` → language-rust, `.swift` → language-swift, `.vue` → vue.
- **By imports** — one agent per detected skill from: `better-result-adopt`, `database`, `docker`, `drizzle-orm`, `i18n`, `kubernetes`, `react`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui-animations`, `vue`, `zod`.
- **By surface touched** — UI/frontend/API skill agents triggered by path globs (no import signal). Triggers, skill list, dedup notes: `reference/surfaces-and-dogfood.md`.
- **By subsystem touched** — diff touches a high-stakes subsystem → spawn the framed agent alongside generic Correctness. Trigger rows, agent names, failure-mode hints: `reference/subsystems.md`.
- **Codex** — only on explicit user request.

**Compute active trust boundaries.** Union from `user-input | network | filesystem | secrets | process-exec | database | auth | permissions | concurrency | external-api | serialization` — runs for Lite and Full (boundaries don't gate `high_stakes`). Signals + failure-mode column (single source of truth for line-anchored agents): `reference/trust-boundaries.md`. Pass the result as `{trust_boundaries}` into every line-anchored template; no boundary → `none`.

**Record the dogfood gate.** Diff changes a user-facing surface → set `dogfood_required: true` and list the matching categories in `dogfood_surfaces[]`. `code-review` only *detects and records*; the runtime 3-persona gate is the consuming loop's job. Categories (`web-ui` / `http-api` / `cli` / `native`) and the broad-detection rule: `reference/surfaces-and-dogfood.md`. Uses the same unified file-set as every other Step 0 trigger.

**Spawn by materiality.** Diff touches something that should be in `CLAUDE.md` / `AGENTS.md` but those files are unchanged → spawn **claude-md-materiality** (haiku). The agent only flags the gap, doesn't write the doc. Skip materiality entirely under Lite. Tight trigger signals (designed to avoid routine config noise): `reference/materiality-signals.md`.

### Step 0.2 — Write shared diff to disk

Write the full diff once to `/tmp/review-diff-<sanitized-branch>-<run_id>.patch`. Sanitize the branch name (a `/` in `feature/x` breaks the path); the `RUN_ID` keeps concurrent runs on the same branch from colliding; write to a `.tmp` sibling then rename so an agent never reads a half-written patch:

```bash
SANITIZED_BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
DIFF_FILE="/tmp/review-diff-$SANITIZED_BRANCH-$RUN_ID.patch"
rtk proxy git diff "$DEFAULT_BRANCH"...HEAD > "$DIFF_FILE.tmp" && mv "$DIFF_FILE.tmp" "$DIFF_FILE"
```

Pass `$DIFF_FILE` to every agent as `{diff_file}` — agents grep/scope the patch instead of re-running `git diff` (write-once / read-N saves the duplicated bytes across a 12-agent fan-out).

If the file-set includes untracked/unstaged content (subsystem agents on uncommitted edits), the agent reads those directly per Step 0 — the patch file only covers the `"$DEFAULT_BRANCH"...HEAD` slice.

**Scope files per agent:**
- Language agents: files matching the extension
- Framework/lib agents: files importing the framework
- Tests agent: test files + source files they test
- Other: all changed files

### Step 0.5 — Pre-triage with cheap model

Many diffs have a long tail of routine files (config additions, pure renames, formatting, generated regeneration). Filter once cheaply before fan-out — spawn ONE `general-purpose` subagent, `model: haiku` (fallback `sonnet`), with the prompt from `templates/pre-triage.md` (substitute `{full_diff}` with the patch contents).

**Subtract APPROVED files from every agent's scoped file list before Step 1.** Exception: a file matching any subsystem trigger or any Dogfood category in Step 0 stays regardless of triage verdict — cheap model + high-stakes path = trust the path, not the model. Triage is not a substitute for the Funnel's "is this code necessary?" — only a filter for lockfile churn and rename-only diffs.

### Step 1 — Spawn all agents in a single message block

Emit ALL Task blocks (plus your own `read`/`grep`/`webfetch`) in the SAME assistant turn, before any result. Serialising = no fan-out, defeats the skill (see *Anti-shortcut*). When `only_agents` was supplied, spawn only those; else the full tier-derived panel. Pass each agent its scoped file list.

`code-review` emits no `<crl:...>` data-capture markers — those bound a *loop* run and are owned by the composing loop, not this skill.

### Step 2 — Assemble and emit the review object

Every agent has returned. Build one structured object — the single contract every caller (human, `code-review-loop`, script-driven orchestrator) consumes. Full schema, the `agent_roster` semantics (the `findings` / `no-findings` / `error` distinction that lets a consumer tell "agent ran clean" apart from "agent never spawned"), the prose-finding wrap, and the atomic `/tmp/` write protocol all live in `reference/review-object.md`.

Quick orientation:
- Top-level fields: `run_id`, `branch`, `head_sha`, `default_branch`, `tier`, `trust_boundaries`, `changed_files`, `dogfood_required`, `dogfood_surfaces`, `agent_roster`, `findings`.
- Assembly is lossless — do not dedupe, triage, or drop here; triage belongs to the consumer.
- Output target: the object in-context AND `/tmp/code-review-findings-<sanitized-branch>-<run_id>.json` (write to `.tmp` then `mv`).

---

## Context verification protocol

A 5-question gate (callers/callees, test context, intentional comments, diff-is-the-fix, type tracing) injected verbatim into every line-anchored prompt (Correctness, Subsystem, Tests, Skill, CLAUDE.md Compliance, Occam Razor). Funnel L1/L2 don't need it (structural, not failure-mode-inferred). Full block to inject: `reference/context-verification.md`.

## Output format for line-anchored findings

The exact JSON envelope, the controlled vocabulary for `signature`, severity/confidence semantics, and the two silent checks (test-coverage grep, "read what you flag") live in `reference/output-format.md`. Read that file once before injecting the block into a line-anchored template — it is the source the agents must reproduce.

Zero findings → respond exactly `No findings.` (textual, not JSON — preserves the convergence signal). Funnel L1/L2 stay textual; Dogfood keeps its own contract.

---

## Agent Prompt Templates

Each template lives in its own file under `templates/`. Read only the templates Step 0 detected — parallel reads, ~zero wall-time cost. Substitute placeholders before passing the text as the Agent's `prompt`.

The full mapping (template → model → output shape → trust-boundaries injection → prev-findings shape), the **Heavy vs Light** skill partition, the substitution rules for `{subsystem_name}` / `{failure_modes}` / `{diff_file}` / `{trust_boundaries}`, and the **previous-findings injection contract** for re-review live in `reference/agent-table.md`. Read it once per run when fanning out — it is the source of truth.

Two rules small enough to keep inline:
- **Line-anchored templates** (Skill, Tests, Subsystem, Correctness, CLAUDE.md Compliance, Occam Razor) require the Context verification + Output format blocks appended verbatim before spawning. **Funnel L1/L2, Materiality, Matt Review** are self-contained.
- Heavy reasoning → `sonnet`, structural/textual lifts → `haiku`, generalist Opus pass → `opus`. The orchestrator stays on the session model.
