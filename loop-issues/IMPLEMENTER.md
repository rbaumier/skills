# Implementer brief — loop-issues

You were handed: contract path, issue number (+ task `<k>`), Step 0
facts (mode, verification trio, worktree wiring, QA launch pack,
generated-type files), report dir (scratchpad, outside any worktree).
Follow this file to the letter; a relay from the orchestrator means
you stalled.

**Rendezvous:** read `RENDEZVOUS.md` (next to this file) before your
first spawn — the only way you wait (end your turn while an `Agent`
child runs; everything else in the foreground) and the only way you
and your children report (`<report>.done` as the last write).

## Build

- **Skills first** — before any code, load
  `coding-standards:quality-bar` + every skill of
  `~/.claude/skills/_shared/SKILLS.md` the contract's files and the
  issue call for — you decide, one trigger per pick. Re-read the
  catalog against your diff before the round pack: a file you touched
  can pull a skill the contract did not. An MR produced without them
  is a failure.
- **Worktree** —
  ```bash
  git fetch origin <default>
  git worktree add ../<repo>-worktrees/issue-<n> -b agent/issue-<n> origin/<default>
  ```
  Stacked base → substitute `origin/<base>` here and in every later
  diff. Split task → suffix `-t<k>` on both names. Wire it (Step 0
  facts), then edit ONLY worktree absolute paths.
- **Implement** the assigned task per contract + repo conventions,
  with the contract's tests. The contract's `Budget`, `Réutilise` and
  `Types` lines are binding: over budget → `## Écarts au plan` with
  the issue line that pays for it, or cut; no local copy of a
  mechanism the repo has, no
  client-declared type for a server/DB shape; a copy elsewhere of a
  mechanism you touch follows `quality-bar` (second copy = refactor) —
  the wide-grep remainder goes in `à valider :`. Code contradicts contract → deviate and record in
  `## Écarts au plan` (a changed DECISION — approach, scope, tests;
  wording drift is no écart). Planner is gone — never consult it.
  Deleting another contributor's scaffold/WIP is never silent "dead
  code": call it out in the MR and notify the author on the issue.
- **Verify** with the trio in the worktree, foreground (green = merge
  bar when no CI). Rust: `cargo nextest run` when installed; warm cache is
  merge-critical — mass `touch`, `CARGO_INCREMENTAL=0`, `cargo clean`
  BANNED unless the MR records why.
- **comply gate** — `comply` on PATH → `comply --working-tree
  <worktree>` (post-commit: `--range origin/<base> HEAD`). ZERO
  diagnostics on the branch's files BEFORE review, pre-existing
  included; never `--diff-only`, never a repo-wide count or delta —
  each limit holds alone (chopping sentences to pay for a bloated
  block trades one rule for another: rewrite properly). Two passes
  per task MAX: this one and the pre-push re-run. NEVER write a
  `comply-ignore`: judged false positives are listed in the MR for
  human triage; gate green = nothing beyond those.
- **Measure gate** — the contract's `Mesure` line (`none` → skip): run
  it now and again after the fixes; both outputs join the round pack.
- **Commit** — `git add <explicit files>` (never `-A`); message per
  repo convention, default `type(scope): summary (closes #<n>)`
  (`refs #<n>` for a non-final split task). No `--no-verify`.
- **Express lane** (contract says `Lane: express`) — gates stay,
  surface shrinks: code reviewer loads `quality-bar-review` + language
  skill only; QA = smoke on the diff's matrix rows, ~5 min; MR prose =
  the express variant in `PRESENTATION.md`. Escalation one-way: first
  red signal (scope exceeded, any `blocker`/`major`, failed QA row,
  comply beyond listed FPs) → standard lane for the rest.

## Review — one pass, before push

Assemble the **round pack**: ONE scratchpad file with the issue body
(fetch it yourself), contract path, changed-file list, a `## Skills`
section = your picks, one `<skill> — <trigger>` line each (`none`
when empty), full diff, the measure output. Spawn BOTH reviewers in ONE message, each handed the
pack path, its own findings path and `REVIEW.md` (path — its
section): the code reviewer (`model: "opus"`,
`subagent_type: "loop-reviewer"`) and the fond reviewer
(`model: "fable"`, `subagent_type: "loop-fond-reviewer"`, plus
`<main-repo>` for read-only git); then end your turn — the first
completion resumes you, the other still running → end it again.
Between the spawn and the end of
your turn — unless the QA skip applies (no user-reachable surface) —
boot the QA stack (launch pack, backgrounded, never awaited): by the
fix the probe is green.

**Fix everything.** Every finding from both reviewers is fixed in this
MR, `nit` included — there is no round for arguing:

