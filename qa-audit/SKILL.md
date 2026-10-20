---
name: qa-audit
description: "Unattended whole-surface acceptance audit of the app from the user's seat: charters planned by Opus, run by Sonnet, free Opus breakers, voice calls on the local voice stack, every finding replayed cold before a batched /issue."
disable-model-invocation: true
argument-hint: "[budget hours, default 6] | calibrate <branch>"
version: 1.0.0
---

# QA audit — the night run

Launched by hand before the night; from then on, **never ask anything**: every
choice below is already made, a blocked step is reported, never a question.

Builds on `~/.claude/skills/qa/SKILL.md`: its leading words (matrix, evidence,
merciless), its write-proof rule (a toast proves nothing, an independent read
does), its allowlist, fuse and teardown hold here unchanged. Read it first.
What changes: the whole surface instead of one change, many agents instead
of two, issues instead of a verdict.

No test suite, no lint, no gate: every verdict comes from driving the running
product as a user would.

## Roles and models

| Role | Model | Count | Prompt |
| --- | --- | --- | --- |
| Stack | sonnet (`loop-mechanic`) | 1 | § Phase 1 |
| Planner | opus | 1 | `PLANNER.md` |
| Executor | sonnet | one per charter | `EXECUTOR.md` |
| Breaker | opus | 3 per wave | `BREAKER.md` |
| Voice caller | sonnet | ≤ 2 at once | `VOICE.md` |
| Judge | opus | one per finding batch | `JUDGE.md` |

At most **10 browser agents** at once (executors + breakers). Each owns one
seeded organization and one isolated browser context, never another's.

## Durable state

`<main-repo>/../qa-audit/` (beside the checkout, never in it):

- `ledger.md` — last audited sha, rotation cursor, inventory hash, and every
  finding ever filed (fingerprint → issue number). Created on the first run.
- `inventory.md` — the surface map; rebuilt only when the hash of the route
  files, `openapi.json` and the channel types changes.
- `run-<YYYY-MM-DD-HHMM>/` — this run: `stack.md`, `charters/`, `results/`,
  `evidence/`, `findings/`, `report.md`.

Screenshots land in `<main-repo>/.qa-shots/<run-id>/` (chrome-devtools'
workspace root) and are moved into the run's `evidence/`.

## Oracle — what a bug is

A finding is a bug only if it breaks one of these, cited in the finding:

1. A rule of `apps/webapp/PRODUCT.md`, `apps/webapp/DESIGN.md`,
   `docs/ux-writing/` or a term of `CONTEXT.md`.
2. A console error, an unhandled rejection, a 5xx, a `problem+json` the UI
   shows raw, an infinite spinner (> 30 s).
3. A write not proven by an independent read (reload, `GET`, read-only SQL).
4. A dead control, a broken navigation, a state lost on reload or back.
5. A cross-organization leak: one organization sees or changes another's data.
6. On a call: silence > 15 s after the caller spoke, a hang-up the caller did
   not ask for, a conversation missing or wrong in the console after the call.

Not a bug: what `.claude/skills/verify/SKILL.md` and
`tools/local-voice/README.md` list as absent locally (Stripe webhook, demo
page, recording transcription `501`, pronunciation dictionary, realtime
mode), latency of the local LLM short of rule 6, anything
`docs/review-checklist.md` § À ne pas signaler names.

## Phase 0 — Arguments

`calibrate <branch>` → § Calibration. Else the budget in hours (default 6);
the run ends at the budget's T-15 min whatever remains, status `PARTIAL`.

## Phase 1 — Stacks

Spawn the Stack agent with: `<main-repo>/.claude/skills/verify/SKILL.md` §
Prerequisites and § Launch, the run dir, and these values:

- Worktree of `origin/main`'s head (`git fetch` first); the sha goes in
  `stack.md`.
