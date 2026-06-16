---
name: loop-issues
description: Continuous implementation loop — pick ready-for-agent issues one at a time, spawn a fable implementer in a worktree that severe-reviews its own diff with a quality-bar pass before pushing, verify, merge, repeat. Use when the user wants to autonomously drain the ready-for-agent issue queue of the current repository, run a standing implement-and-merge loop, or keep shipping issues until interrupted.
---

# Continuous implementation loop orchestrator

## Your role

You are an orchestrator. You implement NOTHING yourself. Your only
responsibility is to keep the loop running by spawning implementer
agents (Agent tool, `model: "fable"`, else `"opus"`) and verifying that
each iteration finishes cleanly before starting the next one.

Invoking this skill is an explicit, standing authorization to commit,
push, create and **merge** MRs/PRs for the issues it processes — the
usual "commit/merge only on demand" rule is satisfied by invoking it.

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
- **Worktree wiring** — note what a fresh worktree needs to be usable
  (from CLAUDE.md or the repo's docs): typically symlinking
  `node_modules` from the main repo (or installing deps), copying
  `.env`, and running any required codegen step (route generation,
  prisma generate…). Pass these exact steps to each implementer.

## The loop (repeat indefinitely)

1. **Select** — fetch the oldest open issue labelled `ready-for-agent`
   (oldest = lowest number/IID). GitLab:
   `mcp__gitlab__list_issues` (`state: "opened"`,
   `labels: ["ready-for-agent"]`). GitHub:
   `gh issue list --label ready-for-agent --state open`. If there is
   none, wait ~60s (foreground `sleep` is blocked in this harness — use
   a background `Bash sleep 60` with `run_in_background: true` and
   resume on its notification), then re-poll.

2. **Lock** — remove `ready-for-agent`, add `picked-by-agent` so no
   other session picks the same issue: read the current labels from the
   selected issue, then write the adjusted set (GitLab:
   `mcp__gitlab__update_issue` with `labels: [...without
   ready-for-agent, "picked-by-agent"]`; GitHub: `gh issue edit
   --remove-label/--add-label`).

3. **Spawn** — launch ONE implementer via the Agent tool
   (`model: "fable"`, else `"opus"`; `run_in_background: true`) with these
   instructions:
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
     Then wire the worktree with the project-specific steps discovered
     in Step 0 (deps symlink/install, `.env` copy, codegen). Every file
     edit MUST use the worktree's absolute paths — editing the main
     repo's paths silently lands on the main working tree.
   - Read the issue in full (GitLab: `mcp__gitlab__get_issue` — MCP
     tool schemas load on demand via ToolSearch inside the agent;
     GitHub: `gh issue view <n>`), implement it in the worktree
     following the repo conventions (CLAUDE.md + its referenced docs),
     add/update the tests the issue lists.
   - Verify locally with the project's check + test + build commands
     (Step 0). When the repo has no blocking per-MR CI, this local trio
     IS the merge gate and must be green in the worktree.
   - Commit with `git add <explicit files>` (never `-A`), message
     following the repo's convention — default
     `type(scope): summary (closes #<n>)`. Never bypass a pre-commit
     hook with `--no-verify` unless the repo's docs name a legitimate
     exception.
   - Severe self-review BEFORE pushing: spawn ONE read-only review
     subagent (`model: "fable"`, else `"opus"`) loading
     `/coding-standards:quality-bar-review`. Give it the issue, the diff
     (`git -C <worktree> diff origin/<default>...HEAD`), and the
     changed-file list; have it apply every checklist dimension at a high
     bar, read call sites before flagging, and tag each finding
     `blocker`/`major`/`minor` with `file:line` and a fix.
   - Disposition EVERY finding, none dropped as "scope creep" or "a nit":
       - in this MR's scope → fix now (new commits); every `blocker`/`major`
         qualifies and MUST be fixed;
       - relevant but out of scope → file an issue (prefer the `/issue`
         skill when available, else GitLab `mcp__gitlab__create_issue` /
         GitHub `gh issue create`), unlabelled, linked, related findings
         grouped into one;
       - false positive or against the repo's conventions → drop it with a
         one-line reason.
     Relevant means it improves the codebase at any severity (a helper
     duplicated 4× belongs in a shared module). Re-verify and re-review
     until zero `blocker`/`major` and every finding fixed, filed, or
     dropped-with-reason; cap 3 rounds, else open no MR/PR and report
     failure.
   - Push the branch (`git push -u origin agent/issue-<n>`), then open
     the MR/PR targeting the default branch (GitLab:
     `mcp__gitlab__create_merge_request`; GitHub: `gh pr create`),
     title carrying `(closes #<n>)` and a `Closes #<n>` line in the
     description.
   - Report back: MR/PR URL, verification results, each finding's
     disposition (fixed / filed-issue link / dropped-with-reason), files
     touched.

4. **Verify & merge** — when the implementer finishes, check yourself:
   - the MR/PR exists, the agent reported verification green (if a
     pipeline ran, don't merge while it's red), and the review clean: zero
     `blocker`/`major`, every finding fixed or filed (none relevant
     dropped). A missing or still-flagged review is a failure (step 5);
   - then merge it (GitLab: `mcp__gitlab__merge_merge_request` with
     `squash: true`, remove the source branch; GitHub:
     `gh pr merge --squash --delete-branch`).
     Known GitLab flake: on a fresh MR, it may falsely report
     "conflicts exist" / not-mergeable for ~30s — wait and retry before
     concluding a real conflict (a real one is fixed by a local rebase
     + push of the branch);
   - the issue closed on merge (the `closes #<n>` keyword does it;
     close manually if not);
   - the worktree is cleaned up and the main repo's default branch is
     synced so the next iteration (deps symlink, codegen, any implementer
     that skips its own fetch) starts from a base that contains the MR/PR
     just merged:
     ```bash
     git worktree remove ../<repo>-worktrees/issue-<n> --force && git worktree prune
     git branch -D agent/issue-<n> 2>/dev/null
     git -C <main-repo> pull --ff-only origin <default>
     ```
     If the main repo isn't on `<default>` or the pull can't fast-forward,
     don't touch its working tree — `git -C <main-repo> fetch origin
     <default>` instead (the worktrees branch from `origin/<default>`, so
     a fresh fetch is what actually matters).

5. **Failure handling** — if the agent fails (incl. its review uncleared
   after 3 rounds), or verification stays red after 2 fix attempts:
   - do NOT merge; close the MR/PR if one was opened;
   - re-queue the issue: remove `picked-by-agent`, add back
     `ready-for-agent` plus `agent-failed`;
   - comment the issue with a short failure summary;
   - clean up the worktree, then move to the next issue.

6. **Resume** — go back to step 1 immediately.

## Strict rules

- One issue at a time — no parallelism (sequential merges keep each new
  worktree based on a default branch that already contains the previous
  MR/PR, avoiding cross-MR semantic conflicts).
- The implementer MUST load `coding-standards:quality-bar` + the
  language skill (and the repo's skill catalogue when CLAUDE.md defines
  one) before coding — an MR/PR produced without it is treated as a
  failure.
- Never push directly to the default branch: everything goes through an
  MR/PR.
- Never merge while the local verification commands are not green (or
  while a pipeline, if any, is red).
- The implementer's own review (a read-only subagent loading
  `/coding-standards:quality-bar-review`) is a hard merge gate: no merge
  unless it reports zero `blocker`/`major`.
- Every relevant finding (anything that improves the codebase, at any
  severity) is fixed or filed as an issue. Only false positives and
  repo-convention conflicts are dropped, with a reason. Waving a relevant
  finding away as "scope creep" is a process failure.
- Never stop on your own: only a user interruption ends the loop.
- After each iteration, print a one-line summary:
  `✅ #<n> merged (!<mr>/#<pr>) after <r> review round(s)` or
  `❌ #<n> failed → re-queued`.
