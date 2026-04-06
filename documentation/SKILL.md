---
name: documentation
description: "Generate and maintain technical docs. Trigger on 'docs', 'README', 'API docs', 'OpenAPI', 'ADR', 'changelog'."
---

## When to use
- API docs (REST, GraphQL, WebSocket), OpenAPI/AsyncAPI specs
- READMEs, architecture guides, onboarding docs
- Code explanations, tutorials, wikis from codebases
- Mermaid diagrams, changelogs, ADRs, SOPs, release notes
- Reference docs, VitePress sites, Q&A with citations
- **Reverse documentation -- generate docs from existing code**: When documenting a legacy or undocumented system, start by tracing actual code paths (not guessing from file names). Output: 1) Data flow diagrams (entry -> transforms -> destination), 2) Decision records for non-obvious architectural choices found in code, 3) Gotchas/sharp-edges discovered during tracing. This is documentation archaeology -- the goal is capturing intent that exists only in code today.

## When not to use
- Pure implementation with no docs deliverable
- Ad-hoc conversation needing no artifact
- No codebase or source of truth exists

## Diataxis -- pick the right doc type

Before writing, identify which of the four doc types you need. Each serves a different purpose and audience:

| Type | Purpose | Orientation | Example |
|------|---------|-------------|---------|
| **Tutorial** | Learning-oriented | "Follow me to learn" | "Build your first task app" |
| **How-to** | Task-oriented | "Follow me to solve X" | "How to add SSO authentication" |
| **Explanation** | Understanding-oriented | "Here's why it works this way" | "Why we chose event sourcing" |
| **Reference** | Information-oriented | "Here are the facts" | "API endpoint reference" |

Decision tool: Ask "what is the reader trying to do?"
- Learning something new -> **Tutorial** (code first, incremental, frequent validation)
- Solving a specific problem -> **How-to** (numbered steps, assumes knowledge, goal-focused)
- Understanding a concept -> **Explanation** (context, alternatives, trade-offs, ADRs live here)
- Looking up a fact -> **Reference** (tables, signatures, exhaustive, auto-generated when possible)

Do not mix types in one document. A tutorial that stops to explain theory loses the reader. A reference that includes a tutorial buries the lookup.

## Architecture Decision Records (ADRs)

### When to write an ADR
- Choosing a framework, library, or major dependency
- Designing a data model or database schema
- Selecting an authentication or API architecture
- Choosing between build tools, hosting platforms, or infrastructure
- Any decision that would be expensive to reverse
- When the team debates the same decision twice -- write it down

### ADR template

Store in `docs/decisions/` with sequential numbering. Copy-paste this:

```markdown
# ADR-NNN: [Short decision title]

## Status
Proposed | Accepted | Superseded by ADR-XXX | Deprecated

## Date
YYYY-MM-DD

## Context
[What problem are we facing? What constraints apply? What requirements drove this decision?]

## Decision
[What did we decide, and at a high level, why?]

## Alternatives Considered

### [Alternative A]
- Pros: [what it does well]
- Cons: [what it does poorly]
- Rejected: [one sentence -- why this lost]

### [Alternative B]
- Pros: [what it does well]
- Cons: [what it does poorly]
- Rejected: [one sentence -- why this lost]

## Consequences
- [What becomes easier or possible as a result]
- [What becomes harder or impossible as a result]
- [What new constraints or obligations does this create]
```

### ADR lifecycle
```
PROPOSED -> ACCEPTED -> (SUPERSEDED or DEPRECATED)
```
- Never delete old ADRs -- they capture historical context
- When a decision changes, write a new ADR that references and supersedes the old one
- Link ADRs from code comments where the decision matters: `// See ADR-007`

## Changelog automation

- Use conventional commits (`feat:`, `fix:`, `chore:`, `BREAKING CHANGE:`) as the source of truth
- Auto-generate changelogs with tools like `conventional-changelog`, `changelogen`, or `release-it`
- Never hand-write what can be generated -- hand-written changelogs drift
- Group by version and date, classify by type, focus on user-facing changes
- Highlight breaking changes with migration notes at the top of each version
- Merge related commits into single entries (3 commits fixing the same bug = 1 changelog line)