- Database `qa_audit_<run-id>`, migrated from that worktree.
- Main stack on the default ports if free, else the first free slot of §
  Parallel runs. Text completions on the local Ollama
  (`LLM_PLATFORM_PROVIDER=openai-compatible`,
  `LLM_OPENAI_COMPATIBLE_BASE_URL=http://localhost:11434`, `llama3.2`); the
  fake messaging service stays for WhatsApp and SMS. Ollama down → the fake
  LLM, noted in `stack.md`.
- Seed: `seed-qa.sql` of the launch pack, then `seed-orgs.sql` beside this
  file with `-v n=12` (ten browser agents, the voice caller, one spare),
  then `seed_billing_catalogue`.
- Voice stack: `SERVER_PORT=3466 SERVER_INTERNAL_PORT=3467
  DATABASE_NAME=qa_audit_<run-id> tools/local-voice/start <voice-org-id>` in
  the background, `<voice-org-id>` = organization 11 of `seed-orgs.sql`. A
  voice stack that does not come up does not stop the run: `stack.md` says
  `voice: down <reason>` and the voice rows end `BLOCKED(env)`.
- Doctor of the launch pack from the console origin; one sign-in round trip
  with a screenshot.

It writes `stack.md`: sha, URLs and ports, PIDs, database, organizations
(id, name, owner agent), credentials path, allowlist, voice state. A red
doctor → the Stack agent fixes what the launch pack says to restart, else
the run ends `ABORTED` (§ Phase 5).

## Phase 2 — Plan

Spawn the Planner (`PLANNER.md`) with the run dir, `stack.md`, the ledger
and the inventory paths. It returns the charters, already ordered:

1. Every area the diff `<ledger sha>..<run sha>` touches, full depth.
2. Every area a client error or support ticket names since the last run.
3. The rotation slice: the next 1/5 of the remaining inventory from the
   cursor, so the whole surface passes in five nights.
4. One voice charter set (`VOICE.md`) every night.

## Phase 3 — Waves

Fill up to 10 browser slots from the charter queue, front first; every free
slot takes the next charter. Each wave of seven executors runs beside three
breakers (`BREAKER.md`), each given one area and one persona the wave's
charters do not hold. Voice callers run beside, ≤ 2 at once.

Spawn in the background and end your turn; each completion wakes you. On a
wake: `ls` the evidence paths the agent names (missing → the row is
`BLOCKED`), append its findings to `findings/pending.md`, start the next
charter. An agent returning an env-block trips the fuse: no new spawn, the
Stack agent repairs once, else `ABORTED`.

## Phase 4 — Judge and file, as findings arrive

Every 5 pending findings (or when the queue drains), spawn a Judge
(`JUDGE.md`) on that batch with its own organization and browser context.
It replays each finding cold from its text alone, drops what does not
reproduce, deduplicates against the ledger and the forge's open issues, and
groups what remains by need.

For each group it returns, invoke `/issue` with the group's text, prefixed:

> Constats d'audit QA nocturne, rejoués à froid : publier après revue sans
> montrer le brouillon. Label `qa-audit`, jamais `ready-for-agent`. Preuves :
> <evidence paths>.

Write each issue number into the ledger against its fingerprints.

## Phase 5 — Report and teardown

`report.md`: status (`COMPLETE` | `PARTIAL` | `ABORTED`), sha, charters run
and their verdicts, issues filed (number, title, severity), findings dropped
by the Judge and why, rows `BLOCKED` with their reason, areas not reached
(they head the next run's queue), voice calls placed. Then advance the
ledger's sha and rotation cursor — not on `ABORTED`.

Teardown on every exit: `list_pages` and close every page the run opened;
stop both stacks by their recorded PIDs; drop `qa_audit_<run-id>`; remove the
worktree. End with one line: status, issues filed, report path.

## Calibration

`calibrate <branch>`: a branch carrying deliberately injected bugs, listed
in `../qa-audit/calibration/<branch>.md` (one line per bug, with its area).
Run Phases 1–4 against it **without filing**: the Judge's groups go to
`report.md` only. Score = injected bugs found / injected bugs; every
injected bug missed names its area, which joins the Planner's next priority
list. Run it once a month; the score goes in the ledger.
