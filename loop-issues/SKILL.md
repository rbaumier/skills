---
name: loop-issues
description: Standing implementation loop — autonomously drain the current repo's `ready-for-agent` issue queue until interrupted. Per issue — a fable builder in fresh phases (contract of shapes, build slices with opus-written tests, ship), an opus shipper for pack and deliver (gates, comply triage, QA, MR), ONE opus review pass (ponytail-review + quality-bar-review) judged on unpaid shapes, push as draft, verify, repeat.
---

# Loop orchestrator

You orchestrate; you implement NOTHING. After Step 0, never read the
repo — no `git grep/show/diff/log`, no Read on project files, no full
issue bodies. Your only evidence: agent reports + forge API.

Briefs live next to this file: the builder reads `BUILDER.md`, the
shipper `SHIPPER.md`, the reviewer `REVIEW.md`; every agent reads
`RENDEZVOUS.md` — the only way anyone waits or reports. A spawn prompt hands facts and the
brief's absolute path, never a paraphrase of it.

## Agents

Every spawn names a pinned agent type and NEVER passes `model` (an
explicit `model` overrides the pin):

| Role | `subagent_type` | Model · effort | Spawned by |
|---|---|---|---|
| contractor (`contract`, + `build 1` when one slice) | `loop-contractor` | fable 5.1 · medium | you |
| builder (`build <k>`, `ship`) | `loop-builder` | fable 5.1 · low | you, once per phase |
| shipper (pack, deliver) | `loop-shipper` | opus 5 · low | you, once per phase |
| reviewer | `loop-reviewer` | opus 5 · high | you |
| mechanic (tests, comply triage, codegen) | `loop-mechanic` | opus 5 · low | builder, shipper |
| QA executor | `loop-qa` | opus 5 · medium | shipper |

Fable phases: `contract` (contractor, which carries on into `build 1`
when the contract has one slice), one `build <k>` per remaining slice
and `ship` (builder). Opus phases (shipper): `pack`,
`deliver`. Every phase is a fresh context; nobody waits on a child
except the shipper on the QA executor. Review and QA run once per
issue; a NO-GO gets one fable answer and one targeted re-verify.

There is NO path that spawns an implementer without a contract:
"spawn des agents opus", "vague de corrections", "rattrapage" mean
run THIS loop on those issues. A bypass exists only when the user
writes "hors loop" — say back what it costs (no contract, no review,
no cap) and wait for the confirmation.

Invoking this skill authorizes commits, pushes and draft MRs;
merging needs autonomous mode.

## Step 0 — Discover the project (once)

From repo docs/config only (CLAUDE.md, `package.json` scripts,
`Makefile`, `justfile`):

- **Forge** — `git rev-parse --show-toplevel` → `<main-repo>`;
  `git remote get-url origin` → forge + project path. GitLab →
  `glab api` (project `<group>%2F<project>`), narrowed queries;
  GitHub → `gh`. No MCP server in any agent of the loop. A checkout is matched on its remote,
  never on its directory name.
- **Verification trio** — check + test + build commands and pinned
  tooling; a documented merge gate is law.
- **CI posture** — blocking MR pipeline? None → the trio IS the gate.
- **Mode** — `loop-issues: automerge` documented in the repo →
  **autonomous** (labels, merge, re-queue); else **draft**: never
  write queue labels, never merge, every MR opens as a draft.
- **Worktree wiring** — deps, `.env`, codegen a fresh worktree needs.
  Rust: `export CARGO_TARGET_DIR=<main-repo>/target`.
- **Frontend app dirs** — where a user-visible file lives (`UI
  touched` at step 4).
- **Generated paths** — generated types, lockfiles, `.sqlx/`,
  `openapi.json`: excluded from the line count; a type the diff
  declares that one of them holds is `Reinvented`.
- **QA launch pack** — launch command + port override, readiness
  probe, extra env, DB-prepare path; `<main-repo>/.claude/skills/verify/`
  is authoritative when present.
- `git fetch origin <default>`; arm the watchdog (`RENDEZVOUS.md`).

## The loop

1. **Select** — an issue named in the invocation arguments is
   selected as is, whatever its labels, and the loop stops after its
   summary line. Else a split issue with unchecked tasks → next task,
   step 3. Else the oldest open `ready-for-agent` issue (lowest IID,
   list only). Draft mode: skip candidates with an open MR from an
   `agent/issue-<n>` branch or on the skip list. None → end your turn.

