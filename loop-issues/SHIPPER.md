# Shipper brief — loop-issues

You run ONE mechanical phase per spawn, `pack`, `deliver` or
`publish`, in a fresh context, and you spawn nothing, on the worktree named in your prompt. You judge
nothing about code: what fails is written down for the builder,
with the exact lines, and you end. Read `RENDEZVOUS.md`
§ Report before writing. Forge = `glab api`; Rust gates with
`CARGO_TARGET_DIR` unset (`cargo` goes through mbx, which manages
the worktree's target), whatever the prompt says; `cargo clean`, mass
`touch`, `CARGO_INCREMENTAL=0`, `rm -rf target/*` banned. Before any
gate, `df -h` the volume: under 20 GB free → `BLOCKED` with the `df`
line, a brake the orchestrator clears before you run anything; never
a gate launched to discover an E0463. A gate that fails on the
target's own artefacts (E0463, E0460, a `.rlib` or `.rmeta` not
found) means damaged artefacts, not a red: replaying it stays red.
`mbx doctor`, then `cargo clean -p <crate>` of the crates the error
names, never the whole target, replay once. Record it under
`## Freins`.

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

0. `r = 1`: `git fetch origin <default>`, then (separate command)
   compare; `<default>` moved past the branch's base → rebase onto it
   before anything else, a conflict → `BLOCKED` naming the files. A
   pack built on a stale base shows a merged neighbour's lines as
   this branch's reversal.
