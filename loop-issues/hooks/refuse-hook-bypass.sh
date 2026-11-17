#!/bin/bash
# PreToolUse hook (Bash): refuse a git call skipping pre-commit.
# Heredoc bodies and quoted strings may cite the flags: dropped.
input=$(cat)
# No pre-commit hook and no hooksPath in the cwd's repo (a `cd`/`-C` target is not resolved): no commit flag skips one.
(cd "$(jq -r '.cwd // "."' <<<"$input")" 2>/dev/null && hook=$(git rev-parse --path-format=absolute --git-path hooks/pre-commit 2>/dev/null) &&
  [ ! -x "$hook" ] && [ -z "$(git config core.hooksPath)" ]) && hookless=1
cmd=$(jq -r '.tool_input.command // empty' <<<"$input" | awk '
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
# A --dry-run commit runs no hook; --no-verify=false skips none.
if [ -z "${hookless:-}" ] && printf '%s\n' "$cmd" | sed -E 's/commit[^;&|]*[[:space:]]--dry-run([[:space:]][^;&|]*)?//g' | grep -qE \
  "${git}commit([[:space:]][^;&|]*)?[[:space:]](--no-verify(=true)?([^=[:alnum:]-]|$)|-[apseiovqz]*n)" \
  || printf '%s\n' "$cmd" | grep -qiE \
  -e "${git}-c[[:space:]]*core\.hookspath=" \
  -e "${git}config([[:space:]]+(--global|--local|--system|--worktree|set))*[[:space:]]+core\.hookspath[[:space:]]+[^[:space:]-]"; then
  echo "Refused: the pre-commit hook is never skipped (no --no-verify, no -n, no core.hooksPath rewrite). Pay its findings in the commit." >&2
  exit 2
fi
exit 0
