#!/usr/bin/env bash
# AFK Phase 3 — create the working branch + worktree, dependency-aware.
# Usage: create-branch.sh <iid> <title>
# Reads the issue body + notes from GitLab to detect deps.
# On success: prints one JSON object on stdout:
#   {branch, parent_branch, parent_mr_iid (or null), worktree}
# Exit 0.
# On push/worktree collision (lost claim race): exits 1 — caller must remove
# picked-by-agent and retry next.
# On any other error: exits 2 with stderr message.

. "$(dirname "$0")/lib.sh"

iid=${1:?missing iid}
title=${2:?missing title}

default_branch=$(afk_detect_default_branch) || exit 2
project_id=$(afk_project_id) || exit 2
afk_date=$(afk_date)
prefix=${AFK_BRANCH_PREFIX:-}

# Parse dependency iids from body and notes.
body=$(glab issue view "$iid" --output json | jq -r '.description // ""')
notes=$(glab api "projects/$project_id/issues/$iid/notes" 2>/dev/null \
        | jq -r '[.[].body] | join("\n")' 2>/dev/null || true)
dep_iids=$(printf '%s\n%s' "$body" "$notes" \
           | { grep -oiE '(depends on|blocked by|needs|requires|after|stack(s|ed)? on) +!?#?[0-9]+' || true; } \
           | { grep -oE '[0-9]+' || true; } | sort -un)

parent_branch=$default_branch
parent_mr_iid="null"
for dep_iid in $dep_iids; do
  [ "$dep_iid" = "$iid" ] && continue
  parent_mr=$(glab api "projects/$project_id/issues/$dep_iid/related_merge_requests" 2>/dev/null \
              | jq '[.[] | select(.state == "opened")] | .[0] // empty')
  [ -z "$parent_mr" ] && continue
  parent_branch=$(printf '%s' "$parent_mr" | jq -r '.source_branch')
  parent_mr_iid=$(printf '%s' "$parent_mr" | jq -r '.iid')
  break
done

slug=$(afk_slug "$title")
branch="${prefix}${iid}-${slug}-afk-${afk_date}"
worktree=$(afk_worktree_path "$branch")

git fetch origin "$parent_branch" >/dev/null 2>&1 || { echo "ERREUR: fetch $parent_branch failed" >&2; exit 2; }

mkdir -p "$(dirname "$worktree")"

# Local atomicity primitive: `git worktree add -b` fails if the branch already
# exists anywhere in this .git/. When it fails we must disambiguate — another
# concurrent instance sharing this .git/ (lost race) vs a stale orphan from a
# prior crashed run on this machine (safe to recycle).
if ! git worktree add "$worktree" -b "$branch" "origin/$parent_branch" >/dev/null 2>&1; then
  # Is the branch checked out by an active worktree? If yes, another live
  # instance owns it. Don't touch.
  if git worktree list --porcelain | grep -q "^branch refs/heads/$branch$"; then
    echo "ERREUR: worktree add collision sur $branch (race perdue)" >&2
    exit 1
  fi
  # Branch exists but no worktree claims it — orphan from a crashed run on this
  # machine. Safe to wipe and retry once.
  rm -rf "$worktree" 2>/dev/null || true
  git worktree prune >/dev/null 2>&1 || true
  git branch -D "$branch" >/dev/null 2>&1 || true
  if ! git worktree add "$worktree" -b "$branch" "origin/$parent_branch" >/dev/null 2>&1; then
    echo "ERREUR: worktree add failed after orphan cleanup" >&2
    exit 2
  fi
fi

# Cross-machine atomicity primitive — if a remote branch with this name
# already exists (orphan from prior crash on another machine, OR concurrent
# claim from another clone), the non-force push fails. We retry after a
# remote-delete attempt only if the remote branch has no open MR — Phase 2's
# claim-next already guaranteed that, so this delete is safe.
if ! git -C "$worktree" push -u origin "$branch" >/dev/null 2>&1; then
  if git -C "$worktree" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    git -C "$worktree" push --delete origin "$branch" >/dev/null 2>&1 || true
  fi
  if ! git -C "$worktree" push -u origin "$branch" >/dev/null 2>&1; then
    echo "ERREUR: push collision sur $branch (race perdue)" >&2
    git worktree remove --force "$worktree" >/dev/null 2>&1 || true
    git branch -D "$branch" >/dev/null 2>&1 || true
    exit 1
  fi
fi

jq -n --arg b "$branch" --arg pb "$parent_branch" --argjson pmr "$parent_mr_iid" --arg wt "$worktree" \
  '{branch: $b, parent_branch: $pb, parent_mr_iid: $pmr, worktree: $wt}'
