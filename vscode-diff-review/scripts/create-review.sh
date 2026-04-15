#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./create-review.sh [FROM] [TO]      # commit-vs-commit (default: origin/master..HEAD)
#   ./create-review.sh --working        # uncommitted changes (unstaged + staged + untracked)

MODE="commits"
FROM="origin/master"
TO="HEAD"

if [[ "${1:-}" == "--working" ]]; then
  MODE="working"
elif [[ -n "${1:-}" ]]; then
  FROM="$1"
  [[ -n "${2:-}" ]] && TO="$2"
fi

REVIEWS_DIR="reviews"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%Hh%M)

mkdir -p "$REVIEWS_DIR"

build_files_yaml() {
  # stdin: lines of "<status>\t<path>"
  local files=""
  while IFS=$'\t' read -r fstatus fpath; do
    [[ -z "$fpath" ]] && continue
    local s
    case "$fstatus" in
      A*|"??") s="A" ;;
      M*|T*)   s="M" ;;
      D*)      s="D" ;;
      R*)      s="R" ;;
      *)       s="M" ;;
    esac
    files="${files}  - path: \"${fpath}\"
    status: ${s}
    reviewed: false
"
  done
  printf '%s' "$files"
}

if [[ "$MODE" == "working" ]]; then
  HEAD_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "head")
  SLUG="${DATE}-${TIME}-working-tree-${HEAD_SHORT}"
  LABEL="Working tree (vs ${HEAD_SHORT})"

  # Collect unstaged + staged + untracked. Later entries overwrite earlier ones,
  # so a file that is both staged and modified ends up listed once with its
  # most recent status.
  TMP=$(mktemp)
  {
    git diff --name-status
    git diff --cached --name-status
    git ls-files --others --exclude-standard | sed 's/^/??\t/'
  } | awk -F'\t' 'NF==2 {seen[$2]=$1} END {for (p in seen) print seen[p] "\t" p}' | sort -k2 > "$TMP"

  FILES=$(build_files_yaml < "$TMP")
  rm -f "$TMP"
else
  LEFT=$(git rev-parse --short "$FROM" 2>/dev/null || echo "$FROM")
  RIGHT=$(git rev-parse --short "$TO" 2>/dev/null || echo "$TO")
  SLUG="${DATE}-${TIME}-commits-${LEFT}-vs-${RIGHT}"
  LABEL="${LEFT}..${RIGHT}"

  FILES=$(git diff --name-status "$FROM"..."$TO" | build_files_yaml)
fi

OUTFILE="${REVIEWS_DIR}/${SLUG}.md"
COUNT=$(printf '%s' "$FILES" | grep -c 'path:' || true)

if [[ "$MODE" == "working" ]]; then
  cat > "$OUTFILE" << ENDOFFILE
---
mode: working
label: "${LABEL}"
pending: true
files:
${FILES}
---

# Diff Review: ${LABEL}

**Mode:** working
**Date:** ${DATE}
**Files:** ${COUNT} (0 reviewed)

## Agent Instructions

Review the comments below. For each unresolved comment:
1. Fix the issue in the codebase
2. Add a reply line under the comment: \`  > description of fix — agent\`
3. Mark as resolved by changing \`- [ ]\` to \`- [x]\`

## Comments

_No comments._
ENDOFFILE
else
  cat > "$OUTFILE" << ENDOFFILE
---
mode: commits
left: "${LEFT}"
right: "${RIGHT}"
label: "${LABEL}"
pending: true
files:
${FILES}
---

# Diff Review: ${LABEL}

**Mode:** commits
**Date:** ${DATE}
**Files:** ${COUNT} (0 reviewed)

## Agent Instructions

Review the comments below. For each unresolved comment:
1. Fix the issue in the codebase
2. Add a reply line under the comment: \`  > description of fix — agent\`
3. Mark as resolved by changing \`- [ ]\` to \`- [x]\`

## Comments

_No comments._
ENDOFFILE
fi

echo "Review created: ${OUTFILE} (${COUNT} files)"
