# Review brief — loop-issues

One pass, read-only: `git grep` / `git show origin/<default>:<path>`
in `<main-repo>`, `sed -n` ranges, never a forge. Load
`ponytail-review` (what to cut), `coding-standards:quality-bar-review`
(correctness, errors, tests) and the pack's `## Skills`. The
contract is intent to contest, never authority: judge the contract
against the ISSUE, then the diff against the ISSUE and the REPO.

A `cut` from ponytail-review on a shape `Nécessaire` pays is `nit`
or `→ issue`, never `blocker`: the review does not contest the plan.
A remedy that adds an abstraction, layer or helper is not a finding.

## Step 1 — `Nécessaire`, BEFORE opening `diff.patch`

Read `pack.md` (issue, contract, changed-file list) and the repo.
Write in your report the list of shapes the issue needs: files, and
every new type, trait, module, table, column, route or dependency,
each with the issue line or repo gap that pays it. Shapes only,
never a line count or a ratio. Write it and only then open
`diff.patch`. A `Nécessaire` written after the diff is a failed
pass.

## Step 2 — Findings

Every shape of the diff absent from `Nécessaire` is a finding
`Unpaid shape` unless the diff proves a second caller on `<base>`.
A finding is a trade: property, remedy, cost. Exhaustive: every
finding, every occurrence; a top-N is a failed pass. One line each,
with the issue line or repo symbol it rests on, tagged
`blocker` / `major` / `minor` / `nit`. Kinds:

- **Unpaid shape** — see above; remedy: delete or inline.
- **Contract creep** — a contract line prescribing a protocol, table,
  API change or layer the criteria do not need.
- **Missing or partial** — a criterion the diff doesn't close.
- **Wrong** — looks done, does the wrong thing.
- **Reinvented** — a mechanism or type the repo already has (grep
  proves it; generated types included), or a copy left standing next
  to the one touched. Filed at the SECOND copy.
- **Over-engineered** — which reframing makes a layer, helper, flag
  or type disappear while closing the same criteria? Try in order:
  delete a layer of indirection; reframe the state model so the
  conditionals vanish; move the ownership boundary so the feature
  extends an existing abstraction; make the special case the default
  flow. Name the shape and the cost; "could be simpler" is not a
  finding; a move wider than the diff is not a finding. Code moved
  without fewer concepts to hold is this finding, not an improvement.
  Closed only when a move is named or the report states that none
  bounded to the diff removes a shape.
- **Shape rule** — a breach of `BUILDER.md` § build.
- **Test of a choice** — a test outside the contract's `Tests` list,
  one that locks an implementation choice, or a test written inline
  instead of its own file; remedy: delete or move.
- **Comment noise** — comments restating the code; remedy: delete.
- **Scope creep** — behaviour the issue didn't ask; remedy: remove.
- **Debt** — the next MR cannot build on this cleanly.

A remedy that would ADD behaviour or scope is tagged `→ issue` and
never asks for code in this MR. Judge each `## Écarts au plan` line
against the issue line it cites.

## Verdict

`MERGEABLE <path>` (no `Unpaid shape`, no `blocker`, no finding of
the kinds Missing, Wrong, Reinvented) or `REWORK <path>`. Write the
report, then its `.done`; end with that one line. Never SendMessage.
