#!/usr/bin/env bash
set -euo pipefail

# Usage: ./create-review.sh [FROM] [TO]
# Defaults: FROM=origin/master, TO=HEAD

FROM="${1:-origin/master}"
TO="${2:-HEAD}"
REVIEWS_DIR="reviews"

DATE=$(date +%Y-%m-%d)
TIME=$(date +%Hh%M)
LEFT=$(git rev-parse --short "$FROM" 2>/dev/null || echo "$FROM")
RIGHT=$(git rev-parse --short "$TO" 2>/dev/null || echo "$TO")
SLUG="${DATE}-${TIME}-commits-${LEFT}-vs-${RIGHT}"

mkdir -p "$REVIEWS_DIR"
OUTFILE="${REVIEWS_DIR}/${SLUG}.md"

FILES=""
while IFS=$'\t' read -r fstatus fpath; do
  case "$fstatus" in
    A*|"??") s="A" ;;
    M*|T*)   s="M" ;;
    D*)      s="D" ;;
    R*)      s="R" ;;
    *)       s="M" ;;
  esac
  FILES="${FILES}  - path: \"${fpath}\"
    status: ${s}
    reviewed: false
"
done < <(git diff --name-status "$FROM"..."$TO")

COUNT=$(echo "$FILES" | grep -c 'path:' || true)
LABEL="${LEFT}..${RIGHT}"

cat > "$OUTFILE" << ENDOFFILE
---
mode: commits
left: "${LEFT}"
right: "${RIGHT}"
label: "${LABEL}"
pending: true
files:
${FILES}---

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

echo "Review created: ${OUTFILE} (${COUNT} files)"
