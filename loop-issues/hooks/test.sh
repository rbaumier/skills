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

group=verdict_word_read_in_qa_skill_format
verdict 4 GO-PROVISIONAL.
expect pass "$gate" '' "$tmp/report" HEAD~2 HEAD web
verdict 4 GO-PROVISIONAL 'Tally: 9 BLOCKED(env), 0 BLOCKED(budget).'
expect pass "$gate" '' "$tmp/report" HEAD~2 HEAD web
printf '# QA run 5 — GO\n' >"$tmp/report/qa/verdict-5.md"
expect pass "$gate" '' "$tmp/report" HEAD~2 HEAD web
printf '# QA run 6\n\n**ABORTED.** x\n' >"$tmp/report/qa/verdict-6.md"
expect deny "$gate" '' "$tmp/report" HEAD~2 HEAD web

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

group=issue_integrated_blocker_passes
LOOP_INTEGRATED='3 7' expect pass "$check" '' issue gh g/p 1 "${sections[@]}"
LOOP_INTEGRATED='#3 #7' expect pass "$check" '' issue gh g/p 1 "${sections[@]}"
LOOP_INTEGRATED='17' expect deny "$check" '' issue gh g/p 1 "${sections[@]}"

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
for readers in 'lu par : ' "lu par :$(printf '\t')" 'lu par personne, cf. a:b' 'lu par : aucun' 'lu par : aucune.' 'lu par : none — x'; do
  printf '%s\n' '## Besoin' '- B1 — x' '' '## Tests' '- B1 — t' '' '## Formes' '- Fichiers : `foo`' "- modifié \`foo\` — $readers" >"$tmp/c.md"
  expect deny "$check" '' contract "$tmp/c.md"
  grep -q 'foo' "$tmp/reason" || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }
done

group=contract_complete_passes
printf '%s\n' '## Besoin' '- B1 — x' '' '## Tests' '- B1 — t' '' '## Formes' '- Fichiers : `foo`' '- modifié `foo` — lu par : bar' "- modifié \`baz\` — lu par$(printf '\302\240'): qux" '- modifié `quux` — lu par : Personne::new' >"$tmp/c.md"
expect pass "$check" '' contract "$tmp/c.md"

group=overlap_shared_file_holds
printf '%s\n' '## Formes' '- Fichiers : `a/x.md`, `a/y.md`' >"$tmp/new.md"
printf '%s\n' '## Formes' '- Fichiers : `a/x.md`, `a/z.md`' >"$tmp/other.md"
expect deny "$check" '' overlap "$tmp/new.md" "$tmp/other.md"
[ "$(cat "$tmp/reason")" = "$tmp/other.md: a/x.md" ] || { echo "FAIL $group: $(cat "$tmp/reason")" >&2; exit 1; }

group=overlap_disjoint_passes
printf '%s\n' '## Formes' '- Fichiers : `b/x.md`, `b/z.md`' >"$tmp/other.md"
expect pass "$check" '' overlap "$tmp/new.md" "$tmp/other.md"

group=overlap_generated_file_passes
printf '%s\n' '## Formes' '- Fichiers : `a/x.md`, `a/openapi.json`' >"$tmp/new.md"
printf '%s\n' '## Formes' '- Fichiers : `a/z.md`, `a/openapi.json`' >"$tmp/other.md"
LOOP_GENERATED='openapi\.json$' expect pass "$check" '' overlap "$tmp/new.md" "$tmp/other.md"

# df double: 50 GB free if $tmp/roomy-if holds, else 1.
slot="$hooks/slot.sh"
printf '%s\n' '#!/bin/bash' 'echo "Filesystem 1024-blocks Used Available Capacity Mounted"' \
  'bash -c "$(cat '"$tmp"'/roomy-if)" && gb=50 || gb=1' 'echo "disk 0 0 $((gb * 1048576)) 0% /"' >"$tmp/bin/df"
