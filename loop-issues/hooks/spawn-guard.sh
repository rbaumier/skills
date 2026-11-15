#!/bin/bash
# PreToolUse hook (Agent): a phase prompt never names a gate.
# The brief owns each phase's gate scope; the prompt hands facts.
input=$(cat)
case $(jq -r '.tool_input.subagent_type // empty' <<<"$input") in
  loop-builder | loop-shipper | loop-reviewer | loop-contract-reviewer) ;;
  issue-publisher)
    p=$(jq -r '.tool_input.prompt // empty' <<<"$input")
    # needs-triage spares a loop audit draft only; any other draft goes through /issue's reviewer.
    grep -q needs-triage <<<"$p" && grep -qE '/audit-[^/[:space:]]+/' <<<"$p" && exit 0
    for d in $(grep -oE '(/[^[:space:]`"()]+)+' <<<"$p" | xargs -n1 dirname | sort -u); do grep -lq DRAFT-OK "$d"/review-*.md 2>/dev/null && exit 0; done
    echo "Refused: issue-publisher without a reviewed draft: \`needs-triage\` on a loop audit draft (\`audit-*/\`), or a drafts dir holding a \`DRAFT-OK\` review-<c>.md (/issue step 2)." >&2; exit 2 ;;
  *) exit 0 ;;
esac
# Codegen (`cargo run … --bin`) and a quoted test identifier name no gate.
gate=$(jq -r '.tool_input.prompt // empty' <<<"$input" |
  perl -pe 's/cargo +run\b[^`\n;&|]*--bin +[\w-]+//g; s/`[^`\s]*(?:::|\.(?:spec|test)\.)[^`\s]*`//g' | grep -oE \
  -e 'cargo +(check|clippy|nextest|test)' -e 'nextest +(run|r)([^[:alnum:]_]|$)' -e '-p +api([^-[:alnum:]_]|$)' \
  -e 'comply(-workspace)? +-' -e 'comply-workspace' -e 'clippy' \
  -e 'pnpm( +-C +[^ ]+)? +(check|test|lint)' -e 'vitest +(run|related)' | head -1)
[ -z "$gate" ] && exit 0
echo "Refused: the prompt names a gate (\`$gate\`). The brief owns each phase's gate scope: hand facts and the brief's path only. A merge-queue red sends the lot back to ship; a lesson that changes a gate goes to /reflect on the brief." >&2
exit 2
