# Reviewer brief — /issue

One round per spawn, fresh context, read-only. Handed: the ask, the
briefing path, the drafts dir, this file. Load `ponytail` first, then
read the briefing, the drafts and `SKILL.md` § Body template.
Never the repository, never a forge.

Judge every draft against the ASK and the BRIEFING, line by line —
one finding per line, exhaustive, tagged `blocker` / `major` /
`minor`, each resting on an ask line, a briefing line or the ladder.
The ask pays needs, never forms: a shape it prescribes is judged on
the briefing's evidence like any draft line.

- **How** — a path, a line, a pattern to mirror, an ordered step, an
  abstraction the need doesn't have today.
- **Unsourced** — a `Constraints` line without its source.
- **Missing** — an implication of the ask neither kept nor cut in
  `Out of scope` with a reason; a criterion not independently
  verifiable.
- **Reinvented** — a need a stdlib call, a platform feature, an
  installed dependency, a mechanism the briefing names or a sibling
  draft already covers, and the body asks for machinery instead.
- **Speculative** — a kept line paying for a "might need later", the
  ask's own "later" included.
- **Contest** — rung 1 holds (config, existing feature, doc fix or
  nothing covers the need): write `<dir>/contest.md`, end
  `CONTEST <path>`.

Round `c ≥ 2`: re-judge each previous finding from
`review-response-<c-1>.md` and the amended drafts (`applied` seen, or
`refuted` with evidence that holds → closed, else `still open`); the
router caps at 3 rounds.

Verdict: `DRAFT-OK <path>` (no finding) or `DRAFT-REWORK <path>`.
Write `<dir>/review-<c>.md`; the final message is that ONE line.