chmod +x "$tmp/bin/df"
fail() { echo "FAIL $group: $1" >&2; exit 1; }
g() { git -C "$tmp/repo" -c user.name=t -c user.email=t@t "$@"; }
git init -q "$tmp/repo" && echo a >"$tmp/repo/f" && g add f && g commit -qm a
mkdir -p "$tmp/wts"
for n in 1 2 3 4-t2; do
  g worktree add -q "$tmp/wts/issue-$n" -b "agent/issue-$n"
  touch -t 202001010000 "$tmp/repo/.git/worktrees/issue-$n/index"
done
echo b >"$tmp/wts/issue-3/f"

group=disk_below_threshold_held
echo false >"$tmp/roomy-if"
expect deny "$slot" '' disk 20 "$tmp/empty-wts" -
grep -q '^disk: 1 GB free < 20 GB$' "$tmp/reason" || fail "$(cat "$tmp/reason")"

group=disk_sweeps_clones_first
echo "[ -e $tmp/swept ]" >"$tmp/roomy-if"
expect pass "$slot" '' disk 20 "$tmp/wts" "echo x >>$tmp/sweeps; touch $tmp/swept" 2
[ "$(wc -l <"$tmp/sweeps")" -eq 1 ] && [ -d "$tmp/wts/issue-1" ] || fail "sweep not first"

group=disk_reclaims_then_passes
echo "[ ! -d $tmp/wts/issue-1 ]" >"$tmp/roomy-if"
touch "$tmp/wts/issue-1.env" "$tmp/wts/issue-4.env"
expect pass "$slot" '' disk 20 "$tmp/wts" true 2
[ ! -d "$tmp/wts/issue-1" ] && [ ! -e "$tmp/wts/issue-1.env" ] || fail "issue-1 or its env kept"
[ ! -d "$tmp/wts/issue-4-t2" ] && [ -e "$tmp/wts/issue-4.env" ] || fail "split task kept, or its issue env lost"
g rev-parse -q --verify agent/issue-1 >/dev/null || fail "branch of issue-1 lost"
[ -d "$tmp/wts/issue-2" ] && [ "$(cat "$tmp/wts/issue-3/f")" = b ] || fail "in-flight or dirty worktree touched"

group=env_hook_injects_slot_env
mkdir -p "$tmp/x-worktrees/issue-1-t2/sub" && echo FOO=bar >"$tmp/x-worktrees/issue-1.env"
# run_hook <mode> <command> [cwd]: any permission decision, then the command output.
run_hook() {
  local out
  out=$(command_input "$2" "${3:-$tmp}" | jq -c --arg m "$1" '.permission_mode = $m' | "$slot" env)
  [ -n "$out" ] || return 0
  jq -r '.hookSpecificOutput.permissionDecision // empty' <<<"$out"
  bash -c "$(jq -r .hookSpecificOutput.updatedInput.command <<<"$out")"
}
mkdir -p "$tmp/x-worktrees/issue-1"
for mode in auto default bypassPermissions; do
  [ "$(run_hook "$mode" "cd $tmp/x-worktrees/issue-1 && echo \"\$FOO\"")" = bar ] || fail "path or decision under $mode"
done
[ "$(run_hook auto 'echo "$FOO"' "$tmp/x-worktrees/issue-1-t2/sub")" = bar ] || fail "cwd of a split lot"
[ "$(HOME=$tmp run_hook auto 'cd $HOME/x-worktrees/issue-1 && echo "$FOO"')" = bar ] || fail "\$HOME path"
[ -z "$(run_hook auto "ls $tmp/x-worktrees/issue-10/x")" ] || fail "issue-10 took issue-1's env"
mkdir -p "$tmp/x-worktrees/slot-2" && echo FOO=baz >"$tmp/x-worktrees/slot-2.env"
[ "$(run_hook auto 'echo "$FOO"' "$tmp/x-worktrees/slot-2")" = baz ] || fail "slot worktree"
mkdir -p "$tmp/x-worktrees/loop-2026-10-15" && echo FOO=lp >"$tmp/x-worktrees/loop-2026-10-15.env"
[ "$(run_hook auto 'echo "$FOO"' "$tmp/x-worktrees/loop-2026-10-15")" = lp ] || fail "integration worktree"

