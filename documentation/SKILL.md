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

## When not to use
- Pure implementation with no docs deliverable
- Ad-hoc conversation needing no artifact
- No codebase or source of truth exists

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
- Short sentences (15-20 words), active voice, define jargon first use
- Numbered lists for sequences, bullets for unordered, tables for reference
- Code examples: realistic, runnable, with error handling and expected output
- No secrets or sensitive data in docs
- Keep docs close to code, generate from annotations when possible
- Doc validation in CI: lint, broken links, example tests
- Review docs with every API/code change
- Deprecation notices + migration guides for breaking changes
