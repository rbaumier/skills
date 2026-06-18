---
name: kirby-review
description: Run kirby's review engine on a PR or a commit, OUTSIDE the orchestrator loop. Local output only — findings are presented in-conversation, nothing is posted, no Provider config needed.
---

Drive `scripts/review.ts` (kirby's Standalone Review) over an arbitrary diff. YOU own all the git; the script is a dumb `(worktree, base) → findings JSON`. Target repo = the cwd repo (the PR/commit lives there).

## Preflight (run in parallel)

- `which bun tmux claude` — missing → STOP, list gaps. (The fan-out spawns `claude` tmux sessions; no `KIRBY_*` token needed — there is no Provider on this path.)
- `git -C "$PWD" rev-parse --git-dir` — must succeed → STOP if cwd not a git repo, ask user to `cd` into the target repo.
- Resolve the default branch: `BASE_BRANCH=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null || echo origin/main)` → e.g. `origin/main`.

## Resolve input → (worktree, base)

Pick a throwaway worktree path that does NOT exist yet: `WT=$(mktemp -u -t kirby-review)`. ALWAYS a dedicated worktree — never the live checkout (the fan-out writes a `.claude/` Stop-hook config into the worktree).

**Commit `<sha>`** (a SHA, tag, or `HEAD~k`):
```sh
git rev-parse --verify "<sha>^"      # base must exist; a root commit has none → STOP
git worktree add --detach "$WT" "<sha>"
BASE="<sha>^"
```

**PR / MR `<n>`**: detect forge from the origin URL, fetch the PR head ref, pin it to a SHA (FETCH_HEAD is shared/racy), refresh the base:
```sh
git fetch origin                                       # refresh origin/* so BASE is current
case "$(git remote get-url origin)" in
  *github.com*) git fetch origin "refs/pull/<n>/head" ;;
  *)            git fetch origin "refs/merge-requests/<n>/head" ;;   # GitLab default
esac
SHA=$(git rev-parse FETCH_HEAD)
git worktree add --detach "$WT" "$SHA"
BASE="$BASE_BRANCH"
```

If unsure whether the input is a commit or a PR, ask the user — don't guess.

## Run (background — the fan-out takes minutes)

```
bun run /Users/rbaumier/www/kirby-bot/scripts/review.ts --worktree "$WT" --base "$BASE" --out "$WT/findings.json"
```
Bash `run_in_background:true`, keep `bash_id`. The harness re-invokes you on completion. On exit:
- non-zero → `TaskOutput` on `bash_id`, surface the error (`ReviewSterile` = all agents failed; `ReadChangedFilesError` = bad worktree/base). Do NOT retry blindly.
- zero → read `$WT/findings.json` and present (below). The stdout summary line names the counts.

Optional live progress: the script writes a `run.jsonl` under `~/.afk-runs/`; tail it with the same recipe as the `kirby` skill if the user wants phase-level updates. Don't read `tmux-*.log` (floods context).

## Present findings

`findings.json` is an `AggregatedReview`: `{ agents, lineAnchoredFindings, proseFindings }`.

- **Line-anchored** (`lineAnchoredFindings[]`): each has `file`, `line`, `severity` (bug|security|performance|error_handling|suggestion), `confidence`, `title`, `analysisChain[]`, `fixPrompt`. Group by severity (bug/security first), one line each: `` `file:line` — title (confidence) `` then the fix on the next line. Note any with `anchored:false` (line couldn't be matched in the diff).
- **Prose** (`proseFindings[]`): each `tag` (`must`|`suggestion`), `agent`, `text`. List `must` before `suggestion`.
- **Roster** (`agents[]`): one line — how many `findings` / `no-findings` / `error` / `wrote-nothing`. Call out errored agents (the review is partial).
- Empty file (`[]` everywhere) → "no findings" if agents ran clean, or relay the empty-diff message from stdout.

## Cleanup (always, even on failure)

```sh
git worktree remove --force "$WT" 2>/dev/null; git worktree prune
```

## Don't

- Don't post anything to the PR/MR — this path is read-only by design.
- Don't run against the live checkout — always the throwaway worktree.
- Don't require/ask for `KIRBY_GITLAB_TOKEN` — the Provider is never touched here.
