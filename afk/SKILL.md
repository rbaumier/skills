---
name: afk
description: Use when the user runs /afk to autonomously work through all open GitLab issues unattended. Also use when the user says "AFK mode", "process issues while I'm gone", "drain the backlog", or wants sequential, full-code-review issue delivery without supervision.
---

# AFK — Autonomous Issue Loop

Unattended. User kicked off `/afk`, stepped away, no mid-run rescue.

**Stop condition = empty queue.** Phase 1 returns zero → stop. Else continue. Each issue ends: open MR (Phase 7+7.5) OR `failed-by-agent`. Any other stop ("delivered enough", "remaining risky", "good pause spot") = contract violation.

Autonomous runs = slot for **big** work. "Too large" = upside-down. Valid skips only: confirmed-blocker (verifier-confirmed), open MR exists, `failed-by-agent` set.

**Silent execution.** No "starting Phase 3, now spawning…". Phase exit signal IS its output. Narration = bloat → later drift.

## Architecture

You orchestrate, never touch code. Two levels.

- **You (L1)** — queue, claims, worktrees, MR open.
- **Implementer (L2, Opus 4.7)** — `cd` worktree, implement/commit/push. Returns `READY_FOR_REVIEW` or `BLOCKER_SUSPECTED`.
- **code-review-loop runner (L2, Opus 4.7)** — loads `code-review-loop`, runs to convergence or 8-iter cap, spawns review/fix agents at L3. Returns `READY_FOR_MR` / `READY_FOR_FAIL_LABEL`. Opus, not Sonnet — Sonnet drifted to shortcut shapes (one general-purpose agent instead of fan-out). Runner wraps skill so "emit token, nothing else" can't override Phase 7 (old `Skill`-tool recency clash).
- **Blocker-verifier (L2, Opus 4.7)** — only on BLOCKER_SUSPECTED. Adversarial. `cd` worktree.

L2 doesn't spawn L3, except runner (loads code-review-loop → L3 review agents). Max nesting = 2.

**Worktree isolation.** Each issue → `~/.afk-worktrees/<repo>/<branch>/`. Launcher untouched (dirty fine). Every Bash: `git -C "$WORKTREE" …`. Every L2 prompt carries `$WORKTREE` + `cd` instruction.

Non-negotiables: (1) one issue at a time per instance, (2) full `code-review-loop` per issue, (3) out-of-scope → new GitLab issue, (4) stop only when queue empty.

Announce: *"AFK orchestrator. Per-issue impl + review at L2. Sequential within instance, parallel instances via GitLab labels."*

## Anti-rationalization — stop if any cross mind

| Temptation | Reality |
|---|---|
| "Too large/risky → mark blocked" | Implementer raises BLOCKER_SUSPECTED, verifier decides. Out-of-scope → new issue. |
| "Too large for autonomous run" | AFK *is* that slot. Size ≠ skip reason. |
| "Edit one file myself, faster" | Never. Every edit through L2. |
| "Tell user starting Phase 4" | Silent. |
| "Depends on #N → blocked" | Phase 3 stacks on MR or branches from `$DEFAULT_BRANCH`. Never blocker. |
| "Lite review, one general-purpose — code-review-loop overkill" | Substitute, not skill. Spawn runner, Full tier. |
| "Diff small, Lite enough" | AFK = Full always. |
| "Dogfood doesn't apply" | Skill decides lenses. |
| "Je tente #X" / "Let me see" | No hedging. Indicative. |
| "Should I ask user?" | User stepped away. No asks. |
| "C'est déjà bien, je m'arrête" | Not your call. Queue empty = goal. |
| "N delivered, respectable count" | N ≠ goal. Continue. |
| "Good place to pause" / "Remaining hard" | Feelings ≠ exit. Next issue. |
| "Briefly summarize before MR" | MR desc IS summary. Next call after READY_FOR_MR = `open-mr`. |
| "Read files to double-check" | Never. READY_FOR_REVIEW = signal. |
| "Context filling, wrap up" | Harness handles. |
| "Substantive findings done, residuals stylistic" | Loop's verdict, not yours. |
| "Tests fail, probably unrelated" | `failed-by-agent`. |
| "8-iter cap, basically done" | `failed-by-agent`. |

