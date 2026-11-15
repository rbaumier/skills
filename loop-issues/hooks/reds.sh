#!/usr/bin/env bash
# reds.sh <seen file> <e2e dir> <log>… — streams each red of a lane pass once, the
# moment a log shows it: per test (nextest, vitest, Playwright, node --test, QA's `✘`),
# else a lane's `── red:`. Follows every lane log a log names (`log in <path>.log`).
# <seen file> keeps a re-armed watch from repeating a red; a `test.fail` test of
# <e2e dir> is never one (no dir: a warning, nothing masked). Never exits: TaskStop it.
set -u
# Its own process group: a TaskStop takes every follower with it.
[ -n "${REDS_PG:-}" ] || REDS_PG=1 exec perl -e 'setpgrp(0, 0); exec @ARGV' "$0" "$@"
seen=$1 e2e=$2
shift 2
touch "$seen"
# `<spec path>:<line>:` of each test `test.fail` marks, by indentation: inside a test, that
# test; at a describe's or file's level, all its tests. A conditional one masks too.
fails=$(cd "$e2e" 2>/dev/null && find . -name '*.spec.ts' -not -path '*/node_modules/*' -exec perl -ne '
  sub key { substr($ARGV, 2) . ":$_[0]:\n" }
  @f = ([-1, 0, []]) unless @f;
  /^(\s*)/; $i = length $1;
  if (/^\s*test\.describe(?:\.\w+)?\(\s*(?:["\x27`(]|$)/) { push @f, [$i, 0, []] }
  elsif (/^\s*test(?:\.(?:only|skip|fixme|slow|fail))?\(\s*(?:["\x27`]|$)/) {
    ($d, $di) = ($., $i); push @{$f[-1][2]}, $.; print key($.) if /^\s*test\.fail\(/;
  }
  elsif (/\btest\.fail\(/) { if ($d && $i > $di) { print key($d) } else { $f[-1][1] = 1 } }
  elsif (/^\s*\}\)[;,]?\s*$/) {
    if ($d && $i == $di) { $d = 0 }
    elsif (@f > 1 && $i == $f[-1][0]) {
      $x = pop @f; push @{$x->[1] ? \@out : $f[-1][2]}, @{$x->[2]};
    }
  }
  if (eof) { push @out, @{$f[0][2]} if $f[0][1]; print key($_) for @out; @f = @out = (); $d = 0; close ARGV }' {} +) ||
  echo "reds.sh: no $e2e: no test.fail masked" >&2
trap 'trap - TERM; kill -- -$$' INT TERM
pat='^ *(FAIL|TIMEOUT|SIGSEGV|SIGABRT|LEAK-FAIL) \[|(✘|✖) '

# vitest and a gate's `── red:` only from a lane log: the main log merely repeats them.
follow() {
  tail -n +1 -F "$1" 2>/dev/null | grep -E --line-buffered "$pat${2:-}" | sed -u "s|^|$1: |"
}

{
  for log in "$@"; do
    follow "$log" &
    tail -n +1 -F "$log" 2>/dev/null | grep -Eo --line-buffered 'log in /[^ ]+\.log' |
      while read -r _ _ lane; do follow "$lane" '|× |^ *❯ |^── red: ' & done &
  done
  wait
} | FAILS=$fails awk -v seen="$seen" '
  BEGIN { while ((getline k < seen) > 0) done[k] = 1; split(ENVIRON["FAILS"], fail, "\n") }
  {
    for (i in fail) if (index($0, "› " fail[i])) next
    if ($0 ~ /✖ failing tests:/) next
    src = $0; sub(/: .*/, "", src)
    # vitest names its file once, on the `❯` line above its `×` tests.
    if ($0 ~ /❯ /) { f = $0; sub(/.*❯ */, "", f); sub(/ .*/, "", f); file[src] = f; next }
    # Same red, whatever log, duration, index or repeat repeats it.
    # A gate or vitest red keeps its log: two lanes share gates and file paths.
    k = $0; if (k !~ /: (── red:| *×) /) sub(/^[^:]*: */, "", k)
    if (k ~ /: *× /) { sub(/ [0-9.]+m?s$/, "", k); sub(/: */, ": " file[src] " > ", k); $0 = k }
    gsub(/\[ *[0-9.]+(m?s|m|h)\]|\([0-9.]+(m?s|m|h)\)|\((repeat|retry) ?#?:?[0-9]+\)|^ *(×|✘|✖) +[0-9]* */, "", k)
    gsub(/ +/, " ", k)
    if (k in done) next
    done[k] = 1; print k >> seen; fflush(seen); print; fflush()
  }' &
wait
