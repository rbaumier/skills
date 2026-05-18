#!/usr/bin/env bash
# AFK terminal-state helpers. Two subcommands:
#   open-mr <iid> <branch> <parent_branch> <parent_mr_iid|null> <iterations> <description_path> <worktree>
#   fail   <iid> <reason> [<comment_path>]
# Each is idempotent. open-mr prints the MR URL on stdout.

. "$(dirname "$0")/lib.sh"

cmd=${1:?missing subcommand (open-mr | fail)}
shift

project_id=$(afk_project_id) || exit 2
default_branch=$(afk_detect_default_branch) || exit 2

case "$cmd" in
  open-mr)
    iid=${1:?missing iid}
    branch=${2:?missing branch}
    parent_branch=${3:?missing parent_branch}
    parent_mr_iid=${4:-null}
    iterations=${5:-?}
    description_path=${6:?missing description path}
    worktree=${7:?missing worktree path}

    [ -f "$description_path" ] || { echo "ERREUR: description path absent" >&2; exit 2; }
    [ -d "$worktree" ] || { echo "ERREUR: worktree $worktree absent" >&2; exit 2; }

    # Push any local commits that aren't on the remote. All git ops target the
    # worktree explicitly — the orchestrator's cwd is not the work branch.
    local_sha=$(git -C "$worktree" rev-parse HEAD)
    remote_sha=$(git -C "$worktree" ls-remote --heads origin "$branch" | awk '{print $1}')
    [ "$local_sha" != "$remote_sha" ] && git -C "$worktree" push -u origin "$branch" >/dev/null 2>&1

    # Idempotence: did an earlier glab mr create succeed server-side?
    existing=$(glab mr list --source-branch "$branch" --output json 2>/dev/null \
               | jq -r '[.[] | select(.state == "opened")] | .[0].web_url // empty')
    if [ -z "$existing" ]; then
      target_branch="$default_branch"
      if [ "$parent_mr_iid" != "null" ] && [ "$parent_branch" != "$default_branch" ]; then
        target_branch="$parent_branch"
      fi
      glab mr create --target-branch "$target_branch" --source-branch "$branch" \
        --title "$(git -C "$worktree" log -1 --pretty=%s)" --description "$(cat "$description_path")" \
        --yes >/dev/null 2>&1 \
        || { echo "ERREUR: glab mr create failed" >&2; exit 2; }
      existing=$(glab mr list --source-branch "$branch" --output json 2>/dev/null \
                 | jq -r '[.[] | select(.state == "opened")] | .[0].web_url // empty')
    fi

    glab issue update "$iid" --unlabel picked-by-agent >/dev/null 2>&1 || true
    printf '%s\n' "$existing"
    ;;

  fail)
    iid=${1:?missing iid}
    reason=${2:?missing reason}
    comment_path=${3:-}

    if [ -n "$comment_path" ] && [ -f "$comment_path" ]; then
      glab issue note "$iid" --message "$(cat "$comment_path")" >/dev/null 2>&1 || true
    else
      glab issue note "$iid" --message "$reason" >/dev/null 2>&1 || true
    fi
    glab issue update "$iid" --label failed-by-agent --unlabel picked-by-agent >/dev/null 2>&1 || true
    ;;

  *)
    echo "ERREUR: subcommand inconnue: $cmd" >&2
    exit 2
    ;;
esac