## Coordination — GitLab is truth

Labels: `ready-for-agent` (queue), `picked-by-agent` (claim, stale-recovery 4h), `failed-by-agent` (terminal). Open MR linked = terminal success.

Queue = `ready-for-agent` AND NOT `failed-by-agent` AND (no `picked-by-agent` OR stale) AND (no open MR).

Multi-instance: `/afk` dans plusieurs worktrees. Claim atomicity = `git push -u` branche Phase 3 (collision tranche la race, pas le label).

## Workflow

Scripts sous `scripts/`, prompts sous `assets/prompts/`. Chaque phase : call → returns → action.

### Phase 0 — Sanity

```bash
bash "$AFK_SKILL_DIR/scripts/sanity.sh" || exit 1
```

`AFK_SKILL_DIR` = `~/.claude/skills/afk` (ou `dirname` SKILL.md). Aborts on missing default branch / glab auth / project id. Dirty launcher fine.

### Phase 1 — Build queue

```bash
COUNT=$(bash "$AFK_SKILL_DIR/scripts/build-queue.sh") || { echo "ERREUR phase 1" >&2; exit 1; }
```

Writes `/tmp/afk-queue.json`. `COUNT == 0` → `AFK terminé. Rien à faire.` + exit 0 (only success-stop).

Pick order = GitLab default. Priority (P0/P1/P2) ou `weight` via board.

### Phase 2 — Claim next

```bash
CLAIM=$(bash "$AFK_SKILL_DIR/scripts/claim-next.sh")
RC=$?
case $RC in
  0) ;;                      # claimed
  1) # exhausted → Phase 8
     ;;
  2) echo "ERREUR phase 2" >&2; exit 1 ;;
esac
```

Parse `IID`, `TITLE`, `BODY`. Script handles stale-claim recovery, open-MR filter, label add. Body fetched here for Implementer.

### Phase 3 — Branch + worktree

```bash
BRANCH_INFO=$(bash "$AFK_SKILL_DIR/scripts/create-branch.sh" "$IID" "$TITLE")
RC=$?
case $RC in
  0) ;;
  1) glab issue update "$IID" --unlabel picked-by-agent ;;  # race lost, retry Phase 2
  2) echo "ERREUR phase 3" >&2; exit 1 ;;
esac
```

Parse `BRANCH`, `PARENT_BRANCH`, `PARENT_MR_IID` ("null" if independent), **`WORKTREE`**.

Deps regex: `(depends on|blocked by|needs|requires|after|stack(s|ed)? on) +!?#?[0-9]+`. Dep with open MR → branch from MR source. Else `$DEFAULT_BRANCH`. Worktree à `~/.afk-worktrees/<repo>/<branch>`, empty branch pushed.

`$WORKTREE` = workspace. Toute opération suivante l'utilise.

### Phase 4 — Implementer

`Agent` tool, `general-purpose`, **`model: "opus"`** (Sonnet drops findings on multi-file).

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
PROMPT="${PROMPT//<BODY>/$BODY}"   # body has newlines, sed can't handle
```

### Phase 5 — Parse Implementer

First line of last output:

- `READY_FOR_REVIEW` (or legacy `DONE`) → verify commits landed:
  ```bash
  WORK_SHA=$(git -C "$WORKTREE" rev-parse HEAD)
  BASE_SHA=$(git -C "$WORKTREE" rev-parse "origin/$PARENT_BRANCH")
  if [ "$WORK_SHA" = "$BASE_SHA" ]; then
    bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" \
      "Implementer returned READY_FOR_REVIEW but HEAD == base. Likely forgot cd into worktree \`$WORKTREE\`."
  fi
  ```
  Pass → Phase 6. Parse `files_touched`/`new_issues_filed`/`notes` for MR desc. **Next call = code-review-loop runner**, no recap.

- `BLOCKER_SUSPECTED` → Phase 5b. Parse `files_explored`. `context` for user debug, not verifier.

