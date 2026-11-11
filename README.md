# skills

Claude Code skills, agents and hooks.

## Install

```bash
git clone --recurse-submodules https://github.com/rbaumier/skills ~/.claude/skills
```

Agents: copy `loop-issues/agents/*.md` and `agents/issue-*.md` to
`~/.claude/agents/`.

Hooks: register in `~/.claude/settings.json` as `PreToolUse` hooks:

| Command | Matcher |
|---|---|
| `issue/hooks/guard-issue-create.sh <group/project>…` | `Bash\|mcp__.*create_issue` |
| `loop-issues/hooks/refuse-hook-bypass.sh` | `Bash` |
| `loop-issues/hooks/slot.sh env`, `slot.sh stack-guard` | `Bash` |
| `loop-issues/hooks/spawn-guard.sh` | `Agent` |
| `loop-issues/hooks/loop-running.sh` | `AskUserQuestion` |

## Requirements

Hooks and scripts are bash and need `jq`, `git`, `curl`, `awk`, `python3`;
`issue` and `loop-issues` also need `gh` or `glab`. The `comply` linter backs
`language-rust`, `language-typescript`, `quality-bar-review` and `loop-issues`;
the chrome-devtools MCP server backs `qa`, `qa-audit`, `mockups`, `show-me` and
`daily-recap`. Some skills target the author's projects (`loop-issues`, `qa`,
`qa-audit`, `daily-recap`, `mockups`, `reflect`) and assume their tooling.

## License

MIT (`LICENSE`), except third-party content listed in `THIRD_PARTY.md`.
