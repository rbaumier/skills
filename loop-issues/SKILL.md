---
name: loop-issues
description: Standing implementation loop — autonomously drain the current repo's `ready-for-agent` issue queue until interrupted. Per issue — fable plan-contract, opus implementer in a worktree, comply gate, one review pass (opus code ‖ fable fond judged against the issue), fix everything, issue-scoped /qa gate (GO required), push, verify, merge, repeat.
---

# Continuous implementation loop orchestrator

## Role

You orchestrate; you implement NOTHING. Spawn agents, verify gates,
merge. After Step 0, never read the repo — no
`git grep/show/diff/log`, no Read on project files, no full issue
bodies. Your only evidence: agent reports + forge API.

Role briefs live next to this file: the planner reads `PLANNER.md`,
the implementer reads `IMPLEMENTER.md`, both reviewers read
`REVIEW.md`; you and the implementer read `RENDEZVOUS.md` — the only
way anyone waits or reports. A spawn prompt hands facts and the
brief's absolute path — never a paraphrase of the brief, and only
the inputs its section lists: the re-check never sees the pack, QA
never sees the reviews.

Model routing: fable = judgment pole, **two calls per issue, hard
cap** — the planner and the fond reviewer, once each (the fond judges
against the issue, free to contradict the contract); opus = everything
else (implementer, code reviewer, re-checks, QA). Run the loop from an
**opus session** (each spawn pins its own model). Fable session → print
one warning, continue.

Invoking this skill is standing authorization to commit, push, open
MRs/PRs and — in autonomous mode — merge.

## Rendezvous

Read `RENDEZVOUS.md` once, before Step 0: the harness facts, the only
way to wait (end your turn while an `Agent` child runs), the
fall-through rules for a notification that reaches you when it
shouldn't, and the watchdog.

## Step 0 — Discover the project (once)

All from repo docs/config (CLAUDE.md, `package.json` scripts,
`Makefile`, `justfile`) — never source files:

- **Forge** — `git rev-parse --show-toplevel` → `<main-repo>`;
  `git remote get-url origin` → forge + project path. GitLab → `gitlab`
  MCP tools (`project_id: "<group>/<project>"`), never `glab`; load
  schemas via ToolSearch (every spawned agent does the same before its
  first call). GitHub → `gh` CLI; label/merge semantics map 1:1.
  Going the other way — an MR URL in hand, its checkout to find — never
  infer the directory from the project name: they diverge here
  (`dashboard-v2` lives in `natalia-dashboard-v2`, `voicehandler` in
  `natalia-voicehandler`, project `natalia-v2` in `natalia-v3`). Match on
  the remote instead: `git -C <dir> remote get-url origin` across the
  candidate roots, or `git worktree list` from one you already know. A
  name glob that returns nothing is not evidence the checkout is absent.
- **Verification trio** — the repo's check + test + build commands and
  pinned tooling. A documented merge gate is law; else default to the
  package manager's `check`/`lint`, `test`, `build`.
- **CI posture** — blocking MR pipeline? If none, the local trio IS the
  merge gate; if yes, pipeline must also be green.
- **Mode** — label mutation + auto-merge require a documented per-repo
  opt-in (e.g. `loop-issues: automerge` in CLAUDE.md).
  - **autonomous** (opt-in present): lock issues with labels,
    auto-merge, re-queue failures.
  - **draft** (default, or unclear): NEVER write queue labels, NEVER
    merge; every MR/PR opens as a draft; human owns merge + labels.
    (Follow-up issues filed with `needs-triage` are still allowed.)
- **Worktree wiring** — what a fresh worktree needs (deps
  symlink/install, `.env` copy, codegen). Rust: ALWAYS
  `export CARGO_TARGET_DIR=<main-repo>/target` (sequential loop = one
  warm cache).
- **Frontend app dirs** — the source dirs whose files a user sees
  (e.g. `apps/webapp/src`, `apps/widget/src`), from the repo layout
  docs. Step 5 judges `UI touched` against this list.
- **Generated types** — the generated API/DB type files
  (openapi-typescript output, Supabase `types.ts`, prost/sqlx output),
  by path from the codegen scripts; handed to the implementer — a
  type the diff declares that one of them already holds is
  `Reinvented`.
- **QA launch pack** — launch command(s) + port override (the `avant`
  capture serves `<main-repo>` on a second port), readiness probe
  (URL + expected response), extra env, fastest DB-prepare path
  (prefer cloning a template DB). Passed to each implementer with the wiring.
- **Fresh base** — `git fetch origin <default>` once now.
- **Watchdog** — arm it (`RENDEZVOUS.md` § Watchdog); it is also the
  empty-queue re-poll.

## The loop

