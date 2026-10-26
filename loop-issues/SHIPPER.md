# Shipper brief — loop-issues

You run ONE mechanical phase per spawn, `pack`, `deliver`, `close`
or `publish`, in a fresh context, and you spawn nothing, on the worktree named in your prompt. You judge
nothing about code: what fails is written down for the builder,
with the exact lines, and you end. Read `RENDEZVOUS.md`
§ Report before writing. Forge = `glab api`; Rust gates with
`CARGO_TARGET_DIR` unset (`cargo` goes through mbx, which manages
the worktree's target), whatever the prompt says; `cargo clean`, mass
`touch`, `CARGO_INCREMENTAL=0`, `rm -rf target/*` banned. The
orchestrator checks the disk before a lot opens (SKILL.md § The
loop); the slot's env reaches every command that names or runs from
the worktree (SKILL.md Step 0, slot env hook), never re-sourced:
write slot commands `cd <worktree> && …`. A gate that fails on the
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
adds (`whole-file`: on any line of a file it touches); a group filed as FP, a generated path or a rule the run
reports as skipped (type-aware timeout) is listed and blocks nothing.

Run `comply --working-tree <worktree>` (post-commit: `--range
origin/<base> HEAD`), output to a file, never to the context. Then
write `<report-dir>/comply-triage.md`, ≤ 40 lines, grouped by rule
then file, one line per group: `<rule> — <file> — <n> findings —
<generated | pre-existing | added by this branch> — <proposal>`.
Generated paths (Step 0 list, `.complyignore`) → proposal
`FP: generated`. A finding on an added line → `fix`, with the line.
A finding on a line this branch did not add depends on Step 0's
Lint scope: `added-lines` → dropped before the triage, never
listed; `whole-file` → `fix` in a touched file (the hook blocks the
commit on it), never FP; an untouched file → dropped. Group with `jq`/`sort | uniq -c` on the file;
the raw output never enters your context. `comply report-fp` only
on the FP groups the builder decided, at `deliver`, and only on
added lines.

## Phase `pack <r>` — after the last slice (`r` = 1) or `ship <r-1>`

Round `r ≥ 2`, before step 3: `git diff <pack-<r-1> sha>..HEAD >
<report-dir>/fix-<r>.patch`.

0. `r = 1`: `git fetch origin <base>`, then (separate command)
   compare; `<base>` moved past the branch's base → rebase onto it
   before anything else, a conflict → `BLOCKED` naming the files. A
   pack built on a stale base shows a merged neighbour's lines as
   this branch's reversal.
1. No gate but comply, no test at `pack` (user, 2026-10-12): the builder's
   merge queue checks the merge and the closing runs every test
   (SKILL.md). Run only the
   formatter check, the comply triage (above), and every generated
   client of Step 0 the diff reaches (regenerated, `git status` clean
   of it, or listed as a failure). `## Gates` says `pack: none`.
   **Test guard**, every round: `git diff -M --numstat
   origin/<base>...HEAD` and `git diff --name-only --diff-filter=D
   origin/<base>...HEAD`, kept to test paths (`tests/`, `*_unit.rs`,
   `*_it.rs`, `*/tests.rs`, `*.test.ts(x)`, `*.spec.ts`, `e2e/`) and to
   `.rs` files whose diff touches a `#[cfg(test)]` module. A file that
   exists on `<base>`, modified or deleted, and absent from the
   contract's `Tests modifiés` → `BLOCKED` naming it; a pure rename
   (`=>`, 0 0) passes. Added lines matching `#[ignore]`, `.skip(`,
   `.only(`, `test.fixme` (`git diff -U0 … | grep '^+'`) → `BLOCKED`.
2. `Mesure` of the contract (unless `none`): run, output captured.
3. Squash the `wip` commits into ONE commit of explicit files, never
   `-A`: `type(scope): summary (closes #<n>)` (`refs #<n>` for a
   non-final split task). A hook failure is this MR's to pay — fix
   the offending lines and commit again. Whether the hook judges
   whole staged files or only added lines is the repo's (Step 0's
   Lint scope); a whole-file hook makes pre-existing drift in a
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
decisions, Breaker map, `mr-description.md`, `→ issue` list). Every `deliver.md`
below is `deliver-<k>.md`, k = the attempt, never rewritten. Then:

