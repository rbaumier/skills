#!/bin/bash
# start/stop mark the loop; bare: refuse AskUserQuestion while marked.
dir="$HOME/.claude/run/loop-issues"
case "${1:-}" in
  start) mkdir -p "$dir" && touch "$dir/${CLAUDE_CODE_SESSION_ID:?}" ;;
  stop) rm -f "$dir/${CLAUDE_CODE_SESSION_ID:?}" ;;
  *)
    if [ -f "$dir/$(jq -r '.session_id // empty')" ]; then
      echo "Refused: a loop-issues loop runs in this session, nobody answers. Report BLOCKED with the question as the reason. Loop stopped: loop-running.sh stop." >&2
      exit 2
    fi
    ;;
esac
