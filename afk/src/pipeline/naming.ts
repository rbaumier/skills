/**
 * pipeline/naming.ts — the pure naming conventions for an issue's branch and
 * worktree. No I/O; every function is a deterministic string transform.
 */
import { join } from "node:path"
import { WORKTREES_DIR } from "../config"
import type { IssueRef } from "./state"

/** Turn an issue title into a lowercase, hyphenated, length-capped slug. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

/** The git branch an issue is worked on, e.g. `afk/issue-42-add-login`. */
export function branchName(issue: IssueRef): string {
  return `afk/issue-${issue.iid}-${slugify(issue.title)}`
}

/** The dedicated worktree directory for a branch, namespaced by repository. */
export function worktreePath(repoName: string, branch: string): string {
  return join(WORKTREES_DIR, repoName, branch.replace(/\//g, "_"))
}
