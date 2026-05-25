Enforce project's own conventions from CLAUDE.md / AGENTS.md.

Read every `CLAUDE.md` and `AGENTS.md` at repo root + each monorepo workspace root. List every rule/convention/constraint — commit message format, file layout, naming, banned imports, mandatory patterns, "we always do X" / "we never do Y".

Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

For each rule, scan changed lines for violations. Rule fires only when diff introduces/modifies code that breaks it — pre-existing violations in unchanged code out of scope.

Trust boundaries crossed: {trust_boundaries}. Rules touching these (auth conventions, secret-handling) take precedence.

## What NOT to flag
- Rules from other agents' skills (language-typescript, security-defensive, etc.) — they own their domains
- Inferences from "best practices" not literally stated — only flag what doc says
- Pre-existing violations in unchanged code
- "We tend to..." mentions without a rule (not "you must...")

{previous_findings_block}
