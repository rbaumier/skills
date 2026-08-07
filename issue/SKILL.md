---
name: issue
description: >-
  Create a grounded, self-contained issue on the current project's GitLab or
  GitHub. Use when the user asks to create an issue from a description, a
  finding, or a doc.
argument-hint: <free-text description of the issue>
---

# /issue — create an issue on the project's forge

Create an issue for the current project from this description:

> $ARGUMENTS

Three qualities gate creation:

- **Grounded** — every path, pattern, and line number in the body exists in
  the repo. No placeholders.
- **Self-contained** — exact files, a named pattern to mirror, an explicit
  test list. The implementer guesses nothing.
- **Converged** — the review loop (step 5) refuted the draft's grounding,
  architecture, complexity, and standards until only nits remained.

## Your role

You sit at the judgment pole: you rule on the scout's verdict, decide
splits, write the drafts, and disposition findings. Everything mechanical —
forge reads, repo exploration, review — runs in subagents pinned
`model: "opus"` in the Agent call; a spawn without the pin is a process
failure. You never read the repository yourself: your evidence is the
subagents' files, plus the forge writes of step 6, which are yours. In a
fable session this routing spends fable only where quality is decided —
the draft is the contract every reviewer judges against.

Report routing: every subagent writes its report to a scratchpad file and
ends with ONE line — verdict + path. It never pastes the report into its
final text and never SendMessages. You read the file; recopying a report
into the conversation is a process failure.

## Session cache

`<scratchpad>/issue-cache.md` holds what a session shares across /issue
runs: forge, project path, label list, issue language. The scout writes it
on first run and reads it on later ones — in a batch loop, only the
backlog search is paid per issue.

## Forge commands

Reference for the scout's prompt and for step 6. Host `github.com` →
GitHub; `gitlab.com` or any host containing `gitlab` → GitLab (from
`git remote get-url origin`; on a fork prefer `upstream` when it exists —
issues belong on the canonical repo). Not a repo, no remote, or another
host → ask the user.

| Action | GitLab (MCP tools) | GitHub (`gh` CLI) |
|---|---|---|
| project id | full URL-encoded path (`group/sub/project`) | `owner/repo` |
| search issues | `list_issues(project_id, state="all", scope="all", search=…)` | `gh issue list --state all --search "…"` |
| list labels | `list_labels(project_id, include_ancestor_groups=true)` | `gh label list` |
| create | `create_issue(project_id, title, labels, description)` | `gh issue create` |
| link dependents | `create_issue_link(link_type="is_blocked_by")`, fall back to `relates_to` on 403 | body mention only |

## Steps

### 0. Guard

Empty `$ARGUMENTS` → stop and ask what the issue is about. Never invent a
topic.

### 1. Scout — opus, forge recon

Spawn ONE scout (`model: "opus"`, read-only) with `$ARGUMENTS`, the cache
path, and the forge commands above. It:

- resolves the forge from the cache, else detects it and writes the cache;
- searches issues — all states — by the salient keywords of `$ARGUMENTS`
  (entity, feature, bug symptom — not the whole sentence), retrying once
  from a different keyword angle if empty;
- reads a few recent issues for their language and picks fitting labels
  from the existing list — never a new label. Empty backlog → language
  from the README;
- writes labels, language, and the duplicate evidence (URL + one line per
  hit) to its file; ends
  `SCOUT <duplicate-open|duplicate-closed|related|new> <path>`.

Rule on the verdict yourself:

- **duplicate-open** → stop, report the existing URL, ask whether to
  extend it instead. Do not create.
- **duplicate-closed** → proceed, prepend `> **Previously #N** — <one
  line: fixed or rejected, when>`; a fixed bug resurfacing is a
  regression — say so.
- **related** → prepend `> **Related to #N** — <one line how>` at the top
  of the body.

Done when: the verdict is ruled on and labels + language are fixed, every
label pre-existing.

### 2. Grounding — opus, one agent, no fan-out

Spawn ONE grounding agent (`model: "opus"`, read-only) with `$ARGUMENTS`.
Exactly one: it explores inline and never fans out Explore subagents —
the briefing, not breadth, is the deliverable. It reads the project's
`CONTEXT.md` and `docs/adr/` when present, then digs out:

- exact files to modify or create, by path;
- the pattern to follow, named, with an existing file to mirror;
- neighbouring test files and the right test layer for this project (no
  repo convention → Testing Trophy: integration > unit > E2E, colocated
  `foo.test.ts`);
- for a bug: root cause at `file:line`, or state explicitly that it was
  not located and where to investigate;
- the constraining ADRs, by name — a plan that contradicts an ADR is
  wrong before review ever sees it.

It writes the **briefing** — cited paths, the file to mirror, the ADRs,
the neighbouring tests — and ends `BRIEFING-READY <path>`, or
`CONTRADICTION <path>` when the code contradicts `$ARGUMENTS` (bug not
reproducible, feature already there). On CONTRADICTION, stop and surface
it instead of writing around it.

