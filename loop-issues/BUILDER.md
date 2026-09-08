# Builder brief — loop-issues

You run ONE phase per spawn, named in your prompt: `contract`
(agent `loop-contractor`), `build <k>` or `ship` (agent
`loop-builder`); the mechanical `pack` and `deliver` phases
belong to `loop-shipper` (`SHIPPER.md`). Each phase starts in a fresh context
from the files of the report dir; you never wait on a child of your
own: every `loop-mechanic` is spawned in the FOREGROUND (never
`run_in_background`), its `DONE` line is your next input, and you end
your phase with your own report line, never before. What you read is what you need for THIS phase: the contract,
the notes of the previous phases, and the files of your slice. Read
`RENDEZVOUS.md` § Report before writing. Spawn only the pinned agent
types of `SKILL.md` § Agents, never with `model`.

The forge is `glab api` in Bash (issues, MR, uploads: `glab api
--method POST projects/:id/uploads -F file=@<png>`); list calls are
filtered (`state=opened&labels=…&per_page=20`), never a full list.
Code is written with `Edit`/`Write`, never a heredoc. A grep names a
path and ends in `| head -40`; a file is never re-read after your
own edit, you know what you wrote. Every long command is truncated
at the source: `2>&1 | tail -40`, or a grep of the error lines. A raw `cargo`, `pnpm`, `comply` or test
output never enters the context; a failing gate is re-run on the one
crate or package that failed. Test code never enters your context
unless you are writing it: `git grep` with `-- ':!**/tests/**'
':!*_it.rs' ':!*/tests.rs' ':!*.test.*'`, and `sed -n` ranges that
stop before a `#[cfg(test)]` line.

## Phase `contract` — before any code

Read the issue, then `CLAUDE.md`/`AGENTS.md`, `CONTEXT.md`,
`docs/adr/`. Read code with `git grep` and `sed -n` ranges. Load
`coding-standards:quality-bar`. Write `<report-dir>/contract.md`:

- `Besoin` — one line per acceptance criterion, as what a user or
  operator observes. A criterion that names a code shape ("one
  composition root", "tested without a socket") is read as its
  observable effect; write the reduction. NEEDS-CLARIFICATION only
  for a product decision the issue leaves open or a dependency
  neither merged nor MR-covered; post the questions on the issue
  first.
- `Formes` — the shapes the diff will contain, and nothing else:
  files touched, and every NEW type, trait, module, table, column,
  route or dependency, each paying with a second caller on `<base>`
  today or the issue line that needs it. `Formes: aucune neuve` is
  the expected value. A shape absent from this list may not appear
  in the diff without a line under `## Écarts au plan`.
- `Réutilise` — one line per transverse mechanism, `<symbol>
  (<file>)`, proven by your grep.
- `Tests` — the CLOSED list of tests, one per acceptance criterion
  and per named risk, none for an implementation choice. Each line:
  `<file>::<test_name> — <layer> — <the bug that slips if it
  breaks> — arrange / act / assert in one sentence — doubles:
  <existing double or none>`. Nobody adds a test outside this list.
- `Tranches` — the ordered build slices, each one fresh context:
  the files, shapes and tests of the contract it delivers, the
  skills beyond quality-bar + language it needs (each with the
  trigger that pays it, else none), and the gate it must pass alone
  (`cargo check -p <crate>`, `pnpm check`).
  A slice compiles on its own; the test file of a slice belongs to
  that slice. ONE slice is the default: every slice re-reads the
  brief, the contract and the files, so a second slice exists only
  when two disjoint crates or packages cannot compile together, and
  its line names them. Three is the ceiling; more →
  NEEDS-CLARIFICATION, the issue is too big.
- `Stack` (`<base>` when a dependency has an open MR), `Mesure` (hot
  path + bar, or `none`), `QA` (deliverables + error paths),
  `Risques` (convention deleted, ADR bent, issue line lifted with the
  refuting grep).

Write nothing you would not defend against "delete it and nothing is
lost". End: `CONTRACTED <contract.md>`.

## Phase `build <k>` — one slice

- Slice 1 creates the worktree:
  ```bash
  git fetch origin <default>
  git worktree add ../<repo>-worktrees/issue-<n> -b agent/issue-<n> origin/<default>
  ```
  Stacked → `origin/<base>`; split → suffix `-t<k>`. Wire it. Later
  slices read `<report-dir>/slice-<k-1>.md` first. Edit ONLY
  worktree paths.
- Load `coding-standards:quality-bar` and the language skill of the
  slice's files, nothing else by default. Another skill of
  `~/.claude/skills/_shared/SKILLS.md` is loaded only when the
  contract's `Tranches` line names it with its trigger (`testing` —
  a harness or double changes; `api-design` — a new route or a
  changed wire contract); a skill loaded for a file the slice does
  not touch is context paid for nothing.
