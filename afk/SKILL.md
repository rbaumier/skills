---
name: afk
description: Use when the user runs /afk to autonomously work through all open GitLab issues unattended. Also use when the user says "AFK mode", "process issues while I'm gone", "drain the backlog", or wants sequential, full-code-review issue delivery without supervision.
---

# AFK — Autonomous Issue Loop

You are running unattended. The user kicked off `/afk` and stepped away. They cannot rescue you mid-run and cannot react to your hesitation. Quality beats throughput on any single issue — but **finishing the queue beats stopping early, always**.

**The queue is the only stop condition.** You keep going until Phase 1 reports zero unprocessed issues. There is no other valid termination. Every claimed issue ends in exactly one of two terminal states: an open MR queued for auto-merge (Phase 7 + 7.5), or `failed-by-agent` with a diagnostic comment. Stopping for any other reason — "I've delivered enough", "the remaining ones look risky", "this is a good place to pause", "c'est déjà bien" — is a violation of the AFK contract. The user picked AFK precisely because they trusted it to drain the queue without negotiation.

**An autonomous run is the slot for the big things, not the small ones.** The user chose `/afk` so substantial work can land while they aren't watching. An issue feeling "too large" is upside-down reasoning — that's *exactly* what this run is for. The only valid skips are: confirmed-blocker (verifier-confirmed), open MR exists, or `failed-by-agent` already set.

**Silence between phases.** Do not narrate "I'm starting Phase 3, now I'm spawning the Implementer, now I'm waiting...". Every line of orchestrator narration is context the next phase has to drag along. Each phase's output should be its exit signal (DONE / BLOCKER_SUSPECTED / MR URL / failed-by-agent), not a play-by-play. The user reads GitLab when they return, not your transcript.

## Architecture — you are the orchestrator

Two-level architecture. You orchestrate; you never read source files or edit code yourself. All code work happens in level-2 subagents. The orchestrator's context stays small so long autonomous runs do not drift, and "manual lite review" becomes structurally impossible — you have no source in context to review.

- **You (orchestrator, level 1)** — manage the queue, claim, create worktree, spawn subagents, invoke skills, open MRs.
- **Implementer subagent (level 2, Opus 4.7)** — one per issue. `cd`s into the worktree, reads files, implements, commits, pushes. Returns `DONE` or `BLOCKER_SUSPECTED`.
- **`code-review-loop` skill (invoked at level 1, spawns level-2 agents internally)** — runs full review/fix iteration to convergence inside the worktree.
- **Blocker-verifier subagent (level 2, Opus 4.7)** — only when Implementer signals BLOCKER_SUSPECTED. Adversarial. Also `cd`s into the worktree.

Subagents never spawn further subagents. Max nesting depth = 2.

**Worktree isolation.** Each issue gets its own git worktree under `~/.afk-worktrees/<repo>/<branch>/`. The launcher's checkout (where the user typed `/afk`) is never touched — dirty trees in the launcher are fine. All Implementer / verifier / code-review-loop work targets the worktree path; the orchestrator threads `$WORKTREE` through every Bash call (`git -C "$WORKTREE" ...`) and every subagent prompt.

The four non-negotiables: (1) one issue at a time within this instance, (2) full `code-review-loop` per issue, (3) out-of-scope work becomes a new GitLab issue, (4) stop only when the GitLab queue is empty.

Announce at start: *"AFK orchestrator. Per-issue implementation and code review run as level-2 subagents. Sequential within this instance, coordination with parallel instances via GitLab labels."*

## Anti-rationalization — if any of these cross your mind, stop

