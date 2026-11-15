#!/bin/bash
# PreToolUse hook (Bash) of loop-builder: no test run per lot.
# Matches what runs: quoted text and heredoc bodies cut (unquoted.sh).
cmd=$(jq -r '.tool_input.command // empty')
# `playwright test --list` lists, runs nothing.
rest=$("$(dirname "$0")/unquoted.sh" <<<"$cmd" | perl -pe 's/playwright\s+test\b[^;&|]*\s--list\b//g')
at='(^|[;&(]|[^\\]\||(^|[^[:alnum:]_./-])((exec|npx|time|bash|sh|nohup|env) +|pnpm( +-C +[^[:space:]]+)? +(exec +)?|xargs( +-[^[:space:]]+)* +|timeout +[0-9]+[smhd]? +|[[:alpha:]_][[:alnum:]_]*=[^[:space:]]* +))[[:space:]]*([^[:space:]]*/)?'
grep -qE -e 'cargo +(test|t)([^[:alnum:]_]|$)' -e 'nextest +(run|r)([^[:alnum:]_]|$)' \
  -e "${at}(vitest|playwright)([^[:alnum:]_.-]|$)" -e 'pnpm( +-C +[^[:space:]]+)? +(run +)?test([^[:alnum:]_]|$)' \
  -e "${at}ci/(check|lib/merge)([^[:alnum:]_.-]|$)" -e 'slot\.sh gate' <<<"$rest" || exit 0
echo "Refused: no test per lot: the closing runs them; a test the contract requires to run once goes to a loop-mechanic task." >&2
exit 2
