#!/bin/bash
# Filter: a Bash command reduced to what runs, for a hook's regex.
# Heredoc bodies and quoted strings drop, as refuse-hook-bypass.sh does.
# Kept, `;`-bounded: a body fed to a shell, a string handed to a shell
# (`bash -lc`, `sh -c --`) or to `eval`, a quoted command word.
awk '
  end != "" {
    if ($0 ~ "^[[:space:]]*" end "[[:space:]]*$") end = body = ""; else if (keep) print; else body = body $0 "\n"
    next
  }
  { print }
  match($0, /(^|[^<])<<-?[[:space:]]*["\047]?[[:alnum:]_]+/) {
    keep = $0 ~ /(^|[;&|(])[[:space:]]*(bash|sh|zsh)([[:space:]]|$)/
    end = substr($0, RSTART, RLENGTH); sub(/^.*<<-?[[:space:]]*["\047]?/, "", end); body = ""
  }
  # A body never closed was no heredoc: kept.
  END { printf "%s", body }' | tr '\n' ';' |
  perl -pe 's/\\;/ /g; s/(^|[;&|(]\s*|(?<![\w.-])(?:(?:bash|sh|zsh)(?:\s+-\S+)*|eval)\s+)?(\x27[^\x27]*\x27|"(?:[^"\\]|\\.)*")/defined $1 ? "$1;" . substr($2, 1, -1) . ";" : "Q"/ge'