- **Shape rules** (each breach is a review finding):
  - one type per state; one method per write; no service / port /
    repository mirror layer for a single query — the seam that owns
    the concern;
  - no struct or trait to carry arguments; no port for a test double;
  - no hand-written parser; no hand-written `Debug` — secrets and
    tenant data in `Secret`, then `#[derive(Debug)]`;
  - a mechanism the repo has is consumed, never mirrored; "like the
    sibling" is not a reason;
  - a comment says a why the code cannot; one that restates the code
    is deleted; one doc sentence per `pub` item. Comment lines ÷
    added lines (hors générés) ≤ 1/10 before the pack.
- A shape outside `Formes`, or a decision changed against the
  contract → `## Écarts au plan` with the issue line that pays it.
- **Tests.** Tests live in their own files, never inline, in the
  repo's own convention (CLAUDE.md names it; natalia-v3: a sibling
  `<module>.test.rs` wired by `#[cfg(test)] #[path = "<module>.test.rs"]
  mod tests;`), integration tests in `tests/*_it.rs`, frontend in
  `*.test.*`. You
  write the code and, per test file of the contract, the FIRST test:
  it fixes the file, the helpers, the double and the assertion
  style. Then ONE `loop-mechanic` writes the remaining
  tests of the contract's `Tests` list, handed: the list verbatim,
  the worktree, the reference test path per file, and the rule "no
  new helper, double, type or test outside the list". Read its diff
  before going on; a test that locks an implementation choice is
  deleted.
- Other mechanical work (rebase, codegen, comply reformatting,
  fixture rewrites) → ONE `loop-mechanic` per batch, exact task.
- The slice's own gate, then its tests only (`cargo nextest run -p
  <crate>`, `pnpm test -- <file>`); `cargo clean`, mass `touch`,
  `CARGO_INCREMENTAL=0` banned. Then ONE `loop-mechanic` runs comply
  on the slice's files and returns the triage of `SHIPPER.md`
  § Comply (≤ 40 lines, never the raw output); you decide each group
  — `fix` on an added line is paid now, a comment finding by
  deleting the comment, never by chopping its sentences; `FP` groups
  are written in `slice-<k>.md` for the shipper. A slice that
  touches `openapi.json` regenerates every generated client of
  Step 0. Commit `wip(<scope>): slice <k>`
  with explicit files. Write `<report-dir>/slice-<k>.md`: what
  exists now (symbols, files), what the next slice must know, écarts
  so far, `## Skills` (`<skill> — <trigger> — <decision it
  changed>`), comply FP groups, ≤ 25 lines. End: `SLICED <k> <slice-k.md>`. The last slice
  ends the same way; the orchestrator spawns `pack`.

## Phase `ship` — after the review verdict

Read `pack.md` (§ Gates, § Comply) and the findings report handed in
your prompt. Fix every finding that removes or corrects code, `nit`
included, every occurrence; a red gate of the pack is fixed here; a
comply group `fix` is paid, `FP` groups are listed for the shipper
with the reason each. `→ issue` findings become `needs-triage`
issues, never code here; before opening one, `glab api
"projects/:id/issues?state=opened&search=<keyword>&per_page=5"` —
a duplicate is linked, not created. A drop carries evidence: false
positive (the line), repo convention (the file), or remedy dearer
than the defect (the grep or measure). Re-run the gate of each
crate or package you touched, never the whole trio: the shipper
does. Commit on top of the pack commit with explicit files.

Review and QA run ONCE per issue. A `blocker` finding whose fix
you cannot prove with the gate and a test → `[review not converged]`
in ship.md, the finding as MR comment text; never a second review.

**QA plan.** No user-reachable surface changed → `QA: not run —
<reason>`. Else the plan from the contract: rows, error paths,
captures to take (screen, state, avant/après) with their placement
in the description.

**Second round only** (your prompt hands `deliver.md` with a NO-GO
verdict): each finding is `fixed` with the commit, or `refuted` with
the code line and the evidence file that proves the API behaves as
the issue asks; a refutation with no line is a fix. Then a
`re-verify` list of the failed rows only. Cap: this one round; a
second NO-GO ships flagged `[qa not converged]`.

**Write.** Read `PRESENTATION.md` NOW and write
`<report-dir>/mr-description.md` in full (prose, `à valider :`,
visual, `Closes #<n>`, the `<details>` block, capture placeholders
`<!-- capture: <screen> -->`). Then `<report-dir>/ship.md`:
disposition table (`fixed` / `→ issue #<m>` / `dropped — <evidence>`
per finding), comply decisions (fix paid / FP groups with reasons),
QA plan or skip, captures list, écarts, flags. End `SHIPPED
<ship.md>`.
