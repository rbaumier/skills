#!/bin/bash
# merge-gate.sh <report-dir> <base> <head> [frontend dir…], from the repo.
# Exit 2: an unpaid in-lot row, an unaudited constat; a lot merged in <base>..<head> without its
# last review MERGEABLE, its mockup pass or, capture-marked, /uploads/ in <report-dir>/mr-body.md;
# a front change whose last QA verdict is no GO(-PROVISIONAL), nor a NO-GO with every in-lot row paid,
# or that changed after the verdict's `head: <sha>`; a merged closing fix without its <report-dir>/fix-<k>/.
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
merged=$(git log --format=%s "$base..$head" | sed -nE "s#.*agent/(closing-)?([A-Za-z0-9-]+)'.*#\2#p; s#^Merge closing-(fix-[0-9]+) into .*#\1#p")
merged_lot() { local d=${1%/}; grep -qx "${d##*/}" <<<"$merged"; }
# Every in-lot row of every verdict and mockup pass, <file stem>:<row>, is paid by one fix lot
# citing it merged into the head, waived by the user, or deferred to an open needs-triage issue.
paid_rows=0
# deferred <row>: its `<row> → #<m> <issue url>` line of qa/deferred.md names an open
# needs-triage issue on the forge; unreadable forge → no.
deferred() {
  local url n p
  url=$(awk -v r="$1" '$1 == r && $2 == "→" { print $3, $4; exit }' "$report/qa/deferred.md" 2>/dev/null)
  n=${url%% *} url=${url#* } n=${n#\#}
  [ "${url##*/}" = "$n" ] || return 1
  case $url in
    https://github.com/*) gh issue view "$url" --json state,labels |
      jq -e '.state == "OPEN" and any(.labels[]; .name == "needs-triage")' ;;
    https://*/-/issues/*) p=${url#https://*/} p=${p%/-/issues/*}
      glab api "projects/$(jq -rn --arg p "$p" '$p | @uri')/issues/$n" |
      jq -e '.state == "opened" and any(.labels[]; . == "needs-triage")' ;;
    *) false ;;
  esac >/dev/null 2>&1
}
for f in "$report"/qa/verdict-*.md "$report"/qa/mockup-*.md; do
  [ -f "$f" ] || continue
  for row in $(awk -F'|' -v s="$(basename "$f" .md)" '$4 ~ /in-lot/ { gsub(/ /, "", $2); print s ":" $2 }' "$f"); do
    [ "$f" = "$verdict" ] && paid_rows=$((paid_rows + 1))
    { grep -qx "$row" "$report/qa/waived.md" 2>/dev/null || deferred "$row"; } && continue
    k='' paid=''
    for lot in $(grep -lw -- "$row" "$report"/fix-*/issue.md 2>/dev/null); do
      k=${lot%/issue.md} k=${k##*/fix-}
      git log --format=%s "$base..$head" | grep -q "closing-fix-$k'" && paid=1 && break
    done
    [ -n "$paid" ] ||
      { echo "BLOCKED — in-lot $row unpaid in $head (fix lot ${k:-none}); the user's own word → $report/qa/waived.md; a deferral → $report/qa/deferred.md (\`<row> → #<m> <issue url>\`, open, needs-triage)" >&2; exit 2; }
  done
done
for d in "$root"/issue-*/mockups/; do
  merged_lot "${d%/mockups/}" && [ -n "$(ls -A "$d")" ] || continue
  m=${d%/mockups/} m=mockup-${m##*/}
  [ -f "$report/qa/$m.md" ] || { echo "BLOCKED — ${m#mockup-} without its mockup pass: $report/qa/$m.md" >&2; exit 2; }
done
grep -qs '^- \[ \]' "$root/constats.md" && { echo "BLOCKED — audit due: $root/constats.md" >&2; exit 2; }
for k in $(grep -x 'fix-[0-9]*' <<<"$merged"); do
  [ -d "$report/$k" ] || { echo "BLOCKED — closing $k merged outside $report/$k/ (no issue.md, no review)" >&2; exit 2; }
done
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
# A GO holds for the front it saw; a NO-GO whose in-lot rows are all paid or waived is spent.
fresh() {
  local vhead
  vhead=$(grep -m1 -oE '^head: [0-9a-f]{7,40}' "$verdict" | cut -d' ' -f2)
  [ -n "$vhead" ] || { echo "BLOCKED — $verdict names no \`head: <sha>\`" >&2; exit 2; }
  [ -z "$(git diff --name-only "$vhead" "$head" -- "$@")" ] ||
    { echo "BLOCKED — front changed after the QA verdict's head $vhead: QA replays the fix lots' rows" >&2; exit 2; }
}
case $word in GO | GO-PROVISIONAL) fresh "$@"; exit 0 ;; NO-GO) [ "$paid_rows" -gt 0 ] && exit 0 ;; esac
echo "BLOCKED — missing QA GO: $verdict (${word:-no verdict})" >&2
exit 2
