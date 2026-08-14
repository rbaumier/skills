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
- **Converged** — the review loop (step 4) refuted the draft's grounding,
  architecture, complexity, and standards until only nits remained.

## Your role

You sit at the judgment pole: you rule on the recon verdict, decide
splits, write the drafts, and disposition findings. Everything mechanical
— forge reads, repo exploration, review, forge writes — runs in subagents
pinned `model: "opus"` in the Agent call; a spawn without the pin is a
process failure. You never read the repository and never call the forge
yourself: your evidence is the subagents' files. In a fable session this
routing spends fable only where quality is decided — the draft is the
contract every reviewer judges against.

Report routing: every subagent writes its report to a scratchpad file and
ends with ONE line — verdict + path. It never pastes the report into its
final text and never SendMessages. You read the file; recopying a report
into the conversation is a process failure.

## Session cache

`<scratchpad>/issue-cache.md` holds what a session shares across /issue
runs: forge, project path, label list, issue language. The recon agent
writes it on first run and reads it on later ones — in a batch loop, only
the backlog search is paid per issue.

## Forge commands

Reference for the recon and publisher prompts. Host `github.com` →
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

### 1. Recon — opus, one agent, forge then repo

Spawn ONE recon agent (`model: "opus"`, read-only) with `$ARGUMENTS`, the
cache path, and the forge commands above. One spawn covers both phases —
a second agent here would pay a second bootstrap for nothing. In order:

**Forge phase.** Resolve the forge from the cache, else detect it and
write the cache. Search issues — all states — by the salient keywords of
`$ARGUMENTS` (entity, feature, bug symptom — not the whole sentence),
retrying once from a different keyword angle if empty. Read a few recent
issues for their language and pick fitting labels from the existing list
— never a new label; empty backlog → language from the README. On
**duplicate-open**, stop here: skip the grounding phase — the issue won't
be created, grounding it would be waste.

**Grounding phase.** Explore inline, never fan out subagents — the
briefing, not breadth, is the deliverable. Read the project's
`CONTEXT.md` and `docs/adr/` when present, then dig out:

- exact files to modify or create, by path;
- the pattern to follow, named, with an existing file to mirror;
- neighbouring test files and the right test layer for this project (no
  repo convention → Testing Trophy: integration > unit > E2E, colocated
  `foo.test.ts`);
- for a bug: root cause at `file:line`, or state explicitly that it was
  not located and where to investigate;
- the constraining ADRs, by name — a plan that contradicts an ADR is
  wrong before review ever sees it.

It writes ONE report file — `## Forge` (labels, language, duplicate
evidence: URL + one line per hit) then `## Briefing` (cited paths, the
file to mirror, the ADRs, the neighbouring tests) — and ends
`RECON <duplicate-open|duplicate-closed|related|new>
<briefing-ready|contradiction|skipped> <path>`. `contradiction` = the
code contradicts `$ARGUMENTS` (bug not reproducible, feature already
there): stop and surface it instead of writing around it.

Rule on the duplicate verdict yourself:

- **duplicate-open** → stop, report the existing URL, ask whether to
  extend it instead. Do not create.
- **duplicate-closed** → proceed, prepend `> **Previously #N** — <one
  line: fixed or rejected, when>`; a fixed bug resurfacing is a
  regression — say so.
- **related** → prepend `> **Related to #N** — <one line how>` at the top
  of the body.

Done when: the verdict is ruled on, labels + language are fixed (every
label pre-existing), and every claim in the briefing carries a path.

### 2. Scope to one MR

One issue = one review-able MR. If bigger, propose a split via
`AskUserQuestion` (title + one-line scope per piece, in dependency order)
and create only after confirmation. Each piece gets the full template.
Dependency numbers don't exist before creation: cite a sibling piece as
`#{<its-draft-filename>}` — the publisher (step 5) creates in dependency
order and substitutes the real numbers. Always prepend
`> **Blocked by #{<slug>}** — <why>` to a dependent's body — the text is
the durable signal; the publisher also links it (blocked-by).

### 3. Draft

Load `coding-standards:design` (once per session), then fill the template
below from the briefing (section names may be translated to the project's
language). A line that genuinely doesn't apply (docs-only change, nothing
to mirror) is omitted, never filled with filler — except `## Tests`: if
no test is warranted, say why. Never quote secrets, tokens, or env values
in the body. Derive an imperative title ≤ 70 chars — the type lives in
the label, not the title. Write each draft to a scratchpad file for
review.

Add ONE visual where it beats prose, per the `show-me` skill (load it
once per session): the smallest view — a file-tree diff when the issue
creates or moves files, a call-tree diff when it changes a flow, a
component-tree diff for UI structure; `mermaid` only when a tree can't
say it. It lands in `## Implementation details` (or `## Expected
behavior` for a user-visible flow). Every node is a grounded claim: it
resolves in the briefing, or the issue creates it (`+` margin).
Two exclusions: no HTML artifact — the body must render on the forge —
and no solution pseudocode — the "what and why, never how" rule holds.
A visual that decorates instead of answering is filler: omit it.

Done when: every draft exists as a file, template filled.

### 4. Review loop — opus, until converged

Nothing is created until the draft converges. Spawn ONE reviewer
(`model: "opus"`, `subagent_type: "issue-reviewer"` — the lean agent type
in `~/.claude/agents/issue-reviewer.md`, no MCP servers: the ~10k tokens
of schemas a full agent drags are repaid on every round) with the draft
path(s) and the recon report path. It loads
`coding-standards:quality-bar-review` + `coding-standards:design` (Skill
tool, its own context), plus — only when the draft creates a new module
or endpoint — `thermo-nuclear-code-quality-review` and the repo's
language skill (`Cargo.toml` → `language-rust`; `package.json`/`tsconfig`
→ `language-typescript`). Its job is to refute the draft, not approve it,
across four lenses in one pass:

- **Grounding** — every citation resolves — visual tree/diagram nodes
  included — and the described behavior matches the code; **blast
  radius** — the importers, callers, tests, and schemas the draft misses
  (grep them);
- **Architecture** — deletion test on every module the plan creates; ADR
  conflicts;
- **Complexity** — a reframing that deletes steps outranks any local
  cleanup; yagni/stdlib/wrapper findings one line each;
- **Standards** — the named pattern, proposed signatures, the `## Tests`
  list, any snippet in the body.

On a split, the same reviewer reviews all drafts in one context — split
boundaries and dependency order belong to the Architecture lens.

**Panel** — only when the user explicitly asks for a panel or deep
review: four reviewers instead of one, one lens each, all
`model: "opus"` + `subagent_type: "issue-reviewer"`, spawned parallel in
one message, each loading its skills in its own context. The Architecture
lens adds `matt-improve-codebase-architecture` + its LANGUAGE.md; the
Complexity lens `ponytail-review`; the Standards lens the framework
skills matching manifest deps (`react`, `vue`, `tanstack-query`,
`drizzle-orm`, `zod`, `tailwind`, …) when they exist.

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

### 5. Publish — opus, forge writes

Creation is mechanical once the drafts converged: spawn ONE publisher
(`model: "opus"`) with the draft path(s), the cache path, and the forge
commands above. It creates in dependency order, substitutes each
`#{<slug>}` placeholder with the number the forge returned, links
dependents (blocked-by), and ends `CREATED <url> [<url> …]` — or
`PUBLISH-FAILED <path>` with the error in the file. Print the URL(s) to
the user, in dependency order on a split.

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
