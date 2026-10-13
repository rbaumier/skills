#!/bin/bash
# Checks the loop's refusal hooks: bash loop-issues/hooks/test.sh
set -u
hooks=$(cd "$(dirname "$0")" && pwd)
bypass="$hooks/refuse-hook-bypass.sh"
running="$hooks/loop-running.sh"
issue="$hooks/../../issue/hooks/guard-issue-create.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export HOME="$tmp"
git init -q "$tmp/guarded" && git -C "$tmp/guarded" remote add origin git@forge:g/p.git

# expect <deny|pass> <script> <input json> [hook arguments…]
expect() {
  local want=$1 script=$2 input=$3 got
  shift 3
  "$script" "$@" <<<"$input" 2>"$tmp/reason"
  case $? in 0) got=pass ;; 2) got=deny ;; *) got=error ;; esac
  [ "$got" = "$want" ] || { echo "FAIL $group: want $want, got $got: $input" >&2; exit 1; }
}
command_input() { jq -nc --arg c "$1" --arg cwd "${2:-$tmp}" '{tool_input: {command: $c}, cwd: $cwd}'; }

group=bypass_refused
for c in 'git commit --no-verify -m x' 'git commit -n' 'cd x && git -C y commit -nm x' \
  'git commit -an -m x' 'git commit -m "it'\''s" -n' \
  'git config core.hooksPath /dev/null' 'git -c core.hooksPath=/dev/null commit -m x' \
  "$(printf 'git commit \\\n  --no-verify -m x')" \
  "$(printf 'cat > f <<EOF\nx\nEOF\njq . <<<y\ngit commit --no-verify -F f')" \
  "$(printf 'echo "1<<2"\ngit commit --no-verify -m x')"; do
  expect deny "$bypass" "$(command_input "$c")"
done

group=plain_git_passes
for c in 'git commit -m x' 'git commit -am "doc: forbid --no-verify"' \
  'git config --get core.hooksPath' 'git log -n 3' 'git log --grep=commit -n 3' \
  'git status -uno' 'git log -n 5' 'git diff --name-only' 'git commit -uno -m x' \
  'git commit -amn' 'git commit -m "it'\''s x" && git log --format='\''%h'\'' -n 5' \
  "$(printf 'git commit -F- <<'\''EOF'\''\nRefuses git commit --no-verify.\nEOF')"; do
  expect pass "$bypass" "$(command_input "$c")"
done

group=question_refused_while_running
CLAUDE_CODE_SESSION_ID=s1 "$running" start
expect deny "$running" '{"session_id":"s1"}'
grep -q BLOCKED "$tmp/reason" || { echo "FAIL $group: reason does not name BLOCKED" >&2; exit 1; }

group=question_allowed_after_stop_or_elsewhere
expect pass "$running" '{"session_id":"s2"}'
CLAUDE_CODE_SESSION_ID=s1 "$running" stop
expect pass "$running" '{"session_id":"s1"}'

group=issue_create_refused_on_listed
expect deny "$issue" "$(command_input 'glab api projects/g%2Fp/issues -f title=x')" g/p
expect deny "$issue" "$(command_input 'gh issue create -R g/p -t x')" g/p
expect deny "$issue" "$(command_input 'gh issue create -t x' "$tmp/guarded")" g/p
expect deny "$issue" '{"tool_name":"mcp__gitlab__create_issue","tool_input":{"project_id":"g%2Fp"}}' g/p

group=publisher_and_unlisted_pass
expect pass "$issue" "$(command_input 'gh issue create -t x' "$tmp/guarded" | jq -c '.agent_type = "issue-publisher"')" g/p
expect pass "$issue" "$(command_input 'gh issue create -R o/q -t x')" g/p
expect pass "$issue" "$(command_input 'glab api projects/g%2Fp/issues/12/notes -f body=x')" g/p
expect pass "$issue" "$(command_input 'gh issue create -R g/p -t x')"
expect pass "$issue" "$(command_input "rg -n 'gh issue create' docs" "$tmp/guarded")" g/p

gate="$hooks/merge-gate.sh"
git init -q "$tmp/repo" && cd "$tmp/repo" || exit 1
mkdir -p web api "$tmp/report/qa" && touch web/a api/a
commit() { [ $# -eq 0 ] || git add "$@"; git -c user.name=t -c user.email=t@t commit -qm x --allow-empty; }
commit && commit api/a && commit web/a
verdict() { printf '## Verdict\n\n**%s** — x\n%s\n' "$2" "${3:-}" >"$tmp/report/qa/verdict-$1.md"; }

group=back_lot_passes_without_verdict
expect pass "$gate" '' "$tmp/report" HEAD~2 HEAD~1 web

group=front_lot_refused_without_go
expect deny "$gate" '' "$tmp/report" HEAD~2 HEAD web
grep -q 'missing QA GO: .*/qa/verdict-1.md' "$tmp/reason" || { echo "FAIL $group: reason does not name the verdict" >&2; exit 1; }
verdict 1 NO-GO
expect deny "$gate" '' "$tmp/report" HEAD~2 HEAD web
grep -q 'verdict-1.md (NO-GO)' "$tmp/reason" || { echo "FAIL $group: reason does not name the NO-GO" >&2; exit 1; }
verdict 2 GO-PROVISIONAL '| 3 | UI | / | x | BLOCKED(budget) | - |'
expect deny "$gate" '' "$tmp/report" HEAD~2 HEAD web

group=front_lot_passes_on_go
verdict 3 GO
expect pass "$gate" '' "$tmp/report" HEAD~2 HEAD web

group=latest_round_wins_numerically
verdict 9 GO
verdict 10 NO-GO
expect deny "$gate" '' "$tmp/report" HEAD~2 HEAD web
grep -q 'verdict-10.md (NO-GO)' "$tmp/reason" || { echo "FAIL $group: verdict-9 beat verdict-10" >&2; exit 1; }

# Forge doubles: issue <n> is $tmp/forge/<n>.body with state $tmp/forge/<n>.state (opened|closed).
check="$hooks/check.sh"
mkdir -p "$tmp/bin" "$tmp/forge"
printf '%s\n' '#!/bin/bash' 'f='"$tmp"'/forge/$3' \
  'jq -n --rawfile b $f.body --arg s "$(cat $f.state)" '\''{body: $b, state: (if $s == "opened" then "OPEN" else "CLOSED" end)}'\''' >"$tmp/bin/gh"
printf '%s\n' '#!/bin/bash' 'f='"$tmp"'/forge/${2##*/}' \
  'jq -n --rawfile b $f.body --arg s "$(cat $f.state)" '\''{description: $b, state: $s}'\''' >"$tmp/bin/glab"
chmod +x "$tmp/bin/gh" "$tmp/bin/glab"
export PATH="$tmp/bin:$PATH"
sections=(Category Summary 'Current behavior' 'Desired behavior' 'Acceptance criteria')
# forge_issue <n> <state> [body line…]: a body with every English template section.
forge_issue() {
  local n=$1
  echo "$2" >"$tmp/forge/$n.state"
  shift 2
  printf '%s\n' "$@" '**Category:** bug' '**Summary:** x' '**Current behavior:**' x \
    '**Desired behavior:**' x '**Acceptance criteria:**' '- [ ] x' >"$tmp/forge/$n.body"
}

group=issue_blocked_skipped
forge_issue 1 opened '> **Blocked by #7** — needs the table'
forge_issue 7 opened
for forge in gh glab; do
  expect deny "$check" '' issue "$forge" g/p 1 "${sections[@]}"
  [ "$(cat "$tmp/reason")" = 'blocked by #7' ] || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }
done

group=issue_closed_blocker_passes
forge_issue 7 opened 'Blocked by #70'
forge_issue 70 closed
expect pass "$check" '' issue gh g/p 7 "${sections[@]}"
[ ! -s "$tmp/reason" ] || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }

group=issue_forge_error
forge_issue 4 opened 'Blocked by #98'
for forge in gh glab; do
  expect error "$check" '' issue "$forge" g/p 99 "${sections[@]}"
  expect error "$check" '' issue "$forge" g/p 4 "${sections[@]}"
done

group=issue_outside_template
echo opened >"$tmp/forge/2.state"
printf '%s\n' '**Category:** bug' '**Summary:** x' '**Current behavior:**' x '**Desired behavior:**' x >"$tmp/forge/2.body"
expect deny "$check" '' issue gh g/p 2 "${sections[@]}"
[ "$(cat "$tmp/reason")" = 'outside template' ] || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }

