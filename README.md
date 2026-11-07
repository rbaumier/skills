# skills

Claude Code skills, agents and hooks.

## Install

```bash
git clone --recurse-submodules https://github.com/rbaumier/skills ~/.claude/skills
```

Agents: copy `loop-issues/agents/*.md` and `agents/issue-*.md` to
`~/.claude/agents/`.

## Requirements

Hooks and scripts are bash and need `jq`, `git`, `curl`, `awk`; `loop-issues`
also needs `gh` or `glab`. Some skills target the author's projects
(`loop-issues`, `qa`, `qa-audit`, `daily-recap`) and assume their tooling.

## License

MIT (`LICENSE`), except third-party content listed in `THIRD_PARTY.md`.
