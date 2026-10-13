#!/bin/bash
# Reads and marks the loop's state.md; exit 2 = refused, reason on stderr.
# Exit 1 = usage or unreadable state, never a refusal.
#   state.sh tick <state.md>            budget marks, then the loop mode
#   state.sh model <state.md> <serving model id>
#   state.sh fresh                      skill files changed since the last read
#   state.sh count <state.md>           progress counter and rework rate
set -uo pipefail
refuse() { echo "$1" >&2; exit 2; }
usage() { echo "usage: state.sh tick|model|fresh|count …" >&2; exit 1; }
skill=$(cd "$(dirname "$0")/.." && pwd)
# Budget column of the § Agents table, in minutes; 0 when none.
budget() { awk -F' *[|] *' -v a="\`$1\`" '$3 == a { print $6 + 0 }' "$skill/SKILL.md"; }
slot_re='^slot [0-9]+: .* (loop-[a-z-]+) since ([^ ]+) — (.+)$'

case ${1:-} in
  tick)
    [ $# -eq 2 ] || usage
    state=$2
    out=$(mktemp)
    trap 'rm -f "$out"' EXIT
    marks=()
    while IFS= read -r line; do
      if [[ $line =~ $slot_re && $line != *🐢* ]]; then
        agent=${BASH_REMATCH[1]} since=${BASH_REMATCH[2]} dir=${BASH_REMATCH[3]}
        max=$(budget "$agent")
        spent=$(jq -n --arg t "$since" '(now - ($t | fromdateiso8601)) / 60 | floor') || exit 1
        if [ "${max:-0}" -gt 0 ] && [ "$spent" -gt "$max" ]; then
          line="$line 🐢 $spent/$max min"
          marks+=("$dir" "$line")
        fi
      fi
      echo "$line"
    done <"$state" >"$out"
    cat "$out" >"$state"
    # After the rewrite, so a failed tick never logs twice.
    for ((i = 0; i < ${#marks[@]}; i += 2)); do
      echo "${marks[i + 1]}" >>"${marks[i]}/lenteurs.md"
    done
    mode=$(sed -n 's/^mode: //p' "$state")
    case $mode in
      pause-until\ *)
        until=${mode#pause-until }
        paused=$(jq -n --arg t "$until" '($t | fromdateiso8601) > now') || exit 1
        [ "$paused" = true ] && refuse "paused until $until"
        ;;
      drain)
        grep -q '^slot [0-9]*: #' "$state" && refuse draining
        refuse drained
        ;;
    esac
    ;;
  model)
    [ $# -eq 3 ] || usage
    pinned=$(awk '$1 == "model:" { print $2; exit }' "$HOME/.claude/agents/loop-orchestrator.md")
    [ -n "$pinned" ] || { echo "model: no pin in loop-orchestrator.md" >&2; exit 1; }
    [ "$3" = "$pinned" ] && exit 0
    echo "stopped: model — serving $3, pinned $pinned" >>"$2"
    refuse "model — serving $3, pinned $pinned"
    ;;
  fresh)
    [ $# -eq 1 ] || usage
    mark="$HOME/.claude/run/loop-issues/${CLAUDE_CODE_SESSION_ID:?}.read"
    # The session loaded the skill just before its first call.
    [ -e "$mark" ] || { mkdir -p "${mark%/*}" && touch "$mark"; exit 0; }
    changed=$(find "$skill" -type f -newer "$mark")
    [ -z "$changed" ] && exit 0
    touch "$mark"
    refuse "$changed"
    ;;
  count)
    [ $# -eq 2 ] || usage
    read -r planned added < <(sed -nE 's/^planned: ([0-9]+) \(\+([0-9]+)\)$/\1 \2/p' "$2")
    [ -n "${planned:-}" ] || { echo "count: no 'planned: N (+k)' line in $2" >&2; exit 1; }
    finished=$(grep -c '^done: ' "$2")
    rework=$(grep -c '^done: .* rework$' "$2")
    echo "Compteur : $finished / $planned lots (+$added ajoutés) · reprises : $rework / $finished"
    ;;
  *) usage ;;
esac
exit 0
