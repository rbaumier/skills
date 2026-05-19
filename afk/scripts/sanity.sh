#!/usr/bin/env bash
# AFK Phase 0 — sanity checks. Exits 0 silently on success, 1 with error on stderr.
# Each AFK phase script re-derives DEFAULT_BRANCH/GL_PROJECT_ID locally because Claude
# Code's Bash tool gives each call a fresh shell — env vars don't persist between calls.
#
# NOTE: no dirty-tree check. AFK works in isolated git worktrees under
# ~/.afk-worktrees/<repo>/<branch>, so the launcher's checkout state is irrelevant.
set -euo pipefail

git fetch --prune >/dev/null 2>&1

default_branch=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -z "$default_branch" ] && default_branch=$(glab repo view --output json 2>/dev/null | jq -r '.default_branch // empty')
[ -z "$default_branch" ] && default_branch=$(git for-each-ref --format='%(refname:short)' \
                                              refs/heads/main refs/heads/master refs/heads/develop 2>/dev/null | head -1)
[ -n "$default_branch" ] || { echo "ERREUR: default branch introuvable" >&2; exit 1; }

glab auth status >/dev/null 2>&1 || { echo "ERREUR: glab non authentifié" >&2; exit 1; }

# Phase 7.5 needs `glab mr merge --auto-merge` (added in glab v1.30, 2023).
# Without it every issue would end failed-by-agent on the merge step.
glab mr merge --help 2>&1 | grep -q -- '--auto-merge' \
  || { echo "ERREUR: glab too old, --auto-merge flag absent. Upgrade glab to >=1.30." >&2; exit 1; }

project_id=$(glab repo view --output json 2>/dev/null | jq -r '.id // empty')
[ -n "$project_id" ] || { echo "ERREUR: GL_PROJECT_ID introuvable" >&2; exit 1; }

echo "OK default_branch=$default_branch project_id=$project_id"
