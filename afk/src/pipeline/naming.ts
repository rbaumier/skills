/**
 * Pipeline/naming.ts — the pure naming conventions for an issue's branch and
 * worktree. No I/O; every function is a deterministic string transform.
 */
import { join } from "node:path";
import { WORKTREES_DIR } from "../config";
import type { IssueRef } from "./state";

/** Maximum characters kept from the slugified title. */
const MAX_SLUG_LENGTH = 40;

const NON_ALPHANUMERIC_RE = /[^a-z0-9]+/g;
const LEADING_TRAILING_HYPHENS_RE = /(^-+|-+$)/g;
const SLASH_RE = /\//g;

/** Turn an issue title into a lowercase, hyphenated, length-capped slug. */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replaceAll(NON_ALPHANUMERIC_RE, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replaceAll(LEADING_TRAILING_HYPHENS_RE, "");

/** The git branch an issue is worked on, e.g. `afk/issue-42-add-login`. */
export const branchName = (issue: IssueRef): string =>
  `afk/issue-${issue.iid}-${slugify(issue.title)}`;

/** The dedicated worktree directory for a branch, namespaced by repository. */
export const worktreePath = (repoName: string, branch: string): string =>
  join(WORKTREES_DIR, repoName, branch.replaceAll(SLASH_RE, "_"));
