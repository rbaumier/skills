---
name: loop-issues
description: Continuous implementation loop — pick ready-for-agent issues one at a time, spawn a fable implementer in a worktree that must pass a comply gate, an adversarial review/fix loop (persistent fable reviewer, converges when only nits remain, cap 8 rounds), and an issue-scoped /qa gate (opus executor drives the running app, GO or GO-PROVISIONAL required) before pushing, verify, merge, repeat. Use when the user wants to autonomously drain the ready-for-agent issue queue of the current repository, run a standing implement-and-merge loop, or keep shipping issues until interrupted.
---

# Continuous implementation loop orchestrator

## Your role

You are an orchestrator. You implement NOTHING yourself. Your only
responsibility is to keep the loop running by spawning implementer
agents (Agent tool, `model: "fable"`, else `"opus"`) and verifying that
each iteration finishes cleanly before starting the next one.

Invoking this skill is an explicit, standing authorization to commit,
push, create MRs/PRs and — when the project opts into autonomous mode
(Step 0) — **merge** them for the issues it processes; the usual
"commit/merge only on demand" rule is satisfied by invoking it.

## Step 0 — Discover the project (once, at loop start)

Everything below is derived from the current repository; nothing is
hardcoded:

- **Forge & project path** — `git rev-parse --show-toplevel` for
  `<main-repo>`, then `git remote get-url origin` to identify the forge
  and the project path (e.g. `gitlab.com/<group>/<project>` or
  `github.com/<owner>/<repo>`).
  - **GitLab** → use the `gitlab` MCP server (`mcp__gitlab__*` tools,
    `project_id: "<group>/<project>"`), never `glab`. Load the tool
    schemas once via ToolSearch.
  - **GitHub** → use the `gh` CLI (`gh issue list`, `gh pr create`,
    `gh pr merge`…). The label/merge semantics below map 1:1.
- **Verification commands** — read the repo's `CLAUDE.md` (and
  `package.json` scripts / `Makefile` / `justfile`) to find the
  project's check + test + build commands and any pinned tooling rules
  (e.g. a specific type-checker). If the repo documents a merge gate,
  that gate is law. If nothing is documented, default to the package
  manager's `check`/`lint`, `test`, `build` scripts when they exist.
- **CI posture** — determine whether MRs/PRs get a blocking CI
  pipeline. If they don't (or CI is a manual/deploy-time gate), the
  local verification trio IS the merge gate. If they do, the pipeline
  must also be green before merging.
- **Automation posture (label + merge policy)** — determine whether the
  project sanctions the loop mutating issue labels and auto-merging. This
  is an explicit per-project opt-in: the repo's CLAUDE.md (or a doc it
  references) must document it — e.g. a `loop-issues: automerge` line or
  an equivalent statement that autonomous merge is allowed. Two modes
  result, and every step below branches on them:
  - **autonomous** (opt-in present) → the full flow: lock issues with
    labels, auto-merge each MR/PR, re-queue failures with labels.
  - **draft** (default — nothing documented) → NEVER mutate issue labels
    and NEVER merge; open every MR/PR as a **draft** for a human to
    review, merge, and re-label. Implement, verify, comply gate,
    review/fix loop, and QA gate are identical.
  When the opt-in is unclear, you are in draft mode.
