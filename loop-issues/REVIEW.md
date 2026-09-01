# Review brief — loop-issues

One pass, two reviewers spawned in parallel by the implementer, then
a re-check per fix round; all read-only — `git grep` / `git show
origin/<default>:<path>` in `<main-repo>`, `sed -n` ranges, never a
whole file, never a forge.
Each writes its findings to its own path and ends ONE line — verdict +
path. Never SendMessage.

A finding is a **trade**: it names the property to reach, the remedy,
and the remedy's cost — lines ±, call sites, a query or an allocation
per row, an abstraction with one caller. A remedy dearer than the
defect is not filed. A remedy on the contract's `Mesure` path names
the bar it must hold. Duplicated Code is filed at the SECOND copy
(`quality-bar` § Scope & necessity) — there is no rule of three.

**Exhaustive.** Every finding, every occurrence — never a top-N, a
selection, a "main issues", an "and N more": a finding seen and left
out is a failed pass. Terse per finding, never fewer findings. Done =
every site in the diff that carries a finding is listed.

## Code reviewer — `model: "opus"`, `subagent_type: "loop-reviewer"`

Input: the round pack path (issue, contract, changed-file list, full
diff, the measure output). Load
`coding-standards:quality-bar-review` + every skill in the pack's
`## Skills` section + any skill of `~/.claude/skills/_shared/SKILLS.md`
the diff calls for that the pack missed; nothing else. Your report's
first line is `Skills: <the list>`. Beyond the diff: call sites and the
mechanisms your findings name, batched — a finding that says "reuse
X" or "extract" carries the grep that proves X exists, or that a
second copy does.

Report FINDINGS ONLY — tagged
`blocker`/`major`/`minor`/`nit`, `file:line`, the property, the fix
and its cost. A finding is a pattern: list every site in the diff that
carries it. Judge each `## Écarts au plan` deviation and the diff
against the contract's `Budget`. Never recount an inventory.

On top of the skills, Fowler's smells apply as judgement calls,
named as such: Duplicated Code, Feature Envy, Data Clumps, Primitive
Obsession, Repeated Switches, Shotgun Surgery, Speculative Generality
(anything the issue didn't ask for — the fix REMOVES code), Middle
Man, Mysterious Name.

End `CODE <path>` (`CODE OK` when nothing). There is no second round
for you: a fresh re-check (below) verifies your findings' properties.

## Fond reviewer — `model: "fable"`, `subagent_type: "loop-fond-reviewer"`

Input: the issue, the diff, the contract, the repo. Load
`thermo-nuclear-code-quality-review`: its code-judo question — the
reframing that makes whole branches, helpers, flags or layers
disappear — is yours, **leashed**: a judo move must make THIS diff
smaller (fewer concepts, files, lines) or consolidate a mechanism the
diff touches; a restructuring wider than the diff is never a finding.
The contract is a declaration of intent to contest, never an
authority: you judge the diff against the ISSUE and the REPO.

One line per finding plus its evidence — no length cap, no cap on
the count. Each finding quotes the issue line or the repo
symbol it rests on:

- **Missing or partial** — an acceptance criterion the diff doesn't
  close.
- **Scope creep** — behaviour the issue didn't ask for.
- **Implemented but wrong** — looks done, does the wrong thing.
- **Reinvented** — a mechanism or a type the diff declares while the
  repo already has it (`git grep` proves it; generated types
  included), or a copy the diff leaves standing next to the one it
  touched.
- **Debt** — the next MR cannot build on this cleanly: a helper in a
  page, a second error mapping, a third label for the same state.
- **Over-engineered** — a smaller diff closes the same criteria: name
  the shape (the layer, flag, helper or type that disappears) and the
  `Budget` line it breaks; "could be simpler" without the shape is not
  a finding.
- **Readable in one pass** — a reader who never saw the issue follows
  the diff; only this kind may end in `MERGEABLE`.

The issue defers existing debt; it never licenses debt the diff
creates — a copy or a second transport born in the diff is
**Reinvented** or **Debt** whatever `Out of scope` says.

Verdict: `MERGEABLE <path>` or `REWORK <path>` — any finding of the
first six kinds is `REWORK`.

## Re-check — `model: "opus"`, `subagent_type: "loop-reviewer"`

A fresh spawn handed ONLY the two round-1 reports, the disposition
table and the fix diff — never the pack; `git grep` in `<main-repo>`
only to test a drop's evidence. Load
`coding-standards:quality-bar-review`. Two jobs: per finding, the
**property** — reached (one declaration, one mapping, the layer gone),
not merely addressed; a drop stands or falls on its evidence (false
positive, repo convention, remedy dearer than the defect — with its
numbers). Evidence has rungs — asserted < file:line < failure path
walked < executed < reproduced — a drop resting below file:line falls. Then the fix diff is new code: the code reviewer's rules
apply to it. End `RECHECK OK <path>` or `RECHECK REWORK <path>` —
REWORK on any property not reached, drop without evidence, or new
finding.
