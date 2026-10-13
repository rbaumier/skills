#!/bin/bash
# Checks the loop's refusal hooks: bash loop-issues/hooks/test.sh
set -u
hooks=$(cd "$(dirname "$0")" && pwd)
bypass="$hooks/refuse-hook-bypass.sh"
running="$hooks/loop-running.sh"
issue="$hooks/../../issue/hooks/guard-issue-create.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export HOME="$tmp"
git init -q "$tmp/guarded" && git -C "$tmp/guarded" remote add origin git@forge:g/p.git

# expect <deny|pass> <script> <input json> [hook arguments…]
expect() {
  local want=$1 script=$2 input=$3 got
  shift 3
  "$script" "$@" <<<"$input" 2>"$tmp/reason"
  case $? in 0) got=pass ;; 2) got=deny ;; *) got=error ;; esac
  [ "$got" = "$want" ] || { echo "FAIL $group: want $want, got $got: $input" >&2; exit 1; }
}
command_input() { jq -nc --arg c "$1" --arg cwd "${2:-$tmp}" '{tool_input: {command: $c}, cwd: $cwd}'; }

group=bypass_refused
for c in 'git commit --no-verify -m x' 'git commit -n' 'cd x && git -C y commit -nm x' \
  'git commit -an -m x' 'git commit -m "it'\''s" -n' \
  'git config core.hooksPath /dev/null' 'git -c core.hooksPath=/dev/null commit -m x' \
  "$(printf 'git commit \\\n  --no-verify -m x')" \
  "$(printf 'cat > f <<EOF\nx\nEOF\njq . <<<y\ngit commit --no-verify -F f')" \
  "$(printf 'echo "1<<2"\ngit commit --no-verify -m x')"; do
  expect deny "$bypass" "$(command_input "$c")"
done

group=plain_git_passes
for c in 'git commit -m x' 'git commit -am "doc: forbid --no-verify"' \
  'git config --get core.hooksPath' 'git log -n 3' 'git log --grep=commit -n 3' \
  'git status -uno' 'git log -n 5' 'git diff --name-only' 'git commit -uno -m x' \
  'git commit -amn' 'git commit -m "it'\''s x" && git log --format='\''%h'\'' -n 5' \
  "$(printf 'git commit -F- <<'\''EOF'\''\nRefuses git commit --no-verify.\nEOF')"; do
  expect pass "$bypass" "$(command_input "$c")"
done

group=question_refused_while_running
CLAUDE_CODE_SESSION_ID=s1 "$running" start
expect deny "$running" '{"session_id":"s1"}'
grep -q BLOCKED "$tmp/reason" || { echo "FAIL $group: reason does not name BLOCKED" >&2; exit 1; }

group=question_allowed_after_stop_or_elsewhere
expect pass "$running" '{"session_id":"s2"}'
CLAUDE_CODE_SESSION_ID=s1 "$running" stop
expect pass "$running" '{"session_id":"s1"}'

group=issue_create_refused_on_listed
expect deny "$issue" "$(command_input 'glab api projects/g%2Fp/issues -f title=x')" g/p
expect deny "$issue" "$(command_input 'gh issue create -R g/p -t x')" g/p
expect deny "$issue" "$(command_input 'gh issue create -t x' "$tmp/guarded")" g/p
expect deny "$issue" '{"tool_name":"mcp__gitlab__create_issue","tool_input":{"project_id":"g%2Fp"}}' g/p

group=publisher_and_unlisted_pass
expect pass "$issue" "$(command_input 'gh issue create -t x' "$tmp/guarded" | jq -c '.agent_type = "issue-publisher"')" g/p
expect pass "$issue" "$(command_input 'gh issue create -R o/q -t x')" g/p
expect pass "$issue" "$(command_input 'glab api projects/g%2Fp/issues/12/notes -f body=x')" g/p
expect pass "$issue" "$(command_input 'gh issue create -R g/p -t x')"
expect pass "$issue" "$(command_input "rg -n 'gh issue create' docs" "$tmp/guarded")" g/p

echo "hooks: all checks pass"
