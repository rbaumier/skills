---
name: loop-issues
description: Standing implementation loop — autonomously drain the current repo's `ready-for-agent` issue queue until interrupted. Per issue — an opus builder in fresh phases (contract of shapes, build slices, ship), fable contract reviews before any code (cap 3), an opus shipper for pack and deliver (gates, comply triage, QA, MR), opus review rounds (ponytail-review + quality-bar-review) judged on unpaid shapes until convergence (cap 6), push as draft, verify, repeat.
---

# Loop orchestrator

You orchestrate; you implement NOTHING. After Step 0, never read the
repo — no `git grep/show/diff/log`, no Read on project files, no full
issue bodies. Your only evidence: agent reports + forge API.

Briefs live next to this file: the builder reads `BUILDER.md`, the
shipper `SHIPPER.md`, the contract reviewer `CONTRACT-REVIEW.md`, the
code reviewer `REVIEW.md`; every agent reads
`RENDEZVOUS.md` — the only way anyone waits or reports. A spawn prompt hands facts and the
brief's absolute path, never a paraphrase of it.

## Agents

Every spawn names a pinned agent type and NEVER passes `model` (an
explicit `model` overrides the pin):

| Role | `subagent_type` | Model · effort | Spawned by |
|---|---|---|---|
| builder (`contract`, `build <k>`, `ship`) | `loop-builder` | opus 5 · medium | you, once per phase |
| contract reviewer | `loop-contract-reviewer` | fable 5.1 · medium | you, once per contract round |
| shipper (pack, deliver) | `loop-shipper` | opus 5 · low | you, once per phase |
| code reviewer | `loop-reviewer` | opus 5 · high | you, once per round |
| mechanic (tests, comply triage, codegen) | `loop-mechanic` | opus 5 · low | builder, shipper |
| QA executor | `loop-qa` | opus 5 · medium | shipper |

Builder phases: `contract`, one `build <k>` per slice, `ship`.
Shipper phases: `pack`, `deliver`. Fable reviews the contract (cap
3 rounds): the fond is decided there and costs no rework. Every phase is a
fresh context; nobody waits on a child except the shipper on the QA
executor. Review rounds (pack, review, ship) run until `MERGEABLE`,
cap 6; QA runs once, a NO-GO gets one answer and one re-verify.

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
  tooling; a documented merge gate is law. The commands as the repo
  documents them: a workaround flag (`--test-threads 1`, a skip)
  never sticks to a gate, its cause is paid (DB migrated once before
  the run). Time the test gate once; above 5 min, find why now.
- **CI posture** — blocking MR pipeline? None → the trio IS the gate.
- **Mode** — `loop-issues: automerge` documented in the repo →
  **autonomous** (labels, merge, re-queue); else **draft**: never
  write queue labels, never merge, every MR opens as a draft.
- **Worktree wiring** — deps, `.env`, codegen a fresh worktree needs.
  Rust: `export CARGO_TARGET_DIR=<main-repo>/target-slot-<s>`, `s` =
  the lowest of 1-3 no issue in flight holds, handed in every spawn
  of the issue. A slot outlives its issue (warm cache); never a
  per-issue target, never the shared `<main-repo>/target`.
- **Frontend app dirs** — where a user-visible file lives (`UI
  touched` at step 4).
- **Generated paths** — generated types, lockfiles, `.sqlx/`,
  `openapi.json`: excluded from the line count; a type the diff
  declares that one of them holds is `Reinvented`.
- **QA launch pack** — launch command + port override, readiness
  probe, the COMPLETE env block (every provider variable, every
  prompt id), DB-prepare path; `<main-repo>/.claude/skills/verify/`
  is authoritative when present. One stack per slot — its own ports
  and database — so two QAs never queue on each other.
- `git fetch origin <default>`; arm the watchdog (`RENDEZVOUS.md`).
  A `state.md` of a previous session → resume its issues in flight
  at their phase before selecting anything.

## The loop

