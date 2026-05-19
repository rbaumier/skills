#!/usr/bin/env bash
# AFK terminal-state helpers. Three subcommands:
#   open-mr     <iid> <branch> <parent_branch> <parent_mr_iid|null> <iterations> <description_path> <worktree>
#   queue-merge <iid> <branch> [--squash]
#   fail        <iid> <reason> [<comment_path>]
# Each is idempotent. open-mr prints the MR URL on stdout.
# queue-merge returns a structured exit code so the orchestrator can dispatch
# auto-fix flows (rebase, CI debug) instead of silently leaving open MRs:
#   0  → auto-merge queued or already merged
#   10 → merge conflict (orchestrator should rebase + retry)
#   11 → pipeline failed (orchestrator should fix CI + retry)
#   12 → approvals required (cannot self-approve → failed-by-agent)
#   13 → branch protection / project policy (try alternate flags, then fail)
#   1  → unrecognised glab error (failed-by-agent, dump stderr)
#   2  → infra error

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
    git -C "$worktree" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1
    ls_rc=$?
    if [ $ls_rc -eq 2 ]; then
      echo "ERREUR: ls-remote failed (network?) pre-MR" >&2
      exit 2
    fi
    remote_sha=$(git -C "$worktree" ls-remote --heads origin "$branch" | awk '{print $1}')
    if [ "$local_sha" != "$remote_sha" ]; then
      git -C "$worktree" push -u origin "$branch" >/dev/null 2>&1 \
        || { echo "ERREUR: push pre-MR failed" >&2; exit 2; }
    fi

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

  queue-merge)
    iid=${1:?missing iid}
    branch=${2:?missing branch}
    extra_flag=${3:-}    # currently only "--squash" recognised; orchestrator
                         # may pass it on a retry when project policy demands it

    mr_iid=$(glab mr list --source-branch "$branch" --output json 2>/dev/null \
             | jq -r '[.[] | select(.state == "opened")] | .[0].iid // empty')
    [ -n "$mr_iid" ] || { echo "ERREUR: no open MR for branch $branch" >&2; exit 2; }

    # `--auto-merge` queues the merge for after the pipeline succeeds. Stacked
    # MRs survive parent-merge retargeting because the attribute is server-side.
    if [ "$extra_flag" = "--squash" ]; then
      merge_err=$(glab mr merge "$mr_iid" --auto-merge --remove-source-branch --squash --yes 2>&1)
    else
      merge_err=$(glab mr merge "$mr_iid" --auto-merge --remove-source-branch --yes 2>&1)
    fi
    rc=$?
    if [ $rc -eq 0 ]; then
      exit 0
    fi

    # Print stderr so the orchestrator can re-read and quote it if needed.
    printf '%s\n' "$merge_err"

    # Dispatch by error signature. glab/GitLab phrasing is not perfectly
    # stable, so match on durable substrings.
    lower=$(printf '%s' "$merge_err" | tr '[:upper:]' '[:lower:]')
    case "$lower" in
      *conflict*|*"cannot be merged"*|*"merge conflicts"*)         exit 10 ;;
      *pipeline*fail*|*"pipeline must succeed"*|*"failed pipeline"*) exit 11 ;;
      *approval*|*"requires approval"*|*"not enough approvals"*)   exit 12 ;;
      *protected*|*"merge method"*|*"squash"*|*"fast-forward"*)    exit 13 ;;
      *) exit 1 ;;
    esac
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