- **Worktree wiring** — note what a fresh worktree needs to be usable
  (from CLAUDE.md or the repo's docs): typically symlinking
  `node_modules` from the main repo (or installing deps), copying
  `.env`, and running any required codegen step (route generation,
  prisma generate…). Pass these exact steps to each implementer.

## The loop (repeat indefinitely)

1. **Select** — if the current issue was split (see below) and still
   has unchecked tasks, take the next one in order and go straight to
   step 3 (the lock is already in place). Otherwise fetch the oldest
   open issue labelled `ready-for-agent`
   (oldest = lowest number/IID). GitLab:
   `mcp__gitlab__list_issues` (`state: "opened"`,
   `labels: ["ready-for-agent"]`). GitHub:
   `gh issue list --label ready-for-agent --state open`. In **draft
   mode** there is no `picked-by-agent` lock, so also skip any candidate
   already covered by an open MR/PR from an `agent/issue-<n>` branch (its
   draft is open) or on the in-session skip list (a prior failure) —
   without this the loop would re-draft the same issue every pass. If
   there is none, wait ~60s (foreground `sleep` is blocked in this
   harness — use
   a background `Bash sleep 60` with `run_in_background: true` and
   resume on its notification), then re-poll.

   **Split check** — read the issue in full. If it is too big for one
   human-reviewable MR/PR (several independent deliverables, or a change that would span
   many modules), split it into ordered tasks — each a vertical slice
   that merges through its own MR/PR and leaves the default branch
   green — and post the plan as a checklist comment on the issue (one
   checkbox per task) so it survives interruptions. One loop iteration
   = one task; an unsplit issue counts as a single task. The issue
   stays locked (step 2) until its last task merges.

2. **Lock** (autonomous mode only) — remove `ready-for-agent`, add
   `picked-by-agent` so no other session picks the same issue: read the
   current labels from the selected issue, then write the adjusted set
   (GitLab: `mcp__gitlab__update_issue` with `labels: [...without
   ready-for-agent, "picked-by-agent"]`; GitHub: `gh issue edit
   --remove-label/--add-label`). In **draft mode** skip this step
   entirely (no label writes); the step-1 selection guard prevents
   re-picking.

3. **Spawn** — launch ONE implementer via the Agent tool
   (`model: "fable"`, else `"opus"`; `run_in_background: true`) with these
   instructions (include the Step 0 mode — autonomous or draft — so it
   knows whether to open the MR/PR as a draft):
   - Load the relevant skills BEFORE writing any code: ALWAYS
     `coding-standards:quality-bar` + the language skill
     (`language-typescript` or `language-rust`), then the area skills
     matching the issue (backend, frontend, tests…) — from the repo's
     CLAUDE.md skill catalogue when it has one. Apply their
     requirements to all produced code.
   - Create a dedicated worktree from up-to-date default branch
     (`<default>` = `main` unless the repo says otherwise):
     ```bash
     git fetch origin <default>
     git worktree add ../<repo>-worktrees/issue-<n> -b agent/issue-<n> origin/<default>
     ```
     For task `<k>` of a split issue, suffix both names:
     `issue-<n>-t<k>` / `agent/issue-<n>-t<k>`.
     Then wire the worktree with the project-specific steps discovered
     in Step 0 (deps symlink/install, `.env` copy, codegen). Every file
     edit MUST use the worktree's absolute paths — editing the main
     repo's paths silently lands on the main working tree.
   - Read the issue in full (GitLab: `mcp__gitlab__get_issue` — MCP
     tool schemas load on demand via ToolSearch inside the agent;
     GitHub: `gh issue view <n>`), implement it in the worktree
     following the repo conventions (CLAUDE.md + its referenced docs),
     add/update the tests the issue lists. For a split issue, implement
     ONLY the assigned task — the checklist comment is the contract; do
     not start the next task.
   - Verify locally with the project's check + test + build commands
     (Step 0). When the repo has no blocking per-MR CI, this local trio
     IS the merge gate and must be green in the worktree.
   - **comply gate** — when the `comply` binary is on PATH, run
     `comply <worktree>` (exit 0 = clean) and fix every violation BEFORE
     the review loop (deterministic findings cost zero review tokens).
     NEVER write a `comply-ignore`: a finding judged a false positive is
     not suppressed — list it in the MR/PR description for human triage;
     the gate is green when comply reports nothing beyond those listed
     false positives.
   - Commit with `git add <explicit files>` (never `-A`), message
     following the repo's convention — default
     `type(scope): summary (closes #<n>)` (`refs #<n>` for a non-final
     task of a split issue). Never bypass a pre-commit
     hook with `--no-verify` unless the repo's docs name a legitimate
     exception.
   - **Review/fix loop BEFORE pushing** — spawn ONE read-only reviewer
     subagent (`model: "fable"`, else `"opus"`) loading
     `/coding-standards:quality-bar-review`, the language skill and
     `/thermo-nuclear-code-quality-review`, plus the area skills in the
     MR/PR's scope. Round 1 input: the issue, the full diff
     (`git -C <worktree> diff origin/<default>...HEAD`), the
     changed-file list. The review is EXHAUSTIVE — every finding, never
     a top-N — each tagged `blocker`/`major`/`minor`/`nit` with
     `file:line` and a fix, call sites read before flagging. Each round
     it writes its findings to a file outside the worktree (scratchpad
     or `/tmp`) and ends with ONE line — verdict + that path. It must
     NOT SendMessage its report: a background child is never given its
     parent's id, and a name-addressed reply fails ("No agent named …
     is reachable").
   - Disposition EVERY finding yourself (the reviewer never edits), none
     dropped as "scope creep":
       - in this MR's scope → fix now (new commits); every `blocker`/`major`
         qualifies and MUST be fixed;
       - relevant but out of scope → file an issue (prefer the `/issue`
         skill when available, else GitLab `mcp__gitlab__create_issue` /
         GitHub `gh issue create`), unlabelled, linked, related findings
         grouped into one;
       - false positive or against the repo's conventions → drop it with a
         one-line reason.
     Relevant means it improves the codebase at any severity (a helper
     duplicated 4× belongs in a shared module). Fix from the findings
     and the current diff — do not re-read files the fixes don't touch.
   - Next round: the reviewer cannot wake you directly — its completion
     notification goes to the orchestrator, which forwards you a
     one-liner (verdict + report path). End your turn while a round
     runs (never poll); on the wake, read the report file, disposition,
     then `SendMessage` the SAME reviewer BY AGENT ID (from the spawn
     result) with only the fix commits' diff
     (`git diff <head-before-fixes>..HEAD`) — its skills and the full
     diff stay in its context. Never respawn a reviewer mid-loop.
   - **Converged** = the reviewer reports nothing above `nit`; hard cap
     8 rounds.
   - **QA gate AFTER the review loop** — prove the change works by
     driving it, not only by tests. Skip ONLY when the MR/PR touches no
     user-reachable surface (pure refactor, docs, CI) — then write
     `QA: not run — <reason>` in the MR/PR description. Otherwise spawn
     ONE QA executor (`model: "opus"` — never fable: fable writes the
     plan, opus drives) that reads `~/.claude/skills/qa/SKILL.md`
     (user-invoked skill — not reachable via the Skill tool) and
     follows it. Hand it the plan, pre-filling its Scope/Enumerate
     phases: target + launch command (Step 0 discovery, the repo's
     docs, or the `/run` skill), host allowlist, a use-case matrix
     scoped to the issue's deliverables and their error paths (never
     the whole app), the tooling matched to the surfaces the MR/PR
     touches (no browser when no UI changed — an API-only change is
     driven over HTTP), a ~15 min budget, and a run dir OUTSIDE the
     worktree (scratchpad — evidence must never land in the branch).
     It executes smoke, harness, assault, report, and — like the
     reviewer — ends with ONE line: verdict + the `<run-dir>/report.md`
     path, never a SendMessage.
   - QA verdicts: **GO** and **GO-PROVISIONAL** pass — copy
     GO-PROVISIONAL's reservations (BLOCKED rows) into the MR/PR
     description. **NO-GO** → fix the findings, send the fix diff to
     the still-alive reviewer, re-run the failed rows (`SendMessage`
     the QA executor by agent id); cap 2 QA
     rounds, else the flagged-draft path below. **ABORTED** (broken
     env, no launch path): draft mode → note it in the description;
     autonomous mode → never merge an un-QA'd surface change: open a
     flagged draft instead.
   - After the last fixes (review and QA), re-run the comply gate and
     the verification trio before pushing.
   - Push the branch (`git push -u origin agent/issue-<n>`), then open
     the MR/PR targeting the default branch (GitLab:
     `mcp__gitlab__create_merge_request`; GitHub: `gh pr create`),
     title carrying `(closes #<n>)` and a `Closes #<n>` line in the
     description. In **draft mode** open it as a DRAFT so it can't be
     merged automatically (GitLab: prefix the title with `Draft:`;
     GitHub: `gh pr create --draft`) — the human is the merge gate. If
     the review loop hit its 8-round cap or QA its 2-round cap without
     converging, STILL push and open the MR/PR — as a draft in BOTH
     modes, title carrying `[review not converged]` or
     `[qa not converged]`, remaining non-nit findings or failed QA rows
     posted as an MR/PR comment for human triage. For a
     split issue, only the LAST task carries `closes #<n>`; earlier tasks
     use `refs #<n>` so the issue stays open until its last task merges.
   - Report back: MR/PR URL, verification results, review rounds used
     and whether the loop converged, the QA verdict (or skip reason),
     each finding's
     disposition (fixed / filed-issue link / dropped-with-reason), files
     touched.

   While the implementer runs, its children's (reviewer, QA) completion
   notifications land on YOU, the orchestrator — not on it. Forward
   each to the implementer via `SendMessage` as the one-liner it
   carries (verdict + report path) and nothing more: recopying a full
   report into your thread wastes the cache the loop is designed to
   save.

