#!/bin/bash
# Mechanical checks of the loop; exit 2 = refused, reason on stderr.
# Exit 1 = forge or usage error, never a refusal.
#   check.sh issue <gh|glab> <project> <n> <template section>…
#   check.sh contract <contract.md>
#   check.sh overlap <new contract.md> <in-flight contract.md>…
set -uo pipefail
refuse() { echo "$1" >&2; exit 2; }

# Prints {body, open} for issue $3 of project $2 on forge $1.
issue_json() {
  case $1 in
    gh) gh issue view "$3" -R "$2" --json body,state | jq -c '{body, open: (.state == "OPEN")}' ;;
    glab) glab api "projects/$2/issues/$3" | jq -c '{body: .description, open: (.state == "opened")}' ;;
    *) echo "unknown forge: $1" >&2; exit 1 ;;
  esac
}

# Prints the body of section `## $2` of file $1.
section() { awk -v h="## $2" '$0 == h { f = 1; next } /^## / { f = 0 } f' "$1"; }

files() { section "$1" Formes | grep -m1 '^- Fichiers' | grep -o '`[^`]*`' | tr -d '`'; }

case ${1:-} in
  issue)
    forge=$2 project=$3 n=$4
    shift 4
    json=$(issue_json "$forge" "$project" "$n") || exit 1
    body=$(jq -r .body <<<"$json")
    for name in "$@"; do
      awk -v s="**$name" 'index($0, s) == 1 { f = 1 } END { exit !f }' <<<"$body" ||
        refuse "outside template"
    done
    for blocker in $(grep -oiE 'blocked by #[0-9]+' <<<"$body" | grep -oE '[0-9]+$'); do
      open=$(issue_json "$forge" "$project" "$blocker" | jq -r .open) || exit 1
      [ "$open" = true ] && refuse "blocked by #$blocker"
    done
    ;;
  contract)
    besoins=$(section "$2" Besoin | grep '^- ')
    unnamed=$(grep -vE '^- B[0-9]+ ' <<<"$besoins" | head -1)
    [ -z "$unnamed" ] || refuse "Besoin without a B<k> id: $unnamed"
    tested=$(section "$2" Tests | grep '^- ' | grep -owE 'B[0-9]+' | sort -u)
    for id in $(grep -oE '^- B[0-9]+' <<<"$besoins" | cut -c3-); do
      grep -qx "$id" <<<"$tested" || refuse "Besoin $id has no test"
    done
    [ -n "$(files "$2")" ] || refuse "Formes has no '- Fichiers :' line"
    unread=$(section "$2" Formes | grep '^- modifié' | grep -vE 'lu par[^:]{0,2}:[[:blank:]]*[[:alnum:]`#]' | head -1)
    [ -z "$unread" ] || refuse "no readers for: $(sed -E 's/^- modifié //; s/ — .*//' <<<"$unread")"
    ;;
  overlap)
    new=$(files "$2" | sort -u)
    shift 2
    for other in "$@"; do
      shared=$(comm -12 <(echo "$new") <(files "$other" | sort -u))
      [ -z "$shared" ] || refuse "$other: $(paste -sd' ' - <<<"$shared")"
    done
    ;;
  *) echo "usage: check.sh issue|contract|overlap …" >&2; exit 1 ;;
esac
exit 0