| Temptation | Reality |
|---|---|
| "Too large / too risky / out of scope — let me mark blocked" | Implementer raises `BLOCKER_SUSPECTED`; you spawn the verifier; neither of you decides alone. "Out of scope" → Implementer files a new issue. |
| "This issue is too large for an autonomous run, let me skip / mark blocked" | An autonomous run *is* the slot for large work — that's the point of AFK. The size of the issue is never a reason to skip. Spawn the Implementer; it decides whether the work is actually impossible. |
| "Let me just edit one file myself, it'll be faster than spawning a subagent" | You never touch source. Every file edit goes through the Implementer or the `code-review-loop` fix agents. One "small fix" by the orchestrator is how runs go off the rails. |
| "Let me tell the user I'm starting Phase 4 now" | Silent execution. The phase's structured exit signal (DONE / BLOCKER_SUSPECTED / MR URL) is the output. Narration between phases is context bloat that makes later phases drift. |
| "Depends on #N — let me mark blocked" | Phase 3 stacks on #N's open MR or branches from `$DEFAULT_BRANCH`. Never a blocker. |
| "I'll run a lite review with one general-purpose agent — code-review-loop is overkill here" | That's a *substitute*, not the skill. Invoke `code-review-loop` via the Skill tool, Full tier. |
| "The diff is small, Lite tier is enough" | AFK never runs Lite. Force Full regardless of diff size. |
| "Dogfood doesn't apply (fixme'd spec / small diff / obvious UI)" | The skill decides which lenses run, not you. |
| "Je tente #X" / "Let me see how this one goes" | No hedging. Indicative only. |
| "Should I continue? Let me ask the user" | The user has stepped away and explicitly chose not to be in the loop. No mid-flight asks. |
| "C'est déjà bien pour cette session, je m'arrête" / "I've delivered enough for this run, time to stop" | Not your call. The user kicked off `/afk` to drain the queue, not to ship a fraction of it. The only valid stop signal is Phase 1 reporting zero issues. Continue. |
| "N issues delivered already, that's a respectable count, let me wrap up" | N is not the goal. The empty queue is the goal. There is no count at which stopping early becomes acceptable. Continue. |
| "It feels like a good place to pause" / "The remaining issues look hard" | Feelings about pacing and difficulty are not exit signals. "Too hard" is already in this table as a forbidden skip reason. Spawn the Implementer on the next issue. |
| "Let me just briefly summarize what code-review-loop fixed before opening the MR" | No. The MR description IS the summary. Anything between Phase 6's `READY_FOR_MR` token and Phase 7's `open-mr` call is drift — empirical past runs have stopped at exactly this point. Your next tool call after `READY_FOR_MR` is `finalize.sh open-mr`, full stop. |
| "Let me read the files quickly to double-check before code-review-loop" | You never read source files. Implementer's `DONE` is the signal to invoke the skill. |
| "Context is filling, time to wrap up early" | No such signal exists. The harness handles context. |
| "Convergence on substantive findings is enough; the residuals are stylistic" | Convergence is the loop's verdict. |
| "Tests fail but probably unrelated — MR anyway" | No MR. `failed-by-agent`. |
| "8-iter cap reached — basically done" | `failed-by-agent`, no MR. |

## Coordination model — GitLab is the source of truth

No local state file. Three labels plus the implicit "has open MR" state:

- `ready-for-agent` — input queue. Humans tag; Implementer also tags out-of-scope discoveries.
- `picked-by-agent` — claim marker. Stale-recovered after 4h (via `resource_label_events`).
- `failed-by-agent` — terminal. Never retried.
- Open MR linked to issue (`related_merge_requests`) — terminal success.

Queue = `ready-for-agent` AND NOT `failed-by-agent` AND (no `picked-by-agent` OR stale) AND (no open MR).

Multi-instance: lance `/afk` dans plusieurs worktrees, coordination 100% via GitLab. La vraie atomicité du claim n'est pas le label (non-atomique côté serveur) mais le `git push -u` de la branche de travail à la Phase 3 — la collision de nom de branche tranche la race.

## Workflow

The skill ships executable scripts under `scripts/` and subagent prompts under `assets/prompts/`. Each phase is a contract: what you call, what it returns, what you do with the result.

### Phase 0 — Sanity

```bash
bash "$AFK_SKILL_DIR/scripts/sanity.sh" || exit 1
```

Where `AFK_SKILL_DIR` is the path to this skill's directory (resolve via `dirname` of the SKILL.md location, or hardcode `~/.claude/skills/afk` in the user's setup). Aborts with stderr on missing default branch, glab auth failure, or missing project id. **A dirty working tree in the launcher's checkout is fine** — AFK works in isolated worktrees and never touches the launcher's tree.

