#!/bin/bash
# PreToolUse hook (Bash): refuse a git call skipping pre-commit.
# Heredoc bodies and quoted strings may cite the flags: dropped.
cmd=$(jq -r '.tool_input.command // empty' | awk '
  end != "" {
    if ($0 ~ "^[[:space:]]*" end "[[:space:]]*$") end = body = ""; else body = body $0 "\n"
    next
  }
  { print }
  match($0, /(^|[^<])<<-?[[:space:]]*["\047]?[[:alnum:]_]+/) {
    end = substr($0, RSTART, RLENGTH); sub(/^.*<<-?[[:space:]]*["\047]?/, "", end)
  }
  # A body never closed was no heredoc: checked.
  END { printf "%s", body }' | tr '\n' ';' \
  | sed -E "s/\\\\;/ /g; s/'[^']*'|\"[^\"]*\"/Q/g")
git='(^|[^[:alnum:]_.-])git([[:space:]]+(-[cC][[:space:]]*[^[:space:]]+|--[^[:space:]]+))*[[:space:]]+'
# -n counts only after commit's argument-less short flags: -uno, -amn pass.
if printf '%s\n' "$cmd" | grep -qE \
  "${git}commit([[:space:]][^;&|]*)?[[:space:]](--no-verify|-[apseiovqz]*n)" \
  || printf '%s\n' "$cmd" | grep -qiE \
  -e "${git}-c[[:space:]]*core\.hookspath=" \
  -e "${git}config([[:space:]]+(--global|--local|--system|--worktree|set))*[[:space:]]+core\.hookspath[[:space:]]+[^[:space:]-]"; then
  echo "Refused: the pre-commit hook is never skipped (no --no-verify, no -n, no core.hooksPath rewrite). Pay its findings in the commit." >&2
  exit 2
fi
exit 0