group=gate_recreates_once
expect pass "$slot" '' gate 'schema mismatch' "echo r >>$tmp/recreates; touch $tmp/migrated" \
  "[ -e $tmp/migrated ] || { echo schema mismatch; exit 1; }" >/dev/null
[ "$(wc -l <"$tmp/recreates")" -eq 1 ] || fail "recreated more than once"
expect deny "$slot" '' gate 'schema mismatch' "echo r >>$tmp/recreates2" 'echo schema mismatch; exit 1' >/dev/null
grep -q '^BLOCKED' "$tmp/reason" && [ "$(wc -l <"$tmp/recreates2")" -eq 1 ] || fail "second mismatch not BLOCKED"
"$slot" gate 'schema mismatch' "touch $tmp/recreates3" 'exit 3' >/dev/null
[ $? -eq 3 ] && [ ! -e "$tmp/recreates3" ] || fail "red without signal recreated or masked"
"$slot" gate 'schema mismatch' true 'exit 2' >/dev/null
[ $? -eq 1 ] || fail "a gate's own exit 2 read as a refusal"

# qa-up refuses a port held on any address, [::1] included.
port() {
  python3 -c '
import socket, sys
held = []
for _ in range(100):
    v4 = socket.socket(); v4.bind(("0.0.0.0", 0)); p = v4.getsockname()[1]
    try:
        v6 = socket.socket(socket.AF_INET6); v6.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
        v6.bind(("::", p))
    except OSError: continue
    held += [v4, v6]
    if len(held) == 2 * int(sys.argv[1]): print(*(s.getsockname()[1] for s in held[::2])); break
else: sys.exit("no free port")' "${1:-1}"
}
serve() { echo "python3 -m http.server $1 --bind 127.0.0.1"; }
up() { curl -sf -o /dev/null --retry 30 --retry-delay 1 --retry-connrefused --max-time 2 "http://127.0.0.1:$1/"; }
cleanup() {
  for s in "$tmp"/qa*.md; do "$slot" qa-down "$s"; done
  rm -rf "$tmp"
}
trap cleanup EXIT

group=qa_probe_then_down_frees_slot
a=$(port)
timeout 10 "$slot" qa-up "$tmp/qa1.md" "$tmp/qa1.log" "$(serve "$a")" "$a" || fail "qa-up did not return"
up "$a" && grep -q 'GET /' "$tmp/qa1.log" || fail "stack down or log empty"
expect deny "$slot" '' qa-probe idp=true cors=false port=false
grep -q cors "$tmp/reason" && ! grep -q port "$tmp/reason" || fail "$(cat "$tmp/reason")"
pgid=$(awk '$1 == "pgid:" { print $2 }' "$tmp/qa1.md")
expect pass "$slot" '' qa-down "$tmp/qa1.md"
! lsof -nP -iTCP:"$a" -sTCP:LISTEN -t >/dev/null && ! kill -0 -- "-$pgid" 2>/dev/null || fail "slot still held"
expect pass "$slot" '' qa-down "$tmp/qa1.md"
expect pass "$slot" '' qa-down "$tmp/absent.md"

group=qa_two_slots_no_conflict
read -r a b <<<"$(port 2)"
"$slot" qa-up "$tmp/qa1.md" "$tmp/qa1.log" "$(serve "$a")" "$a" && "$slot" qa-up "$tmp/qa2.md" "$tmp/qa2.log" "$(serve "$b")" "$b"
up "$a" && up "$b" || fail "two stacks"
expect deny "$slot" '' qa-up "$tmp/qa3.md" "$tmp/qa3.log" "$(serve "$a")" "$a"
grep -q "port $a" "$tmp/reason" && up "$a" || fail "$(cat "$tmp/reason")"
expect pass "$slot" '' qa-down "$tmp/qa1.md"
expect pass "$slot" '' qa-down "$tmp/qa2.md"