### Phase 1 — Build the queue

```bash
COUNT=$(bash "$AFK_SKILL_DIR/scripts/build-queue.sh") || { echo "ERREUR phase 1" >&2; exit 1; }
```

Writes `/tmp/afk-queue.json`. Prints count to stdout. If `COUNT == 0`, print `AFK terminé. Rien à faire.` and exit 0 (this is the only terminal-success path).

Pick order is GitLab's default response order. If the project uses priority labels (P0/P1/P2) or `weight`, configure the GitLab issue board accordingly — the skill imposes no heuristic.

### Phase 2 — Claim the next issue

```bash
CLAIM=$(bash "$AFK_SKILL_DIR/scripts/claim-next.sh")
RC=$?
case $RC in
  0) ;;                      # claimed; CLAIM holds {iid, title, body}
  1) # queue exhausted this iteration — go to Phase 8 (refetch + end check)
     ;;
  2) echo "ERREUR phase 2" >&2; exit 1 ;;
esac
```

On success, parse: `IID=$(jq -r .iid <<<"$CLAIM")`, `TITLE=$(jq -r .title <<<"$CLAIM")`, `BODY=$(jq -r .body <<<"$CLAIM")`.

The script handles stale-claim recovery (4h threshold), open-MR filter, and label add. The body is fetched once here so the Implementer prompt can embed it.

### Phase 3 — Create the working branch + worktree

```bash
BRANCH_INFO=$(bash "$AFK_SKILL_DIR/scripts/create-branch.sh" "$IID" "$TITLE")
RC=$?
case $RC in
  0) ;;                      # ok; BRANCH_INFO holds {branch, parent_branch, parent_mr_iid, worktree}
  1) # worktree-add or push collision — lost the race; remove our label and retry Phase 2
     glab issue update "$IID" --unlabel picked-by-agent
     ;;
  2) echo "ERREUR phase 3" >&2; exit 1 ;;
esac
```

Parse: `BRANCH=$(jq -r .branch <<<"$BRANCH_INFO")`, `PARENT_BRANCH=$(jq -r .parent_branch <<<"$BRANCH_INFO")`, `PARENT_MR_IID=$(jq -r .parent_mr_iid <<<"$BRANCH_INFO")` (string `"null"` if independent), **`WORKTREE=$(jq -r .worktree <<<"$BRANCH_INFO")`**.

Detects deps from issue body and notes via regex `(depends on|blocked by|needs|requires|after|stack(s|ed)? on) +!?#?[0-9]+`. If any dep has an open MR, branches from that MR's source. Otherwise branches from `$DEFAULT_BRANCH`. Creates a dedicated worktree at `~/.afk-worktrees/<repo>/<branch>` and pushes the empty branch from it.

`$WORKTREE` is now the workspace for this issue. Every subsequent orchestrator Bash call that touches the work branch uses `git -C "$WORKTREE" ...`; every subagent prompt carries `$WORKTREE` and instructs the subagent to `cd` there first.

### Phase 4 — Spawn the Implementer subagent

Use the `Agent` tool with `subagent_type: general-purpose` and **`model: "opus"`** (Opus 4.7 — Sonnet drops findings on complex multi-file work under autonomy, Haiku is out of the question).

Read the prompt template, substitute placeholders, pass as the Agent's `prompt`:

```bash
PROMPT=$(sed \
  -e "s|<IID>|$IID|g" \
  -e "s|<TITLE>|$TITLE|g" \
  -e "s|<BRANCH>|$BRANCH|g" \
  -e "s|<PARENT_BRANCH>|$PARENT_BRANCH|g" \
  -e "s|<PARENT_MR_IID>|$PARENT_MR_IID|g" \
  -e "s|<DEFAULT_BRANCH>|$DEFAULT_BRANCH|g" \
  -e "s|<WORKTREE>|$WORKTREE|g" \
  "$AFK_SKILL_DIR/assets/prompts/implementer.md")
# Append the body separately because it contains newlines/special chars sed can't handle inline:
PROMPT="${PROMPT//<BODY>/$BODY}"
```

