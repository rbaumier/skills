---
name: afk
description: Use when the user runs /afk to autonomously work through all open GitLab issues unattended, typically overnight or while away from the keyboard. Also use when the user says "AFK mode", "process issues while I'm gone", "tackle the backlog overnight", or wants sequential, full-code-review issue delivery before stepping away.
---

# AFK — Autonomous Issue Loop

You are running unattended. The user has left the keyboard, often gone to bed. They cannot rescue you mid-run. If you cut corners, the corners stay cut. Quality and discipline beat throughput.

## Announce at start

"I'm using the afk skill to process the GitLab backlog unattended. Sequential mode, full code-review-loop per issue."

## The four non-negotiables

1. **One issue at a time.** No parallel implementation across issues. Finish each one (implementation + review + MR opened) before touching the next.
2. **Full code-review-loop per issue.** Every issue runs the `code-review-loop` skill to its own convergence. No skipping agents. No early exit because the diff is small.
3. **Out-of-scope work becomes a new GitLab issue, not a side commit.** Anything you'd want to clean up that isn't required by the current issue gets filed. The new issue joins this cycle's queue.
4. **Stop only when every fetched issue is either terminal in state OR durably deferred.** Two kinds of outcomes count as final for the stop check: (a) a state-file entry whose status is `done`, `blocked`, or `failed`; (b) a record in `"$SKIP_FILE"` (either `existing-mr` covered externally, or `api-error` we couldn't verify). Issues that are `pending` or `in-progress` in state, or absent from both files, do not count. GitLab issues stay `opened` until the MR is merged the next morning, so do **not** use `glab issue list` emptiness as the stop signal. Use the state file and skip file together.

## Why each rule exists (rationalization table)

The user flagged these patterns explicitly. If any of these thoughts cross your mind, you are about to break the contract.

| Temptation | Reality |
|------------|---------|
| "Sequential is slow, let me run two issues in parallel" | Parallel writes to a shared repo create conflicts, double-edits, and test-suite races. The user explicitly asked for sequential. |
| "The diff is small, code-review-loop is overkill" | Small diffs hide subtle bugs. Convergence is the only reliable signal. Run the full loop. |
| "Some review agents won't find anything, let me skip them" | Skipping any agent breaks the convergence guarantee. `code-review-loop` already decides which agents apply. Don't second-guess. |
| "I noticed a refactor opportunity, let me sneak it in" | Scope creep. File an issue. It joins this cycle and gets its own MR. |
| "The queue keeps growing as I find things. Time to cap it" | The cycle is exhaustion-based. A growing queue is expected behaviour. Keep going. |
| "It's been many hours, time to wrap up" | Time isn't the stop condition. Terminal state for every queued item is. |
| "This issue is too vague, I'll just skip it" | Don't skip silently. Comment on the issue with the missing info, mark `blocked` in state, surface in the final report. |
| "The user is asleep, let me ask in chat anyway, they'll see it later" | No mid-flight prompts. Use issue comments and the final report. The conversation must stand on its own when they return. |
| "Tests are failing but probably unrelated, I'll open the MR anyway" | Failing tests block the MR. If you can't make them green, the issue is `failed`, no MR. Don't push bad green-looking state. |
| "The review loop hit the cap, the work is basically done" | Hitting the cap means non-convergence. Non-convergence means `failed`, no MR. The user will see the branch and the unresolved findings in the report. |
| "This issue is docs/config-only, code-review-loop doesn't apply" | code-review-loop has a "When not to use" clause and will exit on its own. Run it anyway. Don't pre-filter. |
| "These two issues touch the same area, one combined MR is cleaner" | One issue, one MR. If they truly belong together, the user would have merged them in the tracker. |
| "The branch is failed locally, no need to push it" | Push every branch you committed to. The user needs a remote artifact to inspect tomorrow. |
| "`glab` errored after the push, I'll move on and report later" | An MR not opened is an MR lost. Re-check, retry, log clearly. Don't silently drop side effects. |
| "The first 100 issues are handled, the queue is effectively empty" | Paginate. Read every page until GitLab returns an empty page. |
| "This stack is easier than fighting conflicts, I'll stack even though it's independent" | Stacking forces sequential review. Only stack when the code actually depends on parent commits. |

## Workflow

### Phase 0 — Sanity check and cycle setup

Detect the project's actual default branch and stamp the cycle date. These two values are used everywhere below; never hardcode `main`.

**Fatal-exit rule.** Any unrecoverable error in this phase (cannot determine default branch, `glab` not authenticated, no write access, etc.) must produce `afk-report-YYYY-MM-DD.md` at the repo root explaining what failed and why no cycle started, **before** exiting. The user must never wake up to a silent non-event.

**Define `write_fatal_report` before anything else** so every fatal exit can call it:

```bash
write_fatal_report() {
  local reason=$1
  local repo_root state_summary
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  # If a state file exists with prior work, surface it so the user knows the cycle wasn't a clean no-op.
  if [ -s "$STATE_FILE" ]; then
    if jq empty "$STATE_FILE" 2>/dev/null; then
      state_summary=$'\n\n## Prior work in this state file (may be incomplete)\n'$(jq -r '.[] | "- #\(.iid) — \(.title) — status: \(.status)"' "$STATE_FILE" 2>/dev/null || echo "- (state file present but unreadable)")
    else
      state_summary=$'\n\n## Prior state file is corrupt\nThe file at '"$STATE_FILE"' exists but is not parseable JSON. Inspect it manually to recover any in-flight work before re-running AFK.'
    fi
  else
    state_summary=$'\n\nNo prior state file was present. No issues were processed in this invocation.'
  fi
  cat > "$repo_root/afk-report-$(date +%Y-%m-%d).md" <<EOF
# AFK Cycle — $(date +%Y-%m-%d)

## Fatal abort

AFK could not proceed.

**Reason:** $reason
$state_summary
EOF
}
```

```bash
git fetch --prune
# 1. Local symbolic ref (set by `git clone` and `git remote set-head`).
DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
# 2. GitLab API — most reliable, knows the real default branch:
[ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(glab repo view --output json 2>/dev/null | jq -r '.default_branch // empty')
# 3. Local-name fallback for offline or odd setups:
[ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(git for-each-ref --format='%(refname:short)' refs/heads/main refs/heads/master refs/heads/develop refs/heads/trunk 2>/dev/null | head -1)
AFK_DATE=$(date +%Y-%m-%d)   # matches the report filename and is git-branch-safe

# Resolve durable per-cycle file paths via git (works in linked worktrees where .git is a file):
STATE_FILE=$(git rev-parse --git-path afk-state.json)
SKIP_FILE=$(git rev-parse --git-path afk-skip.json)   # deferrals (existing-mr, api-error); persists for resume + final report

# If any of these fail, write afk-report-YYYY-MM-DD.md first, then exit.
test -n "$DEFAULT_BRANCH" || { write_fatal_report "Cannot determine default branch"; exit 1; }
test -n "$STATE_FILE" || { write_fatal_report "Cannot resolve git dir for state file"; exit 1; }
glab auth status >/dev/null 2>&1 || { write_fatal_report "glab not authenticated"; exit 1; }
```

Treat `$DEFAULT_BRANCH` and `$AFK_DATE` as cycle-wide constants. Every reference to "main" below means `$DEFAULT_BRANCH`.

**Phase 0 step order matters.** The steps below must run in this order: (a) detect fresh-vs-resume, (b) dirty-tree handling, (c) only then create the `main` alias. The alias creates persistent state in the repo; never create it on a code path that aborts.

**Step a — Detect fresh start vs. resume.** A state file from a prior run can be in two states: interrupted (has at least one `pending` or `in-progress` entry) or completed (all entries terminal). Only an interrupted state file should resume.

```bash
# If no state but an orphan skip exists, archive it BEFORE validation — a corrupt orphan
# shouldn't fatal the run; we just move it aside.
if [ ! -s "$STATE_FILE" ] && [ -s "$SKIP_FILE" ]; then
  ARCHIVE_DIR=$(git rev-parse --git-path afk-archive)
  mkdir -p "$ARCHIVE_DIR"
  mv "$SKIP_FILE" "$ARCHIVE_DIR/skip-orphaned-$(date +%Y%m%d-%H%M%S).json"
fi

# Validate both per-cycle files; corruption while STATE_FILE exists is fatal — the user must investigate.
# Shape check: both files MUST be a JSON array of objects. Scalars/arrays-of-strings/bare objects all fail.
for f in "$STATE_FILE" "$SKIP_FILE"; do
  if [ -s "$f" ]; then
    if ! jq empty "$f" 2>/dev/null; then
      write_fatal_report "File $f is corrupt (invalid JSON). AFK will not proceed."
      exit 1
    fi
    if [ "$(jq -r 'type' "$f")" != "array" ]; then
      write_fatal_report "File $f is not a JSON array (the only allowed top-level shape). AFK will not proceed."
      exit 1
    fi
    if [ "$(jq -r '[.[] | type] | unique | join(",")' "$f")" != "object" ] && [ "$(jq 'length' "$f")" != "0" ]; then
      write_fatal_report "File $f contains non-object elements. Every entry must be an object."
      exit 1
    fi
  fi
done

# Validate that every status value in $STATE_FILE is from the allowed set, AND that required
# scalar fields are present with the right shape. Later logic assumes iid is a number and title is
# a string; later GitLab calls and final report rendering both depend on these.
if [ -s "$STATE_FILE" ]; then
  BAD=$(jq -r '[.[] | (if (.status | type) == "string" then .status else "<not-a-string>" end) | select(. != "pending" and . != "in-progress" and . != "done" and . != "blocked" and . != "failed")] | unique | join(",")' "$STATE_FILE")
  if [ -n "$BAD" ]; then
    write_fatal_report "State file contains unknown status values: $BAD. The allowed set is pending|in-progress|done|blocked|failed."
    exit 1
  fi
  # Full shape check: required (iid, title) + every other field must be the right type-or-null,
  # plus cross-field invariants and a closed-key set (no extras, no typos).
  BAD_SHAPE=$(jq -r '
    def isNullOrNonEmptyStr: . == null or (type == "string" and length > 0);
    def isNumOk: . == null or type == "number";
    def isIidOk: . == null or (type == "number" and . == (. | floor) and . >= 1);
    def isStrArrOk: . == null or (type == "array" and (all(type == "string")));
    def isBoolOk: . == null or type == "boolean";
    def allowedKeys: ["iid","title","status","branch","parent_branch","parent_mr","mr_url","touched_files","review_iterations","loop_report_path","pushed_at_sha","created_during_cycle","discovered_from_issue","notes"];
    [.[]
      | select(
          (.iid | type) != "number" or .iid != (.iid | floor) or .iid < 1
          or (.title | type) != "string" or (.title | length) == 0
          or (.touched_files != null and ((.touched_files | type) == "array") and (.touched_files | any(. == "")))
          or (.branch | isNullOrNonEmptyStr | not)
          or (.parent_branch | isNullOrNonEmptyStr | not)
          or (.parent_mr | isIidOk | not)
          or (.mr_url | isNullOrNonEmptyStr | not)
          or (.pushed_at_sha | isNullOrNonEmptyStr | not)
          or (.review_iterations | isNumOk | not)
          or (.touched_files | isStrArrOk | not)
          or (.loop_report_path | isNullOrNonEmptyStr | not)
          or (.created_during_cycle | isBoolOk | not)
          or (.discovered_from_issue | isIidOk | not)
          or (.notes | (. == null or type == "string") | not)
          or (.status == "done" and ((.mr_url | type) != "string" or (.mr_url | length) == 0))
          or (.created_during_cycle == true and .discovered_from_issue == null)
          or ((.created_during_cycle != true) and .discovered_from_issue != null)
          or ((keys - allowedKeys) | length > 0)
        )
      | (.iid // "<missing>") | tostring]
    | join(",")
  ' "$STATE_FILE")
  if [ -n "$BAD_SHAPE" ]; then
    write_fatal_report "State file has entries with wrong field types, unknown keys, an empty-string field where null was expected, a 'done' entry without an mr_url, or a 'created_during_cycle:true' entry without 'discovered_from_issue'. Offending iids: $BAD_SHAPE."
    exit 1
  fi
fi

# Validate SKIP_FILE reason enum and required fields. Stale or corrupted reasons would mis-filter
# the queue; an existing-mr record with null mr_url would render as "covered by null" in Phase 7.
if [ -s "$SKIP_FILE" ]; then
  BAD_SKIP=$(jq -r '[.[] | (if (.reason | type) == "string" then .reason else "<not-a-string>" end) | select(. != "existing-mr" and . != "api-error")] | unique | join(",")' "$SKIP_FILE")
  if [ -n "$BAD_SKIP" ]; then
    write_fatal_report "Skip file contains unknown reason values: $BAD_SKIP. The allowed set is existing-mr|api-error."
    exit 1
  fi
  # existing-mr records MUST carry a non-empty STRING mr_url. Arrays/objects/numbers/null all fail.
  BAD_URL=$(jq -r '[.[] | select(.reason == "existing-mr" and ((.mr_url | type) != "string" or (.mr_url | length) == 0)) | .iid] | join(",")' "$SKIP_FILE")
  if [ -n "$BAD_URL" ]; then
    write_fatal_report "Skip file has existing-mr records without a valid string mr_url (iids: $BAD_URL). Inspect and correct."
    exit 1
  fi
  # Full skip-record shape: closed keys, non-empty title, iid positive int, api-error has null mr_url.
  BAD_FIELDS=$(jq -r '
    def allowedSkipKeys: ["iid","title","reason","mr_url"];
    [.[]
      | select(
          (.iid | type) != "number" or .iid != (.iid | floor) or .iid < 1
          or (.title | type) != "string" or (.title | length) == 0
          or (.reason == "api-error" and .mr_url != null)
          or ((keys - allowedSkipKeys) | length > 0)
        )
      | (.iid // "<missing>") | tostring]
    | join(",")
  ' "$SKIP_FILE")
  if [ -n "$BAD_FIELDS" ]; then
    write_fatal_report "Skip file has records with invalid iid/title, unknown keys, or an 'api-error' record with a non-null mr_url. Offending iids: $BAD_FIELDS."
    exit 1
  fi
fi

RESUME=0
if [ -s "$STATE_FILE" ]; then
  NONTERMINAL=$(jq '[.[] | select(.status == "pending" or .status == "in-progress")] | length' "$STATE_FILE")
  if [ "$NONTERMINAL" -gt 0 ]; then
    RESUME=1
  else
    # Old completed cycle. Archive both state AND skip together so the new run starts clean.
    ARCHIVE_DIR=$(git rev-parse --git-path afk-archive)
    mkdir -p "$ARCHIVE_DIR"
    STAMP=$(date +%Y%m%d-%H%M%S)
    mv "$STATE_FILE" "$ARCHIVE_DIR/state-$STAMP.json"
    [ -s "$SKIP_FILE" ] && mv "$SKIP_FILE" "$ARCHIVE_DIR/skip-$STAMP.json"
  fi
fi

```

After this block: `RESUME=1` means we're picking up an actually-interrupted cycle. `RESUME=0` means fresh — either no prior file, or the prior was completed and has been archived.

**Step b — Dirty-tree handling.**

- *Fresh start (`RESUME=0`).* If `git status --porcelain` shows any output, the working tree is dirty. The user did not authorize overwriting uncommitted changes. Do not create a state file. Do not create the `main` alias. Write `afk-report-YYYY-MM-DD.md` at the repo root explaining the cycle did not start, list the dirty files, exit.
- *Resume (`RESUME=1`).* A state file exists from a prior interrupted run. Do **not** abort on a dirty tree at startup; Phase 2's per-item working-tree check classifies whether the residue is legitimate WIP for the resumed item or stray garbage. Proceed to Step c.

**Step c — code-review-loop alignment (only reached if Step b passed).** `code-review-loop`'s prompt templates hardcode `git diff main...HEAD`. If `$DEFAULT_BRANCH != "main"`, those diffs will be wrong. To make `code-review-loop` work without modifying it, ensure a local `main` ref exists pointing at the right place for the duration of the cycle. Because we only reach this step after Step b passed, the alias is created only on paths that will actually run a cycle — no leftover alias from aborted fresh starts.

```bash
ALIAS_MARKER=$(git rev-parse --git-path afk-main-alias)

if [ "$DEFAULT_BRANCH" != "main" ]; then
  if git show-ref --verify --quiet refs/heads/main; then
    if [ -f "$ALIAS_MARKER" ]; then
      # Existing 'main' is an AFK alias left by a prior crashed run. Adopt and refresh it.
      git update-ref refs/heads/main "refs/remotes/origin/$DEFAULT_BRANCH"
      AFK_CREATED_MAIN_ALIAS=1
    else
      write_fatal_report "Local 'main' branch exists, project default is $DEFAULT_BRANCH, and no AFK alias marker is present. AFK refuses to overwrite a real local branch. Rename or delete local 'main' before running."
      exit 1
    fi
  else
    git branch main "origin/$DEFAULT_BRANCH"
    : > "$ALIAS_MARKER"   # marker proves the alias is ours
    AFK_CREATED_MAIN_ALIAS=1
  fi
fi

# Register exit-trap to remove the alias on EVERY exit path from this point on.
cleanup_main_alias() {
  if [ "$AFK_CREATED_MAIN_ALIAS" = "1" ]; then
    git branch -D main 2>/dev/null
    rm -f "$ALIAS_MARKER"
  fi
}
trap cleanup_main_alias EXIT
```

**Define the GitLab and skip helpers now** (they're used in Phase 1, 2, and 6; defining them in Phase 0 means they exist on both fresh starts and resumes):

```bash
# Returns the JSON array of OPEN MRs related to the issue, or the literal "ERROR" on API failure.
fetch_open_mrs_for_issue() {
  local iid=$1
  local raw filtered
  raw=$(glab api "projects/:id/issues/$iid/related_merge_requests" 2>/dev/null)
  [ -z "$raw" ] && { echo "ERROR"; return; }
  filtered=$(printf '%s' "$raw" | jq '[.[] | select(.state == "opened")]' 2>/dev/null)
  [ -z "$filtered" ] && { echo "ERROR"; return; }
  printf '%s' "$filtered"
}

# Ensure SKIP_FILE exists as a valid empty array if not already initialized.
[ -s "$SKIP_FILE" ] || printf '[]' > "$SKIP_FILE"

upsert_skip() { # $1=iid, $2=title, $3=reason, $4=mr_url-or-empty
  jq --argjson iid "$1" --arg title "$2" --arg reason "$3" --arg url "$4" \
     '[ .[] | select(.iid != $iid) ] + [{iid: $iid, title: $title, reason: $reason, mr_url: (if $url == "" then null else $url end)}]' \
     "$SKIP_FILE" > "$SKIP_FILE".tmp && mv "$SKIP_FILE".tmp "$SKIP_FILE"
}

remove_skip() { # $1=iid
  jq --argjson iid "$1" '[ .[] | select(.iid != $iid) ]' \
     "$SKIP_FILE" > "$SKIP_FILE".tmp && mv "$SKIP_FILE".tmp "$SKIP_FILE"
}
```

**Keep the alias fresh during the cycle.** Every time you `git pull` the default branch (Phase 2 independent branching, or after a remote-conflict rebase), advance the alias too — **only when AFK actually created the alias** (`AFK_CREATED_MAIN_ALIAS=1`). When the project's default branch is `main`, there is no alias and `update-ref` would clobber a real local branch:

```bash
git fetch origin "$DEFAULT_BRANCH"
if [ "$AFK_CREATED_MAIN_ALIAS" = "1" ]; then
  git update-ref refs/heads/main "refs/remotes/origin/$DEFAULT_BRANCH"
fi
```

On resume (`RESUME=1`), the trap is re-registered fresh on the new process. The previous run's alias may still exist; that's fine, the trap will remove it at this run's exit.

### Phase 1 — Build and prioritize the queue

**Fetch all open issues, paginating until GitLab returns an empty page.** Aggregate into one well-formed JSON array using `jq -s '[.[][]]'`, never `>>` two arrays together (that produces invalid JSON):

```bash
page=1
tmpdir=$(mktemp -d)
while :; do
  # glab 1.80+ defaults to opened and does not accept `--state opened`; rely on the default.
  batch=$(glab issue list --per-page 100 --page "$page" --output json 2>/dev/null)
  # Distinguish API failure from end-of-results: a valid empty page is "[]",
  # but a network or auth failure typically yields empty string or non-JSON.
  if [ -z "$batch" ] || ! printf '%s' "$batch" | jq empty 2>/dev/null; then
    write_fatal_report "glab issue list failed on page $page (network or auth). No cycle started."
    exit 1
  fi
  count=$(printf '%s' "$batch" | jq 'length')
  [ "$count" -eq 0 ] && break
  printf '%s' "$batch" > "$tmpdir/page-$page.json"
  page=$((page+1))
done
# Handle empty backlog without an unmatched glob:
if compgen -G "$tmpdir/page-*.json" > /dev/null; then
  jq -s '[.[][]]' "$tmpdir"/page-*.json > /tmp/afk-queue.json
else
  printf '[]' > /tmp/afk-queue.json
fi
```

**Filter out issues that already have an open MR.** A prior AFK cycle (or a human) may have already produced an MR for an issue that's still open because nobody has merged it. Skipping these prevents duplicate branches and MRs.

Use GitLab's native issue–MR linkage rather than text-searching for `Closes #N`. The `related_merge_requests` endpoint catches every closing keyword (`Closes`, `Fixes`, `Resolves`, plural forms, English/French variants) AND manual UI-level links — text search misses these and is also prone to substring false positives:

The helper `fetch_open_mrs_for_issue` is defined in Phase 0. Iterate the queue and write deferrals as **JSON records** (not bare iids) so Phase 7 can render the MR URL or the error reason. `"$SKIP_FILE"` lives in the git dir so it survives a crash/restart alongside `$STATE_FILE`.

```bash
# Helpers (fetch_open_mrs_for_issue, upsert_skip, remove_skip) are defined in Phase 0.

jq -c '.[]' /tmp/afk-queue.json | while IFS= read -r row; do   # -r preserves backslashes in titles (e.g., backticks/markdown)
  iid=$(printf '%s' "$row" | jq '.iid')
  title=$(printf '%s' "$row" | jq -r '.title')
  result=$(fetch_open_mrs_for_issue "$iid")
  if [ "$result" = "ERROR" ]; then
    upsert_skip "$iid" "$title" "api-error" ""
  elif [ "$(printf '%s' "$result" | jq 'length')" -gt 0 ]; then
    # Use `// empty` so a missing/null web_url produces no output instead of the literal "null".
    url=$(printf '%s' "$result" | jq -r '.[0].web_url // empty')
    if [ -z "$url" ]; then
      # GitLab returned an MR but no usable URL. Treat as an API anomaly: defer as api-error.
      upsert_skip "$iid" "$title" "api-error" ""
    else
      upsert_skip "$iid" "$title" "existing-mr" "$url"
    fi
  fi
done

jq --slurpfile skip "$SKIP_FILE" \
   '[ .[] | select( ((.iid) as $i | $skip[0] | map(.iid) | index($i)) | not ) ]' \
   /tmp/afk-queue.json > /tmp/afk-queue.filtered.json
mv /tmp/afk-queue.filtered.json /tmp/afk-queue.json
```

Reuse `fetch_open_mrs_for_issue` in Phase 2's pre-pick recheck and Phase 6's append step. Do not text-search MRs. Every caller must handle three outcomes distinctly: zero MRs → process, one-or-more MRs → defer with the MR URL captured, ERROR → defer with a "could not verify" note so the user sees it in the final report.

**Reporting Phase 1 deferrals.** Phase 7 reads `"$SKIP_FILE"` to render:
- each `existing-mr` entry with its `mr_url`
- each `api-error` entry as a "could not verify" line, prominently flagged

**Initialize the state file as empty NOW**, before the terminal-shortcut check below. This guarantees Phase 7 always finds a readable state file, even on the Nothing-to-do path:

```bash
printf '[]' > "$STATE_FILE"
```

The post-filter loop in the schema section below appends to this initially-empty file. On a resumed run (`RESUME=1`) Phase 1 doesn't run at all, so this init only happens on fresh starts.

**Phase 1 terminal-shortcut rule.** If the filtered queue is empty:

```bash
queue_empty=$( [ "$(jq 'length' /tmp/afk-queue.json)" -eq 0 ] && echo 1 || echo 0 )
skip_has_errors=$(jq '[.[] | select(.reason == "api-error")] | length' "$SKIP_FILE")
```

- `queue_empty=1` AND `skip_has_errors=0` AND `$(jq 'length' "$SKIP_FILE") == 0` → genuinely nothing to do. Write `"Nothing to do."` in the report and go to Phase 7.
- `queue_empty=1` AND `skip_has_errors>0` → API outage took the queue down. Write a report headed "API errors prevented this cycle" listing each failed iid; do NOT write "Nothing to do."
- `queue_empty=1` AND only `existing-mr` skips (no errors) → write "All open issues already have MRs", list them with URLs.
- `queue_empty=0` → proceed to ordering.

Decide the order yourself. Reasonable heuristics:
- Bugs and regressions before features
- Issues that unblock others first (read links and references in descriptions)
- Smaller, clearly-scoped issues before vague ones
- Issues touching unrelated areas earlier (reduces conflict risk later in the cycle)

**State file: `$STATE_FILE`** (inside the local `.git/` directory, never tracked, persists across restarts of this run). It is the source of truth, not the GitLab UI. **One entry per issue** with exactly these fields:

- `iid` — issue iid (matches GitLab's terminology and what `fetch_open_mrs_for_issue` expects)
- `title` — issue title
- `status` — one of: `pending` | `in-progress` | `done` | `blocked` | `failed`. No other values. Ever.
- `branch` — branch name once created
- `parent_branch` — name of the parent cycle branch if stacked, else `null`
- `parent_mr` — parent cycle MR iid if stacked, else `null`
- `mr_url` — once opened
- `touched_files` — array of paths, filled in after implementation
- `review_iterations` — once code-review-loop runs
- `loop_report_path` — path to the code-review-loop HTML report, if any
- `pushed_at_sha` — local commit SHA at the time `git push` succeeded; `null` if never pushed
- `created_during_cycle` — boolean, `true` if filed via Phase 3, else `false`
- `discovered_from_issue` — iid of the parent issue if `created_during_cycle`, else `null`
- `notes` — short free-text, e.g., reason for `blocked` or `failed`, or last command stderr on partial failure

**Populate the state file (fresh start, `RESUME=0`).** `$STATE_FILE` was already initialized to `[]` above (before the terminal-shortcut). Now, for every issue remaining in `/tmp/afk-queue.json` (post-filter), append a state entry with `status: "pending"`, `created_during_cycle: false`, all other dynamic fields `null` or empty. After this step, `$STATE_FILE` has exactly one `pending` entry per fetched-and-not-deferred issue, in the order you decided.

**On resume (`RESUME=1`), do not run Phase 1 at all.** The state file is the queue. Phase 6 will reconcile any new GitLab issues filed since the interruption.

Write the file immediately after every external side effect (`git push`, `glab issue create`, `glab mr create`) and after every status transition. Treat it as the source of truth, not the GitLab UI.

### Phase 2 — Pick the next issue and decide branching

**Pick the next item first.** Read `$STATE_FILE`. Select the first entry whose status is `pending` **or** `in-progress`, in file order.

**Pre-pick MR recheck — run only when AFK has no local or remote artifact for this entry.** Specifically: run the recheck if the entry is `pending`, or if the entry is `in-progress` AND `branch` is null (Phase 2 branching never completed — there is nothing of AFK's own to confuse with an external MR). In any other state — branch created locally, commits made, or pushed — **skip** the recheck. The risk of losing local AFK work to a transient API error outweighs the rare race of a human opening an MR mid-implementation. Phase 5's idempotence handles AFK's own remote artifacts.

**For entries that have a `branch` but `pushed_at_sha` is null**, the push may have succeeded with the state write lost to a crash. Resume must check the remote to recover the true push status before continuing into Phase 5. Run `git ls-remote --heads origin <branch>`; if the remote SHA matches `git rev-parse <branch>`, treat the branch as pushed and update `pushed_at_sha` in state from `git rev-parse <branch>` before routing to Phase 5.

For runnable entries (pending or fully-empty in-progress), catch MRs opened by humans while you were running and move the issue out of state into `"$SKIP_FILE"` — same deferral model as Phase 1/6:

```bash
# Run only when (status == "pending") OR (status == "in-progress" AND branch is null):
iid=$(jq -r '.iid' <<<"$entry")
title=$(jq -r '.title' <<<"$entry")

remove_from_state() {
  jq --argjson iid "$1" '[ .[] | select(.iid != $iid) ]' \
     "$STATE_FILE" > "$STATE_FILE".tmp && mv "$STATE_FILE".tmp "$STATE_FILE"
}

result=$(fetch_open_mrs_for_issue "$iid")
if [ "$result" = "ERROR" ]; then
  upsert_skip "$iid" "$title" "api-error" ""
  remove_from_state "$iid"
  pick_next
elif [ "$(printf '%s' "$result" | jq 'length')" -gt 0 ]; then
  url=$(printf '%s' "$result" | jq -r '.[0].web_url // empty')
  if [ -z "$url" ]; then
    upsert_skip "$iid" "$title" "api-error" ""
  else
    upsert_skip "$iid" "$title" "existing-mr" "$url"
  fi
  remove_from_state "$iid"
  pick_next
else
  # zero MRs → process normally. Also clear any stale skip record from a prior crashed iteration
  # (e.g., a transient api-error that has since resolved), so the final report doesn't show
  # this issue as both processed and deferred.
  remove_skip "$iid"
fi
```

`remove_from_state` writes immediately, so a crash between `upsert_skip` and `remove_from_state` leaves the entry in both files; the next loop will see it in state, recheck, and the upsert is idempotent. The cycle continues either way. Do not block on a single API error.

**Crash-recovery reconciliation BEFORE routing a resumed in-progress item.** When picking a resumed `in-progress` item that has already reached at least Phase 3 (i.e., `branch` is set), run the Phase 6 reconciliation pass FIRST — refetch open issues, ingest any that match the `Discovered while working on #<this-iid>` marker and are not yet in state. This prevents Phase 3 (when it resumes implementation) from rediscovering the same out-of-scope finding and calling `glab issue create` again, which would produce a duplicate GitLab issue.

- A `pending` item is fresh work — proceed normally and mark it `in-progress` once the working-tree check (below) passes.
- An `in-progress` item is a resumed item (this skill was interrupted mid-issue). It already has a `branch` (or doesn't, see below). Routing rule:
  - `branch` is null → resume at Phase 2 branching (this section).
  - `branch` exists locally but no commits past base → resume at Phase 3 (implementation).
  - branch has commits, `review_iterations` is null → resume at Phase 4 (review loop).
  - `review_iterations` is set, `mr_url` is null → resume at Phase 5 (push + MR). Phase 5's idempotence check handles the rest.
  - `mr_url` is non-null but status is still `in-progress` → MR was created but the `done` transition was lost. Mark `done` immediately and go to Phase 6; no Phase 5 rerun needed.

**Working-tree check and forced checkout.**

```bash
git status --porcelain
CUR=$(git rev-parse --abbrev-ref HEAD)
```

- **Picking a fresh `pending` item.** Tree must be empty. Any dirty content is residue from the previous issue → go to the **Abort routine** in Failure handling. Do not pile new work on top.
- **Resuming an `in-progress` item with a non-null `branch`.** You must be on that branch before resuming. Behaviour:
  - If `CUR == item.branch` and tree is clean → resume directly.
  - If `CUR == item.branch` and tree is dirty → that's the user's WIP from the interrupted implementation; resume at Phase 3 (implementation) and finish committing.
  - If `CUR != item.branch` and tree is clean → `git checkout <item.branch>` and proceed.
  - If `CUR != item.branch` and tree is dirty → the dirty content does not belong to this item → go to the **Abort routine**. Do not checkout away from work you don't understand.
- **Resuming an `in-progress` item with a null `branch`.** Tree must be clean (no implementation has started). If dirty → Abort routine.

Subsequent phases assume you are on the item's branch. If you cannot reach that state, do not proceed.

**Dependency check (pre-implementation).** Issue descriptions rarely list all the files actually touched, so don't decide stacked vs independent from text alone. Do real exploration:

1. Read the issue body, comments, and linked issues. Note any explicit file paths, route names, table names, type/contract names.
2. Use the project's search to map each named symbol to its current files: e.g., `rg -l 'SymbolName'`, `rg -l 'route_name'`.
3. List the `touched_files` of every `done` cycle entry from the state file.
4. Compute overlap between (probable files from steps 1–2) and (touched_files from step 3).

- **No overlap** → branch from `$DEFAULT_BRANCH`. Independently reviewable.
- **Likely overlap** OR the issue clearly builds on code that only exists on a cycle branch → branch from that cycle branch. Record `parent_branch` and `parent_mr` in state.

When in doubt, prefer **independent**. Stacking forces sequential review and amplifies code-review-loop noise. A real post-implementation re-check happens at the end of Phase 4 — if you guessed wrong, that's where you correct.

```bash
# Independent
git checkout "$DEFAULT_BRANCH" && git pull
git checkout -b <branch-name>

# Stacked
git fetch origin <parent-cycle-branch>
git checkout <parent-cycle-branch>
git checkout -b <branch-name>
```

**Branch naming.** Follow the project's convention (look at recent MRs: `glab mr list --per-page 10`). Append a cycle marker to keep this run idempotent and avoid collision with branches from earlier runs: `<project-pattern>-afk-$AFK_DATE`. Example: `feat/42-cleanup-afk-20260513`. Record the final name in `branch`.

### Phase 3 — Implement

Implement the issue. Follow whatever process the project's CLAUDE.md mandates (TDD if `matt-tdd` is in use, etc.). Commit incrementally with clear messages.

**Anything you want to do that isn't required by the issue → file a new issue, don't commit it.** Examples that must become new issues, not stowaway commits:

- Unrelated refactor opportunity
- Dead code you spotted
- Bug in adjacent code that isn't blocking this issue
- Missing tests for code outside this issue's scope
- Outdated docs in a neighbouring file

To file:

```bash
glab issue create --title "<concise title>" --description "$(cat <<'EOF'
Discovered while working on #<current-issue-id>.

<what the problem is>
<why it matters>
<rough scope, if obvious>
EOF
)"
```

Append the new issue to `$STATE_FILE` as `pending` with `created_during_cycle: true` and `discovered_from_issue: <current-issue-iid>`. **Do this in the same logical step as the `glab issue create` call** — write the entry immediately after the command returns, before any other work.

**Crash-recovery for the race.** If the agent dies between `glab issue create` succeeding and the state write, Phase 6's refetch will re-discover the issue. To recover the cycle context: in Phase 6, when ingesting a refetched issue whose description starts with the literal string `Discovered while working on #` (the template above), set `created_during_cycle: true` and parse the parent iid from that first line into `discovered_from_issue`. This makes the marker self-describing so the final report stays correct.

### Phase 4 — Run code-review-loop in full

Invoke the `code-review-loop` skill. Run it to convergence as it defines convergence (every spawned agent returns "No findings.").

Do not:
- Pass a reduced agent list
- Stop early because the loop is on iteration N and "looks fine"
- Substitute your own quick review for the loop

**Hard cap: 8 iterations.** If the loop does not converge after 8 iterations, the issue is `failed`. Do **not** open an MR. Push the branch, log the unresolved findings into `notes`, and move on. (Treatment in Failure handling below.)

**Convergence — single rule, no exceptions.** Convergence is whatever `code-review-loop` itself defines: an iteration where every spawned agent returns exactly the string `No findings.`. Nothing else counts as converged. In particular: a fix being applied does **not** count as resolution — only the agents' verdict on the *next* iteration, on the post-fix code, does.

**Stacked-branch consequence.** Because `code-review-loop` diffs against `$DEFAULT_BRANCH`, agents on a stacked branch may keep flagging code introduced by the parent MR. This can prevent convergence even when the child issue is fine. We do **not** introduce a special parent-territory shortcut — it would be a loophole. Instead, this is the explicit failure mode:

- If the loop converges within 8 iterations → proceed.
- If it doesn't, the issue hits the cap and becomes `failed`. Push the branch, write a note explaining the suspected cause (stacked-branch noise) and the unresolved findings, and move on. The user reviews in the morning and may choose to merge the parent first, then re-run the child without the stack.

**Stacked-branch notice for the reviewer.** The Phase 5 MR description (when stacked and the loop did converge) must tell the reviewer to focus on commits after the parent tip and acknowledge that some findings may overlap with `!<parent-mr>`.

**Post-convergence verification (independent of code-review-loop).** code-review-loop runs tests inside its own Step 3, but a final loop iteration's fix may not be tested. After convergence, explicitly re-run the project's full test suite. If anything fails, that's a regression: re-enter Phase 3 to fix, then re-run code-review-loop (counts toward the 8-iteration cap). If a single re-fix round still leaves tests red → `failed` per Failure handling.

**Post-implementation dependency re-check.** Compute the real diff now:

```bash
git diff --name-only "$BASE"...HEAD   # $BASE = $DEFAULT_BRANCH or parent_branch
```

Compare with every `done` cycle entry's `touched_files`. If you branched as **independent** but actual overlap with a `done` MR is now significant, do **not** silently ship it as independent — instead, note this in the MR's "Review notes" section as a flagged dependency for the reviewer, and record the overlap in `notes`. (Do not rebase mid-cycle: rebasing unattended is too risky.)

Record into state for the current issue:
- `review_iterations`: how many iterations the loop ran
- `touched_files`: `git diff --name-only $BASE...HEAD` — this issue's files only
- `loop_report_path`: path to the loop's HTML report, if produced

### Phase 5 — Open the MR

Before pushing and creating the MR, check the remote state — you may be resuming after a partial failure. Verify the remote actually points at **our** commits before adopting it:

```bash
REMOTE_SHA=$(git ls-remote --heads origin <branch-name> | awk '{print $1}')
LOCAL_SHA=$(git rev-parse HEAD)
EXISTING_MR=$(glab mr list --source-branch <branch-name> --output json | jq '[.[] | select(.state == "opened")] | length')
```

- `REMOTE_SHA` empty → not pushed yet. Push, then `glab mr create`.
- `REMOTE_SHA == LOCAL_SHA` and `EXISTING_MR > 0` → already shipped on this run. Read the MR URL into state, mark `done`, go to Phase 6.
- `REMOTE_SHA == LOCAL_SHA` and `EXISTING_MR == 0` → branch pushed, MR creation failed earlier. Skip push, retry `glab mr create` only.
- `REMOTE_SHA != LOCAL_SHA` (non-empty) → collision with a stale branch from another run. Do **not** push over it. Mark `failed`, `notes: "branch name collision with stale remote at <REMOTE_SHA>; AFK does not auto-rename — user should rename and re-queue"`, and move on. The cycle-date suffix from Phase 2 should prevent this; if it still happens, something is wrong with the naming convention and the user resolves it in the morning.

**Canonical push + MR sequence.** Push first, record `pushed_at_sha` to state immediately, only then call `glab mr create`. This is the single source of truth for the order — do not collapse it back into a one-shot snippet:

```bash
git push -u origin <branch-name>
# record pushed_at_sha to state for this entry RIGHT NOW (before glab mr create):
PUSHED_SHA=$(git rev-parse HEAD)
# update state entry: pushed_at_sha = $PUSHED_SHA

glab mr create --title "<title>" --description "$(cat <<'EOF'
## Summary
<2-3 bullets>

Closes #<issue-id>

## Decisions & choices

Document every non-trivial decision made during implementation. The user reads this after the fact and may want to revisit.

**The most important ones to document are decisions about specs or behaviour** — anywhere the issue was ambiguous and you had to pick an interpretation of *what the system should do*. The user can disagree with these and want them reverted. Surface them first.

For each decision: what you chose, what the alternatives were, why you picked this one. Be explicit about the ones you're least sure about.

- **<spec / behaviour decision>** (most important): the issue was ambiguous about <X>. Chose <interpretation A> over <interpretation B>. Reason: <why>. Reversible by: <how the user can flip it if they disagree>.
- **<library / dependency>**: <added | reused existing>. Reason: <why>.
- **<naming / API shape>**: <choice>. Alternatives considered: <list>.
- **<test strategy>**: <unit | integration | both>. Reason: <why>.

## Out-of-scope issues filed

List every new issue you opened while working on this MR (per Phase 3). The user needs to see this in context — these came from the work that produced this MR.

- #<new-id> — <title> — <one-line description of what was out of scope>
- #<new-id> — <title> — <one-line description>

If none: "None."

## Review notes
- <Independent of other cycle MRs> OR <Stacks on !<parent-mr>; review !<parent-mr> first. Focus review on commits after the parent tip — code-review-loop's diff vs main may surface findings already addressed in !<parent-mr>.>
- code-review-loop converged in <N> iteration(s)
EOF
)"
```

**Why `pushed_at_sha` is recorded between the push and the `glab mr create`** (rather than after the MR is created): if a crash happens between push and MR creation, Phase 2's pre-pick recheck must know AFK already pushed this branch, so it doesn't misclassify AFK's own pending push as an external MR-less issue.

If the MR stacks on a cycle branch, set the target branch with `--target-branch <parent-cycle-branch>`. Capture the MR URL into `$STATE_FILE` **immediately** after `glab mr create` succeeds. Mark the issue `done`.

Do not merge. Do not push to `$DEFAULT_BRANCH` or any protected branch.

### Phase 6 — Loop

Re-fetch open issues (paginated as in Phase 1, with `jq -s`). **Phase 6 must not use `write_fatal_report` on API failure** — that helper is for "no cycle started" cases. By the time Phase 6 runs, there's processed work in state and `$SKIP_FILE`; the user needs a proper Phase 7 report.

**If the paginated fetch fails here, the response depends on whether this Phase 6 call is end-of-cycle or pre-routing reconciliation:**

- **End-of-cycle Phase 6 (the loop's main "refresh before deciding stop" call).** Terminalize every state entry still `pending` or `in-progress` as `failed` with `notes: "Phase 6 refetch failed — cycle ended early; this issue was not processed"`. Push any branch that has commits before terminalizing it, recording `pushed_at_sha`. Then jump straight to Phase 7. Do not exit before Phase 7.
- **Pre-routing reconciliation (called from Phase 2 before resuming an in-progress item).** This is best-effort. Skip the reconciliation, write `notes: "Phase 6 pre-routing reconciliation failed; resuming without it"` on the current entry, and proceed with the resume. Do **not** terminalize the in-progress item — its local work must not be lost.

If the fetch succeeds, for every issue iid not already in `$STATE_FILE`:

1. **Apply the same open-MR filter as Phase 1, idempotently.** Call `fetch_open_mrs_for_issue`.
   - **Empty array** → if the iid was previously in `"$SKIP_FILE"` (e.g., past `api-error`), call `remove_skip "$iid"` first so the final report reflects the new reality. Then proceed to step 2.
   - **Non-empty array** → extract the MR URL with `url=$(printf '%s' "$result" | jq -r '.[0].web_url // empty')`. If `url` is empty (GitLab returned an MR with no usable `web_url`), call `upsert_skip "$iid" "$title" "api-error" ""` instead — never store a null/empty URL as `existing-mr`. Otherwise `upsert_skip "$iid" "$title" "existing-mr" "$url"`. Do **not** add to state. Upsert replaces any prior record for this iid.
   - **`ERROR`** → `upsert_skip "$iid" "$title" "api-error" ""`. Do **not** add to state. (This branch only runs for issues not yet in state, so there is nothing else to reconcile.)

   The "every fetched issue ends terminal" invariant applies to state entries (issues AFK decided to process). Deferrals in `"$SKIP_FILE"` are not state entries; they're reported separately in Phase 7. Upsert + remove keep deferrals in sync across Phase 6 iterations.

2. **Construct the `pending` state entry** (only reached for the empty-array case above). Before defaulting `created_during_cycle` to `false`, inspect the description: if the first line matches the Phase 3 marker (literal prefix `Discovered while working on #`), this is a Phase 3 issue whose state write was lost to a crash. Set `created_during_cycle: true` and parse the parent iid from that first line into `discovered_from_issue`. Otherwise default to `false`.

This recovers cycle context for crash-lost Phase 3 issues and prevents requeuing of issues already covered by an MR. Phase 7 reads both the state file (AFK's processed work) and `"$SKIP_FILE"` (deferrals) for a complete picture.

The stop signal is the **state file**, not the GitLab query:

- Any entry is `pending` → go to Phase 2.
- Any entry is `in-progress` → go to Phase 2 (resume; Phase 2 routes to the correct phase based on the entry's recorded progress).
- Every entry is `done`, `blocked`, or `failed` → go to Phase 7.

### Phase 7 — Final report

Write `afk-report-YYYY-MM-DD.md` at the repo root. This is what the user reads first thing when they return. Make it scannable.

```markdown
# AFK Cycle — <YYYY-MM-DD>

## Summary
- Issues reached terminal state: <N done + N blocked + N failed> of <N total in state file>
  - Done with MR: <N>
  - Blocked: <N>
  - Failed: <N>
- MRs opened: <N>
- New issues filed mid-cycle: <N>
- Approximate duration: <hh:mm>

## MR review order

### Independent (review in any order)
- !123 — <title> — closes #<id>
- !124 — <title> — closes #<id>

### Stacks (review in listed order)
- Stack A: !125 → !126 → !127
  - !125 introduces <X>; !126 builds on it; !127 depends on !126.

## Deferred — existing MR already covers
(Read from `"$SKIP_FILE"`. Each is an issue AFK skipped because the work was already in flight.)
- #<iid> — <title> — covered by <mr_url>

## Deferred — MR status could not be verified
(Read from `"$SKIP_FILE"` where `reason == "api-error"`. If non-empty, flag the GitLab API issue prominently at the top of the report.)
- #<iid> — <title> — API error during MR lookup; not processed

## New issues filed during cycle
- #789 — <title> — discovered while doing #<parent-id>
- #790 — <title> — discovered while doing #<parent-id>

## Blocked
- #45 — <title> — reason: <e.g., spec ambiguous, comment posted on issue>

## Failed
For each failed entry, derive the branch line from state:
- If `branch` is null → "No branch was created."
- Else if branch was pushed → "Branch pushed at `origin/<branch-name>`."
- Else → "Branch left locally at `<branch-name>`, not pushed (reason: <e.g., collision, abort>)."

Then add: "No MR opened. Review-loop report: <loop_report_path or 'n/a'>."

- #67 — <title> — reason: <e.g., code-review-loop did not converge after 8 iterations> — <derived branch line above>
- #45 — <title> — reason: branch name collision with stale remote — Branch left locally at `<branch>`, not pushed. No MR opened.
```

End the run. Do not merge anything. The user reviews and merges in the morning.

## Failure handling

You will hit things that don't work. Every failure must end with the issue in a terminal state (`done`, `blocked`, or `failed`) **or** kept `in-progress` only if the resume logic in Phase 2 can pick it back up safely.

For every failure that produced commits, **push the branch** so the user has a remote artifact to inspect tomorrow. Treat the failure push exactly like the Phase 5 success push: record `pushed_at_sha` to state immediately after the push command returns, so the final report's branch-status derivation is correct.

```bash
git push -u origin <branch-name>
# success → record SHA:
PUSHED_SHA=$(git rev-parse HEAD)
# update state entry: pushed_at_sha = $PUSHED_SHA
```

- **Issue too vague to implement.** Comment on the issue with the questions you'd need answered. Mark `blocked`. Move on. No branch was created, nothing to push.
- **Tests won't pass after reasonable attempts.** Commit what you have. `git push -u origin <branch-name>`. Do **not** open an MR. Mark `failed`. Record the reason in `notes`.
- **code-review-loop doesn't converge after 8 iterations.** Stop the loop. Commit current state. `git push -u origin <branch-name>`. Do **not** open an MR. Mark `failed`. Record unresolved findings in `notes`. The user inspects the branch and the loop's HTML report in the morning.
- **Conflict against `$DEFAULT_BRANCH` mid-cycle** (someone pushed while you were running). Rebase. If the rebase is non-trivial, commit and push current state, mark `failed`, move on.
- **`git push` succeeds but `glab mr create` fails.** Keep the entry `in-progress` with `notes` describing the error. Phase 2's resume logic will route back into Phase 5, where the idempotence check detects the pushed branch and retries `glab mr create` only. If the retry also fails: mark `failed`, leave the branch pushed, record the error in `notes`.
- **External command exits non-zero unexpectedly** and the failure is not covered above. Retry once. If it still fails: if no side effect happened on remote, leave the entry as it was (`pending` or `in-progress`) and surface the error in `notes`; if a side effect did happen, treat per the partial-failure rule above. After two failed retries on the same command for the same issue, mark `failed` so the cycle can complete.

### Abort routine (dirty tree mid-cycle, fatal env failure)

If you must abort the loop before all entries are terminal — typically because the working tree is dirty at the start of Phase 2 — do not just stop. Terminalize the remaining queue so Phase 7 can still produce a complete report:

1. For every entry still `pending` or `in-progress`:
   - If the entry has a `branch` that exists locally with commits past `$DEFAULT_BRANCH`, push it (`git push -u origin <branch-name>`) and record `pushed_at_sha` before flipping status. This mirrors the Failure-handling rule "every failure that produced commits gets pushed."
   - Set status to `failed` with `notes: "AFK cycle aborted before processing — <reason>"`.
2. For the entry whose dirty residue you found (if identifiable): include the dirty file list in `notes`.
3. Jump to Phase 7 and write the final report; flag the abort prominently at the top.

This preserves the invariant that every fetched issue ends in a terminal state with its work pushed to a remote artifact whenever applicable.

### Hard rules

Never `git push --force` to a branch shared with anyone else. Never push to `$DEFAULT_BRANCH` or any protected branch. Never delete branches you didn't create in this cycle.

## Red flags — if you catch yourself thinking these, stop

- "Let me start the next issue while this review loop runs"
- "This review agent is slow, let me skip it"
- "I'll lump this cleanup into the current MR"
- "I'll come back to this small refactor at the end, committing it now is fine"
- "These two issues are close enough, one MR is cleaner"
- "It's getting late, let me wrap up early"
- "Tests fail but probably unrelated, MR anyway"
- "Hit the iteration cap, basically done"
- "Docs-only / config-only, code-review-loop doesn't apply"
- "Branch is failed, no need to push"
- "glab errored, I'll move on and report later"
- "First 100 issues handled, queue is empty"
- "Easier to stack, even if independent"

Each of these breaks one of the four non-negotiables. Re-read them.