1. Comply decisions: `FP: generated` groups are never filed (they
   block nothing). Other FP groups not yet filed → `comply report-fp
   <rule_id> <path:line> --reason "<why>" --model claude-opus-5-5`
   for each. A `path:line` absent from the `+` lines of `git diff -U0
   origin/<base>...HEAD -- <path>` is refused: not filed, the group
   goes back to `fix`, `BLOCKED` naming it. Re-run comply; a finding
   on an added line → `BLOCKED`.
2. `git log origin/<base>..HEAD` = this task's commits only; more
   than one → squash as in `pack`. No gate, no QA here (user,
   2026-10-15): the merge queue checks the merge
   result, the closing runs the full gates and one QA for every lot.
3. Push `agent/issue-<n>`, open the MR on `<base>`, title `(closes
   #<n>)`, body = `mr-description.md`, DRAFT in draft mode; `## Not
   converged` present → title prefix `[review not converged]`, its
   lines posted as ONE MR comment. Read the pipeline once; red →
   `deliver.md` names the job and its first error lines.
4. Report `<report-dir>/deliver.md`: MR URL, comply verdict + FPs,
   pipeline state. End: `DELIVERED <deliver.md>`.

## Phase `close` — the closing, on `<integration>`

Your prompt hands the closing report dir, the integration worktree
and the `integrated:` lines (issue, MR, report dir of each lot).

1. `git fetch origin`, then (separate command) `git checkout
   --detach origin/<integration> && git merge --no-edit
   origin/<default>`; a new commit → `git push origin
   HEAD:refs/heads/<integration>`; a conflict → `git merge --abort`,
   `BLOCKED <close.md>` naming the files.