group=issue_translated_template_passes
echo opened >"$tmp/forge/3.state"
printf '%s\n' '**Catégorie :** bug' '**Résumé :** x' '**Comportement actuel :**' x \
  '**Comportement attendu :**' x '**Critères d'\''acceptation :**' '- [ ] x' >"$tmp/forge/3.body"
expect pass "$check" '' issue gh g/p 3 'Catégorie' 'Résumé' 'Comportement actuel' 'Comportement attendu' "Critères d'acceptation"

group=contract_uncovered_besoin
printf '%s\n' '## Besoin' '- B1 — x' '- B10 — y' '' '## Tests' '- B10 — t' 'B1 has no test, prose only.' '' '## Formes' '- Fichiers : `a/x.md`' >"$tmp/c.md"
expect deny "$check" '' contract "$tmp/c.md"
grep -q 'B1 ' "$tmp/reason" || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }

group=contract_missing_readers
printf '%s\n' '## Besoin' '- B1 — x' '' '## Tests' '- B1 — t' '' '## Formes' '- Fichiers : `foo`' '- modifié `foo` — x' >"$tmp/c.md"
expect deny "$check" '' contract "$tmp/c.md"
grep -q 'foo' "$tmp/reason" || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }
for readers in 'lu par : ' "lu par :$(printf '\t')" 'lu par personne, cf. a:b' 'lu par : aucun' 'lu par : none — x'; do
  printf '%s\n' '## Besoin' '- B1 — x' '' '## Tests' '- B1 — t' '' '## Formes' '- Fichiers : `foo`' "- modifié \`foo\` — $readers" >"$tmp/c.md"
  expect deny "$check" '' contract "$tmp/c.md"
  grep -q 'foo' "$tmp/reason" || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }
done

group=contract_complete_passes
printf '%s\n' '## Besoin' '- B1 — x' '' '## Tests' '- B1 — t' '' '## Formes' '- Fichiers : `foo`' '- modifié `foo` — lu par : bar' "- modifié \`baz\` — lu par$(printf '\302\240'): qux" >"$tmp/c.md"
expect pass "$check" '' contract "$tmp/c.md"

group=overlap_shared_file_holds
printf '%s\n' '## Formes' '- Fichiers : `a/x.md`, `a/y.md`' >"$tmp/new.md"
printf '%s\n' '## Formes' '- Fichiers : `a/x.md`, `a/z.md`' >"$tmp/other.md"
expect deny "$check" '' overlap "$tmp/new.md" "$tmp/other.md"
[ "$(cat "$tmp/reason")" = "$tmp/other.md: a/x.md" ] || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }

group=overlap_disjoint_passes
printf '%s\n' '## Formes' '- Fichiers : `b/x.md`, `b/z.md`' >"$tmp/other.md"
expect pass "$check" '' overlap "$tmp/new.md" "$tmp/other.md"

echo "hooks: all checks pass"