Done when: the one-liner is `BRIEFING-READY` and every claim in the
briefing carries a path.

### 3. Scope to one MR

One issue = one review-able MR. If bigger, propose a split via
`AskUserQuestion` (title + one-line scope per piece, in dependency order)
and create only after confirmation. Each piece gets the full template.
Create in dependency order — `#A` must exist before a dependent's body
cites it. Link dependents (blocked-by) and always prepend
`> **Blocked by #A** — <why>` to the body — the text is the durable
signal.

### 4. Draft

Load `coding-standards:design` (once per session), then fill the template
below from the briefing (section names may be translated to the project's
language). A line that genuinely doesn't apply (docs-only change, nothing
to mirror) is omitted, never filled with filler — except `## Tests`: if
no test is warranted, say why. Never quote secrets, tokens, or env values
in the body. Derive an imperative title ≤ 70 chars — the type lives in
the label, not the title. Write each draft to a scratchpad file for
review.

Done when: every draft exists as a file, template filled.

### 5. Review loop — opus, until converged

Nothing is created until the draft converges. Spawn ONE reviewer
(`model: "opus"`, read-only) with the draft path(s) and the briefing
path; it loads `coding-standards:quality-bar-review` +
`coding-standards:design` (Skill tool, its own context). Its job is to
refute the draft, not approve it: every citation resolves and the
described behavior matches the code; **blast radius** — the importers,
callers, tests, and schemas the draft misses (grep them); architecture —
deletion test on every module the plan creates, ADR conflicts;
complexity — a reframing that deletes steps outranks any local cleanup;
standards — the named pattern, proposed signatures, the `## Tests` list.

**Panel instead of the single reviewer** when the draft creates a new
module or endpoint, or on a split (one panel reviews all drafts; split
boundaries and dependency order belong to the Archi lens). Four
reviewers, all `model: "opus"`, spawned parallel in one message, each
loading its skills in its own context:

| Lens | Loads | Answers |
|---|---|---|
| Grounding | — | Citations and blast radius, as above. |
| Archi | `coding-standards:design`, `matt-improve-codebase-architecture` + its LANGUAGE.md | Is the proposed architecture right? Deletion test on every module the plan creates; ADR conflicts. Judges from the draft, the briefing, and the ADRs it names — no repo-wide search, Grounding owns the facts. |
| Complexity | `thermo-nuclear-code-quality-review`, `ponytail-review` | Is complexity controlled? A code-judo reframing that would delete steps outranks any local cleanup; yagni/stdlib/wrapper findings one line each; `Lean already. Ship.` when nothing. |
| Standards | `coding-standards:quality-bar-review`, the repo's language skill (`Cargo.toml` → `language-rust`; `package.json`/`tsconfig` → `language-typescript`), framework skills matching manifest deps (`react`, `vue`, `tanstack-query`, `drizzle-orm`, `zod`, `tailwind`, …) when they exist | Does the suggested code pass the bar? The named pattern, proposed signatures/types, the `## Tests` list, any snippet in the body. |

Each reviewer writes findings tagged `BLOCKER`/`NIT` to a scratchpad file
and ends ONE line — `OK` or `FINDINGS <path>`.

The loop, per round: read the findings file(s), fix the drafts, then
`SendMessage` the SAME reviewer BY AGENT ID (from the spawn result) with
what changed and one line per finding — `fixed` / `dropped — <reason>`.
Its skills and its reading stay in its context, so it re-reads only what
changed. A drop it judges unjustified comes back as a new `BLOCKER`, so a
contested drop blocks convergence. Never respawn a reviewer mid-loop.
**Converged** = every reviewer's last line is `OK` or its findings are
nits-only (fix nits, no re-review). Hard cap 4 rounds; a `BLOCKER` still
disputed at the cap → `AskUserQuestion` with the finding, instead of
creating.

Done when: converged, or the user has ruled on each surviving blocker.

### 6. Create, report

Create, then print the web URL(s), in dependency order on a split.

## Body template

```markdown
## Context
<why this is needed; link the source doc/finding if any>

## Expected behavior
<what must work once done>

## Implementation details
- Files to modify / create (exact paths):
  - `path/to/file` — <what changes>
- Pattern to follow: <named pattern + existing file to mirror>
- Ordered steps (what and why, never line-by-line how; dependency order —
  data → logic → UI):
  1. <step>
- Edge cases:
  - <case the implementer must handle>

## Tests
- [ ] <happy case> — layer + file
- [ ] <error / boundary case> — layer + file

## Out of scope
- <what the implementer must NOT touch>
```

For a **bug**, add before `## Implementation details`:

```markdown
## Repro
1. <step> → expected: <…> / observed: <…>

## Root cause
`path/to/file:<line>` (in `<symbol>`) — <the defect>. (Or: "not located — investigate <area>.")
```

…and `## Tests` must include a regression test that fails before the fix.