## Rules
- Trace actual code paths, never guess from file names
- Cite sources as `(file_path:line_number)` for every claim
- Distinguish fact vs inference explicitly
- Explain WHY before WHAT
- No hand-waving; read code before claiming behavior
- Claims like "X calls Y" need file path + function name
- Data flow claims need entry -> transforms -> destination
- OpenAPI 3.1+, `$ref` for reuse, examples on every req/res
- API docs: multi-language examples (cURL, JS, Python minimum)
- README: assume fresh machine, every command copy-pasteable
- README: show expected output, explain why not just how
- README sections: title, features, stack, prereqs, setup, arch, env vars, scripts, tests, deploy, troubleshooting
- Architecture docs: exec summary, components, decisions, rationale, trade-offs
- Code explanation: high-level flow first, then drill into components
- Wiki: max 4 nesting levels, max 8 children per section
- Wiki: small repos (<=10 files) get Getting Started only
- Onboarding senior: focus WHY, min 3 Mermaid diagrams, cite every claim
- Onboarding new: focus HOW, copy-pasteable commands, show expected output
- Mermaid: pick right diagram type, use `autonumber` in sequence diagrams
- Mermaid dark-mode: node `#2d333b`, borders `#6d5dfc`, text `#e6edf3`
- Mermaid: use `<br>` not `<br/>`, provide basic + styled versions
- Tutorials: code first then explain, incremental complexity, frequent validation
- Changelogs: group by time, classify by type, focus user-facing changes
- Changelogs: merge related commits, highlight breaking changes with migration notes
- Q&A: detect question language, respond in same language
- Q&A: only use information from actual source files with inline citations
- VitePress: use `withMermaid` wrapper, `appearance: 'dark'`
- VitePress: Mermaid renders async, must poll for SVGs in `setup()` + `onMounted`
- VitePress: never use `isCustomElement` for bare `<T>`, causes crashes
- JSDoc: comment business logic "why", complex algos, non-obvious behavior
- JSDoc: skip obvious code and self-explanatory names
- ADRs: Status, Context, Decision, Consequences format
- ADRs: always include Alternatives Considered with Pros/Cons/Rejected reason
- ADRs: never delete -- supersede with a new ADR that references the old one
- Short sentences (15-20 words), active voice, define jargon first use
- Numbered lists for sequences, bullets for unordered, tables for reference
- Code examples: realistic, runnable, with error handling and expected output
- No secrets or sensitive data in docs
- Keep docs close to code, generate from annotations when possible
- Doc validation in CI: lint, broken links, example tests
- Review docs with every API/code change
- **Doc freshness tracking -- detect and fix doc rot**: Add `last-reviewed: YYYY-MM-DD` frontmatter to every doc. CI flags docs not reviewed in 90+ days. When code changes, check if related docs need updating (search for file/function names in docs/). In reviews: if a PR changes a function signature or API, check that the corresponding doc is updated in the same PR. Stale docs are worse than no docs -- they actively mislead.
- **Automated doc generation pipeline**: Use TypeDoc (TypeScript), JSDoc-to-Markdown, or Swagger/Redoc (OpenAPI) to auto-generate API reference docs from source annotations. Store generated output in a `/docs/api-reference/` directory. Run generation in CI to catch drift. Never hand-write what can be generated -- hand-written API docs are guaranteed to drift. In reviews: if API docs are manually maintained alongside annotated source code, suggest auto-generation.
- **Runbook format for operational docs**: Runbooks must be executable, not descriptive. Structure: 1) Symptoms (what triggered the runbook), 2) Diagnosis steps (commands to run, what to look for), 3) Remediation steps (exact commands, rollback if it fails), 4) Escalation path (who to contact if remediation fails), 5) Post-incident (what to update after resolution). Every command must be copy-pasteable. Every step must include expected output. In reviews: if an operational doc describes what to do in prose without executable commands, flag it as non-actionable.
- **Prose linting with Vale**: Add a `.vale.ini` config and CI step to lint docs for: jargon without definition, passive voice, weasel words, sentence length >25 words, inconsistent terminology. Use the `write-good`, `Microsoft`, or custom style packages. Vale catches quality issues that human reviewers miss consistently. In reviews: if docs have inconsistent terminology (e.g., mixing 'endpoint' and 'route' for the same concept), suggest a Vale vocab file.
- **C4 model for architecture documentation**: Use the C4 model (Context, Containers, Components, Code) to structure architecture docs at increasing levels of detail. Level 1 (Context): system + external actors. Level 2 (Containers): apps, databases, queues. Level 3 (Components): major modules within a container. Use Mermaid C4 diagrams. Each level answers a different audience's questions. In reviews: if architecture docs jump from high-level overview directly to code details without intermediate levels, suggest C4 structuring.
- **Link checking in CI**: Run a link checker (markdown-link-check, lychee, or remark-validate-links) in CI on every docs PR. Check both internal links (broken after file moves/renames) and external links (dead URLs). External link checks should be weekly (not per-PR) to avoid flaky CI from temporary outages. In reviews: if a PR renames or moves a file, verify that all internal links pointing to it are updated.
- **Docs live next to the code they describe**: Place README.md in each major module/component directory, not only at the project root. When code changes, the doc to update is in the same directory -- zero navigation. Module-level docs cover: what this module does, key files, public API, how to test, gotchas. In reviews: if a new module/feature directory has no README, flag it.
- Deprecation notices + migration guides for breaking changes