- Else (silent/malformed/timeout) → terminal:
  ```bash
  bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" \
    "Implementer failed structured return. Branch \`$BRANCH\` worktree \`$WORKTREE\` left for inspection."
  ```

### Phase 5b — Blocker-verifier

`general-purpose`, **`model: "opus"`** (adversarial, Sonnet agrees too readily). **Don't pass Implementer's `context`** (anchors verifier).

```bash
GIT_DIFF=$(git -C "$WORKTREE" diff "origin/$DEFAULT_BRANCH"...HEAD)
PROMPT=$(sed -e "s|<IID>|$IID|g" -e "s|<WORKTREE>|$WORKTREE|g" "$AFK_SKILL_DIR/assets/prompts/blocker-verifier.md")
PROMPT="${PROMPT//<BODY>/$BODY}"
PROMPT="${PROMPT//<FILES_EXPLORED>/$FILES_EXPLORED}"
PROMPT="${PROMPT//<GIT_DIFF>/$GIT_DIFF}"
```

Parse first line:

- `attempt-anyway: <suggestion>` → re-spawn Phase 4 with prompt **prepended**:
  ```
  ## Previous attempt feedback
  Earlier Implementer signaled BLOCKER_SUSPECTED. Verifier rejected, suggested: <SUGGESTION>. Try this.
  ```
- `confirmed-blocker: <evidence>` → `finalize.sh fail "$IID" "$EVIDENCE"`. Continue.

### Phase 6 — code-review-loop runner

**Why runner.** Direct `Skill`-tool use stopped past runs ici — skill's "emit token, nothing else" won by recency over Phase 7 "call open-mr". Runner owns the run; orchestrator sees return only.

```
Agent({
  subagent_type: "general-purpose",
  model: "opus",                   // Sonnet drifted to "spawn one general-purpose, call it a review"
  description: "code-review-loop runner",
  prompt: <contents of $AFK_SKILL_DIR/assets/prompts/code-review-loop-runner.md, <WORKTREE> substituted>
})
```

Read template, substitute `<WORKTREE>`. Don't use `Skill` tool from orchestrator. Don't spawn ad-hoc review agent.

Parse last line:

- `READY_FOR_MR iter=<N> findings_fixed=<C>` → run test suite in worktree. Green → **next call = `finalize.sh open-mr …`**, no recap. Red → re-spawn runner (counts cap). Still red → fail-label.
- `READY_FOR_FAIL_LABEL iter=8 dump=<path>` → fail-label below. **Ends issue, not run.**
- Else (prose, silent, legacy `CONVERGED`/`CAP_HIT`, mid-flight) → treat as `READY_FOR_FAIL_LABEL` synthetic. **Don't stop loop.**

For `READY_FOR_FAIL_LABEL`:
```bash
CAP_REPORT=$(mktemp)
cat > "$CAP_REPORT" <<EOF
AFK abandons. code-review-loop didn't converge after 8 iter.

## Last findings (per agent)
<DUMP>

## Test state
<OUTPUT>

## Diff state
\`\`\`
$(git -C "$WORKTREE" diff --stat "origin/$DEFAULT_BRANCH"...HEAD)
\`\`\`

## Worktree (left for inspection)
$WORKTREE
EOF
bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" "code-review-loop didn't converge after 8 iter" "$CAP_REPORT"
```

### Phase 7 — Open MR

Desc from Implementer return + Phase 6 iter count:

```bash
DESC=$(mktemp)
cat > "$DESC" <<EOF
## Summary
<2-3 bullets from Implementer notes>

Closes #$IID

## Decisions

Spec/behaviour ambiguities first.

- **<spec/behaviour>** (most important): <ambiguity + choice>. Reversible by <how>.
- <library/API/test choices>

## Out-of-scope issues filed
<list, or "None.">

## Review notes
$STACK_NOTE
- code-review-loop converged in <N> iteration(s)
EOF

bash "$AFK_SKILL_DIR/scripts/finalize.sh" open-mr "$IID" "$BRANCH" "$PARENT_BRANCH" "$PARENT_MR_IID" "$N_ITERS" "$DESC" "$WORKTREE"
```