2. Gates: Step 0 names a certifying gate script → run THAT script on
   this sha (it posts the status the closing merge needs); none → the
   workspace check + lint (Rust: `cargo check` and `clippy
   --workspace --all-targets`), the full test suite, every frontend
   lane. Then `comply --range origin/<default> HEAD`, triaged as
   above against the lots' FP decisions; a finding on an added line is
   a red. Foreground, one command per gate, `tail -40`; a gate that
   exits 0 on zero tests run is red. With a schema signal in the
   launch pack, each gate runs as
   `~/.claude/skills/loop-issues/hooks/slot.sh gate '<signal>'
   '<recreate>' '<gate>'`: one recreation and one rerun on that
   signal, exit 2 → `BLOCKED: schema mismatch after recreate`. A red reproduced on
   `origin/<default>` (detached worktree, same command) is inherited:
   recorded with that command. Any other red → rerun the failing
   lane without fail-fast, on the gates model database (never the
   slot's), so every red lands in one pass; `<report-dir>/close.md`
   lists each failure with the lot whose merge first reddens it
   (the failing test alone, bisected over `git rev-list
   --first-parent --reverse origin/<default>..HEAD`; the
   `origin/<default>` merge → `#closing`), end `BLOCKED <close.md>`.
3. Test files of `origin/<default>` modified or deleted over
   `origin/<default>...HEAD` (the `pack` test guard's paths, plus any
   allowlist or baseline file a gate reads) → `## Tests modifiés` of
   `close.md`, each with the lot that changed it: the closing MR
   lists them for the human who merges it.
4. **QA.** The plan = the Breaker maps of every lot's last `ship-<r>.md`
   (`QA: not run` lots add nothing), front lots first, one section per
   lot naming its issue. No map at all → skip to the report. Else,
   with `slot=~/.claude/skills/loop-issues/hooks/slot.sh`, each from
   `cd <worktree> && …`: `$slot qa-down <report-dir>/qa-stack.md`
   (your own previous stack), then `$slot qa-up
   <report-dir>/qa-stack.md <log> '<launch command>' <ports>…` per
   the QA launch pack (binary built in the integration worktree's target). A surface
   that needs the model to call a tool → the fake model starts with a
   script covering it, its trigger phrase in the handoff. Exit
   2 names a port another process holds: `BLOCKED` naming it, never
   killed. Then one `curl --retry` probe. Seed: the repo's versioned seed
   recipe (launch pack) first, applied to N organizations, one per
   Breaker (N = the slot count in your prompt, 1 when absent); the
   maps' seed composes on top of each, never beside it. Then `$slot qa-probe
   <dependency>=<command>…` with the launch pack's probes, FROM the
   slot's console origin, every dependency the plan's login path
   crosses: identity provider alive, CORS preflight accepted for the
   slot's origin, every port, the recipe's rows present. Exit 2 names
   the first failing one: a brake removed now (relaunch, reseed) or
   `$slot qa-down` then a `BLOCKED` naming it — never handed to QA to
   come back `ABORTED`. Then write
   `<report-dir>/qa-handoff.md` for the `loop-qa` the orchestrator
   spawns (it reads `~/.claude/skills/qa/SKILL.md`): mode
   `breakers-only`, the maps, URL/port, host allowlist (the login
   console included), N, the N organizations and their credentials,
   the budget in minutes, ~15 per lot ÷ N, run dir outside the worktree, verdict path `qa/verdict-<k>.md`. Write
   `database: <name>` into `<report-dir>/qa-stack.md` (`qa-up`
   wrote its process group, ports and log), leave the stack up, end
   `QA-READY <qa-handoff.md>`.
   QA skipped → `publish` steps 6 and 7 in this same phase.

## Phase `publish` — the closing, after the QA verdict handed in your prompt

The stack is the one of `qa-stack.md`: one `curl` probe proves it;
dead → `slot.sh qa-down` then `qa-up` again from the launch pack,
never assume. `qa-down` runs on every exit of this phase, ABORTED
verdict included.

5. NO-GO → `slot.sh qa-down <report-dir>/qa-stack.md`, write `<report-dir>/deliver.md`
   with the verdict path and, per `in-lot` finding, the lot its map
   section names, end `BLOCKED <deliver.md>`: those lots' `ship`
   answers it (SKILL.md § Closing). `GO-PROVISIONAL` is a GO: its
   reservations go to the MR comment, never to a `BLOCKED`, never to
   a `ship`.
6. GO → UI touched → captures per `PRESENTATION.md` § Captures on
   the running stack (paths named in each lot's ship.md), signed in with the
   local dev account the QA launch pack names — a local dev
   credential typed into the login form is the procedure, not a
   leak; skipping the captures for it is not. Upload per
   `PRESENTATION.md`, embed the returned markdown at the placement ship.md marks.
   THEN `slot.sh qa-down <report-dir>/qa-stack.md`: exit 2 names a
   port still held, written in `deliver.md`.
7. Open the MR `<integration>` → `<default>` (push nothing: its head
   is the sha `close` certified), title `loop <date>: <k> lots`, body
   per `PRESENTATION.md`: one section per lot (its MR, its
   `mr-description.md` summary, `closes #<n>`), the `## Tests
   modifiés` of close.md, the inherited reds; DRAFT in draft mode.
   Read the pipeline once; red → `deliver.md` names the job and its
   first error lines, and `inherited` when the same job is red on
   `<default>`.
8. Report `<report-dir>/deliver.md`: MR URL, gates, QA verdict,
   captures, pipeline state. End: `DELIVERED <deliver.md>`.

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
nothing and say so in the report. Same for what else your phase
created outside the issue's worktree: a detached worktree for a base
reproduction is removed (`git worktree remove`) before your last
line, a throwaway database you fell back to is dropped. The issue's
worktree, the slot's model and its QA database are the
orchestrator's to clean (SKILL.md step 4): `deliver.md` names the QA
database so it can.