- a finding is a pattern: fix every occurrence in the diff;
- a finding on the diff, or on a mechanism the diff touches, is NEVER
  a follow-up issue — the only follow-up allowed is the contract
  batch of an expand–contract the fond reviewer accepted as too wide;
- a "scope creep" or Speculative Generality finding is fixed by
  REMOVING code;
- a drop needs evidence in the disposition table: false positive (the
  line), repo convention (the file), or **remedy dearer than the
  defect** — the grep or the measure that prices it (a helper with one
  caller, a query per row, +40 lines for −8); the re-check judges
  every drop.

Fix from findings + current diff; don't re-read untouched files.
Re-run trio, comply and the measure after the fixes; a
fix that breaks the `Mesure` bar is reverted and its finding dropped
with the numbers.

**Re-check** — any non-empty fix diff: spawn a NEW code reviewer
(`model: "opus"`, `subagent_type: "loop-reviewer"`) handed ONLY the
two round-1 reports, the disposition table (`fixed <commit>` /
`dropped — <evidence>`), the fix diff (`git diff
<head-before-fixes>..HEAD`, written to a file) and `REVIEW.md` (path —
§ Re-check); never the pack. Its findings path is
`review-recheck-<k>.md`. End your turn. Cap 2 re-checks; still
`RECHECK REWORK` at the cap → flagged-draft path (push below). Nothing
to fix → no re-check. Fable is spent: the planner and the fond
reviewer were its two calls for this issue.

**Converged** = nothing to fix (fond `MERGEABLE`, code `OK`), or the
last re-check ends `RECHECK OK` — every finding fixed with its
property reached, or dropped on evidence the re-check accepted.

## QA gate — after convergence

Prove it by driving it. Skip ONLY when no user-reachable surface
changed → `QA: not run — <reason>` in the description. Else: the stack
already runs; confirm the probe (one `curl`), then spawn ONE QA executor
(`model: "opus"`, never fable) that reads `~/.claude/skills/qa/SKILL.md`.
Hand it: QA plan (Scope/Enumerate pre-filled from the contract's
matrix, adjusted for deviations), URL/port, launch pack (its boot kit —
it boots whatever its probe finds dead), host allowlist, tooling
matched to touched surfaces, ~15 min budget (EXECUTION only —
build/boot/provision/login uncapped; a slow stack never justifies
driving components in isolation), run dir outside the worktree.
Verdict: `qa/verdict-<k>.md` + its `.done`. While it runs, write the
reviewer presentation (`PRESENTATION.md`) — the diff froze at
convergence — then end your turn. On its completion, UI touched → take
the captures (`PRESENTATION.md`) on the still-running stack; THEN kill
every process QA started — orphans poison the next issue. A QA-forced
fix retouches the presentation and re-captures the screens it touched.

**Verdicts** — GO / GO-PROVISIONAL pass (copy reservations into the
description; one blaming an unbooted stack is void → boot and re-run
those rows). NO-GO → fix, then spawn a NEW QA executor handed the previous
verdict file and run dir — it re-runs the failed rows only; a fix wider than the failed rows also goes through
one re-check (same cap); cap 2 QA rounds, else flagged-draft
path. ABORTED only when NO launch path exists — never a slow boot
(draft: note it; autonomous: flagged draft, never merge an un-QA'd
surface change).

## Ship

- **Before push** — re-run comply + trio after the last fixes. Then
  **branch purity**: `git log origin/<base>..HEAD` = only this task's
  commits, branch diff = the diff the review converged on (one foreign
  commit invalidates the whole review). A follow-up the description
  promises has its issue created BEFORE the MR opens.
- **Reviewer presentation** — read `PRESENTATION.md` (next to this
  file) NOW, before writing one line of the description. It owns the
  gabarit and ends on the self-check; the step-5 gate rejects any
  description that strays from it.
- **Push + MR** — `git push -u origin agent/issue-<n>`; open the MR/PR
  targeting `<default>` (`<base>` if stacked), title carrying
  `(closes #<n>)`; description = the gabarit output, `Closes #<n>`
  included. Draft mode → open as DRAFT (`Draft:` prefix / `--draft`).
  Re-check cap or QA cap hit → STILL push, draft in BOTH modes, title
  `[review not converged]` / `[qa not converged]`, remaining findings
  or failed rows as an MR comment. Split issue: only the LAST task
  carries `closes #<n>`; earlier tasks `refs #<n>`.
- **Report back** — MR URL, verification results, code findings
  count + fond verdict + re-checks, QA verdict (or skip reason),
  `UI touched: yes <n> captures embedded | no`, every disposition,
  deviations, files touched.
