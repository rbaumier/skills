#!/bin/bash
# merge-gate.sh <report-dir> <base> <head> [frontend dir…], from the repo.
# Exit 2: an unpaid in-lot row, an unaudited constat; a lot merged in <base>..<head> without its
# last review MERGEABLE, its mockup pass or, capture-marked, /uploads/ in <report-dir>/mr-body.md;
# a front change whose last QA verdict is no GO(-PROVISIONAL), nor a NO-GO with every in-lot row paid.
set -u
report=$1 base=$2 head=$3
shift 3
verdict='' last=0
for f in "$report"/qa/verdict-*.md; do
  round=${f##*/verdict-} round=${round%.md}
  [[ $round =~ ^[0-9]+$ ]] && ((10#$round > last)) && last=$((10#$round)) verdict=$f
done
[ -n "$verdict" ] && {
  # The verdict is the first bold word under `## Verdict`, else in the file.
  word=$(awk '/^## Verdict/ { v = 1; next } v && /\*\*/ { sub(/^[^*]*\*\*/, ""); sub(/\*\*.*/, ""); print; exit }' "$verdict")
  [ -n "$word" ] || word=$(grep -m1 -oE '\*\*(GO-PROVISIONAL|NO-GO|GO|BLOCKED|ABORTED)\b' "$verdict" | tr -d '*')
  [ -n "$word" ] || word=$(head -1 "$verdict" | grep -oE '(GO-PROVISIONAL|NO-GO|GO|BLOCKED|ABORTED)$')
  word=${word%.}
}
root=$report/..
# The lots this range merged, by report dir name: issue-<n>[-t<k>], fix-<k>.
merged=$(git log --format=%s "$base..$head" | grep -oE "agent/[A-Za-z0-9-]+'" | sed -E "s#^agent/(closing-)?##; s#'\$##")
merged_lot() { local d=${1%/}; grep -qx "${d##*/}" <<<"$merged"; }
# Every in-lot row of every verdict and mockup pass, <file stem>:<row>, is paid by one fix lot
# citing it merged into the head, or waived by the user.
paid_rows=0
for f in "$report"/qa/verdict-*.md "$report"/qa/mockup-*.md; do
  [ -f "$f" ] || continue
  for row in $(awk -F'|' -v s="$(basename "$f" .md)" '$4 ~ /in-lot/ { gsub(/ /, "", $2); print s ":" $2 }' "$f"); do
    [ "$f" = "$verdict" ] && paid_rows=$((paid_rows + 1))
    grep -qx "$row" "$report/qa/waived.md" 2>/dev/null && continue
    k='' paid=''
    for lot in $(grep -lw -- "$row" "$report"/fix-*/issue.md 2>/dev/null); do
      k=${lot%/issue.md} k=${k##*/fix-}
      git log --format=%s "$base..$head" | grep -q "closing-fix-$k'" && paid=1 && break
    done
    [ -n "$paid" ] ||
      { echo "BLOCKED — in-lot $row unpaid in $head (fix lot ${k:-none}); the user's own word → $report/qa/waived.md" >&2; exit 2; }
  done
done
for d in "$root"/issue-*/mockups/; do
  merged_lot "${d%/mockups/}" && [ -n "$(ls -A "$d")" ] || continue
  m=${d%/mockups/} m=mockup-${m##*/}
  [ -f "$report/qa/$m.md" ] || { echo "BLOCKED — ${m#mockup-} without its mockup pass: $report/qa/$m.md" >&2; exit 2; }
done
grep -qs '^- \[ \]' "$root/constats.md" && { echo "BLOCKED — audit due: $root/constats.md" >&2; exit 2; }
for d in "$root"/*/ "$report"/fix-*/; do
  merged_lot "$d" || continue
  # The newest round's verdict: the last verdict line of its report or its .done.
  r=$(ls "$d"review-[0-9]*.md 2>/dev/null | sort -V | tail -1)
  v=$(grep -hoE '^(\*\*)?(Verdict *: *)?\**(MERGEABLE|REWORK)' "$r" "$r.done" 2>/dev/null | grep -oE 'MERGEABLE|REWORK' | tail -1)
  [ "$v" = MERGEABLE ] || { echo "BLOCKED — ${d%/} merged without review" >&2; exit 2; }
done
for m in "$root"/issue-*/mr-description.md; do
  merged_lot "${m%/mr-description.md}" && grep -q '<!-- capture:' "$m" || continue
  n=${m%/mr-description.md} n=${n##*/issue-} n=${n%%-t*}
  awk -v n="#$n" '/^(- \*\*|#)/ { s = $0 ~ (n "([^0-9]|$)") } s && /\/uploads\// { f = 1 } END { exit !f }' "$report/mr-body.md" 2>/dev/null ||
    { echo "BLOCKED — #$n without a capture in $report/mr-body.md" >&2; exit 2; }
done
[ $# -gt 0 ] || exit 0
front=$(git diff --name-only "$base...$head" -- "$@") || exit 1
[ -n "$front" ] || exit 0
[ -n "$verdict" ] || { echo "BLOCKED — missing QA GO: $report/qa/verdict-1.md" >&2; exit 2; }
# A NO-GO whose in-lot rows are all paid or waived is spent.
case $word in GO | GO-PROVISIONAL) exit 0 ;; NO-GO) [ "$paid_rows" -gt 0 ] && exit 0 ;; esac
echo "BLOCKED — missing QA GO: $verdict (${word:-no verdict})" >&2
exit 2
