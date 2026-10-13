#!/bin/bash
# merge-gate.sh <report-dir> <base> <head> [frontend dir…], from the repo.
# Exit 2: a front lot whose last QA verdict is not a clean GO.
set -u
report=$1 base=$2 head=$3
shift 3
[ $# -gt 0 ] || exit 0
front=$(git diff --name-only "$base...$head" -- "$@") || exit 1
[ -n "$front" ] || exit 0
verdict=
for f in "$report"/qa/verdict-*.md; do [ -e "$f" ] && verdict=$f; done
[ -n "$verdict" ] || { echo "BLOCKED — missing QA GO: $report/qa/verdict-1.md" >&2; exit 2; }
word=$(awk '/^## Verdict/ { v = 1; next } v && /\*\*/ { sub(/^[^*]*\*\*/, ""); sub(/\*\*.*/, ""); print; exit }' "$verdict")
case $word in GO | GO-PROVISIONAL) grep -q 'BLOCKED(budget)' "$verdict" || exit 0 ;; esac
echo "BLOCKED — missing QA GO: $verdict (${word:-no verdict})" >&2
exit 2
