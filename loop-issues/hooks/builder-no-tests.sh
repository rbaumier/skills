#!/bin/bash
# PreToolUse hook (Bash) of loop-builder: no test run per lot.
# Matches the raw command, quoted strings included (`bash -c "…"`).
cmd=$(jq -r '.tool_input.command // empty')
# The one exception: the `_unit` guard the queue returned, alone.
guard="cargo nextest run -p api -E ['\"]binary\([^)'\"]*_unit[^)'\"]*\)['\"]( 2>&1)?[[:space:]]*(\||&&|;|$)"
rest=$(sed -E "s#$guard#\2#g" <<<"$cmd")
at='(^|[;&(]|[^\\]\||(^|[^[:alnum:]_./-])((exec|npx|time|bash|sh|nohup|env) +|pnpm( +-C +[^[:space:]]+)? +(exec +)?|xargs( +-[^[:space:]]+)* +|timeout +[0-9]+[smhd]? +|[[:alpha:]_][[:alnum:]_]*=[^[:space:]]* +))[[:space:]]*([^[:space:]]*/)?'
# A quote opens a command only before a whole word: `bash -c "vitest run"`.
q="(^|[[:space:]=])[\"'][[:space:]]*([^[:space:]]*/)?(vitest|playwright|ci/(check|lib/merge))([[:space:];&)]|$)"
grep -qE -e 'cargo +(test|t)([^[:alnum:]_]|$)' -e 'nextest +(run|r)([^[:alnum:]_]|$)' -e "$q" \
  -e "${at}(vitest|playwright)([^[:alnum:]_.-]|$)" -e 'pnpm( +-C +[^[:space:]]+)? +(run +)?test([^[:alnum:]_]|$)' \
  -e "${at}ci/(check|lib/merge)([^[:alnum:]_.-]|$)" -e 'slot\.sh gate' <<<"$rest" || exit 0
echo "Refused: no test per lot: the merge queue and the closing run them; only the \`_unit\` guard the queue returned may be replayed: cargo nextest run -p api -E 'binary(/_unit\$/)'; a test the contract requires to run once goes to a loop-mechanic task." >&2
exit 2
