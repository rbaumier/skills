---
name: afk
description: Use when the user runs /afk to autonomously work through all open GitLab issues unattended. Also use when the user says "AFK mode", "process issues while I'm gone", "drain the backlog", or wants sequential, full-code-review issue delivery without supervision.
---

# AFK — Autonomous Issue Loop

`/afk` runs a **deterministic orchestrator**: a Bun state machine that drives Claude Code through every `ready-for-agent` GitLab issue, one at a time, until the queue is empty. Each issue is implemented, reviewed, and either opened as a merge request or labelled `failed-by-agent`.

The orchestrator — not Claude — owns the state machine: the queue, claims, worktrees, the per-issue session pipeline, and the MR lifecycle. It spawns fresh Claude Code sessions in tmux for each phase of an issue, so no single session accumulates enough context to compact.

## Run it

```bash
bun ~/.claude/skills/afk/orchestrator.ts
```

It runs to completion on its own — kick it off, step away. Worktrees and run logs are left under `~/.afk-worktrees/` and `~/.afk-runs/` for post-mortem.

## Prerequisites

- `jq`, `tmux`, `claude`, `glab`, `git` in `PATH`.
- `glab auth status` working.
- `origin/HEAD` set locally — `git remote set-head origin -a`.
- Issues to process tagged `ready-for-agent`.

## Architecture

`orchestrator.ts` is the whole system. Design and rationale: [`docs/2026-05-22-orchestrator-decomposition.md`](docs/2026-05-22-orchestrator-decomposition.md).

`verify-crl-witness.sh`, `v0-test.ts`, `v1a-smoke.ts`, `v1b-sandbox-setup.ts` are validation/smoke tools — not part of a run.