Spawn with that prompt. The Agent's return string is the subagent's final message.

### Phase 5 — Parse the Implementer return

Read the **first line** of the subagent's last output.

- `DONE` → **first verify the Implementer actually committed in the worktree** before continuing:
  ```bash
  WORK_SHA=$(git -C "$WORKTREE" rev-parse HEAD)
  BASE_SHA=$(git -C "$WORKTREE" rev-parse "origin/$PARENT_BRANCH")
  if [ "$WORK_SHA" = "$BASE_SHA" ]; then
    bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" \
      "Implementer returned DONE but HEAD == $PARENT_BRANCH base ($BASE_SHA). No commits landed in worktree \`$WORKTREE\`. Likely cause: subagent forgot to \`cd\` into the worktree and operated on the launcher's cwd."
    # Continue the loop.
  fi
  ```
  If the SHA check passes, continue to Phase 6 (parse `files_touched`, `new_issues_filed`, `notes` from subsequent lines for the MR description).
- `BLOCKER_SUSPECTED` → Phase 5b. Parse `files_explored` from subsequent lines; the `context` line is for the user's eventual debug, not for the verifier.
- Anything else (silent return, malformed, timeout) → terminal failure:
  ```bash
  bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" \
    "AFK Implementer failed to return a structured result. Branch left at \`$BRANCH\` and worktree at \`$WORKTREE\` for inspection."
  ```
  Continue the loop.

### Phase 5b — Blocker-verifier (only on BLOCKER_SUSPECTED)

Spawn a second subagent. `subagent_type: general-purpose`, **`model: "opus"`** (adversarial reasoning needs Opus; Sonnet agrees too readily). Pass the verifier prompt template with `<IID>`, `<BODY>`, `<WORKTREE>`, `<FILES_EXPLORED>`, `<GIT_DIFF>`. **Do NOT pass the Implementer's `context` field** — anchoring kills the verifier.

```bash
GIT_DIFF=$(git -C "$WORKTREE" diff "origin/$DEFAULT_BRANCH"...HEAD)
PROMPT=$(sed -e "s|<IID>|$IID|g" -e "s|<WORKTREE>|$WORKTREE|g" "$AFK_SKILL_DIR/assets/prompts/blocker-verifier.md")
PROMPT="${PROMPT//<BODY>/$BODY}"
PROMPT="${PROMPT//<FILES_EXPLORED>/$FILES_EXPLORED}"
PROMPT="${PROMPT//<GIT_DIFF>/$GIT_DIFF}"
```

Parse the first line of the verifier's return:

- `attempt-anyway: <suggestion>` → re-spawn the Implementer (Phase 4) with the same prompt **prepended** by:
  ```
  ## Previous attempt feedback

  An earlier Implementer signaled BLOCKER_SUSPECTED. An adversarial verifier rejected the blocker and suggested: <SUGGESTION>. Try this approach.
  ```
- `confirmed-blocker: <evidence>` →
  ```bash
  bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" "$EVIDENCE"
  ```
  Continue the loop.

### Phase 6 — Invoke code-review-loop

Invoke the `code-review-loop` **skill** via the `Skill` tool. The skill runs its own internal review/fix iteration to convergence or 8-iter cap. You receive the verdict.

**Invocation contract:**
- Use the `Skill` tool. Do NOT spawn a general-purpose Agent with a review prompt — that's a substitute, not the skill.
- Build the instruction string **with `$WORKTREE` already expanded to its concrete path** before passing it to the Skill tool — the Skill tool does no shell expansion. Concretely, if `$WORKTREE` is `/Users/foo/.afk-worktrees/12345/380-fix-bar-afk-20260518`, the instruction text you send must contain that literal path, not the string `$WORKTREE`. Template:
  > AFK invocation — Full tier required, no Lite override regardless of `total_lines` or `file_count`. Operate inside `<EXPANDED_WORKTREE_PATH>` — every git operation, file read, and edit must target that path (use `git -C "<EXPANDED_WORKTREE_PATH>" …` and read/edit files only under that prefix). The orchestrator's cwd is not the work branch.
- Dogfood is mandatory when triggered; the skill decides triggers, not you.

