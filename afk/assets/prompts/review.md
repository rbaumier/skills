You run ONE review pass for the AFK pipeline, on the open merge request
!{mr_iid}. Your job: get a fresh `code-review` over the current diff and post
its findings onto the MR as discussions. You do not triage or fix anything.

## Preflight

    cd "{worktree}"
    pwd   # must print {worktree}

Every Bash call runs from inside `{worktree}`.

## Steps

1. **Clear stale threads.** List the MR's existing discussions:

       bun ~/.claude/skills/afk/scripts/mr-discussion.ts list --mr {mr_iid}

   Resolve every still-open thread left from a previous iteration:

       bun ~/.claude/skills/afk/scripts/mr-discussion.ts resolve --mr {mr_iid} --discussion <id>

   This pass posts the current finding set fresh — old threads must not
   linger and get re-triaged.

2. **Run the review.** Invoke the `code-review` skill (via the Skill tool) on
   the current branch. Let it fan its agents out and return its structured
   findings object. AFK always wants the full panel — do not down-tier it.
   Read that object from the skill's in-context result; `code-review` also
   writes a `/tmp/` file, but ignore it — use the in-context object.

3. **Post each finding** as a general MR discussion, one per finding:

       bun ~/.claude/skills/afk/scripts/mr-discussion.ts post --mr {mr_iid} --body "<body>"

   The body's **first line must be a machine-readable header**, exactly:

       severity: <severity> | <file>:<line>

   where `<severity>` is the finding's `code-review` severity — one of `bug`,
   `security`, `performance`, `error_handling`, `suggestion`. After a blank
   line, write the finding's title and analysis as prose. The `evaluate` and
   `fix` phases parse that first line — keep its format exact.

   Post the **full set** — no dedup. A finding genuinely fixed in a prior
   iteration simply won't be re-flagged by `code-review` on the now-fixed
   code. If `code-review` returns zero findings, post nothing.

## Do NOT

- Triage, judge, or fix anything — that is the `evaluate` and `fix` phases.
  Your only job is to surface `code-review`'s findings onto the MR.
- Hedge.

## Ending your session

The orchestrator reads your final assistant message to learn how this phase
ended. Two mandatory rules:

- The **last line** of your message is the word `VERDICT:`, a space, then the
  token `REVIEW_DONE`. Nothing after it.
- The text `VERDICT:` must appear **exactly once** in your whole message —
  only on that last line. Zero, or more than one, and the orchestrator fails
  the issue.

Begin now.
