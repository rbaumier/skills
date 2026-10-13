#!/bin/bash
# PreToolUse hook: only issue-publisher creates issues on argument repos.
# Matchers: Bash, and the forge MCP's create_issue (its project_id).
[ $# -gt 0 ] || exit 0
input=$(cat)
[ "$(jq -r '.agent_type // empty' <<<"$input")" = issue-publisher ] && exit 0
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
project=$(jq -r '.tool_input.project_id // empty' <<<"$input")
# A forge call starts a statement; a quoted mention does not.
call='(^|[;&|(])[[:space:]]*([[:alnum:]_]+=[^[:space:]]*[[:space:]]+)*(glab|gh)[[:space:]]+'
cli=$(printf '%s\n' "$cmd" | grep -E "${call}issue[[:space:]]+(create|new)")
api=$(printf '%s\n' "$cmd" | grep -oE "${call}api[[:space:]][^;&|]*" \
  | grep -E "/issues([[:space:]?\"']|$)" \
  | grep -E '[[:space:]](-f|-F|--field|--raw-field|--input|-XPOST|-X[[:space:]]+POST|--method[[:space:]]+POST)' \
  | grep -vE '(-X|--method)[[:space:]]*GET')
[ -n "$cli$api$project" ] || exit 0
# Target: a listed path, or the cwd's origin.
[ -n "$project" ] || origin=$(git -C "$(jq -r '.cwd // "."' <<<"$input")" remote get-url origin 2>/dev/null)
for repo in "$@"; do
  if printf '%s\n' "$cmd" "$project" "$origin" | grep -qE "(^|[[:space:]:/=])(${repo}|${repo//\//%2F})(\.git)?([[:space:]/]|$)"; then
    echo "Refused: issues on $repo are created by the /issue publisher only. Use /issue." >&2
    exit 2
  fi
done
exit 0