`STACK_NOTE` = *"Independent of other cycle MRs."* OR *"Stacks on !$PARENT_MR_IID (source: \`$PARENT_BRANCH\`). Review !$PARENT_MR_IID first. GitLab retargets to \`$DEFAULT_BRANCH\` when parent merges."*

Script idempotent (`glab mr list --source-branch`), removes `picked-by-agent`, prints URL.

### Phase 7.5 — Land MR (auto-merge + auto-fix)

`$MR_URL` from Phase 7.

```bash
OUT=$(bash "$AFK_SKILL_DIR/scripts/finalize.sh" queue-merge "$IID" "$BRANCH")
RC=$?
```

**Budget par issue : 1 rebase + 1 CI-fix + 1 `--squash` retry, total, jamais reset.** 2ème occurrence n'importe quelle catégorie → `failed-by-agent`.

| RC | Cause | Action |
|---|---|---|
| 0 | Queued/merged | Phase 8 |
| 10 | Conflict | `conflict-resolution.md` (opus). `READY_FOR_MERGE_RETRY`/legacy `REBASED` → re-queue. `REBASE_FAILED` ou 2ème `10` → fail. |
| 11 | Pipeline failed | `ci-fix.md` (opus). `READY_FOR_PIPELINE_POLL`/legacy `CI_FIXED` → **poll** (below) puis re-queue. `CI_FIX_FAILED`, post-fix non-success, ou 2ème `11` → fail. |
| 12 | Approvals required | fail: "Auto-merge blocked: requires human approval. $MR_URL" |
| 13 | Branch protection | Retry once `--squash`. 2ème `13` → fail (`$OUT`). |
| 1 | Unrecognised | fail with `$OUT` |
| 2 | Infra | fail with infra error |

**Post-CI-fix poll** (sinon new pipeline tourne sans observation) :

```bash
until status=$(glab ci status --branch "$BRANCH" 2>/dev/null | head -1); \
      [[ "$status" =~ (success|failed|canceled|skipped|manual) ]] || (( SECONDS > 1800 )); do
  sleep 30
done
[[ "$status" == *success* ]] || \
  bash "$AFK_SKILL_DIR/scripts/finalize.sh" fail "$IID" \
    "Post-CI-fix pipeline finished $status. $MR_URL"
```

Storming un projet cassé avec 20 mêmes failures = correct ; pas de circuit breaker.

### Phase 8 — Loop or end

GitLab clears `merge_when_pipeline_succeeds` au retarget enfant après merge parent :

```bash
bash "$AFK_SKILL_DIR/scripts/finalize.sh" requeue-retargeted
```

Puis Phase 1. Queue peut grow (out-of-scope) ou shrink (parallel instance).

Phase 1 retourne 0 :

```bash
echo "AFK terminé. Voir GitLab pour MRs et issues failed-by-agent."
echo "Worktrees laissés sous ~/.afk-worktrees/ (cleanup: git worktree remove <path> + git worktree prune)."
exit 0
```

No markdown report. User reviews in GitLab. Worktrees on disk for post-mortem.

## Failure handling

Rule : issue → open MR OR `failed-by-agent`. No pending/in-progress. `finalize.sh fail` idempotent.

- Implementer malformed/empty → fail with branch-left-for-inspection.
- Verifier `confirmed-blocker` → fail with evidence.
- 8-iter cap → fail with dump.
- `glab mr create` fails → idempotent retry, then fail.
- Phase 3 push collision → unlabel `picked-by-agent`, retry Phase 2.
- Mid-run crash → stale recovery sur next `/afk` (4h).

## Hard rules

- Orchestrator never reads/edits source.
- Never `git push --force` to shared branch.
- Never push to `$DEFAULT_BRANCH` or protected.
- Never delete remote branch except Phase 3 orphan cleanup.
- Never `--no-verify`.

## User instructions

Launch `/afk`, step away. Pre : tag issues `ready-for-agent`, `glab auth status` works. Dirty checkout fine. Return : open GitLab. Landed MRs auto-merged. `failed-by-agent` → read AFK's comment, inspect worktree, re-tag to retry. Cleanup : `git worktree remove <path>` / `prune`.
