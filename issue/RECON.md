# Recon brief — /issue

Read-only, one spawn, two phases in order — never fan out subagents:
the briefing, not breadth, is the deliverable. You were handed:
`$ARGUMENTS` (the issue ask), the cache path, a report path.

## Forge commands

Host `github.com` → GitHub; `gitlab.com` or any host containing
`gitlab` → GitLab (from `git remote get-url origin`; on a fork prefer
`upstream` when it exists — issues belong on the canonical repo). Not
a repo, no remote, or another host → report it, create nothing.

| Action | GitLab (MCP tools) | GitHub (`gh` CLI) |
|---|---|---|
| project id | full URL-encoded path (`group/sub/project`) | `owner/repo` |
| search issues | `list_issues(project_id, state="all", scope="all", search=…)` | `gh issue list --state all --search "…"` |
| list labels | `list_labels(project_id, include_ancestor_groups=true)` | `gh label list` |
| create | `create_issue(project_id, title, labels, description)` | `gh issue create` |
| link dependents | `create_issue_link(link_type="is_blocked_by")`, fall back to `relates_to` on 403 | body mention only |

## Forge phase

Resolve the forge from the cache, else detect it and write the cache.
Search issues — all states — by the salient keywords of `$ARGUMENTS`
(entity, feature, bug symptom — not the whole sentence), retrying once
from a different keyword angle if empty. Read a few recent issues for
their language and pick fitting labels from the existing list — never
a new label; empty backlog → language from the README. On
**duplicate-open**, stop here: skip the repo phase.

## Repo phase — the briefing

The draft names no path: you dig for what the scoping needs to
**judge**, not for where to edit. Read with `git grep` and `sed -n`
ranges on signatures, never a whole file.

- **Already there?** — the behaviour asked, or a mechanism that covers
  it (config, flag, existing helper or endpoint): name the symbol.
- **Mechanisms the ask touches** — HTTP client, error→message mapping,
  session/token handling, date/money formatting, export, chunking,
  validation, generated types (OpenAPI `Schemas.*`, DB types,
  `z.infer`): the shared symbol for each, so the issue can require its
  reuse under `Key interfaces`.
- **Blast radius** — callers, consumers, schemas, tests the change
  reaches, listed by criterion (the grep + the list), never totalled.
- **Constraints** — ADRs and `CLAUDE.md`/`CONTEXT.md` rules that bind
  the change, by name; product intent visible there.
- **Bug** — root cause by symbol, or `not located — investigate
  <area>`.

## Report

ONE file — `## Forge` (labels, language, duplicate evidence: URL + one
line per hit) then `## Briefing` (the bullets above, symbols only).
End with ONE line, nothing pasted:
`RECON <duplicate-open|duplicate-closed|related|new>
<briefing-ready|contradiction|skipped> <path>`.
`contradiction` = the code contradicts `$ARGUMENTS` (bug not
reproducible, feature already there, ADR forbids it): say so instead
of writing around it. Never SendMessage.