state="$hooks/state.sh"
at() { jq -nr --argjson s "$1" '(now + $s) | todate'; }

group=tick_pause_and_drain
printf '%s\n' "mode: pause-until $(at 3600)" 'slot 1: free' >"$tmp/state.md"
expect deny "$state" '' tick "$tmp/state.md"
grep -q '^paused until ' "$tmp/reason" || fail "$(cat "$tmp/reason")"
printf '%s\n' "mode: pause-until $(at -3600)" 'slot 1: free' >"$tmp/state.md"
expect pass "$state" '' tick "$tmp/state.md"
printf '%s\n' 'mode: drain' "slot 1: #4 build 1 loop-builder since $(at -60) — $tmp/r4" 'slot 2: free' >"$tmp/state.md"
expect deny "$state" '' tick "$tmp/state.md"
[ "$(cat "$tmp/reason")" = draining ] || fail "$(cat "$tmp/reason")"
printf '%s\n' 'mode: drain' 'slot 1: free' 'slot 2: free' >"$tmp/state.md"
expect deny "$state" '' tick "$tmp/state.md"
[ "$(cat "$tmp/reason")" = drained ] || fail "$(cat "$tmp/reason")"
printf '%s\n' 'slot 1: free' >"$tmp/state.md"
expect pass "$state" '' tick "$tmp/state.md"

group=tick_marks_overdue_phase
mkdir -p "$tmp/r1" "$tmp/r2"
printf '%s\n' 'mode: run' "slot 1: #1 ship 2 loop-reviewer since $(at -1200) — $tmp/r1" \
  "slot 2: #2 build 1 loop-builder since $(at -300) — $tmp/r2" \
  "slot 3: #3 build 1 loop-builder done — $tmp/r3" >"$tmp/state.md"
expect pass "$state" '' tick "$tmp/state.md"
expect pass "$state" '' tick "$tmp/state.md"
[ "$(grep -n '🐢' "$tmp/state.md" | cut -d: -f1)" = 2 ] || fail "$(cat "$tmp/state.md")"
grep -q ' 🐢 20/15 min$' "$tmp/state.md" || fail "$(cat "$tmp/state.md")"
[ "$(wc -l <"$tmp/r1/lenteurs.md")" -eq 1 ] || fail "$(cat "$tmp/r1/lenteurs.md")"
[ ! -e "$tmp/r2/lenteurs.md" ] || fail "r2/lenteurs.md"

group=model_mismatch_stops
mkdir -p "$tmp/.claude/agents"
printf '%s\n' --- 'name: loop-orchestrator' 'model: claude-opus-5-5' --- >"$tmp/.claude/agents/loop-orchestrator.md"
printf '%s\n' 'mode: run' >"$tmp/state.md"
expect deny "$state" '' model "$tmp/state.md" claude-sonnet-5-5
[ "$(tail -1 "$tmp/state.md")" = 'stopped: model — serving claude-sonnet-5-5, pinned claude-opus-5-5' ] || fail "$(cat "$tmp/state.md")"
printf '%s\n' 'mode: run' >"$tmp/state.md"
expect pass "$state" '' model "$tmp/state.md" claude-opus-5-5
[ "$(cat "$tmp/state.md")" = 'mode: run' ] || fail "state.md changed on a match"

