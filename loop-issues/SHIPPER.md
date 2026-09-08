# Shipper brief — loop-issues

You run ONE mechanical phase per spawn, `pack` or `deliver`, in a
fresh context, on the worktree named in your prompt. You judge
nothing about code: what fails is written down for the fable
builder, with the exact lines, and you end. Read `RENDEZVOUS.md`
§ Report before writing. Forge = `glab api`; Rust gates with
`export CARGO_TARGET_DIR=<main-repo>/target`; `cargo clean`, mass
`touch`, `CARGO_INCREMENTAL=0`, `rm -rf target/*` banned — disk full
→ `BLOCKED` with the `df` line.

## Comply triage — the only comply the fable ever reads

Run `comply --working-tree <worktree>` (post-commit: `--range
origin/<base> HEAD`), output to a file, never to the context. Then
write `<report-dir>/comply-triage.md`, ≤ 40 lines, grouped by rule
then file, one line per group: `<rule> — <file> — <n> findings —
<generated | pre-existing | added by this branch> — <proposal>`.
Generated paths (Step 0 list, `.complyignore`) → proposal
`FP: generated`. A comment rule on a line this branch did not add →
`pre-existing, delete or FP`. A finding on an added line →
`fix`, with the line. Never run `comply report-fp` yourself: the
fable decides each group in its next phase and hands the FP list to
a `loop-mechanic`.

## Phase `pack` — after the last slice

1. Trio in the worktree, foreground, split per command (Rust:
   `cargo nextest run` when installed), each through `tail -40`.
   Every generated client of Step 0 regenerated and `git status`
   clean of it, or the regeneration listed as a failure.
2. Comply triage (above). `Mesure` of the contract (unless `none`):
   run, output captured.
3. Squash the `wip` commits into ONE commit of explicit files, never
   `-A`: `type(scope): summary (closes #<n>)` (`refs #<n>` for a
   non-final split task). The pre-commit hook scans whole staged
   files; a hook failure on a line the branch did not add → commit
   with `--no-verify`, the offending lines listed in the pack.
4. Pack = TWO files: `pack.md` (issue body, contract, slice notes,
   changed-file list, `## Skills` copied from the slice notes
   (`<skill> — <trigger> — <decision it changed>`), `## Gates` one
   line per gate with its result, `## Comply` the triage inline,
   `## Mesure`, hook exceptions) and
   `diff.patch` (full diff). A red gate or a comply group `fix` does
   NOT stop the pack: the reviewer and the fable `ship` phase read
   it there. End: `PACKED <pack.md>`.

## Phase `deliver` — after the fable `ship` phase

Your prompt hands `<report-dir>/ship.md` (disposition table, comply
decisions, QA plan, `mr-description.md`, `→ issue` list). Then:

1. Comply decisions: FP groups → ONE `loop-mechanic` runs `comply
   report-fp <rule_id> <path:line> --reason "<why>" --model
   claude-fable-5` for each; re-run comply, ZERO expected on branch
   files; residue → `BLOCKED`.
2. Trio again, split per command. `git log origin/<base>..HEAD` =
   this task's commits only; more than one → squash as in `pack`.
3. **QA.** `QA: not run — <reason>` in ship.md → skip. Else launch
   the stack per the QA launch pack, one `curl` probe, spawn ONE
   `loop-qa` that reads `~/.claude/skills/qa/SKILL.md`, handed: the
   QA plan, URL/port, host allowlist, ~15 min budget, run dir outside
   the worktree, verdict path `qa/verdict-<k>.md`. End your turn; you
   are resumed by its notification. A `re-verify` list in your prompt
   (second round) → the executor gets ONLY those rows, never the
   full plan.
4. NO-GO → kill the QA processes, write `<report-dir>/deliver.md`
   with the verdict path, end `BLOCKED <deliver.md>`: the fable
   `ship` phase answers it, once.
5. GO → UI touched → captures per `PRESENTATION.md` § Captures on
   the running stack (paths named in ship.md), upload with `glab
   api`, embed the returned markdown at the placement ship.md marks.
   THEN kill every process QA started.
6. Push `agent/issue-<n>`, open the MR on `<default>` (`<base>` if
   stacked), title `(closes #<n>)`, body = `mr-description.md`,
   DRAFT in draft mode. Read the pipeline once; red → `deliver.md`
   names the job and its first error lines.
7. Report `<report-dir>/deliver.md`: MR URL, gates, comply zero +
   FPs, QA verdict, captures, pipeline state. End: `DELIVERED
   <deliver.md>`.
