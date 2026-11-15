#!/bin/bash
# Per-slot lifecycle of the loop; exit 2 = refused, reason on stderr.
# Exit 1 = usage error, never a refusal. Every value comes from the launch pack.
#   slot.sh disk <threshold GB> <worktrees dir> <sweep command|-> [<n in flight>…]
#   slot.sh env        PreToolUse Bash hook: sources <worktrees dir>/slot-<s>.env
#   slot.sh gate <schema signal ERE> <recreate command> <gate command>
#   slot.sh env-check <script>…  every ${NAME:?} of the scripts and what they source, set
#   slot.sh qa-up <qa-stack.md> <log> <launch command> <port>…  (env-check on its script tokens)
#   slot.sh qa-probe <dependency>=<command>…
#   slot.sh qa-down <qa-stack.md>
#   slot.sh stack-guard  PreToolUse Bash hook: denies ci/check or ci/e2e while a stack is up,
#                        a compile in a loop worktree while ci/check or ci/e2e runs
set -uo pipefail
shopt -s nullglob
refuse() { echo "$1" >&2; exit 2; }
usage() { echo "usage: slot.sh disk|env|env-check|gate|qa-up|qa-probe|qa-down|stack-guard …" >&2; exit 1; }
free_gb() { df -Pk "$1" | awk 'NR == 2 { print int($4 / 1048576) }'; }
roomy() { [ "$(free_gb "$worktrees")" -ge "$threshold" ]; }
listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
field() { awk -v k="$1:" '$1 == k { print $2 }' "$2"; }
# Refuses naming every required variable unset, before a stack or a pass starts.
env_check() {
  local f v seen=' ' missing=
  while [ $# -gt 0 ]; do
    f=$1; shift
    [ -f "$f" ] && [[ $seen != *" $f "* ]] && { [[ $f == *.sh ]] || head -1 "$f" | grep -q '^#!.*sh'; } || continue
    seen+="$f "
    # shellcheck disable=SC2046 # one sourced path per word.
    set -- "$@" $(sed -nE "s/^[[:space:]]*(source|\.)[[:space:]]+[\"']?([^\"'[:space:];]+).*/\2/p" "$f")
    for v in $(grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*:?\?' "$f" | sed -E 's/^\$\{//; s/:?\?$//' | sort -u); do
      [ -n "${!v:-}" ] || [[ " $missing " == *" $v "* ]] || missing+=" $v"
    done
  done
  [ -z "$missing" ] || refuse "env-check: unset$missing"
}
# One stack at a time per project, hard limit (user, 2026-11-03; scoped
# per project 2026-11-10: « on est sur 2 projets différents »): a qa-up
# stack holds the project's lock while its process group lives; a
# running ci/check or ci/e2e of the same repo (same origin) is a stack
# too. Outside a git checkout the scope falls back to the whole machine.
origin_of() { git -C "$1" remote get-url origin 2>/dev/null; }
here=$(origin_of .)
lock=${LOOP_STACK_LOCK:-$HOME/.cache/loop-stack${here:+-$(printf %s "$here" | shasum | cut -c1-12)}.lock}
e2e_running() {
  local pid cwd
  for pid in $(pgrep -f '(^|[ /])ci/(check|e2e)( |$)'); do
    [ -z "$here" ] && return 0
    cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
    [ -n "$cwd" ] && [ "$(origin_of "$cwd")" = "$here" ] && return 0
  done
  return 1
}
stack_up() {
  local held
  held=$(cat "$lock" 2>/dev/null) || return 1
  [ -f "$held" ] && kill -0 -- "-$(field pgid "$held")" 2>/dev/null && echo "$held"
}

case ${1:-} in
  disk)
    [ $# -ge 4 ] || usage
    threshold=$2 worktrees=$3 sweep=$4
    shift 4
    roomy && exit 0
    [ "$sweep" = - ] || bash -c "$sweep"
    roomy && exit 0
    # Build caches first: a worktree no process runs in loses its target, however recent.
    command -v mbx >/dev/null && mbx gc >/dev/null 2>&1
    for wt in "$worktrees"/*/; do
      [ -d "${wt}apps/api" ] && ! pgrep -f "${wt%/}" >/dev/null && mbx cache remove "${wt}apps/api" >/dev/null 2>&1
    done
    roomy && exit 0
    for wt in "$worktrees"/issue-*/; do
      n=${wt%/} n=${n##*/issue-} n=${n%%-t*}
      for live in "$@"; do [ "$n" = "$live" ] && continue 2; done
      [ -n "$(find "$(git -C "$wt" rev-parse --absolute-git-dir)/index" -mmin -1200)" ] && continue
      # Without --force, git refuses a worktree holding uncommitted work.
      # A split issue's env outlives its task worktrees.
      git -C "$wt" worktree remove "$wt" 2>/dev/null &&
        [ "$wt" = "$worktrees/issue-$n/" ] && rm -f "$worktrees/issue-$n.env"
    done
    roomy || refuse "disk: $(free_gb "$worktrees") GB free < $threshold GB"
    ;;
  env)
    input=$(cat)
    slot=$(jq -r '.tool_input.command // empty, .cwd // empty' <<<"$input" |
      grep -oE "[^[:space:]\"'=;]*-worktrees/((slot|issue)-[0-9]+|loop-[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z0-9]*(-[a-z0-9]+)*)" | head -1)
    case $slot in
      '') exit 0 ;;
      \~/*) slot=$HOME/${slot#\~/} ;;
      \$HOME/*) slot=$HOME/${slot#\$HOME/} ;;
      /*) ;;
      *) slot=$(jq -r .cwd <<<"$input")/$slot ;;
    esac
    [ -f "$slot.env" ] || exit 0
    # No permissionDecision: the rewritten command meets the user's policy.
    jq -c --arg p "set -a; . $(printf %q "$slot.env"); set +a; " \
      '{hookSpecificOutput: {hookEventName: "PreToolUse",
        updatedInput: (.tool_input | .command = $p + .command)}}' <<<"$input"
    ;;
  gate)
    [ $# -eq 4 ] || usage
    log=$(mktemp)
    trap 'rm -f "$log"' EXIT
    for attempt in 1 2; do
      bash -c "$4" >"$log" 2>&1
      code=$?
      tail -40 "$log"
      # Exit 2 stays the script's refusal; a gate's own 2 is a red.
      [ "$code" -ne 0 ] && grep -qE "$2" "$log" || exit $((code == 2 ? 1 : code))
      [ "$attempt" = 2 ] && refuse "BLOCKED: schema mismatch after recreate"
      bash -c "$3" >&2 || refuse "BLOCKED: recreate failed: $3"
    done
    ;;
  env-check) shift; env_check "$@" ;;
  qa-up)
    [ $# -ge 5 ] || usage
    stack=$2 log=$3 launch=$4
    shift 4
    # shellcheck disable=SC2086 # the launch command's words, files among them.
    env_check $launch
    held=$(stack_up) && refuse "qa-up: one stack at a time, $held is up (slot.sh qa-down it first)"
    e2e_running && refuse "qa-up: one stack at a time, ci/check or ci/e2e holds it"
    for port; do listening "$port" && refuse "qa-up: port $port already held"; done
    # Job control: the stack gets its own process group.
    set -m
    bash -c "$launch" >"$log" 2>&1 </dev/null &
    { echo "pgid: $!"; printf 'port: %s\n' "$@"; echo "log: $log"; } >"$stack"
    mkdir -p "${lock%/*}" && echo "$stack" >"$lock"
    ;;
  qa-probe)
    shift
    for probe; do
      bash -c "${probe#*=}" >/dev/null 2>&1 || refuse "qa-probe: ${probe%%=*} failed"
    done
    ;;
  qa-down)
    [ $# -eq 2 ] || usage
    [ -f "$2" ] || exit 0
    pgid=$(field pgid "$2")
    if [ -n "$pgid" ] && kill -- "-$pgid" 2>/dev/null; then
      for _ in 1 2 3 4 5 6 7 8 9 10; do
        kill -0 -- "-$pgid" 2>/dev/null || break
        sleep 0.5
      done
      kill -9 -- "-$pgid" 2>/dev/null
    fi
    for port in $(field port "$2"); do
      listening "$port" && refuse "qa-down: port $port still held"
    done
    [ "$(cat "$lock" 2>/dev/null)" = "$2" ] && rm -f "$lock"
    ;;
  stack-guard)
    input=$(cat)
    cmd=$(jq -r '.tool_input.command // empty' <<<"$input" | "$(dirname "$0")/unquoted.sh")
    at='(^|[;&|(])[[:space:]]*(([A-Za-z_]+=[^[:space:]]*|bash|sh|exec|time|nohup|timeout[[:space:]]+[0-9.]+[smhd]?|env([[:space:]]+-u[[:space:]]+[^[:space:]]+)*)[[:space:]]+)*'
    end='([[:space:];&|)]|$)'
    compile='(mbx[[:space:]]+)?cargo([[:space:]]+\+[^[:space:]]+)?[[:space:]]+(check|build|clippy|nextest|test|sqlx[[:space:]]+prepare)|comply[[:space:]]+--working-tree|([^[:space:];&|(]*/)?ci/lib/comply-workspace|mbx[[:space:]]+gc'
    if grep -qE "$at([^[:space:];&|(]*/)?ci/(check|e2e)$end" <<<"$cmd"; then
      if held=$(stack_up); then r="One stack at a time: $held is up"
      elif e2e_running; then r="One stack at a time: ci/check or ci/e2e holds it"
      else exit 0
      fi
      r+=". Wait for it to end, or slot.sh qa-down the QA stack first."
    # A closing gate's load would turn it red: no compile beside it in the loop's worktrees.
    elif sed -E 's/mbx[[:space:]]+gc[[:space:]][^;&|]*--dry-run//g' <<<"$cmd" | grep -qE "$at($compile)$end" &&
      jq -r '.tool_input.command, .cwd // empty' <<<"$input" | grep -qE -- '-worktrees/(slot|loop)-' && e2e_running; then
      r="No compile beside a closing gate: ci/check or ci/e2e runs. End the phase \`BLOCKED gate\`: it is re-spawned at the gate's exit."
    else exit 0
    fi
    jq -cn --arg r "$r" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
    ;;
  *) usage ;;
esac
exit 0
