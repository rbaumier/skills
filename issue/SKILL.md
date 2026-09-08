---
name: issue
description: >-
  Create a need-only, minimal-scope issue on the current project's GitLab or
  GitHub. Use when the user asks to create an issue from a description, a
  finding, or a doc.
argument-hint: <free-text description of the issue>
---

# /issue — create an issue on the project's forge

Create an issue for the current project from this description:

> $ARGUMENTS

An issue states the NEED, never the how. Three qualities gate creation:

- **Minimal** — the smallest change that closes the acceptance criteria;
  every implication the ask carries is kept with its impact or cut with
  its reason.
- **Durable** — no file path, no line number, no pattern to mirror: the
  repo moves before the implementer reads the issue. Types, signatures
  and observable behaviour survive; paths don't.
- **Decided** — no open tension in a published body; the user rules on
  the draft in chat before anything is created.

## Your role

You route, validate with the user and never draft yourself. The
scoping and the draft run in ONE fable subagent (`issue-scoper`, effort
pinned); everything mechanical (forge reads, repo check, forge writes)
runs in subagents pinned `model: "opus"`. You never read the
repository, never load a skill and never call the forge yourself.

Report routing: a subagent writes its report to a scratchpad file and
ends with ONE line — verdict + path. You read the file; never recopy a
report into the conversation, except the draft body at step 3.

## Session cache

`<scratchpad>/issue-cache.md` — forge, project path, label list, issue
language. The recon agent writes it on first run and reads it on later
ones.

## Steps

### 0. Guard

Empty `$ARGUMENTS` → stop and ask what the issue is about. Never invent
a topic.

### 1. Recon — opus, one agent

Spawn ONE recon agent (`model: "opus"`, read-only) with `$ARGUMENTS`,
the cache path, a report path, and `RECON.md` (path). It ends
`RECON <duplicate-verdict> <repo-verdict> <path>`.

Rule on the verdicts yourself:

- **duplicate-open** → stop, report the existing URL, ask whether to
  extend it instead. Do not create.
- **duplicate-closed** → proceed; the scoper prompt carries
  `> **Previously #N** — <one line: fixed or rejected, when>`; a fixed
  bug resurfacing is a regression — say so.
- **related** → the scoper prompt carries `> **Related to #N** — <one
  line how>`.
- **contradiction** (feature already there, bug not reproducible, ask
  conflicts with an ADR) → stop and surface it; never write around it.

### 2. Scope & draft — one `issue-scoper` spawn

Spawn ONE `issue-scoper` (`subagent_type: "issue-scoper"`, never with
`model`) handed: `$ARGUMENTS`, the briefing path, a drafts dir, the
project language from the cache, and `SCOPER.md` (path). It ends
`DRAFTED <dir>` (one file per draft, `split.md` when it proposes a
split), `CONTEST <path>` (a config change, an existing feature, a doc
fix or doing nothing covers the need) or `FAILED <path>`.

- **CONTEST** → print the file, ask the user; on "draft anyway",
  respawn with the ruling.
- **split** → `AskUserQuestion` with the titles and one-line scopes
  of `split.md`; a refused split → respawn with the ruling.

### 3. Validate with the user

Print the draft(s) in full — the body IS the deliverable. The user
edits or accepts in chat; apply edits to the draft file without
re-scoping what was accepted. Nothing is created before this go.

### 4. Publish — opus, one agent

Spawn ONE publisher (`model: "opus"`) with the draft paths, the cache
path, and `RECON.md` (path — its § Forge commands). It creates in
dependency order from the files, substitutes each `#{<slug>}` with the
number the forge returned, links dependents (blocked-by), and ends
`CREATED <url> [<url> …]` or `PUBLISH-FAILED <path>`. Print the URLs
in dependency order. You never call the forge: the body leaves the
fable once, as the file.

## Body template

≤ 40 lines. No file path, no line number, no pattern to mirror, no
ordered steps. A line that doesn't apply is omitted, never filled.
Never quote secrets or env values. A count is never a contract. A flow
the issue changes may carry ONE mermaid diagram of the touched sub-flow
under `Desired behavior`; never a file tree.

```markdown
**Category:** bug / enhancement
**Summary:** <one line: what must happen>

**Current behavior:**
<what happens today, for whom; link the source doc/finding.
Bug: repro steps + expected / observed>

**Desired behavior:**
<what the user observes once done; edge cases and error conditions named>

**Key interfaces:**
- `TypeName` / `functionName()` / config shape — the behaviour that
  changes and why, never "a new method"; the shared mechanism or
  generated type to reuse, by name, never by path

**Constraints:**
- <what a human or an ADR imposes, each line ending on its source:
  "text[] in DB (ADR-4)", "FR only (user)", "<rule> (CLAUDE.md)".
  Unsourced = a disguised how: cut it. Omit if none>

**Acceptance criteria:**
- [ ] <independently verifiable behaviour>

**Out of scope:**
- <implication cut> — <why: no impact today / cost / other issue>
```

Title: imperative, ≤ 70 chars; the type lives in the label, not the
title.