1. **Select** — split issue with unchecked tasks → take next task, go
   to step 3 (lock + checklist already exist). Else fetch the oldest
   open `ready-for-agent` issue (lowest IID; list only — reading the
   full issue is the planner's job). Draft mode: also skip candidates
   with an open MR from an `agent/issue-<n>` branch or on the
   in-session skip list. None → end your turn; the watchdog re-polls.

2. **Lock** (autonomous only) — swap `ready-for-agent` →
   `picked-by-agent` (read current labels, write adjusted set). Draft
   mode: skip.

3. **Plan** — a pre-planned contract already on disk for this
   candidate (step 4) → go straight to step 4. Else spawn ONE planner
   (`model: "fable"`, else `opus`; background) with: issue number
   (+ task for a split issue), `<main-repo>`, report path, and
   `PLANNER.md` (path). It ends `PLAN-READY <path>` or
   `NEEDS-CLARIFICATION <path>` → step 6.

4. **Implement** — spawn ONE implementer (`model: "opus"`, background)
   with: contract path, issue number (+ task `<k>`), Step 0 facts
   (mode, trio, wiring, QA pack, generated types), report dir, and
   `IMPLEMENTER.md` (path). It owns worktree → gates → review pass →
   fix → QA →
   presentation → push + MR, and reports back.

   While the implementer runs, none of its children's notifications
   should reach you — one that does is a fall-through
   (`RENDEZVOUS.md`). Use the wait to PRE-PLAN: right after spawning the implementer,
   spawn the next candidate's planner (step 3) — unless the candidate
   depends on the current issue, or is the next task of the current
   split (their base is still moving: plan those after the current
   push). A contract waiting at select time starts the next iteration
   at step 4; stale vs a merge that landed meanwhile is handled by the
   implementer's deviation rule, not by re-planning.

5. **Verify** — from the report + forge API only: MR exists,
   verification green, comply ZERO on the branch's files (a repo-wide
   delta = failed gate), pipeline not red, review pass
   converged (`IMPLEMENTER.md`: nothing to fix, or the last re-check
   `RECHECK OK`), QA GO/GO-PROVISIONAL or skipped-with-reason, AND
   the MR description holds the gabarit of `PRESENTATION.md` (read
   that file once, at first use): headingless prose funnel, one
   short sentence per line, `à valider :` bullets, required visual,
   agent record below the fold in ONE `<details>` block, no
   `## Plan`. **UI touched is judged from the MR's changed files**
   (forge API: any non-test, non-generated file under a frontend
   app dir from Step 0), never from the report alone — files say
   yes → ≥1 `![…](/uploads/…)` capture embedded, or the MR goes
   back. One item of the gabarit missing = non-conforming.
   Non-conforming description → SendMessage the implementer to
   rewrite it in place (`update_merge_request`, title and draft state
   intact; re-verify `draft:true` after the PATCH), then re-check.
   Missing review pass or QA = failure (step 6). Cap-hit review/QA or ABORTED
   QA is NOT: confirm the MR is a draft carrying the findings comment,
   never merge it, skip to cleanup. Then:
   - **draft mode** — no merge, no issue touches; leave the draft for a
     human;
   - **autonomous mode** — merge (GitLab
     `merge_merge_request squash: true` + remove source branch; GitHub
     `gh pr merge --squash --delete-branch`). GitLab flake: fresh MR
     may report false "conflicts" ~30s — retry before concluding (real
     conflict = local rebase + push). Confirm the issue closed (close
     manually if not). Split issue → tick the task checkbox instead.
   - **both** — cleanup + sync:
     ```bash
     git worktree remove ../<repo>-worktrees/issue-<n> --force && git worktree prune
     git branch -D agent/issue-<n> 2>/dev/null
     git -C <main-repo> pull --ff-only origin <default>
     ```
     Not on `<default>` or can't fast-forward → `fetch` only, never
     touch the working tree.

6. **Failure** — planner NEEDS-CLARIFICATION, implementer failure, or
   verification red after 2 fix attempts (cap-hit review/QA or ABORTED
   QA is NOT a failure — step 5 handles it):
   - never merge; close the MR if opened;
   - NEEDS-CLARIFICATION (blocked-on-human, not retryable):
     autonomous → remove BOTH labels, add `agent-failed` (re-adding
     `ready-for-agent` would re-pick the same unclear issue); draft →
     in-session skip list;
   - other failures: autonomous → remove `picked-by-agent`, re-add
     `ready-for-agent` + `agent-failed`; draft → skip list (human
     triages the reported failure);
   - comment the issue with a short failure summary (split issue: name
     the failed task);
   - clean up the worktree; next issue.

7. **Relay before the recap** — the next iteration's spawn (steps
   1–3, or step 4 on a pre-planned contract) is in flight BEFORE this
   iteration's summary line prints; a turn that ends with nothing
   running is the gap the user pays for. Empty queue → end the turn;
   the watchdog re-polls.

## Strict rules

- One task at a time — sequential merges keep each worktree based on a
  default branch containing the previous MR. (Pre-planning the next
  candidate is read-only and exempt.)
- Forge list calls are narrowed on the FIRST attempt (`per_page`, an
  explicit field list, a state or label filter). A response that
  overflows the token cap is never re-issued unchanged: it already
  landed in a persisted file, so parse that file.
- An open unmerged dependency MR never stops the loop — stack on it
  (the planner's stack check); "blocked by an unmerged MR" is not a
  failure reason.
- Never push to the default branch; everything through an MR/PR.
- Never merge with the trio red, comply beyond listed FPs, a red
  pipeline, a review not converged, or without QA GO/GO-PROVISIONAL (or
  a stated skip). Cap hits never cancel the MR — flagged draft, both
  modes.
- Every finding fixed, `nit` included; a follow-up issue for a finding
  on the diff or on a mechanism the diff touches is a process failure,
  and so is waving findings off as "scope creep"; a drop is evidence
  (`IMPLEMENTER.md`), never an opinion.
- Never stop on your own; only user interruption ends the loop.
- Per-iteration summary line, printed after the next spawn (step 7):
  `✅ #<n> merged (!<mr>/#<pr>) after <r> re-check(s)` |
  `📝 #<n> drafted …` | `⚠️ #<n> drafted flagged … — <review|qa> not
  converged` | `❓ #<n> needs clarification → commented` |
  `❌ #<n> failed → re-queued` — with ` task <k>/<K>` when split.
