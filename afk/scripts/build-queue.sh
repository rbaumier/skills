#!/usr/bin/env bash
# AFK Phase 1 — fetch the queue into /tmp/afk-queue.json.
# Prints the count of issues to stdout. Exits 0 always (queue may be legitimately empty).
# Errors go to stderr with exit 1.

. "$(dirname "$0")/lib.sh"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

page=1
while :; do
  batch=$(glab issue list --label ready-for-agent --not-label failed-by-agent \
            --per-page 100 --page "$page" --output json 2>/dev/null)
  if [ -z "$batch" ] || ! printf '%s' "$batch" | jq empty 2>/dev/null; then
    echo "ERREUR: glab issue list a échoué page $page" >&2
    exit 1
  fi
  count=$(printf '%s' "$batch" | jq 'length')
  [ "$count" -eq 0 ] && break
  printf '%s' "$batch" > "$tmpdir/page-$page.json"
  page=$((page+1))
done

if compgen -G "$tmpdir/page-*.json" > /dev/null; then
  jq -s '[.[][]]' "$tmpdir"/page-*.json > /tmp/afk-queue.json
else
  printf '[]' > /tmp/afk-queue.json
fi

jq 'length' /tmp/afk-queue.json
