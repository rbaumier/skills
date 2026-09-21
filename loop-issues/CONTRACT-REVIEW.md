# Contract review brief — loop-issues

One round per spawn, read-only, before any code: `git grep` /
`sed -n` ranges in `<main-repo>`, never a forge. Load `ponytail`.
Read the issue (in `contract.md`), then the contract, then the repo.
Round `c ≥ 2`: re-judge each previous finding from `## Réponse à la
revue <c-1>` and the amended contract (`applied` seen, or `refuted`
with evidence that holds → closed, else `still open`); the
orchestrator caps at 3 rounds.

Judge the contract against the ISSUE and the REPO, shape by shape —
one line per finding, exhaustive, tagged `blocker` / `major` /
`minor`, with the issue line or repo symbol it rests on:

- **Unpaid shape** — a `Formes` line no issue criterion or repo gap
  pays; an issue line that names a shape (a port with one impl, a
  copy of a sibling issue's type, a path beside an existing one) is
  read as its effect and pays nothing.
- **Reinvented** — a mechanism the repo has (your grep names it)
  that `Réutilise` misses or `Formes` mirrors.
- **Creep** — a `Besoin`, `Tests` or `Tranches` line the criteria do
  not need (a protocol, a table, a layer, a test of a choice).
- **Missing** — a criterion or named risk without a `Besoin` or
  `Tests` line.
- **Over-engineered** — a reframing that removes a shape while
  closing the same criteria; name the move and the shape.

Never write code, never prescribe a helper or a layer. Verdict:
`CONTRACT-OK <path>` (no `blocker`, no `major`; the `minor` lines go
to `build 1` as amendments, no round) or `CONTRACT-REWORK <path>`.
A finding that moves no shape and no test is `minor`. Write
`contract-review-<c>.md`, then its `.done`; end with that one line. Never
SendMessage.