**Parse the skill's last line — it returns a single token, not prose:**

- `READY_FOR_MR iter=<N> findings_fixed=<C>` → starting gun for Phase 7, not a finish line for the issue. Re-run the project's full test suite once inside the worktree (`cd "$WORKTREE" && <test cmd>`). The moment tests return green, your **next tool call** is `bash "$AFK_SKILL_DIR/scripts/finalize.sh" open-mr …` — do not write a summary, do not type "Tests are green, proceeding to Phase 7", just call the tool. Past runs have repeatedly stopped here because the orchestrator paused to acknowledge convergence; that pause is the failure mode. If tests are red, re-invoke `code-review-loop` (counts toward cap). Still red → fail-label handling.
- `READY_FOR_FAIL_LABEL iter=8 dump=<path>` → fail-label handling below. **This token ends one issue, never the run.** Apply the label, then go to Phase 8.
- Anything else (prose, "Open suggestions: …", silent return, legacy tokens `CONVERGED` / `CAP_HIT`) → the skill is in user-invocation mode or is an old version. Treat as `READY_FOR_FAIL_LABEL` with a synthetic dump quoting what came back, then continue. Do **not** stop the loop.

For `READY_FOR_FAIL_LABEL iter=8 dump=<path>`, record the dump:
  ```bash
  CAP_REPORT=$(mktemp)
  cat > "$CAP_REPORT" <<EOF
  AFK abandons this issue. code-review-loop did not converge after 8 iterations.

  ## Last findings (per agent)
  <DUMP FROM SKILL>

  ## Test state
  <OUTPUT>

  ## Diff state
  \`\`\`
  $(git -C "$WORKTREE" diff --stat "origin/$DEFAULT_BRANCH"...HEAD)
  \`\`\`

  ## Worktree (left in place for inspection)
  $WORKTREE
  EOF
  bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" "code-review-loop did not converge after 8 iterations" "$CAP_REPORT"
  ```
  Continue the loop.

### Phase 7 — Open the MR

Build the description (using `files_touched`, `new_issues_filed`, `notes` from the Implementer return, plus the converged iteration count from Phase 6):

```bash
DESC=$(mktemp)
cat > "$DESC" <<EOF
## Summary
<2-3 bullets from Implementer notes>

Closes #$IID

## Decisions

Spec/behaviour ambiguities first — surface them so the user can revert.

- **<spec/behaviour>** (most important): <ambiguity and choice>. Reversible by <how>.
- <library/API/test strategy choices>

## Out-of-scope issues filed
<list from new_issues_filed, or "None.">

## Review notes
$STACK_NOTE
- code-review-loop converged in <N> iteration(s)
EOF

bash "$AFK_SKILL_DIR/scripts/finalize.sh" open-mr "$IID" "$BRANCH" "$PARENT_BRANCH" "$PARENT_MR_IID" "$N_ITERS" "$DESC" "$WORKTREE"
```

Where `STACK_NOTE` is either *"Independent of other cycle MRs."* or *"Stacks on !$PARENT_MR_IID (source: \`$PARENT_BRANCH\`). Review !$PARENT_MR_IID first. GitLab retargets this MR to \`$DEFAULT_BRANCH\` when the parent merges."*

The script handles idempotence (checks for existing MR via `glab mr list --source-branch`) and removes `picked-by-agent`. Prints the MR URL.

### Phase 7.5 — Land the MR (auto-merge with auto-fix)

`$MR_URL` from Phase 7 is the failure-note anchor.

```bash
OUT=$(bash "$AFK_SKILL_DIR/scripts/finalize.sh" queue-merge "$IID" "$BRANCH")
RC=$?
```

**Attempt budget per issue: one rebase + one CI-fix + one `--squash` retry, total — never reset.** A second occurrence of any category → `failed-by-agent`.

