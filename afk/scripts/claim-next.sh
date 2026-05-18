#!/usr/bin/env bash
# AFK Phase 2 — pick and claim the next issue from /tmp/afk-queue.json.
# On success: prints one JSON object on stdout: {iid, title, body}. Exit 0.
# On empty queue (no candidate picked): exits 1 with no stdout (Phase 8 terminal).
# On error: exits 2 with stderr message.

. "$(dirname "$0")/lib.sh"

[ -s /tmp/afk-queue.json ] || { echo "ERREUR: /tmp/afk-queue.json absent ou vide" >&2; exit 2; }

project_id=$(afk_project_id) || exit 2

stale_seconds=14400   # 4h

while IFS= read -r row; do
  iid=$(printf '%s' "$row" | jq -r '.iid')
  title=$(printf '%s' "$row" | jq -r '.title')

  # Step a: last picked-by-agent event.
  claim=$(glab api "projects/$project_id/issues/$iid/resource_label_events" 2>/dev/null \
          | jq '[.[] | select(.label.name == "picked-by-agent")] | sort_by(.created_at) | last // empty')
  claim_action=$(printf '%s' "$claim" | jq -r '.action // "none"')
  claim_at=$(printf '%s' "$claim" | jq -r '.created_at // empty')

  if [ "$claim_action" = "add" ]; then
    age=$(afk_age_sec "$claim_at")
    if [ "$age" -lt "$stale_seconds" ]; then
      continue   # live claim by another instance
    fi
    glab issue update "$iid" --unlabel picked-by-agent >/dev/null 2>&1 || true   # stale recovery
  fi

  # Step b: open MR check.
  open_mr=$(glab api "projects/$project_id/issues/$iid/related_merge_requests" 2>/dev/null \
            | jq '[.[] | select(.state == "opened")] | length')
  [ "$open_mr" -gt 0 ] && continue

  # Step c: claim.
  glab issue update "$iid" --label picked-by-agent >/dev/null 2>&1 \
    || { echo "ERREUR: échec de pose du label picked-by-agent sur #$iid" >&2; exit 2; }
  glab issue note "$iid" --message "Picked by AFK at $(date -u +%Y-%m-%dT%H:%M:%SZ)." >/dev/null 2>&1 || true

  # Fetch full body now (the queue JSON only carries the title).
  body=$(glab issue view "$iid" --output json | jq -r '.description // ""')

  jq -n --argjson iid "$iid" --arg title "$title" --arg body "$body" \
    '{iid: $iid, title: $title, body: $body}'
  exit 0
done < <(jq -c '.[]' /tmp/afk-queue.json)

exit 1   # queue exhausted, no candidate
