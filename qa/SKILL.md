---
name: qa
description: "Adversarial manual acceptance testing of any user surface (UI, API, CLI, TUI, and more): exhaustive use-case matrix, two merciless agents, proven verdict."
disable-model-invocation: true
argument-hint: "[target url|command] [time budget]"
version: 1.2.0
---

# QA: Adversarial Manual Acceptance Testing

Manually recette a feature across whatever surface exposes it — UI, HTTP API,
CLI, TUI, or anything else a user touches — until you can vouch for its
functionality, robustness, and tolerance. This is hands-on acceptance testing,
NOT the project's own unit/integration/e2e suites. You drive the running thing
yourself.

Supersedes `dogfood` for web QA — `dogfood` remains a lighter single-agent
exploratory tool.

Three leading words govern the run:

- **matrix** — the enumerated set of use cases. Exhaustiveness is *observable*:
  a cell with no verdict is unfinished work, never a pass.
- **evidence** — every verdict traces to an artifact captured on disk (a
  screenshot, a console read, an HTTP response, an exit code + output). "It
  works" with no captured artifact is a guess.
- **merciless** — the posture of the two assault agents: assume the feature is
  broken and hunt for the proof.

## Phase 1 — Scope

1. **Get a target.** Prefer one handed in by the caller (URL, base API URL,
   binary/command, TUI launch command). If none, look for a project skill that
   launches the app, or invoke `/run`. If no launch path is known, **stop and
   ask** — never improvise unknown boot commands.
2. **Confirm non-production.** Inspect the target: URL host, the actual `.env`
   connection strings (a file labelled "test" can still point at prod — verify
   the string, not the filename), the DB it hits. If anything smells like prod,
   **stop and ask**.
3. **Build the host allowlist.** List every host/base-URL/path the agents may
   touch (the target plus any test dependency). The agents may touch nothing
   else — this is the safety boundary passed into every prompt.