| `$RC` | Cause | Action |
|---|---|---|
| `0` | Queued or merged | Phase 8. |
| `10` | Conflict | Spawn `assets/prompts/conflict-resolution.md` (model `opus`). On `REBASED` re-invoke `queue-merge`. On `REBASE_FAILED` or 2nd `10` → `failed-by-agent`. |
| `11` | Pipeline failed | Spawn `assets/prompts/ci-fix.md` (model `opus`). On `CI_FIXED`, **poll the new pipeline** (see below) before re-`queue-merge`. On `CI_FIX_FAILED`, post-fix pipeline non-success, or 2nd `11` → `failed-by-agent`. |
| `12` | Approvals required | `finalize.sh fail "$IID" "Auto-merge blocked: requires human approval. $MR_URL"`. |
| `13` | Branch protection / merge method | Retry once with `queue-merge "$IID" "$BRANCH" --squash`. 2nd `13` → `failed-by-agent` (quote `$OUT`). |
| `1` | Unrecognised | `failed-by-agent` with `$OUT`. |
| `2` | Infra | `failed-by-agent` with the infra error. |

**Post-CI-fix poll** (else the new pipeline runs unobserved and a late failure leaves the MR stuck):

```bash
until status=$(glab ci status --branch "$BRANCH" 2>/dev/null | head -1); \
      [[ "$status" =~ (success|failed|canceled|skipped|manual) ]] || (( SECONDS > 1800 )); do
  sleep 30
done
[[ "$status" == *success* ]] || \
  bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" \
    "Post-CI-fix pipeline finished $status. $MR_URL"
```

Storming a broken project with 20 same-shaped failures is correct; do not invent a circuit breaker.

### Phase 8 — Loop or end

GitLab clears `merge_when_pipeline_succeeds` when it retargets a child after a parent merges, so first sweep:

```bash
bash "$AFK_SKILL_DIR/scripts/finalize.sh" requeue-retargeted
```

Then Phase 1. The queue may have grown (Implementer filed out-of-scope) or shrunk (parallel instance handled siblings).

When Phase 1 returns 0 items:

```bash
echo "AFK terminé. Voir GitLab pour les MRs ouverts et les issues étiquetées failed-by-agent."
echo "Worktrees laissés sous ~/.afk-worktrees/ (cleanup manuel : git worktree remove <path> + git worktree prune)."
exit 0
```

No markdown report is generated. The user reviews work in GitLab when they return. Worktrees stay on disk for post-mortem on `failed-by-agent` issues and for local inspection of merged work; the user prunes them at leisure.

## Failure handling

Single rule: every issue ends with either an open MR (success) or a `failed-by-agent` label (terminal). No `pending`, no `in-progress`. The `scripts/finalize.sh fail` helper handles the latter idempotently.

Specific cases:
- Implementer returns malformed or empty → `finalize.sh fail` with branch-left-for-inspection message.
- Verifier returns `confirmed-blocker` → `finalize.sh fail` with the verifier's evidence.
- `code-review-loop` hits 8-iter cap → `finalize.sh fail` with findings dump file.
- `glab mr create` fails → `finalize.sh open-mr` is idempotent (re-checks via `glab mr list --source-branch`); retry once, then fail.
- Phase 3 push collision → remove our `picked-by-agent`, retry Phase 2.
- Crash mid-run → nothing to do during the run; stale recovery on the next `/afk` picks up after 4h.

## Hard rules

- You (orchestrator) never read source files, never edit files. Every code-touching action is in a subagent.
- Never `git push --force` to a shared branch.
- Never push to `$DEFAULT_BRANCH` or any protected branch.
- Never delete a remote branch except the Phase 3 orphan cleanup (a branch matching the naming pattern for the issue you just claimed).
- Never `--no-verify` a commit.

## When the user asks "what do I do?"

You (the human reading this) launch `/afk` and step away. Before launching: ensure issues to process are labeled `ready-for-agent` and `glab auth status` works. Your current checkout can be dirty — AFK uses its own worktrees under `~/.afk-worktrees/` and never touches the launcher's tree. When you return: open GitLab. The MRs that landed have already been merged (Phase 7.5 auto-merge); review the diffs if you want, but no clicks are required. For `failed-by-agent` issues, read the comment AFK posted, inspect the worktree if useful, and re-tag `ready-for-agent` to retry. Once you're done, `git worktree remove <path>` (or `git worktree prune` for already-deleted dirs) cleans up.
