---
name: create-verification-skill
description: Interview a repo once and generate its project `verify` skill — launch, doctor, drive, evidence, cleanup — proven end-to-end before handover.
disable-model-invocation: true
argument-hint: "[repo path (default: cwd)]"
---

# Create the project's verification skill

One repo interview → one generated skill at
`<repo>/.claude/skills/verify/SKILL.md` that any agent (qa Phase 1,
loop-issues' QA launch pack, a dogfood gate) follows verbatim to boot,
drive and prove the app. The recurring cost this kills: every QA run
re-discovering how to launch the thing — or stopping to ask.

## 1 — Interview the repo, not the user

Everything from the repo: README, `package.json` scripts /
`Makefile` / `justfile`, docker-compose, `.env.example`, CI config,
migration/seed scripts, existing project skills. Ask the user ONLY
what the repo cannot answer (real credentials, which env is safe) —
batched into ONE question at the end of the interview, never during.

**Completion:** launch command(s), ports, env vars, DB-prepare path,
readiness signal and the user-visible features are each traced to a
file you read (or one user answer).

## 2 — Write the skill

Generate `<repo>/.claude/skills/verify/SKILL.md` (versioned with the
repo). Frontmatter: model-invoked (no `disable-model-invocation` —
agents must find it), description = "Launch, probe, drive and clean up
<repo>'s app for QA/verification — the boot source of truth." Five
sections:

- **Launch** — exact commands from cold: deps, env, DB prepare
  (prefer cloning a template DB), boot, port(s). Copy-pasteable, zero
  placeholders.
- **Doctor** — the readiness probe (URL/command + expected response)
  and the top failures with their one-line fixes (port busy, stale
  deps, missing env).
- **Drive** — the feature map: one line per user-visible feature →
  how to reach it (route, command, credentials role). This is what QA
  turns into matrix rows.
- **Evidence** — per surface, what artifact proves behaviour
  (screenshot, HTTP response, exit code) and the capture tool.
- **Cleanup** — kill what Launch started, reset what Drive mutated.

## 3 — Prove it once

Fresh shell, follow the generated skill VERBATIM: launch from cold →
probe green → drive one feature → capture one artifact → cleanup
leaves nothing running. Any improvisation the run needed is a bug in
the skill: fix the skill, re-run the broken section.

**Completion:** the cold-to-evidence run needed zero commands outside
the skill. Only then hand over — name the file and what consumes it
(qa Phase 1, loop-issues Step 0).
