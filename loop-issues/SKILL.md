---
name: loop-issues
description: Standing implementation loop — autonomously drain the current repo's `ready-for-agent` issue queue until interrupted. Per issue — an opus builder in fresh phases (contract of shapes, build slices, ship), one opus contract review before any code, a sonnet shipper for pack and deliver (gates, comply triage, QA, MR), opus review rounds (ponytail-review + quality-bar-review) judged on unpaid shapes until convergence (cap 3), push as draft, verify, repeat.
---

# Loop orchestrator

You orchestrate; you implement NOTHING. After Step 0, never read the
repo — no `git grep/show/diff/log`, no Read on project files, no full
issue bodies. Your only evidence: agent reports + forge API.

Briefs live next to this file: the builder reads
`~/.claude/skills/loop-issues/BUILDER.md`, the shipper
`~/.claude/skills/loop-issues/SHIPPER.md`, the contract reviewer
`~/.claude/skills/loop-issues/CONTRACT-REVIEW.md`, the code reviewer
`~/.claude/skills/loop-issues/REVIEW.md`; every agent reads
`~/.claude/skills/loop-issues/RENDEZVOUS.md` — the only way anyone waits or reports. Each
pinned agent already names its brief: a spawn prompt never renames
one (a `REVIEWER.md` that does not exist cost a `find` in 41
reviews). A spawn prompt hands facts and the
brief's absolute path, never a paraphrase of it — and never rewrites a
phase's gate scope: the brief decides it (`pack r ≥ 2` runs the
touched crates only; a prompt that asked for the full trio there cost
~15 min on one lot, 2026-09).

## Agents

Every spawn names a pinned agent type and NEVER passes `model` (an
explicit `model` overrides the pin):