group=fresh_rereads_changed_only
cp -R "$hooks/.." "$tmp/skill"
export CLAUDE_CODE_SESSION_ID=f1
expect pass "$tmp/skill/hooks/state.sh" '' fresh
expect pass "$tmp/skill/hooks/state.sh" '' fresh
# The copy is as new as the mark: age both, the mark last.
find "$tmp/skill" -type f -exec touch -t 202001010000 {} +
touch -t 202001010100 "$tmp/.claude/run/loop-issues/f1.read"
touch "$tmp/skill/RENDEZVOUS.md"
expect deny "$tmp/skill/hooks/state.sh" '' fresh
[ "$(cat "$tmp/reason")" = "$tmp/skill/RENDEZVOUS.md" ] || fail "$(cat "$tmp/reason")"
expect pass "$tmp/skill/hooks/state.sh" '' fresh

group=count_shows_counter_and_rework
printf '%s\n' 'mode: run' 'planned: 3 (+1)' 'done: #1 ✅ merged rework' 'done: #2 📝 drafted' >"$tmp/state.md"
[ "$("$state" count "$tmp/state.md")" = 'Compteur : 2 / 3 lots (+1 ajoutés) · reprises : 1 / 2' ] || fail "$("$state" count "$tmp/state.md")"

group=registry_records_and_keeps_entries
mkdir -p "$tmp/lot7" "$tmp/lot8"
printf '%s\n' '## Constats non payés' '- a.sh:3 — x — y' '' '## Autre' '- b.sh:1 — z — w' >"$tmp/lot7/ship-1.md"
printf '%s\n' '## Constats non payés' '- c.sh:5 — u — v' >"$tmp/lot8/ship-2.md"
"$state" merged "$tmp/constats.md" 7 "$tmp/lot7" || fail "merged exit"
"$state" merged "$tmp/constats.md" 8 "$tmp/lot8" || fail "merged exit"
[ "$(cat "$tmp/constats.md")" = "$(printf '%s\n' '- [ ] #7 a.sh:3 — x — y' 'merged #7' '- [ ] #8 c.sh:5 — u — v' 'merged #8')" ] ||
  fail "$(cat "$tmp/constats.md")"

group=registry_never_duplicates
printf '%s\n' '- [x] #7 a.sh:3 — x — y — absent @abc' >"$tmp/closed.md"
for _ in 1 2; do "$state" merged "$tmp/closed.md" 7 "$tmp/lot7" || fail "merged exit"; done
[ "$(grep -c '^- ' "$tmp/closed.md")" -eq 1 ] || fail "$(cat "$tmp/closed.md")"
grep -qF '[ ]' "$tmp/closed.md" && fail "reopened: $(cat "$tmp/closed.md")"
for _ in 1 2; do "$state" merged "$tmp/open.md" 7 "$tmp/lot7" || fail "merged exit"; done
[ "$(grep -c '^- ' "$tmp/open.md")" -eq 1 ] || fail "$(cat "$tmp/open.md")"
printf '%s\n' '- [x] #7 a.sh:3 — x — y — z — absent @abc' >"$tmp/longer.md"
"$state" merged "$tmp/longer.md" 7 "$tmp/lot7" || fail "merged exit"
grep -qFx -- '- [ ] #7 a.sh:3 — x — y' "$tmp/longer.md" || fail "hidden: $(cat "$tmp/longer.md")"

group=registry_audit_due_every_ten
mkdir -p "$tmp/empty"
for i in $(seq 11); do
  [ -n "$("$state" merged "$tmp/cadence.md" "$i" "$tmp/empty")" ] && echo "$i"
done >"$tmp/due"
[ "$(cat "$tmp/due")" = "$(printf '%s\n' 10 11)" ] || fail "audit due after merges: $(cat "$tmp/due")"
echo audited >>"$tmp/cadence.md"
for i in $(seq 12 21); do
  [ -n "$("$state" merged "$tmp/cadence.md" "$i" "$tmp/empty")" ] && echo "$i"
done >"$tmp/due"
[ "$(cat "$tmp/due")" = 21 ] || fail "audit due after reset: $(cat "$tmp/due")"

echo "hooks: all checks pass"