1. Gates run on a tree that changed. `pack 1` runs the FULL trio on
   the workspace (`cargo nextest run --workspace`, clippy
   `--workspace --all-targets`, every frontend lane the diff
   reaches): on a warm mbx target it costs minutes, and a
   surface-only pack lets through the red of a crate the diff does
   not name, found at `deliver` and paid by a second ship + deliver
   (three times in one run, 2026-09). A rebase since the last full
   trio → the full trio again, whatever the round or the phase: a
   new base changes what compiles, and a merge without textual
   conflict can be wrong. `r ≥ 2`: only the crates or
   packages `fix-<r>.patch` touches,
   plus the workspace check and
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
   non-final split task). A hook failure is this MR's to pay — fix
   the offending lines and commit again. Whether the hook judges
   whole staged files or only added lines is the repo's (Step 0
   records it); a whole-file hook makes pre-existing drift in a
   touched file this MR's too.
   `--no-verify` is forbidden without exception, and so is every
   equivalent: `core.hooksPath=/dev/null`, a per-file `comply.toml`
   that silences a rule, a `comply-ignore`. A finding the branch
   cannot pay is a `BLOCKED`, never a bypass.
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
   <rule_id> <path:line> --reason "<why>" --model claude-opus-5-5`
   for each. Re-run comply; a finding on an added line → `BLOCKED`.
2. `git log origin/<base>..HEAD` = this task's commits only; more
   than one → squash as in `pack`. Then the gates: the forge pipeline
   gates NOTHING. Step 0 names a certifying gate script → push
   `agent/issue-<n>` (the squashed head) and run THAT script on it,
   foreground, INSTEAD of the trio: it is a superset and posts the
   status the merge needs, so the trio then the script on one sha
   runs the same suite twice. No script → the FULL trio on the
   workspace when HEAD moved since `pack 1`'s full run; HEAD = the
   last pack's sha AND a full workspace trio already ran on this
   exact base → its gates stand, run nothing. A red gate reproduced
   on the branch's base (detached worktree, same command) is
   inherited: recorded with that command, it blocks nothing.
3. **QA.** `QA: not run — <reason>` in ship.md → skip; neither that
   line nor a plan → `BLOCKED` naming it, never QA-less. Else kill
   whatever listens on the slot's ports (an orphan dev server gives
   a false capture), launch the slot's stack per the QA launch pack (binary built in the
   worktree's target), one `curl --retry` probe. Seed: the repo's versioned seed
   recipe (launch pack) first, applied to TWO organizations — one
   for the Verifier, one for the Breaker; the plan's seed rows
   compose on top of it, never beside it. Then probe, FROM the
   slot's console origin, every dependency the plan's login path
   crosses, with the launch pack's commands: identity provider
   alive, CORS preflight accepted for the slot's origin, every port,
   the recipe's rows present. A probe that fails is a brake removed
   now (relaunch, reseed) or a `BLOCKED` naming it — never handed to
   QA to come back `ABORTED`. Then write
   `<report-dir>/qa-handoff.md` for the `loop-qa` the orchestrator
   spawns (it reads `~/.claude/skills/qa/SKILL.md`): the QA plan, URL/port,
   host allowlist (the login console included), the two
   organizations and their credentials, the Breaker's targets — the
   boundaries the diff opens or changes, i.e. the contract's hostile
   cases in `Tests`, not the whole app — and the budget in minutes,
   ~15, enforced: past it the run ends `ABORTED — budget`. Plan rows
   first, the exploratory hunt capped at a third, an unfinished
   hunt reported `hunt: partial` and downgrading nothing — run dir
   outside the worktree, verdict path `qa/verdict-<k>.md`. A
   `re-verify` list in your prompt (second round) → the handoff
   carries ONLY those rows, never the full plan. Write
   `<report-dir>/qa-stack.md` (PIDs, ports, database, log paths),
   leave the stack up, end `QA-READY <qa-handoff.md>`.
   QA skipped → steps 5 to 7 in this same phase.

## Phase `publish` — after the QA verdict handed in your prompt

The stack is the one of `qa-stack.md`: one `curl` probe proves it;
dead → kill its PIDs and relaunch from the file, never assume.

4. NO-GO → kill the QA processes, write `<report-dir>/deliver.md`
   with the verdict path, end `BLOCKED <deliver.md>`: the `ship`
   phase answers it, once. `GO-PROVISIONAL` is a GO: its
   reservations go to the MR comment, never to a `BLOCKED`, never to
   a `ship` — answering them cost ~45 min of ship + deliver + QA
   re-verify each, for reservations the verdict called non-blocking.
5. GO → UI touched → captures per `PRESENTATION.md` § Captures on
   the running stack (paths named in ship.md), signed in with the
   local dev account the QA launch pack names — a local dev
   credential typed into the login form is the procedure, not a
   leak; skipping the captures for it is not. Upload with `glab
   api`, embed the returned markdown at the placement ship.md marks.
   THEN kill every PID of `qa-stack.md` and check its ports are free.
6. Push `agent/issue-<n>` (already there when the certifying gate
   ran at step 2: push nothing new, its sha is the certified one), open the MR on `<default>` (`<base>` if
   stacked), title `(closes #<n>)`, body = `mr-description.md`,
   DRAFT in draft mode; `## Not converged` present → title prefix
   `[review not converged]`, its lines posted as ONE MR comment.
   Read the pipeline once; red → `deliver.md` names the job and its
   first error lines, and `inherited` when the same job is red on
   `<default>`.
7. Report `<report-dir>/deliver.md`: MR URL, gates, comply verdict +
   FPs, QA verdict, captures, pipeline state. End: `DELIVERED
   <deliver.md>`.

`git fetch origin <default>` and the `git rev-parse origin/<default>`
that reads its result NEVER share one compound command: the parse
returns the pre-fetch value and every later comparison runs against a
stale base. Measured 2026-09-22 — the stale base showed a
merged feature's deletion as this branch's addition, one step from a
`BLOCKED` on a regression that did not exist. Fetch, then read, in
two separate commands.

Before you conclude, sweep the test clones your suite left behind.
A `TEMPLATE` clone is not garbage-collected: measured 2026-09-22,
1704 of them appeared in one hour and filled the disk to 131 MiB
free, stopping every agent on the machine. Run as is the clone
sweep command of the repo's launch pack (natalia-v3:
`.claude/skills/verify/SKILL.md` § Test clone pattern); never
compose the SQL yourself from the pattern. No command named → sweep
nothing and say so in the report.
