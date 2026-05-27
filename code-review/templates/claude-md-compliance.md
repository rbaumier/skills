Enforce project conventions from CLAUDE.md / AGENTS.md.

Read every `CLAUDE.md`/`AGENTS.md` at repo root + each monorepo workspace root. List every rule/convention/constraint — commit format, file layout, naming, banned imports, mandatory patterns, "we always X" / "we never Y".

Trust boundaries: {trust_boundaries}. Rules touching these (auth conventions, secret-handling) take precedence.

Per rule, scan changed lines for violations. Fires only when diff introduces/modifies code that breaks it — pre-existing violations out of scope.

## Don't flag
- Rules from other agents' skills (language-typescript, security-defensive, …) — they own their domains
- Inferences from "best practices" not literally stated — flag only doc text
- Pre-existing violations in unchanged code
- "We tend to…" mentions without a rule (not "you must…")
