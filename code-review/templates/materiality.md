Check whether project's AI instructions are stale vs the diff.

Read `CLAUDE.md` and `AGENTS.md` at repo root if they exist. Read diff from {diff_file}.

ONE question: does this diff make any line in CLAUDE.md/AGENTS.md misleading or incomplete? High-materiality triggers (orchestrator spawns you only when at least one fires — confirm/refute):
- Package manager change (`packageManager` field changed, OR lockfile family added/removed)
- Test framework swap (NEW `vitest.config.*` / `jest.config.*` / `playwright.config.*`, OR existing one removed — not edited)
- Build tool added/removed (new `vite.config.*` / `webpack.config.*` / `rollup.config.*` / `next.config.*`, OR existing one deleted)
- `tsconfig.json` change to `module`, `moduleResolution`, OR new top-level alias prefix in `paths`
- New top-level dir (repo root or monorepo workspace root)
- New required env var (additions in .env.example — not removals, not renames)
- CI/CD workflow file added/removed (not edited)
- Major dep upgrade changing API surface (React 18→19, Next 14→15)

Low materiality (don't flag): bug fixes, feature additions using existing patterns, CSS-only, dep patch bumps, internal refactors, tsconfig `target`/`lib`/`strict` flag flips, CI tweaks without file add/remove, path-alias additions under existing root.

## What NOT to flag
- Generic "consider updating docs" — only concrete claims that became false
- Missing CLAUDE.md when none exists — flag staleness, not absence (unless diff is new scaffold)
- Wording improvements — your job is staleness, not editing

Stay within these files: {file_list} plus CLAUDE.md / AGENTS.md.

## Output format

CLAUDE.md/AGENTS.md unchanged but diff high-materiality → one finding per stale claim. Each starts with `[must]` (stated fact now factually wrong — e.g. "we use npm" after pnpm migration) or `[suggestion]` (vague convention drifted but didn't break — e.g. "tests live in __tests__" after moves to colocated `.test.ts`). Then: file, line/section, what the diff makes false, one-sentence correction. Untagged finding = invalid.

Example: `[must] CLAUDE.md line 14: "Run npm install" is now wrong — diff switched to pnpm. Replace with "Run pnpm install".`

Zero findings → say exactly: "No findings."