| Role | `subagent_type` | Model · effort | Spawned by |
|---|---|---|---|
| builder (`contract`, `build <k>`, `ship`) | `loop-builder` | opus 5.5 · medium | you, once per phase |
| contract reviewer | `loop-contract-reviewer` | opus 5.5 · medium | you, ONCE per issue |
| shipper (`pack`, `deliver`, `publish`) | `loop-shipper` | sonnet 5.5 · medium | you, once per phase |
| code reviewer | `loop-reviewer` | opus 5.5 · medium | you, once per round |
| mechanic (tests of the closed list, codegen, brakes, the queue head's merge) | `loop-mechanic` | sonnet 5.5 · medium | you, after a `build <k>` that lists tasks, on a brake, at the queue head |
| QA executor | `loop-qa` | opus 5.5 · medium | you, on `QA-READY` |

Builder phases: `contract`, one `build <k>` per slice, `ship`.
Shipper phases: `pack`, `deliver`, `publish`. The contract reviewer reviews it ONCE: the fond is decided there and costs no rework. Every phase is a
fresh context. Only YOU spawn: builder and shipper have no `Agent`
tool — a child's notification never resumes a subagent, it froze a
thread 30-60 min each time. Review rounds (pack, review, ship) run until `MERGEABLE`,
cap 3; QA runs once, a NO-GO gets one answer and one re-verify, a
`GO-PROVISIONAL` goes straight to `publish`.

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
- **Fresh instructions** — every spawn starts in THIS checkout and
  loads its `CLAUDE.md` and imports on every turn, whatever worktree it
  then works in. `git fetch origin` then `git diff --quiet HEAD
  origin/<default> -- CLAUDE.md CODING_STANDARDS.md docs/agents` fails
  → stop before any spawn and ask the user to start the loop from a
  checkout of the default branch (a stale one cost ~45k tokens per turn
  of every agent, 06-08/10/2026).
- **Verification trio** — check + test + build commands and pinned
  tooling; a documented merge gate is law. The commands as the repo
  documents them: a workaround flag (`--test-threads 1`, a skip)
  never sticks to a gate, its cause is paid (DB migrated once before
  the run). Time the test gate once; above 5 min, find why now.
- **CI posture** — blocking MR pipeline? None → the trio IS the gate.
- **Certifying gate** — a repo script that runs the gates on a pushed
  sha and posts a status on it (a `local-gates`-style status the
  forge or the release checks): record its path and its status name.
  It is a superset of the trio, so it REPLACES the trio at `deliver`
  and is the gate of the merge queue (step 4); none → the trio stays
  the gate everywhere.
- **Mode** — `loop-issues: automerge` documented in the repo →
  **autonomous** (labels, merge, re-queue); else **draft**: never
  write queue labels, never merge, every MR opens as a draft.
- **Worktree wiring** — deps, `.env`, codegen a fresh worktree needs.
  Rust: `CARGO_TARGET_DIR` stays unset, in every spawn and every
  gate: `cargo` goes through the `mbx` shim, which gives each
  worktree its managed target (linked as `apps/api/target`),
  restores compiled work from its store and prunes it itself. Never
  a `build-cache-*` nor a `target-slot-*`, never a `CARGO_TARGET_DIR`
  in a spawn prompt. `ci/check` refusing to run for want of mbx →
  `mbx doctor`. Artefacts that error on their own (E0463, E0460, a
  `.rlib` or `.rmeta` not found, typically after the disk filled) →
  `mbx doctor`, then `cargo clean -p <crate>` of the crates the
  error names; `cargo clean` of a whole target stays forbidden. A
  slot `s` = 1 by default (§ Rules: sequential); with parallel loops
  asked, the lowest slot no issue in flight holds. Handed in
  every spawn of the issue. Disk: before any gate, `df` the volume; under
  20 GB free it is a brake cleared first (test clones — § Slowness
  is yours), never a gate launched to discover an
  E0463. Worktrees and caches the loop did not create are the user's:
  reported in one 🐢 line with their size, never deleted. A slot
  owns its database and its QA ports. **Its OWN model
  database**, one per slot, never the shared one: a harness that
  clones `CREATE DATABASE … TEMPLATE` refuses the clone while any
  session holds the model open (`55006`), so one `psql` in another
  session reddens every slot at once. Measured 2026-09-22: one pack
  replayed its suite six times for this. Each slot exports its own
  `DATABASE_URL` on a database it created and migrated itself, and
  drops nobody else's — the repo's launch pack names its URL —
  migrated from the slot's own worktree before
  the gate: branches carry different migrations, so the model is
  rebuilt per run, never shared and never inherited. The slot's QA
  stack runs on a DIFFERENT database from its model: an `api` binary
  left connected to the model reddens the slot's own gates exactly
  like a foreign session would (measured 2026-09-22, one `ship` fell
  back to a throwaway database for it). Slot 0 is kept for the repair of `<default>`,
  which never waits for a slot.
- **Frontend app dirs** — where a user-visible file lives (`UI
  touched` at step 4).
- **Generated paths** — generated types, lockfiles, `.sqlx/`,
  `openapi.json`: excluded from the line count; a type the diff
  declares that one of them holds is `Reinvented`.
- **QA launch pack** — per-slot values (model database URL, test
  clone pattern, report dir, dev sign-in), launch command + port override, readiness
  probe, the COMPLETE env block (every provider variable, every
  prompt id), DB-prepare path, the versioned seed recipe (the base
  every QA plan composes on), the dependency probes of the login path
  (IdP, CORS preflight from a slot's console origin);
  `<main-repo>/.claude/skills/verify/` is authoritative when present. One stack per slot — its own ports
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
     → select that dependency next). The FIRST `CONTRACTED` is never
     the contract: `SendMessage` the SAME builder (still live, its
     context intact — never a new spawn) this message, always the
     same, exactly once per issue, and nothing about it earlier (the
     builder must not know it is coming; `BUILDER.md` says nothing
     of it):
     ```
     now come up with a much simpler solution that provides 80% of the benefits we are talking about here

     Rewrite contract.md in place: keep `Besoin`; redo `Formes`, `Réutilise`, `Tests`, `Tranches` for that simpler solution. Add `## Simplification`, one line per thing dropped — what, and which criterion (or none) loses it. End with the same `CONTRACTED <contract.md>` line.
     ```
     → `CONTRACTED`. Then check `Formes`, a closed `Tests` list,
     `Tranches`.
     One slice under ~150 changed lines and no new table, route or
     dependency in `Formes` → `build 1`, no contract review: small
     issues ship in 30-60 min that way, where a contract review
     costs ~25 min for findings the code review catches as well. Else spawn ONE
     `loop-contract-reviewer` with the contract path, its findings
     path, `CONTRACT-REVIEW.md`, `<main-repo>`.
   - contract reviewer, **one round, never two** → `CONTRACT-OK` →
     `build 1`, handed the review path (its `minor` lines amend the
     contract); `CONTRACT-REWORK <path>` → `contract` once more with
     that path (amends, answers each finding) → `build 1` whatever
     that amendment says. The shipper copies the open findings into
     `pack-1.md` and the code review judges them on the diff.
     The first pass catches what a contract review is for — a defect
     already paid, a shape reinvented, a scope that fabricates work.
     Rounds beyond it argue prose: measured 2026-09-21 on one issue, four
     contract rounds and three reviews preceded a diff the code
     review passed `MERGEABLE` first try, and review 3 prescribed a
     migration order that was plainly wrong. A contract finding is
     cheap to carry into the code review; a round is not.
   - `loop-builder` `build <k>` → `SLICED <k> <note>`. A `## Mechanic`
     section in the note → spawn ONE `loop-mechanic` with it
     verbatim → `DONE <path>`. Then `build <k+1>` while slices
     remain, else `loop-shipper` `pack`.
   - `loop-shipper` `pack <r>` → `PACKED <pack-<r>.md>`. Spawn ONE
     `loop-reviewer` with `r`, the pack path, its findings path
     `review-<r>.md`, `REVIEW.md` path, `<main-repo>`.
   - reviewer → `MERGEABLE`/`REWORK <path>`. Spawn `loop-builder`
     `ship <r>` with the findings path and the verdict.
   - `loop-builder` `ship <r>` → `SHIPPED <ship-<r>.md>`. `MERGEABLE`,
     `r = 3` or a `ship` that committed no code → `loop-shipper`
     `deliver` with it (open findings ship flagged `[review not
     converged]`); else `pack <r+1>`.
   - `loop-shipper` `deliver` → `QA-READY <qa-handoff.md>` → spawn
     one `loop-qa` with it (in parallel with other slots' QAs only when parallel loops were asked) → verdict path → `loop-shipper` `publish`
     with it — `GO-PROVISIONAL` included, never a `ship`. `deliver`
     (no QA) or `publish` → `DELIVERED <report>` → step 4 in the SAME
     turn: a `QA: not run` lot goes deliver → verify → queue with no
     spawn in between and no turn ended on it; `BLOCKED
     <deliver.md>` (QA NO-GO, comply residue, red gate) → spawn
     `loop-builder` `ship` once more with deliver.md, then `deliver`
     again with its `re-verify` list; a second `BLOCKED` → step 4 as
     flagged draft. `FAILED <path>` → step 5.

4. **Verify** — from the report + forge only:
   - MR exists, draft in draft mode, title `(closes #<n>)`;
   - contract with `Formes`, `Tests` and a `## Simplification`
     section (the 80 % pass ran); reviewer `Nécessaire`
     written, zero `Unpaid shape` left open; ship.md disposition
     table complete;
   - certifying gate green on the head sha (trio green when Step 0
     found none), no comply finding on an added line. The forge
     pipeline does NOT gate the merge (user, 2026-09-22: "tant que
     ça passe en local c'est bon") — it runs the same trio, minutes
     to hours later, and waiting on it stalled finished work. Record
     its id, never block on it;
   - contract findings `applied` or `refuted — <evidence>`, ONE
     contract review; last
     review `MERGEABLE` with every finding `fixed`, `non payé —
     <raison>` or `dropped — <evidence>`, or `[review not converged]` at round 3
     with the open findings as an MR comment;
   - QA GO/GO-PROVISIONAL or `QA: not run — <reason>`;
   - description per `PRESENTATION.md` (read once); a user-visible
     changed file → ≥1 `![…](/uploads/…)` capture.
   Non-conforming → SendMessage the shipper ONCE with the missing
   items; still non-conforming → step 5. Cap-hit review or ABORTED
   QA → confirm draft + findings comment, never merge, cleanup.
   Autonomous → the lot is `READY` and enters the merge queue below;
   once merged, confirm the source branch removed and the issue
   closed (split → tick the task). Both modes, after the merge or the
   draft:
   ```bash
   wt=$(git -C ../<repo>-worktrees/issue-<n> rev-parse --show-toplevel)   # before the removal
   git worktree remove ../<repo>-worktrees/issue-<n> --force && git worktree prune
   git branch -D agent/issue-<n> 2>/dev/null
   # The checkout's gates model, named as ci/check derives it (repo with GATES_DATABASE_URL only),
   # and its `_p…` clones: nothing reclaims them once the model is gone.
   [ -n "${GATES_DATABASE_URL:-}" ] && m="${GATES_DATABASE_URL##*/}_$(printf %s "$wt" | shasum -a 256 | cut -c1-12)" &&
     psql "${GATES_DATABASE_URL%/*}/postgres" -Atc "select format('DROP DATABASE IF EXISTS %I;', datname) from pg_database
       where datname = '$m' or datname ~ '^${m}_p[0-9]{10}_[0-9a-f]{12}\$'" | psql "${GATES_DATABASE_URL%/*}/postgres" -q
   git -C <main-repo> pull --ff-only origin <default>
   ```
   No target to prune: mbx prunes the managed targets itself.

   **Merge queue** (autonomous) — you hold it, FIFO, in `state.md`. A
   lot enters only once step 4 is verified: verification happens
   before the merge task, never inside it. A head does NOT rebase
   because `<default>` moved: its branch head was certified as is, and
   it merges pinned on that sha with a merge commit, so a gate is
   never replayed for a sha that changed nothing (natalia-v3: ADR 0036,
   amendement du 30/09/2026 — the replay cost 45 to 50 min, and MR !811
   paid it four times in one night, twice with no conflict). A rebase
   happens only when the forge reports a real conflict
   (`has_conflicts`), and then the gate runs again, since the rebase
   mints a new sha. `<default>`'s tip is therefore not certified
   between two releases; the release's own gate finds a semantic
   conflict, and that repair goes first (step 1).
   The head is ONE `loop-mechanic` with this closed task: read the MR
   (`glab api projects/<id>/merge_requests/<iid>`); `has_conflicts`
   false and the certifying status green on its head → merge PINNED on
   that sha, nothing rerun. Conflicted → `git fetch`, rebase on
   `<default>` (unresolvable → `BLOCKED` naming the files), push
   `--force-with-lease`, run the certifying gate (the trio without
   one) in the foreground; green → merge PINNED on the certified sha
   with the project's merge method (`glab api -X PUT
   projects/<id>/merge_requests/<iid>/merge -f sha=<sha>`; GitHub
   `gh pr merge --match-head-commit <sha>`) → `DONE <merged sha>`;
   red → `BLOCKED <path>`, no merge. A `BLOCKED` head leaves the
   queue and goes back to `ship` with the gate output, like a
   `deliver` `BLOCKED`; an inherited red → the repair of `<default>`
   first (step 1). The next head's task is in flight before the relay
   line.

5. **Failure** — never merge, close the MR if opened, comment the
   issue with the summary, clean the worktree. NEEDS-CLARIFICATION:
   autonomous → both labels off + `agent-failed`; draft → skip list.
   Other: autonomous → `ready-for-agent` + `agent-failed`; draft →
   skip list.

6. **Relay** — at EVERY transition (phase to phase, verify to queue,
   one issue to the next), the next spawn is in flight BEFORE the
   summary line. No sub-orchestrator, no per-slot orchestrator: a
   child's notification never resumes a subagent (§ Agents). Summary
   lines:
   `✅ #<n> merged (!<mr>)` | `📝 #<n> drafted` |
   `⚠️ #<n> drafted flagged — <review|qa> not converged` | `❓ #<n>
   needs clarification` | `❌ #<n> failed → re-queued`.

## Slowness is yours

Every stall of the loop is your defect to remove, never a fact to
report and wait out. Budgets, spawn → notification: builder 40 min,
shipper 60, reviewer 15, mechanic 15, QA 25. A phase over budget, a
report naming an obstacle outside the diff (stuck process, taken
port, stale or locked database, cold or purged target, missing env
var, workaround flag, tool missing from PATH, red inherited from
`<default>`), or the same cause in two reports of any issue → it is
a **brake**: before the next phase spawn, remove it — a
`loop-mechanic` with the exact command (kill, free the port, migrate
the slot's database, restore the env, drop the flag) when it is
environmental, an issue selected at slot 0 like a red `<default>`
when it is code — and write `state.md` § Freins: cause, action,
hours lost. A flaky test seen red in two reports is such a brake
whatever each report concluded: its repair jumps to slot 0, ahead of
the queue, never re-run until it passes. An agent that ends its turn
"waiting" on its own background gate is a brake too (RENDEZVOUS.md
§ Waiting). A brake you cannot remove (usage limit, a decision only
the user owns) is reported at once in one line `🐢 <cause> —
<what it costs per hour> — <the one action needed>`, never buried
in a relay line. The next relay line carries every brake handled
since the last: `🔧 <cause> → <action>`.

## Rules

- **Sequential by default: one agent in flight, ever.** One issue at
  a time, one phase spawn at a time, slot 1 only; the next spawn
  leaves only once the previous agent has reported. Parallel loops
  run only when the user asks for them in the invocation or the
  conversation ("en parallèle", "N slots"), and then up to the
  number of slots they name. The user's own rule
  (2026-10-08, after three lots ran in parallel unasked): usage and
  disk are the binding constraints, and one agent at a time keeps
  both readable.
- When parallel was asked: each issue holds its slot, only on
  disjoint files, and every phase runs in parallel across slots,
  browser QA and `publish` captures included: each slot has its own
  console port (the launch pack's per-slot port) and each `loop-qa`
  opens its own `new_page` with an `isolatedContext` named after its
  slot, passing that `pageId` to every chrome-devtools call — never
  `select_page`, never a page it did not open. Never queue a QA
  behind another slot's.
- Disjoint means disjoint at the FILE level, not the theme level.
  Three issues that all touch one screen are serial work wearing a
  parallel costume: the same files conflict, which is now the one thing
  that still forces a rebase, and a rebase replays the full trio.
  Measured 2026-09-21: one issue was rebased three
  times in one evening; another run paid 50 + 21 + 19 min of
  rebases on three issues of one feature. Issues on one surface go
  to ONE slot, in sequence. When the queue
  offers nothing disjoint, run fewer slots than asked — a slot left
  idle costs less than a rebase chain. Name the touched surface of
  each issue in flight and check the next candidate against it
  before selecting, rather than trusting a shared label to separate
  them.
- Forge list calls narrowed on the first attempt (`per_page`,
  `labels`, `state`); an overflowing response is parsed from its
  persisted file.
- An open dependency MR never stops the loop: stack on it.
- Never push to the default branch. Never merge with the certifying
  gate (or the trio) red, on a sha it did not certify, with comply
  beyond listed FPs, an unpaid shape, a review not converged, or
  without QA GO. A pipeline pending or red does NOT hold a merge
  whose local gate is green.
- A fix to the repo's environment docs (the verify skill, a launch
  pack line) found during the loop never opens its own MR: agents
  read the main checkout's copy, so it travels in the next lot of
  that repo, listed under the MR's écarts.
- An inherited red — a gate red reproduced on the branch's base —
  is not this issue's: `deliver` records it with the reproducing
  command and proceeds as draft. It still forbids the merge: the
  repair of `<default>` is selected first (step 1).
- **No phase of this loop ever opens an issue on the forge.** The
  queue grew by 101 issues in three days because every phase filed
  its leftovers (user, 2026-09-24: "je croyais que tu arrêtais d'en
  créer et que tu les intégrais dans les mrs en cours"). A finding
  that removes or corrects code is fixed in the MR; one that adds
  behaviour is paid in the MR when it lands in a file the lot
  already touches, and otherwise written as ONE line under
  `## Constats non payés` in the phase report — never filed, never
  referenced as `Refs #`. The MR never grows in review beyond that.
  "Adds behaviour" is not the whole test — three findings are fixed in
  the MR whatever they look like: a duplication THIS MR posted (the
  second copy is the MR's own debt, never a successor's), any finding
  inside a function the MR already rewrote, and any finding under
  fifteen lines that opens no new file and settles no scope question.
  Measured 2026-09-23 on the fifteen issues one evening opened: nine
  fit their own MR, seven of them under fifteen lines without a new
  file, and three of the five invisible debts were duplications the
  MR itself had just posted. An issue is for work a successor must
  scope, not for a remedy already under the author's hand.
- Only user interruption ends the loop; the acknowledging reply ends
  with `💡 /reflect — miner ce run pour des deltas de skills`.
