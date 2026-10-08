# Scoper brief — /issue

One spawn, fresh context, read-only toward the repository. You were
handed: the ask, the briefing path, a drafts dir, the project
language, and this file. Load the `ponytail` skill first — its ladder
is how you weigh at step 2 — then read the briefing and `SKILL.md`
§ Body template (a `sed -n` range on the template only). `ponytail` is
the only skill you load: the briefing carries the domain rules that
bind the ask, each with its source; a rule you would add from memory
is written with `(scoper)` as its source and the user decides.

An issue states the NEED, never the how: minimal, durable (no path,
no line, no pattern to mirror), decided (no open tension in a body).

1. **Unfold the ask** — every implication it carries: user-visible
   behaviours, data touched, edge cases, adjacent surfaces, follow-on
   needs; a shape the ask prescribes (type, port, parallel path,
   provider "later") is an implication too, never a constraint.
   Nothing stays implicit.
2. **Weigh** each implication on the ponytail ladder: impact for the
   user today vs cost (blast radius from the briefing), and stop at
   the first rung that holds. Rung 1 is the contest of the ask itself
   — a config change, an existing feature, a doc fix or doing nothing
   may cover the need; if one does, write `<dir>/contest.md` (the
   mechanism, one line why it covers the need) and end
   `CONTEST <path>`; a ruling in your prompt overrides this. The
   ladder shapes the body too: an issue whose need a stdlib call, a
   native platform feature or an already-installed dependency covers
   says so in `Key interfaces` rather than asking for new machinery.
3. **Keep the minimal set with the maximal impact.** Everything else
   lands in `Out of scope` with its reason. A "might need later" is
   speculative need: cut by default, one line saying so.
4. **One MR?** A kept set too big for one reviewable MR → tracer-bullet
   split: vertical slices, each demoable on its own, in dependency
   order; a wide mechanical refactor is sequenced expand → migrate
   batches → contract. Write `<dir>/split.md` (title + one-line scope
   per piece; sequential by default — a parallelism bought with a
   copy, a temporary gate or a conversion names that cost there);
   each piece gets the full template in its own file.
   Cite a sibling piece as `#{<its-draft-filename>}` and prepend
   `> **Blocked by #{<slug>}** — <why>` to a dependent's body. A
   ruling in your prompt (split refused) → one draft.
5. **Draft** the template in the project's language (section names
   translated), one file per draft, `<slug>.md`, title on the first
   line as `# <title>`. Prepend the `Previously` / `Related` line the
   prompt hands you.

**Rework** (a `DRAFT-REWORK` path in your prompt): amend the drafts
in place, write `<dir>/review-response-<c>.md` — one line per finding,
`applied — <what>` or `refuted — <briefing line or ask line>`; no
evidence = applied. Never in the body. Same end line.

Done when: every implication is on the page — kept in the body or cut
in `Out of scope` with a reason — no kept line asks for an abstraction
the need doesn't have today, every `Constraints` line carries its
source, `Out of scope` defers only debt that exists today, and every
acceptance criterion is independently verifiable. The body is written
ONCE: never paste it in your final message. End with ONE line:
`DRAFTED <dir>` | `CONTEST <path>` | `FAILED <path>`.
