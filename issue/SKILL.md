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

You scope and draft — that is where fable earns its cost. Everything
mechanical (forge reads, repo check, forge writes on a split) runs in
subagents pinned `model: "opus"`. You never read the repository and
never call the forge yourself — one exception: publishing a single
issue (step 4). In an opus session, delegate step 2 to ONE agent
`model: "fable"` handed the briefing path and this file's path
(§ Scope & draft); everything else is unchanged.

Report routing: a subagent writes its report to a scratchpad file and
ends with ONE line — verdict + path. You read the file; never recopy a
report into the conversation.

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
- **duplicate-closed** → proceed, prepend `> **Previously #N** — <one
  line: fixed or rejected, when>`; a fixed bug resurfacing is a
  regression — say so.
- **related** → prepend `> **Related to #N** — <one line how>`.
- **contradiction** (feature already there, bug not reproducible, ask
  conflicts with an ADR) → stop and surface it; never write around it.

### 2. Scope & draft — the fable pass

Read the briefing (existing mechanisms, blast radius, ADRs, product
intent). Load every skill of `~/.claude/skills/_shared/SKILLS.md` the
briefing calls for (the files it names, the mechanisms it touches) —
the domain rules shape the acceptance criteria (`database` ⇒ an
EXPLAIN criterion on any RPC or query change). Then:

1. **Unfold the ask** — list every implication it carries: user-visible
   behaviours, data touched, edge cases, adjacent surfaces, follow-on
   needs. Nothing stays implicit.
2. **Weigh** each implication: impact for the user today vs cost (blast
   radius from the briefing). Contest the ask itself: a config change,
   an existing feature, a doc fix or doing nothing may cover the need —
   if one does, say so to the user before drafting.
3. **Keep the minimal set with the maximal impact.** Everything else
   lands in `Out of scope` with its reason. A "might need later" is
   cut by default.
4. **One MR?** A kept set too big for one reviewable MR → tracer-bullet
   split: vertical slices, each demoable on its own, in dependency
   order; a wide mechanical refactor (rename/retype fanning across the
   codebase) is sequenced expand → migrate batches → contract. Propose
   the split via `AskUserQuestion` (title + one-line scope per piece);
   each piece gets the full template. Cite a sibling piece as
   `#{<its-draft-filename>}` and prepend
   `> **Blocked by #{<slug>}** — <why>` to a dependent's body.
5. **Draft** the template below in the project's language (section
   names translated). One draft = one scratchpad file.

Done when: every implication is on the page — kept in the body or cut
in `Out of scope` with a reason — every `Constraints` line carries its
source, `Out of scope` defers only debt that exists today (it never
licenses debt the change would create), and every acceptance
criterion is independently verifiable.

### 3. Validate with the user

Print the draft(s) in full — the body IS the deliverable. The user
edits or accepts in chat; apply edits without re-scoping what was
accepted. Nothing is created before this go.

### 4. Publish

A single issue → create it YOURSELF: one forge call (ToolSearch the
create tool first on GitLab). Print the URL.

A split → spawn ONE publisher (`model: "opus"`) with the draft paths,
the cache path, and `RECON.md` (path — its § Forge commands). It
creates in dependency order, substitutes each `#{<slug>}` with the
number the forge returned, links dependents (blocked-by), and ends
`CREATED <url> [<url> …]` or `PUBLISH-FAILED <path>`. Print the URLs
in dependency order.

## Body template

≤ 40 lines. No file path, no line number, no pattern to mirror, no
ordered steps. A line that doesn't apply is omitted, never filled.
Never quote secrets or env values. A count is never a contract. A flow
the issue changes may carry ONE mermaid diagram of the touched sub-flow
(`show-me` skill) under `Desired behavior`; never a file tree.

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
