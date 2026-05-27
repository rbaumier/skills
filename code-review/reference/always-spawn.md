# Always spawn — Full tier

Every entry below MUST fire on every Full-tier run. Tick through this list explicitly before fanning out — an unbulleted prose form is too easy to skim past and silently drop an agent.

**Each line carries its prescribed `model=` argument** — pass it verbatim to `Task()`. A bare `Task(subagent_type=..., prompt=...)` inherits the orchestrator's model (Opus when you're on Opus) and silently turns a "haiku" agent into a 5×-cost one. Measured leak: Funnel L1/L2 ran on haiku only ~40% of the time, pre-triage ran on Opus 60% of the time, before this rule was enforced.

- [ ] Funnel L1 — `model="haiku"`
- [ ] Funnel L2 — `model="haiku"`
- [ ] Occam Razor — `model="sonnet"`
- [ ] Correctness — `model="sonnet"`
- [ ] Tests — `model="sonnet"`
- [ ] simplify — `model="sonnet"` (heavy skill)
- [ ] matt-improve-codebase-architecture — `model="sonnet"` (heavy skill)
- [ ] matt-review — `model="sonnet"`
- [ ] thermo-nuclear-code-quality-review — `model="sonnet"`
- [ ] security-defensive — `model="sonnet"` (heavy skill)
- [ ] coding-standards (umbrella) — `model="sonnet"`
- [ ] coding-standards:design — `model="sonnet"`
- [ ] coding-standards:errors — `model="sonnet"`
- [ ] coding-standards:hygiene — `model="sonnet"`
- [ ] coding-standards:style — `model="sonnet"`
- [ ] General Opus 4.7 (generalist reviewer, `general-purpose` subagent) — `model="opus"`

**Plus, conditional spawns** (see SKILL.md Step 0) — model from `reference/agent-table.md`:
- `claude-md-compliance` when any `CLAUDE.md` exists (repo root or monorepo workspace root) — `model="sonnet"`
- Language agents by extension (`.ts`/`.tsx` → language-typescript, `.rs` → language-rust, `.swift` → language-swift, `.vue` → vue) — `model="sonnet"` (heavy)
- Skill agents by import — `model="sonnet"` for heavy (`database`, `drizzle-orm`, `react`, `web-performance`, `api-design`, `better-result-adopt`), `model="haiku"` for light (`docker`, `i18n`, `kubernetes`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui-animations`, `vue`, `zod`). Heavy/light partition: `reference/agent-table.md` §"Heavy vs light".
- Surface-triggered skills (see `reference/surfaces-and-dogfood.md`) — heavy vs light per same partition
- Subsystem agents (see `reference/subsystems.md`) — `model="sonnet"`
- `claude-md-materiality` (see `reference/materiality-signals.md`) — `model="haiku"`
- Codex only on explicit user request

**Lite tier shrinks this to:** Funnel L1 (haiku), L2 (haiku), Occam Razor (sonnet), **one** Correctness (sonnet), **one** language agent (dominant ext, sonnet), simplify (sonnet), coding-standards umbrella only (sonnet), Tests (sonnet). No subsystem, no General Opus, no surface/import spawn.