4. **Create the run dir.** Pick a run id (timestamp or short slug) and create one
   absolute directory `<project-or-scratchpad>/qa-run-<id>/`, then
   `mkdir -p <run-dir>/evidence/` for artifacts (redirects and `tee` do NOT
   create parent dirs — the subdir must exist first). Copy `templates/report.md`
   (relative to this skill's directory) to `<run-dir>/report.md` — all matrix and
   report writes go to the copy, never the template. Reuse `<id>` verbatim
   wherever a run-scoped literal is needed (tmux session name, etc.).
5. **Smoke the target.** Drive one real end-to-end round trip per surface with
   the actual credentials — log in, hit one authenticated endpoint, run one
   real command — and capture the artifact to `evidence/`. A failed smoke means
   the environment is broken, not the feature: **stop and report ABORTED**
   (Phase 5), naming the broken precondition. Never spawn agents against a
   target you could not drive yourself.

**Completion:** target reachable, confirmed non-prod, allowlist written, run dir
created with an `evidence/` subdir and the report copy inside, smoke passed with
its artifact on disk.

## Phase 2 — Explore

Map the entire surface. Read the README, `package.json` scripts, route files,
`--help`, OpenAPI/GraphQL schemas — whatever declares the entry points. A target
often spans **several surfaces** (a web app with a backing API, a CLI with a TUI
mode). Detect each one.

Each detected surface needs a harness before Phase 4:

- **Covered surfaces** map to a file: UI → `references/ui.md`, HTTP API (incl.
  GraphQL) → `references/api.md`, CLI → `references/cli.md`, TUI →
  `references/tui.md`. Load only the ones in play.
- **Any other surface** (websocket/SSE, gRPC, webhooks, email/SMS/push,
  chat/voice, file import-export, SDK/library, desktop, mobile, scheduled jobs,
  message queues, …) has no file. Derive an **ad-hoc harness** by answering three
  questions, and write it to `<run-dir>/harness-<surface>.md`:
  1. What tool drives it? (a client lib, `websocat`, a listener you host for
     inbound webhooks, an SDK script, …)
  2. What counts as a captured artifact? (the raw frame, the response, a log
     line, a received payload)
  3. What are the assault levers? List the hostile inputs and edge cases specific
     to this surface (e.g. a frame that never arrives, an unverified webhook
     signature, a replayed message) — not "test it". If you can't name at least
     three concrete levers, you don't understand the surface yet; go read more.

**Completion:** inventory of entry points written; every detected surface has a
harness file path (shipped or ad-hoc) ready to hand to a subagent.

## Phase 3 — Enumerate

For each entry point, write use-case rows to `<run-dir>/report.md` — happy
paths AND error paths — each with status `UNTESTED`. Cover, at minimum:

- **Happy path** — intended flow, valid input.
- **Validation** — empty, missing-required, wrong-format, over-long,
  special-character, unicode/emoji input.
- **Auth / permission** — unauthenticated, wrong-role (expect clean
  redirect/401/403, never a crash).
- **Not-found** — bad route, deleted/nonexistent id.
- **Limits** — boundary values, pagination edges, oversized payloads.
- **Concurrency / interruption** — double-submit, back/refresh mid-flow, cancel,
  rapid repeat.

Re-read the inventory once to catch entry points you missed.

**Completion:** matrix written to the report copy, reread once for gaps.

## Phase 4 — Assault

Spawn **two merciless subagents** (Agent tool, `general-purpose`). A subagent
starts with a fresh context — it sees only its prompt, so every prompt below is
a **template you fill** with absolute values before spawning. Leave no `{{slot}}`
unfilled.

**Order:** sequential by default, **Verifier first, then Breaker** — the
Breaker's hostile mutations would poison the Verifier's rows and make FAILs
unattributable. Run them in parallel ONLY when they touch disjoint state AND
neither drives the shared Chrome instance (the chrome-devtools MCP is a single
browser).

Verifier prompt template:

> You are a merciless QA verifier.
> TARGET: {{target url/command + how to reach/launch it, credentials}}
> ALLOWLIST: you may touch ONLY these hosts/paths: {{allowlist}}. Never follow a
> link or request to any other host.
> MATRIX: read {{run-dir}}/report.md — the coverage matrix. HARNESS: read
> {{harness file path(s)}} before testing.
> EVIDENCE DIR: write every artifact under {{run-dir}}/evidence/ (already exists)
> with a filename naming the row (e.g. `row-3-login-empty.png`).
> BUDGET: {{budget or "none"}} — at T-2min, stop and mark remaining rows
> BLOCKED(budget).
> FUSE: distinguish a row-specific block from an env-block — the environment
> itself is broken (cannot authenticate, target unreachable, dependency down).
> On an env-block, stop immediately: mark all remaining rows BLOCKED(env) and
> return early, naming the broken precondition. Never grind a dead environment
> row by row.
> Drive EVERY matrix row through the running target using the harness — click the
> real UI, send the real request, run the real command. For each row capture an
> artifact to the evidence dir and return a verdict: PASS (observed the promised
> behavior), FAIL (observed a deviation — describe it), BLOCKED (could not test —
> say why). A row with no artifact on disk is not PASS. Never conclude "works"
> from a page that merely loaded or a 200 with an unchecked body. Record every
> write you make (record created, file written, mutating request) in a
> "Mutations" list. Return: the completed matrix with a verdict + artifact path
> per row, a BLOCKED count, and the Mutations list.

Breaker prompt template:

> You are a merciless exploratory tester. Goal: BREAK the target and find as many
> real bugs as possible.
> TARGET: {{target url/command + how to reach/launch it, credentials}}
> ALLOWLIST: touch ONLY {{allowlist}} — never any other host.
> HARNESS: read {{harness file path(s)}}. EVIDENCE DIR: {{run-dir}}/evidence/
> (already exists) — name each artifact `bug-<n>-<slug>` to avoid clashing with
> the verifier's `row-*` files.
> BUDGET: {{budget or "none"}}.
> FUSE: if the environment itself dies (cannot authenticate, target
> unreachable), stop and return immediately, naming the broken precondition —
> never keep rounds running against a dead target.
> The matrix at {{run-dir}}/report.md is what's already covered — hunt
> OUTSIDE it. Throw hostile input: malformed payloads, injection strings,
> unicode/emoji, 1–10 MB values, negative and boundary numbers, double-submits,
> back/refresh mid-flow, expired/forged tokens (note it as an untried lever in your
> return if you can't obtain one), race conditions, empty states, rapid repeats. Capture evidence to the
> evidence dir for every bug. Work in rounds; keep hunting until **dry** — two
> consecutive rounds with zero new bugs. Record every write you make in a
> "Mutations" list. Return: every bug with repro steps, evidence path, and
> severity; a per-round tally ("Round 3: 0 new"); and the Mutations list.

**Fuse (parent):** an agent returning an env-block ends the run — spawn nothing
further, go straight to Phase 5 and report **ABORTED**. Fix-and-rerun beats a
wall of BLOCKED rows.

**Completion:** the Verifier returned zero `UNTESTED` rows (BLOCKED rows force
report status **PARTIAL** and become reservations), the Breaker's round tally
shows two dry rounds, and **you have `ls`'d every reported evidence path** —
any missing artifact downgrades its row to BLOCKED. A time budget that expires
first yields status **PARTIAL**, never a false all-green.

## Phase 5 — Report

Complete `<run-dir>/report.md`:

1. **Coverage matrix** — every use case → verdict → evidence path. Each PASS/FAIL
   points to an artifact verified on disk; a BLOCKED row carries a reason instead.
2. **Findings** — deduplicated, sorted by severity, each with location, repro
   steps, expected vs actual, evidence. Every FAIL row maps to a finding.
3. **Test mutations** — merged from both agents' Mutations lists.
4. **Verdict** — coverage-aware, not findings-only:
   - **ABORTED** if the run stopped on a broken environment (failed smoke,
     tripped fuse) — name the broken precondition and the untested rows; no GO
     of any kind until the environment is fixed and the run redone.
   - **NO-GO** if any open Critical or High finding.
   - **GO** only when status is COMPLETE with zero BLOCKED rows and no open
     Critical/High.
   - **GO-PROVISIONAL** otherwise (status PARTIAL / any BLOCKED row) — must name
     exactly what went unverified. An all-BLOCKED run is never a clean GO.
   Medium/Low findings and BLOCKED rows are listed as reservations.

**Completion:** every PASS/FAIL verdict and every finding points to an artifact
you confirmed on disk; BLOCKED rows carry a stated reason.

## Common rationalizations (parent-facing)

| Rationalization | Reality |
|-----------------|---------|
| "Most cells pass, close enough" | An `UNTESTED` cell is unfinished work, not a pass. Done means every cell has a proven verdict. |
| "The subagent said it passed" | A verdict with no artifact on disk is a guess. `ls` the path before you trust it. |
| "The Breaker found nothing, so it's clean" | Only if its tally shows two dry rounds. One quiet round is not dry. |
| "GO — nothing looked catastrophic" | The verdict is mechanical and coverage-aware: any open Critical/High → NO-GO; any BLOCKED row → at best GO-PROVISIONAL, never clean GO. Don't eyeball it. |
| "Mostly BLOCKED, but the run finished" | A wall of BLOCKED(env) rows is a dead environment, not coverage. The fuse should have tripped — report ABORTED, fix the env, rerun. |

## Red flags — STOP

- A verdict or finding with **no artifact on disk**.
- Any matrix row left **`UNTESTED`** while reporting "done".
- Grinding rows to **BLOCKED(env)** one by one after the environment has died —
  the fuse should trip on the first env-block.
- Running the assault against **production** or an unverified environment, or
  letting an agent reach a host outside the allowlist.
- Spawning a subagent prompt with an unfilled `{{slot}}`.
- Improvising unknown boot commands to start the target — stop and ask (Phase 1).
