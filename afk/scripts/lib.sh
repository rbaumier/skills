#!/usr/bin/env bash
# Shared helpers for AFK phase scripts. Sourced via `. "$(dirname "$0")/lib.sh"`.
# Each phase script must re-derive its env (Claude Code's Bash tool is non-persistent).

set -euo pipefail

afk_detect_default_branch() {
  local b
  b=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
  [ -z "$b" ] && b=$(glab repo view --output json 2>/dev/null | jq -r '.default_branch // empty')
  [ -z "$b" ] && b=$(git for-each-ref --format='%(refname:short)' \
                     refs/heads/main refs/heads/master refs/heads/develop 2>/dev/null | head -1)
  [ -n "$b" ] || { echo "ERREUR: default branch introuvable" >&2; return 1; }
  printf '%s' "$b"
}

afk_project_id() {
  local id
  id=$(glab repo view --output json 2>/dev/null | jq -r '.id // empty')
  [ -n "$id" ] || { echo "ERREUR: GL_PROJECT_ID introuvable" >&2; return 1; }
  printf '%s' "$id"
}

afk_date() { date +%Y%m%d; }

# Where AFK puts its per-issue worktrees. Outside the repo so the launcher's
# checkout state is untouched, predictable so the user can find failed runs.
# Args: <branch>. Prints the absolute path.
# Uses the GitLab numeric project_id (stable across renames, collision-free
# when two repos share the same dirname on disk).
afk_worktree_path() {
  local branch=$1
  local pid
  pid=$(afk_project_id) || return 1
  printf '%s/.afk-worktrees/%s/%s' "$HOME" "$pid" "$branch"
}

# Slugify a title for use in a branch name. Max 40 chars.
afk_slug() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' \
    | tr -cs '[:alnum:]' '-' | sed 's/^-*//; s/-*$//' | cut -c1-40 | sed 's/-*$//'
}

# Age in seconds of an ISO8601 timestamp (handles macOS BSD date and GNU date).
afk_age_sec() {
  local ts=$1
  local clean=${ts%.*}
  local epoch
  if epoch=$(date -u -j -f "%Y-%m-%dT%H:%M:%S" "$clean" +%s 2>/dev/null); then
    :
  elif epoch=$(date -u -d "$ts" +%s 2>/dev/null); then
    :
  else
    echo 0
    return
  fi
  echo $(( $(date -u +%s) - epoch ))
}