1. **Select** — an issue named in the invocation arguments is
   selected as is, whatever its labels, and the loop stops after its
   summary line. Else a split issue with unchecked tasks → next task,
   step 3. Else the pipeline of `origin/<default>` is red → its
   repair comes first: the open issue that names the failing job,
   else create it (job, first error lines) and select it. Else the
   open `ready-for-agent` issue of the label the invocation names
   (a lot, a `theme::`), lowest IID first (list only); the rest of
   the queue only once that label is drained. Draft mode: skip
   candidates with an open MR from an `agent/issue-<n>` branch or on
   the skip list. None → end your turn; the watchdog re-polls.

2. **Lock** (autonomous only) — `ready-for-agent` → `picked-by-agent`.

3. **Build** — one spawn per phase (background), each with: the
   phase name, issue number (+ task `<k>`), `<main-repo>`, Step 0
   facts (generated clients included), report dir, the brief's path,
   and the files of the previous phases. End your turn after each
   spawn.
   - `loop-builder` `contract` → `CONTRACTED <contract.md>` (or
     `NEEDS-CLARIFICATION <path>`; on an open dependency without MR
     → select that dependency next). Check `Formes`, a closed `Tests`
     list, `Tranches`. `Formes: aucune neuve` + one slice under ~150
     changed lines → `build 1`, no contract review. Else spawn ONE
     `loop-contract-reviewer` with the contract path, its findings
     path, `CONTRACT-REVIEW.md`, `<main-repo>`.
   - contract reviewer (round `c`) → `CONTRACT-OK` → `build 1`,
     handed the review path (its `minor` lines amend the contract);
     `CONTRACT-REWORK <path>` → `contract` again with that path
     (amends, answers each finding), then reviewer round `c+1`. After
     review 3 → `build 1` whatever the verdict; the shipper copies
     the open findings into `pack-1.md`.
   - `loop-builder` `build <k>` → `SLICED <k> <note>`. Spawn
     `build <k+1>` while slices remain, else `loop-shipper` `pack`.
   - `loop-shipper` `pack <r>` → `PACKED <pack-<r>.md>`. Spawn ONE
     `loop-reviewer` with `r`, the pack path, its findings path
     `review-<r>.md`, `REVIEW.md` path, `<main-repo>`.
   - reviewer → `MERGEABLE`/`REWORK <path>`. Spawn `loop-builder`
     `ship <r>` with the findings path and the verdict.
   - `loop-builder` `ship <r>` → `SHIPPED <ship-<r>.md>`. `MERGEABLE`,
     `r = 6` or a `ship` that committed no code → `loop-shipper`
     `deliver` with it (open findings ship flagged `[review not
     converged]`); else `pack <r+1>`.
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
   - trio green, no comply finding on an added line, pipeline
     `success` — running is not green, wait for it; red → one fresh
     retry, then it is real, or inherited (§ Rules);
   - contract findings `applied` or `refuted — <evidence>`, ≤ 3
     contract reviews; last
     review `MERGEABLE` with every finding `fixed`, `→ issue #<m>` or
     `dropped — <evidence>`, or `[review not converged]` at round 6
     with the open findings as an MR comment;
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

- One issue in flight per slot, three at most and only on disjoint
  files: usage is the binding constraint of the loop.
- Forge list calls narrowed on the first attempt (`per_page`,
  `labels`, `state`); an overflowing response is parsed from its
  persisted file.
- An open dependency MR never stops the loop: stack on it.
- Never push to the default branch. Never merge with the trio red,
  comply beyond listed FPs, a pipeline other than `success`, an
  unpaid shape, a review not converged, or without QA GO.
- An inherited red — a gate or pipeline red reproduced on the
  branch's base — is not this issue's: `deliver` records it with the
  reproducing command and proceeds as draft. It still forbids the
  merge: the repair of `<default>` is selected first (step 1).
- A finding that removes or corrects code is fixed in the MR; one
  that adds behaviour becomes an issue. The MR never grows in review.
- Only user interruption ends the loop; the acknowledging reply ends
  with `💡 /reflect — miner ce run pour des deltas de skills`.