4. **Verify** — when the implementer finishes, check yourself: the MR/PR
   exists, the agent reported verification AND comply green (if a
   pipeline ran, don't proceed while it's red), and the review loop
   converged — nothing above `nit`, every finding fixed, filed, or
   dropped-with-reason — and the QA gate reported GO/GO-PROVISIONAL
   (reservations in the description) or was skipped with a stated
   reason. A missing review loop or QA gate is a failure (step 5). A
   review loop at its 8-round cap or QA at its 2-round cap is NOT:
   confirm its MR/PR is a flagged
   draft carrying the findings comment, never merge it (even in
   autonomous mode — a human triages it), and skip to the worktree
   cleanup below.
   Then branch on the Step 0 mode:
   - **draft mode** — do NOT merge and do NOT touch the issue (no label
     writes, no checkbox tick, no manual close): leave the draft MR/PR
     open for a human to review, merge, and label, then go straight to
     the worktree cleanup below;
   - **autonomous mode** — merge it (GitLab:
     `mcp__gitlab__merge_merge_request` with `squash: true`, remove the
     source branch; GitHub: `gh pr merge --squash --delete-branch`).
     Known GitLab flake: on a fresh MR, it may falsely report
     "conflicts exist" / not-mergeable for ~30s — wait and retry before
     concluding a real conflict (a real one is fixed by a local rebase
     + push of the branch). Then confirm the issue closed on merge (the
     `closes #<n>` keyword does it; close manually if not). For a split
     issue, tick the task's checkbox in the plan comment instead; the
     issue itself closes only when the last task merges.
   Then, in **both modes**:
   - the worktree is cleaned up and the main repo's default branch is
     synced so the next iteration (deps symlink, codegen, any implementer
     that skips its own fetch) starts from an up-to-date base (in
     autonomous mode this already contains the MR/PR just merged):
     ```bash
     git worktree remove ../<repo>-worktrees/issue-<n> --force && git worktree prune
     git branch -D agent/issue-<n> 2>/dev/null
     git -C <main-repo> pull --ff-only origin <default>
     ```
     If the main repo isn't on `<default>` or the pull can't fast-forward,
     don't touch its working tree — `git -C <main-repo> fetch origin
     <default>` instead (the worktrees branch from `origin/<default>`, so
     a fresh fetch is what actually matters).

5. **Failure handling** — if the agent fails, or verification stays red
   after 2 fix attempts (a review loop or QA gate at its round cap is
   NOT a failure — step 4 handles its flagged draft):
   - do NOT merge; close the MR/PR if one was opened;
   - **autonomous mode** — re-queue the issue: remove `picked-by-agent`,
     add back `ready-for-agent` plus `agent-failed`;
   - **draft mode** — no label writes: add the issue to the in-session
     skip list (see step 1) so the loop doesn't immediately re-pick it;
     there is no `agent-failed` label to carry the failure across
     sessions, so a human triages the reported failure;
   - comment the issue with a short failure summary (for a split
     issue, name the failed task — merged tasks stay ticked, and the
     next pick resumes from the failed one);
   - clean up the worktree, then move to the next issue.

6. **Resume** — go back to step 1 immediately.

## Strict rules

- One task at a time — no parallelism (sequential merges keep each new
  worktree based on a default branch that already contains the previous
  MR/PR, avoiding cross-MR semantic conflicts).
- The implementer MUST load `coding-standards:quality-bar` + the
  language skill (and the repo's skill catalogue when CLAUDE.md defines
  one) before coding — an MR/PR produced without it is treated as a
  failure.
- **Label + merge policy** — mutating issue labels and auto-merging
  require the project's documented opt-in (Step 0 automation posture).
  Absent it, the loop runs in **draft mode**: it opens draft MRs/PRs,
  never merges, and never writes issue labels; a human owns the merge and
  the labels. When the opt-in is unclear, you are in draft mode.
- Report routing is a harness constraint: a background child cannot
  address its parent, and its completion notification lands on the
  orchestrator. Reviewer and QA report via a file + one-line verdict;
  the orchestrator forwards only that line to the implementer, who
  reads the file and owns every disposition. Recopying a verbatim
  report anywhere is a process failure.
- Never push directly to the default branch: everything goes through an
  MR/PR.
- Never merge while the local verification commands are not green (or
  while a pipeline, if any, is red).
- The review/fix loop, the comply gate, and the QA gate are the hard
  merge gate: no merge unless the loop converged (nothing above `nit`),
  comply is green, and QA reported GO/GO-PROVISIONAL (or was skipped
  because no user-reachable surface changed). Hitting a round cap never
  cancels the MR/PR — it opens as a flagged draft for human triage, in
  both modes.
- Every relevant finding (anything that improves the codebase, at any
  severity) is fixed or filed as an issue. Only false positives and
  repo-convention conflicts are dropped, with a reason. Waving a relevant
  finding away as "scope creep" is a process failure.
- Never stop on your own: only a user interruption ends the loop.
- After each iteration, print a one-line summary:
  `✅ #<n> merged (!<mr>/#<pr>) after <r> review round(s)` (autonomous),
  `📝 #<n> drafted (!<mr>/#<pr>) after <r> review round(s)` (draft),
  `⚠️ #<n> drafted flagged (!<mr>/#<pr>) — <review|qa> not converged`, or
  `❌ #<n> failed → re-queued` — with ` task <k>/<K>` after `#<n>` when
  the issue was split.
