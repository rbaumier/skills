#!/bin/bash
# Per-slot lifecycle of the loop; exit 2 = refused, reason on stderr.
# Exit 1 = usage error, never a refusal. Every value comes from the launch pack.
#   slot.sh disk <threshold GB> <worktrees dir> <sweep command|-> [<n in flight>…]
#   slot.sh env        PreToolUse Bash hook: sources <worktrees dir>/slot-<s>.env
#   slot.sh gate <schema signal ERE> <recreate command> <gate command>
#   slot.sh qa-up <qa-stack.md> <log> <launch command> <port>…
#   slot.sh qa-probe <dependency>=<command>…
#   slot.sh qa-down <qa-stack.md>
set -uo pipefail
shopt -s nullglob
refuse() { echo "$1" >&2; exit 2; }
usage() { echo "usage: slot.sh disk|env|gate|qa-up|qa-probe|qa-down …" >&2; exit 1; }
free_gb() { df -Pk "$1" | awk 'NR == 2 { print int($4 / 1048576) }'; }
roomy() { [ "$(free_gb "$worktrees")" -ge "$threshold" ]; }
listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null; }
field() { awk -v k="$1:" '$1 == k { print $2 }' "$2"; }

case ${1:-} in
  disk)
    [ $# -ge 4 ] || usage
    threshold=$2 worktrees=$3 sweep=$4
    shift 4
    roomy && exit 0
    [ "$sweep" = - ] || bash -c "$sweep"
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
      grep -oE "[^[:space:]\"'=;]*-worktrees/((slot|issue)-[0-9]+|loop-[0-9]{4}-[0-9]{2}-[0-9]{2}(-[a-z0-9]+)*)" | head -1)
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
  qa-up)
    [ $# -ge 5 ] || usage
    stack=$2 log=$3 launch=$4
    shift 4
    for port; do listening "$port" && refuse "qa-up: port $port already held"; done
    # Job control: the stack gets its own process group.
    set -m
    bash -c "$launch" >"$log" 2>&1 </dev/null &
    { echo "pgid: $!"; printf 'port: %s\n' "$@"; echo "log: $log"; } >"$stack"
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
    ;;
  *) usage ;;
esac
exit 0
