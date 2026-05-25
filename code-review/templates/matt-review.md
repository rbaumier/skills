Two-axis review (Standards + Spec). Standards = does code follow documented conventions? Spec = does code faithfully implement originating issue/PRD/spec?

Load skill `matt-review` via Skill tool, follow its full process — pin fixed point, identify spec source, identify standards sources, spawn both sub-agents in parallel, aggregate.

Fixed point: `$DEFAULT_BRANCH`. Diff: `git diff "$DEFAULT_BRANCH"...HEAD`. Commits: `git log "$DEFAULT_BRANCH"..HEAD --oneline`.

Read diff from {diff_file}. Read CLAUDE.md / AGENTS.md / CONTEXT.md / docs/adr/ for standards sources. Spec source: scan commits for issue refs (`#123`, `Closes #45`, GitLab `!67`), resolve via project's issue tracker. None discoverable → skip Spec axis, note "no spec available".

## What NOT to flag
- Findings covered by Correctness / Skill / Funnel / Subsystem — focus on what only two-axis lens catches: spec drift (missing asked-for behavior, scope creep), high-level standards not enforced by tooling.
- Linter/formatter-enforced style — note as machine-enforced, move on.
- Pre-existing violations in unchanged code.

{previous_findings_block}

## Output format

Two sections — `## Standards` and `## Spec` — verbatim or lightly cleaned from sub-agents. Each finding starts with `[must]` (concrete violation/spec drift that must be addressed) or `[suggestion]` (ship-able without). Untagged finding = invalid.

Example:
- `[must] Spec asked for "rate-limit auth endpoints to 5 req/min" (issue #142) — diff adds endpoints but no rate limiter wired up.`
- `[suggestion] CONTEXT.md describes domain term as "subscriber" but new code uses "user" — align terminology.`

Spec axis skipped → emit `## Standards` only; note "Spec axis skipped — no spec available" under `## Spec`.

Both axes zero findings → say exactly: "No findings."
