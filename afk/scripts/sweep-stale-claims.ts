#!/usr/bin/env bun
/**
 * Sweep-stale-claims.ts — standalone AFK crash recovery.
 *
 * A crashed orchestrator strands its issue as `picked-by-agent`.
 * The queue read filters those out.
 * This sweep runs on its own schedule (cron, ~3h), never by the orchestrator.
 * It unlabels `picked-by-agent` issues idle longer than the budget + margin.
 * It also force-removes the orphan worktree,
 * so the next run re-picks them from scratch.
 *
 * Usage: bun ~/.claude/skills/afk/scripts/sweep-stale-claims.ts [--dry-run]
 * Run from inside the target repo. Requires: glab (authenticated), git.
 */
import { $ } from "bun";
import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect } from "effect";
import { z } from "zod";
import { LABELS } from "../src/config";
import { describeGitLabError } from "../src/gitlab/errors";
import { parseGlabJson, runGlabRead, runGlabWrite } from "../src/gitlab/glab";
import { IssueSchema } from "../src/gitlab/schema";
import type { ClaimedIssue } from "../src/recovery/stale";
import { selectStale, worktreePathsForIssue } from "../src/recovery/stale";
import { runShell } from "../src/shell";

/** Staleness threshold — 2h, safely above the 90-minute per-issue budget. */
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

const dryRun = process.argv.slice(2).includes("--dry-run");

/** Fetch every issue currently labelled `picked-by-agent`. */
const listClaimedIssues = Effect.gen(function* () {
  const command = [
    "issue",
    "list",
    "--label",
    LABELS.pickedByAgent,
    "--output",
    "json",
    "--per-page",
    "100",
  ];
  const output = yield* runGlabRead(command);
  const issues =
    output.trim() === "" ? [] : yield* parseGlabJson(output, z.array(IssueSchema), command);
  return issues.map((issue): ClaimedIssue => ({ iid: issue.iid, updatedAt: issue.updated_at }));
});

/** Remove a single worktree by path. Logs success or failure. */
const removeOneWorktree = (path: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    const removed = yield* runShell(() => $`git worktree remove --force ${path}`);
    if (removed.exitCode === 0) {
      yield* Console.log(`    removed worktree ${path}`);
    } else {
      yield* Console.error(`    could not remove worktree ${path}: ${removed.stderr.trim()}`);
    }
  });

/** Force-remove an issue's orphan worktree(s). Best-effort, and logged. */
const removeOrphanWorktrees = (iid: number): Effect.Effect<void> =>
  Effect.gen(function* () {
    const listed = yield* runShell(() => $`git worktree list --porcelain`);
    if (listed.exitCode !== 0) {
      yield* Console.error("    worktree cleanup skipped — `git worktree list` failed");
      return;
    }
    for (const path of worktreePathsForIssue(listed.stdout, iid)) {
      yield* removeOneWorktree(path);
    }
    yield* runShell(() => $`git worktree prune`);
  });

/** Recover one crash-orphaned issue: unlabel it, then clean its worktree. */
const recoverIssue = (issue: ClaimedIssue): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Console.log(`  recovering #${issue.iid} (idle since ${issue.updatedAt})`);
    yield* runGlabWrite([
      "issue",
      "update",
      String(issue.iid),
      "--unlabel",
      LABELS.pickedByAgent,
    ]).pipe(
      Effect.catchAll((error) =>
        Console.error(`  #${issue.iid} unlabel failed — ${describeGitLabError(error)}`),
      ),
    );
    yield* removeOrphanWorktrees(issue.iid);
  });

const program = Effect.gen(function* () {
  const claimed = yield* listClaimedIssues;
  const staleIssues = selectStale(claimed, Date.now(), STALE_THRESHOLD_MS);

  if (staleIssues.length === 0) {
    yield* Console.log("No stale claims.");
    return;
  }

  const staleCount = staleIssues.length;
  yield* Console.log(`${staleCount} stale claim(s)${dryRun ? " — dry-run, no changes:" : ":"}`);
  if (dryRun) {
    yield* Effect.forEach(
      staleIssues,
      (issue) => Console.log(`  #${issue.iid} — idle since ${issue.updatedAt}`),
      {
        discard: true,
      },
    );
    return;
  }
  // Recover each — one issue's failure must not abort the others.
  yield* Effect.forEach(staleIssues, (issue) => recoverIssue(issue), { discard: true });
});

BunRuntime.runMain(program);