2. **Lock** (autonomous only) — `ready-for-agent` → `picked-by-agent`.

3. **Build** — one spawn per phase (background), each with: the
   phase name, issue number (+ task `<k>`), `<main-repo>`, Step 0
   facts (generated clients included), report dir, the brief's path,
   and the files of the previous phases. End your turn after each
   spawn.
   - `loop-contractor` `contract` → `SLICED 1 <note>` when the
     contract has one slice (the contractor built it in the same
     context), else `CONTRACTED <contract.md>` (or
     `NEEDS-CLARIFICATION <path>`). Check the contract has `Formes`,
     a closed `Tests` list and `Tranches`; on `CONTRACTED` spawn
     `build 1`, on `SLICED 1` spawn `loop-shipper` `pack`.
   - `loop-builder` `build <k>` → `SLICED <k> <note>`. Spawn
     `build <k+1>` while slices remain, else `loop-shipper` `pack`.
   - `loop-shipper` `pack` → `PACKED <pack.md>`. Spawn ONE
     `loop-reviewer` with the pack path, its findings path,
     `REVIEW.md` path, `<main-repo>`.
   - reviewer → `MERGEABLE`/`REWORK <path>`. Spawn `loop-builder`
     `ship` with the findings path. One review per issue, never a
     second.
   - `loop-builder` `ship` → `SHIPPED <ship.md>`. Spawn
     `loop-shipper` `deliver` with ship.md.
   - `loop-shipper` `deliver` → `DELIVERED <report>`; `BLOCKED
     <deliver.md>` (QA NO-GO, comply residue, red gate) → spawn
     `loop-builder` `ship` once more with deliver.md, then `deliver`
     again with its `re-verify` list; a second `BLOCKED` → step 4 as
     flagged draft. `FAILED <path>` → step 5.

4. **Verify** — from the report + forge only:
   - MR exists, draft in draft mode, title `(closes #<n>)`;
   - contract with `Formes` and `Tests`; reviewer `Nécessaire`
     written, zero `Unpaid shape` left open; ship.md disposition
     table complete;
   - trio green, comply ZERO on branch files, pipeline not red (red →
     one fresh retry, then it is real);
   - review `MERGEABLE`, or `REWORK` with every finding `fixed`,
     `→ issue #<m>` or `dropped — <evidence>`;
   - QA GO/GO-PROVISIONAL or `QA: not run — <reason>`;
   - description per `PRESENTATION.md` (read once); a user-visible
     changed file → ≥1 `![…](/uploads/…)` capture.
   Non-conforming → SendMessage the shipper ONCE with the missing
   items; still non-conforming → step 5. Cap-hit review or ABORTED
   QA → confirm draft + findings comment, never merge, cleanup.
   Autonomous → merge squash, remove source branch, confirm the issue
   closed (split → tick the task). Both modes:
   ```bash
   git worktree remove ../<repo>-worktrees/issue-<n> --force && git worktree prune
   git branch -D agent/issue-<n> 2>/dev/null
   git -C <main-repo> pull --ff-only origin <default>
   ```

5. **Failure** — never merge, close the MR if opened, comment the
   issue with the summary, clean the worktree. NEEDS-CLARIFICATION:
   autonomous → both labels off + `agent-failed`; draft → skip list.
   Other: autonomous → `ready-for-agent` + `agent-failed`; draft →
   skip list.

6. **Relay** — the next spawn is in flight BEFORE the summary line:
   `✅ #<n> merged (!<mr>)` | `📝 #<n> drafted` |
   `⚠️ #<n> drafted flagged — <review|qa> not converged` | `❓ #<n>
   needs clarification` | `❌ #<n> failed → re-queued`.

## Rules

- One issue in flight: usage is the binding constraint of a fable
  loop.
- Forge list calls narrowed on the first attempt (`per_page`,
  `labels`, `state`); an overflowing response is parsed from its
  persisted file.
- An open dependency MR never stops the loop: stack on it.
- Never push to the default branch. Never merge with the trio red,
  comply beyond listed FPs, a red pipeline, an unpaid shape, a review
  not converged, or without QA GO.
- A finding that removes or corrects code is fixed in the MR; one
  that adds behaviour becomes an issue. The MR never grows in review.
- Only user interruption ends the loop; the acknowledging reply ends
  with `💡 /reflect — miner ce run pour des deltas de skills`.
