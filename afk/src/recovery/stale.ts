/**
 * Recovery/stale.ts — pure logic for the crash-recovery sweep.
 *
 * When the orchestrator crashes mid-run it leaves the issue labelled
 * `picked-by-agent`. The queue read filters that label out, silently
 * stranding the issue. The standalone sweep recovers those.
 *
 * This module is the pure decision logic (which claims are stale,
 * which worktrees belong to an issue), unit-tested without `glab`
 * or `git`.
 */

/** An issue carrying the `picked-by-agent` label, with its last-update time. */
export type ClaimedIssue = {
  readonly iid: number;
  readonly updatedAt: string;
};

/**
 * Select the claims that are stale — last updated longer than
 * `thresholdMs` ago. An issue whose `updatedAt` cannot be parsed
 * is treated as NOT stale: we never unlabel an undateable claim.
 */
export function selectStale(
  issues: readonly ClaimedIssue[],
  nowMs: number,
  thresholdMs: number,
): readonly ClaimedIssue[] {
  return issues.filter((issue) => {
    const updatedMs = Date.parse(issue.updatedAt);
    if (Number.isNaN(updatedMs)) {
      return false;
    }
    return updatedMs < nowMs - thresholdMs;
  });
}

/**
 * Parse `git worktree list --porcelain` output and return the
 * worktree paths whose branch belongs to the given issue
 * (`afk/issue-<iid>-…`).
 *
 * The trailing `-` after the iid disambiguates issue 5
 * from issue 55.
 *
 * Matches on the `branch` line only. Detached/branchless blocks
 * are skipped — the orchestrator always creates a branch, so a
 * normal orphan has one. Branchless orphans are left to
 * `git worktree prune`.
 */
/** Extract the worktree path from a porcelain block if its branch contains `needle`. */
function matchingWorktreePath(block: string, needle: string): string | null {
  const lines = block.split("\n");
  const wt = lines.find((ln) => ln.startsWith("worktree "));
  const br = lines.find((ln) => ln.startsWith("branch "));
  const path = wt?.slice("worktree ".length).trim() ?? "";
  if (path === "" || !br?.includes(needle)) {
    return null;
  }
  return path;
}

export function worktreePathsForIssue(porcelain: string, iid: number): readonly string[] {
  const needle = `/afk/issue-${iid}-`;

  // Parse each porcelain block; keep paths whose branch matches the issue.
  return porcelain.split("\n\n").flatMap((block) => {
    const path = matchingWorktreePath(block, needle);
    return path === null ? [] : [path];
  });
}
