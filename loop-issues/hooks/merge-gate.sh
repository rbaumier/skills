#!/bin/bash
# merge-gate.sh <report-dir> <base> <head> [frontend dir…], from the repo.
# Exit 2: a front lot whose last QA verdict is not a clean GO.
set -u
report=$1 base=$2 head=$3
shift 3
[ $# -gt 0 ] || exit 0
front=$(git diff --name-only "$base...$head" -- "$@") || exit 1
[ -n "$front" ] || exit 0
verdict= last=0
for f in "$report"/qa/verdict-*.md; do
  round=${f##*/verdict-} round=${round%.md}
  [[ $round =~ ^[0-9]+$ ]] && ((10#$round > last)) && last=$((10#$round)) verdict=$f
done
[ -n "$verdict" ] || { echo "BLOCKED — missing QA GO: $report/qa/verdict-1.md" >&2; exit 2; }
# The verdict is the first bold word under `## Verdict`, else in the file.
word=$(awk '/^## Verdict/ { v = 1; next } v && /\*\*/ { sub(/^[^*]*\*\*/, ""); sub(/\*\*.*/, ""); print; exit }' "$verdict")
[ -n "$word" ] || word=$(grep -m1 -oE '\*\*(GO-PROVISIONAL|GO|NO-GO|BLOCKED|ABORTED)\b' "$verdict" | tr -d '*')
case $word in GO | GO-PROVISIONAL) grep -q 'BLOCKED(budget)' "$verdict" || exit 0 ;; esac
echo "BLOCKED — missing QA GO: $verdict (${word:-no verdict})" >&2
exit 2
