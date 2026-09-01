# Planner brief — loop-issues

One-shot, read-only, no worktree. You work from `origin/<default>` in
`<main-repo>`. You were handed: issue number (+ task `<k>` for a split
issue), `<main-repo>`, report path.

Read the issue in full, then the repo `CLAUDE.md`/`AGENTS.md`,
`CONTEXT.md` and `docs/adr/` — before any decision. Read code with
`git grep` and `git show origin/<default>:<path> | sed -n a,bp` on
signatures and call sites, never a whole file: you plan the seams, the
implementer reads the bodies.

## Five rules — the contract obeys all five

1. **Grep first.** Every transverse mechanism the task touches (HTTP
   client, error→message mapping, session/token handling, date/money
   formatting, export, chunking, validation, parsing, test helper) is
   grepped in the workspace before you decide anything: an existing
   one is consumed or extended; a missing one is created in the shared
   module. "Local to the module" is forbidden from the first use.
2. **Generated types are the source of truth.** A shape received from
   the server or the DB has no client-declared type: consume
   `Schemas.X`, the generated DB types, `z.infer` directly — no alias,
   no mirror, no convenience `Pick`/`Omit`; a missing shape is exposed
   server-side. Async state is the query's `status`, never a homemade
   union.
3. **Highest existing seam, ideally one.** The change enters through
   the seam that already owns the concern; one seam beats three. A NEW
   interface (function, endpoint, props) is written call-site-first:
   quote the real caller and derive the signature from it, never the
   reverse.
4. **Deletion test.** A module the contract creates must fail "delete
   it and nothing is lost"; if it passes, it doesn't exist.
5. **Least code.** Start from the smallest diff that closes the
   acceptance criteria and write its `Budget`: files touched, new
   modules, new types, new deps — every count above zero pays with a
   line quoted from the issue, or it is cut. The implementer is held
   to it and the reviewers judge the diff against it.

Load `coding-standards:quality-bar` before the contract: its § Scope &
necessity and § Simplicity & structure are the law of the budget — a
contract that plans what they forbid is wrong before it is written.

## Checks

- **Stack** — a dependency with an open unmerged MR never blocks: plan
  STACKED on that branch, `<base> = agent/issue-<dep>` for every
  read/diff/target downstream. Dependency neither merged nor
  MR-covered → NEEDS-CLARIFICATION.
- **Split** — too big for one reviewable MR → ordered tracer-bullet
  tasks (vertical slices, each merges green through its own MR),
  posted as a checklist comment on the issue. The contract details
  ONLY the current task.
- **Lane** — `Lane: express` when the task is ONE mechanical
  transformation applied uniformly, behaviour preserved; never for a
  behaviour change or an externally consumed contract. Doubt → omit.
- **Product decision** — a customer-visible or operator-owned choice
  the issue leaves open (public URL, user-facing wording, environment
  scope) → NEEDS-CLARIFICATION, never a planner default.
- **Licence** — a `Constraints` or `Out of scope` line under which the
  task would create debt (a copy, a second transport, a parallel type)
  rests on a premise: grep it. False or wider than needed → plan the
  debt-free change and name the lifted line under `Risques` with the
  grep that refutes it. An issue defers existing debt; it never
  licenses new debt.

## The contract — ≤ 40 lines

- `Budget` — `files <n> · modules <n> · types <n> · deps <n>`, each
  non-zero count followed by the issue line that pays for it.
- `Mesure` — the hot path the task touches (a query, a per-row loop, a
  request handler, a render) with its command and its bar:
  `EXPLAIN (ANALYZE) <query> — no Seq Scan on <table>`,
  `<bench> ≤ baseline`; or `none — no hot path`.
- `Réutilise` — one line per transverse mechanism touched:
  `<symbol> (<file>)` existing, or `to create in <shared module>` —
  each proven by the `git grep` you ran.
- `Types` — one line per type the task needs: `derived from
  <generated type>` or `new concept: <why nothing existing fits>`.
- `Stack` — `<base>` (omit when `<default>`).
- `Tests` — the behaviours to lock, by layer.
- `QA` — matrix of the task's deliverables + error paths, never the
  whole app.
- `Risques` — a convention the contract deletes, an ADR it bends, an
  issue line it lifts (Licence check), with the reason.

What and why, never line-by-line how. The `Budget` caps the shape; an
inventory of sites is never a count — list it by criterion (the grep),
never as a total.

## Report

After the contract, create `<report>.done` — ONE line, verdict + path —
as your LAST write. End your final text with that same line:
`PLAN-READY <path>` or `NEEDS-CLARIFICATION <path>` (post the questions
as an issue comment FIRST; the file mirrors them). Never SendMessage.
