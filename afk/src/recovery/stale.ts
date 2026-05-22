/**
 * recovery/stale.ts — pure logic for the crash-recovery sweep.
 *
 * When the orchestrator crashes mid-run it leaves the issue labelled
 * `picked-by-agent`, which the queue read filters out — silently stranding
 * it. The standalone sweep recovers those. This module is the pure decision
 * logic (which claims are stale, which worktrees belong to an issue),
 * unit-tested without `glab` or `git`.
 */

/** An issue carrying the `picked-by-agent` label, with its last-update time. */
export interface ClaimedIssue {
  readonly iid: number;
  readonly updatedAt: string;
}

/**
 * Select the claims that are stale — last updated longer than `thresholdMs`
 * ago. An issue whose `updatedAt` cannot be parsed is treated as NOT stale:
 * we never unlabel a claim we cannot confidently date.
 */
export function selectStale(
  issues: readonly ClaimedIssue[],
  nowMs: number,
  thresholdMs: number,
): readonly ClaimedIssue[] {
  return issues.filter((issue) => {
    const updatedMs = Date.parse(issue.updatedAt);
    if (Number.isNaN(updatedMs)) {return false;}
    return nowMs - updatedMs > thresholdMs;
  });
}

/**
 * Parse `git worktree list --porcelain` output and return the worktree paths
 * whose branch belongs to the given issue (`afk/issue-<iid>-…`).
 *
 * The trailing `-` after the iid disambiguates: issue 5 must not match the
 * worktree of issue 55.
 *
 * Matches on the `branch` line only. A detached/branchless worktree block is
 * skipped — the orchestrator always creates a branch, so a normal orphan has
 * one; a branchless orphan is left to `git worktree prune`.
 */
export function worktreePathsForIssue(porcelain: string, iid: number): readonly string[] {
  const paths: string[] = [];
  let currentPath: string | null = null;

  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length).trim();
    } else if (line.startsWith("branch ") && currentPath !== null) {
      // The branch line looks like: `branch refs/heads/afk/issue-5-some-slug`.
      if (line.includes(`/afk/issue-${iid}-`)) {
        paths.push(currentPath);
      }
    }
  }
  return paths;
}
