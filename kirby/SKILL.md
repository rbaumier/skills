---
name: kirby
description: Launch kirby-bot orchestrator in background, relay phase transitions live from run.jsonl.
---

## Preflight (run in parallel)

- `test -n "$KIRBY_GITLAB_TOKEN"` — missing → STOP, ask user to export PAT.
- `which bun tmux claude` — missing → STOP, list gaps.
- Same-repo guard (per-repo, NOT per-binary — every target runs the same `main.ts`, so a bare `pgrep` false-positives across projects). Match each *live* kirby PID to its repo via its cwd, resolving worktrees through git's common dir (layout-independent). A kirby on a *different* repo is fine; ignore it.
  ```sh
  mainroot() { local d=$1 c; c=$(git -C "$d" rev-parse --git-common-dir 2>/dev/null) || return 1; ( cd "$d" && cd "$(dirname "$c")" && pwd ); }
  CUR=$(mainroot .) || { echo "STOP: cwd not a git repo"; }
  for pid in $(pgrep -f kirby-bot/src/main.ts); do
    cwd=$(lsof -a -d cwd -p "$pid" -Fn 2>/dev/null | sed -n 's/^n//p')
    [ -n "$cwd" ] && [ "$(mainroot "$cwd")" = "$CUR" ] && echo "RUNNING_HERE pid=$pid"
  done
  ```
  Any `RUNNING_HERE` line → STOP, confirm before a second run on the SAME repo. No output → proceed (other-repo kirby runs are expected and must NOT block). Counts only live PIDs, so dead/stale runs never false-positive.
- `git -C "$PWD" remote get-url origin` — must succeed. Bot detects target repo from cwd's git remote — STOP if cwd not a git repo, ask user to `cd` into target.

## Snapshot + launch

1. `OLD=$(ls -1 ~/.afk-runs/ 2>/dev/null | sort | tail -1)`
2. Bash `run_in_background:true` — run from CURRENT cwd (= target repo), absolute path to bot:
   ```
   bun run /Users/rbaumier/www/kirby-bot/src/main.ts
   ```
   Keep `bash_id`. Confirm to user: `Targeting <repo from git remote>.`

## Detect new run-id

`Monitor` (load via `ToolSearch select:Monitor`):
```
until NEW=$(ls -1 ~/.afk-runs/ 2>/dev/null | sort | tail -1) && [ -n "$NEW" ] && [ "$NEW" != "OLD" ]; do sleep 2; done; echo "$NEW"
```
Timeout 30s. On timeout → `TaskOutput` on bash_id, surface `ProviderConfigError` or other startup error (bot exits before creating run dir if auth fails).

## Relay (Monitor)

```
tail -F ~/.afk-runs/<NEW>/run.jsonl | jq -rc '.'
```

JSONL keys: `at`, `event`, `from`, `to`, `elapsedMs`, `issue: {iid,title}|null`, `note?`.

| event | output (1 line) |
|---|---|
| `run_start` | `<repo> (default: <defaultBranch>).` |
| `transition` w/ issue | `#<iid> «<title>»: <from> → <to> (<elapsedMs/1000>s)<note ? " — "+note : "">.` |
| `transition` no issue (queue level) | `<from> → <to>.` |
| `transition to: "failed"` | same as above, always include `note`. |
| `transition to: "end"` | `→ END.` |
| `run_end` | `Done.` → stop monitor, exit. |
| `run_error` | `Error: <error>.` (`error` is single string) → stop, surface. |

One line per event. No recap.

## Stop (user asks)

1. `TaskStop` (load via `ToolSearch select:TaskStop`) ONLY on the monitor + bash_id you launched in THIS session. NEVER `TaskStop`/`kill`/`pgrep -k` a kirby process or run you didn't start here — other-repo runs are not yours to stop.
2. Warn: finalizers run (worktree cleanup, label restore).

## End recap

Count `done` transitions + `~/.afk-runs/<id>/` path. One line.

## Don't

- Don't read `tmux-*.log` — huge, floods context. User wants live → `tmux attach -t <session>` (name in `run.jsonl`).
- Don't restart on `run_error`.
