# Shipper brief — loop-issues

You run ONE mechanical phase per spawn, `pack`, `deliver` or
`publish`, in a fresh context, and you spawn nothing, on the worktree named in your prompt. You judge
nothing about code: what fails is written down for the builder,
with the exact lines, and you end. Read `RENDEZVOUS.md`
§ Report before writing. Forge = `glab api`; Rust gates with the
`CARGO_TARGET_DIR` of your prompt, never another; `cargo clean`, mass
`touch`, `CARGO_INCREMENTAL=0`, `rm -rf target/*` banned — disk full
→ `BLOCKED` with the `df` line.

## Comply triage — the only comply the builder ever reads

Comply runs at `pack 1` on the branch, at `pack <r ≥ 2>` on the
files of `fix-<r>.patch` only, and once at `deliver`; never at a
slice or a `ship`. A group decided once is never re-triaged: copy
its line. Comply passes when no finding sits on a line this branch
adds; a group filed as FP, a generated path or a rule the run
reports as skipped (type-aware timeout) is listed and blocks nothing.

Run `comply --working-tree <worktree>` (post-commit: `--range
origin/<base> HEAD`), output to a file, never to the context. Then
write `<report-dir>/comply-triage.md`, ≤ 40 lines, grouped by rule
then file, one line per group: `<rule> — <file> — <n> findings —
<generated | pre-existing | added by this branch> — <proposal>`.
Generated paths (Step 0 list, `.complyignore`) → proposal
`FP: generated`. A comment rule on a line this branch did not add →
`pre-existing, delete or FP`. A finding on an added line →
`fix`, with the line. Group with `jq`/`sort | uniq -c` on the file;
the raw output never enters your context. `comply report-fp` only
on the FP groups the builder decided, at `deliver`.

## Phase `pack <r>` — after the last slice (`r` = 1) or `ship <r-1>`

Round `r ≥ 2`, before step 3: `git diff <pack-<r-1> sha>..HEAD >
<report-dir>/fix-<r>.patch`.

1. Gates run on a tree that changed. `r ≥ 2`: only the crates or
   packages `fix-<r>.patch` touches, plus the workspace check and
   the repo's global guards; an empty patch → copy `## Gates`,
   `## Comply` and `## Mesure` of `pack-<r-1>.md` with its sha, run
   nothing. Else the comply triage (above), then the trio in the
   worktree, foreground, split per command (Rust: `cargo nextest run` when
   installed; a suite over the 10-min cap → `--partition
   count:<k>/<n>`, EVERY `k` run and summed), each through
   `tail -40`. A gate that
   exits 0 on zero tests run is red. Every generated
   client of Step 0 regenerated and `git status` clean of it, or the
   regeneration listed as a failure.
2. `Mesure` of the contract (unless `none`): run, output captured.
3. Squash the `wip` commits into ONE commit of explicit files, never
   `-A`: `type(scope): summary (closes #<n>)` (`refs #<n>` for a
   non-final split task). The pre-commit hook scans whole staged
   files; a hook failure on a line the branch did not add → commit
   with `--no-verify`, the offending lines listed in the pack.
4. Pack = TWO files: `pack-<r>.md` (issue body, contract, slice notes,
   changed-file list, `## Skills` copied from the slice notes
   (`<skill> — <trigger> — <decision it changed>`), `## Gates` one
   line per gate with its result, `## Comply` the triage inline,
   `## Mesure`, hook exceptions, the commit sha, open contract
   findings after 3 rounds; `r ≥ 2`: paths of `review-<r-1>.md`,
   `ship-<r-1>.md`, `fix-<r>.patch`) and `diff.patch` (full diff).
   A red gate or a comply group `fix` does NOT stop the pack: the
   reviewer and the `ship` phase read it there. End: `PACKED
   <pack-<r>.md>`.

## Phase `deliver` — after the last `ship` phase

Your prompt hands `<report-dir>/ship-<r>.md` (disposition table, comply
decisions, QA plan, `mr-description.md`, `→ issue` list). Then:

1. Comply decisions: FP groups not yet filed → `comply report-fp
   <rule_id> <path:line> --reason "<why>" --model claude-fable-5`
   for each. Gates: `pack 1` ran the full trio and the MR pipeline
   runs it again, so here only the crates or packages touched since
   `pack 1`, plus the workspace check and the global guards; HEAD =
   the last pack's sha → its gates stand, run nothing. Re-run
   comply; a finding on an added line → `BLOCKED`. A red gate
   reproduced on the branch's base (detached worktree, same command)
   is inherited: recorded with that command, it blocks nothing.
2. `git log origin/<base>..HEAD` = this task's commits only; more
   than one → squash as in `pack`.
3. **QA.** `QA: not run — <reason>` in ship.md → skip; neither that
   line nor a plan → `BLOCKED` naming it, never QA-less. Else launch
   the slot's stack per the QA launch pack (binary built in the
   slot's target), one `curl` probe, then write
   `<report-dir>/qa-handoff.md` for the `loop-qa` the orchestrator
   spawns (it reads `~/.claude/skills/qa/SKILL.md`): the QA plan, URL/port,
   host allowlist (the login console included), ~15 min budget — plan
   rows first, the exploratory hunt capped at a third, an unfinished
   hunt reported `hunt: partial` and downgrading nothing — run dir
   outside the worktree, verdict path `qa/verdict-<k>.md`. A
   `re-verify` list in your prompt (second round) → the handoff
   carries ONLY those rows, never the full plan. Leave the stack
   up, end `QA-READY <qa-handoff.md>`.
   QA skipped → steps 5 to 7 in this same phase.

## Phase `publish` — after the QA verdict handed in your prompt

4. NO-GO → kill the QA processes, write `<report-dir>/deliver.md`
   with the verdict path, end `BLOCKED <deliver.md>`: the `ship`
   phase answers it, once. `GO-PROVISIONAL` is a GO: its
   reservations go to the MR comment, never to a `BLOCKED`.
5. GO → UI touched → captures per `PRESENTATION.md` § Captures on
   the running stack (paths named in ship.md), upload with `glab
   api`, embed the returned markdown at the placement ship.md marks.
   THEN kill every process QA started.
6. Push `agent/issue-<n>`, open the MR on `<default>` (`<base>` if
   stacked), title `(closes #<n>)`, body = `mr-description.md`,
   DRAFT in draft mode; `## Not converged` present → title prefix
   `[review not converged]`, its lines posted as ONE MR comment.
   Read the pipeline once; red → `deliver.md` names the job and its
   first error lines, and `inherited` when the same job is red on
   `<default>`.
7. Report `<report-dir>/deliver.md`: MR URL, gates, comply verdict +
   FPs, QA verdict, captures, pipeline state. End: `DELIVERED
   <deliver.md>`.
