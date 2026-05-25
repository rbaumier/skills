# Materiality signals — when to spawn `claude-md-materiality`

Diff touches something that should be in `CLAUDE.md` / `AGENTS.md` but those files are unchanged → spawn **claude-md-materiality** (haiku). The agent's only job: flag the gap, don't write the doc.

Skip materiality entirely under Lite (cost low but consistency matters — Lite ≡ no structural change).

Tight signals, designed to avoid firing on routine config tweaks:

- **package manager switch** — `package.json` `packageManager` field changed, OR lockfile family added/removed (`pnpm-lock.yaml` ↔ `package-lock.json` ↔ `yarn.lock` ↔ `bun.lock`)
- **test framework swap** — a `vitest.config.*` / `jest.config.*` / `playwright.config.*` file added or removed (not edited)
- **build tool added or removed** — new `vite.config.*` / `webpack.config.*` / `rollup.config.*` / `next.config.*` file, OR an existing one deleted
- **`tsconfig.json` shape change** — `module`, `moduleResolution`, or addition of a *new top-level alias prefix* in `paths` (NOT path tweaks, NOT `target`/`lib`/`strict` flag toggles)
- **new top-level dir** — root of repo or root of a monorepo workspace
- **new required env var** — additions in `.env.example` (not removals, not renames)
- **CI/CD workflow file added or removed** — NOT edited (workflow tweaks rarely invalidate docs)
