# Always spawn — Full tier

Every entry below MUST fire on every Full-tier run. Tick through this list explicitly before fanning out — an unbulleted prose form is too easy to skim past and silently drop an agent.

- [ ] Funnel L1
- [ ] Funnel L2
- [ ] Occam Razor
- [ ] Correctness
- [ ] Tests
- [ ] simplify
- [ ] matt-improve-codebase-architecture
- [ ] matt-review
- [ ] thermo-nuclear-code-quality-review
- [ ] security-defensive
- [ ] coding-standards (umbrella)
- [ ] coding-standards:design
- [ ] coding-standards:errors
- [ ] coding-standards:hygiene
- [ ] coding-standards:style
- [ ] General Opus 4.7 (generalist reviewer, `general-purpose` subagent, `model: opus`)

**Plus, conditional spawns** (see SKILL.md Step 0):
- `claude-md-compliance` when any `CLAUDE.md` exists (repo root or monorepo workspace root)
- Language agents by extension (`.ts`/`.tsx` → language-typescript, `.rs` → language-rust, `.swift` → language-swift, `.vue` → vue)
- Skill agents by import (`better-result-adopt`, `database`, `docker`, `drizzle-orm`, `i18n`, `kubernetes`, `react`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui-animations`, `vue`, `zod`)
- Surface-triggered skills (see `reference/surfaces-and-dogfood.md`)
- Subsystem agents (see `reference/subsystems.md`)
- `claude-md-materiality` (see `reference/materiality-signals.md`)
- Codex only on explicit user request

**Lite tier shrinks this to:** Funnel L1, L2, Occam Razor, **one** Correctness, **one** language agent (dominant ext), simplify, coding-standards (umbrella only), Tests. No subsystem, no General Opus, no surface/import spawn.
