import { describe, expect, it } from "vitest"
import { selectStale, worktreePathsForIssue } from "./stale"

const HOUR = 60 * 60 * 1000
const NOW = Date.parse("2026-05-22T12:00:00Z")

describe("selectStale", () => {
  it("selects a claim older than the threshold", () => {
    const issues = [{ iid: 1, updatedAt: "2026-05-22T09:00:00Z" }] // 3h ago
    expect(selectStale(issues, NOW, 2 * HOUR).map((i) => i.iid)).toEqual([1])
  })

  it("keeps a fresh claim", () => {
    const issues = [{ iid: 2, updatedAt: "2026-05-22T11:00:00Z" }] // 1h ago
    expect(selectStale(issues, NOW, 2 * HOUR)).toEqual([])
  })

  it("is exclusive at exactly the threshold", () => {
    const issues = [{ iid: 3, updatedAt: "2026-05-22T10:00:00Z" }] // exactly 2h ago
    expect(selectStale(issues, NOW, 2 * HOUR)).toEqual([])
  })

  it("never selects an issue with an unparseable date", () => {
    const issues = [{ iid: 4, updatedAt: "not-a-date" }]
    expect(selectStale(issues, NOW, 2 * HOUR)).toEqual([])
  })

  it("filters a mixed list", () => {
    const issues = [
      { iid: 1, updatedAt: "2026-05-22T08:00:00Z" }, // 4h — stale
      { iid: 2, updatedAt: "2026-05-22T11:30:00Z" }, // 30m — fresh
      { iid: 3, updatedAt: "2026-05-21T12:00:00Z" }, // 24h — stale
    ]
    expect(selectStale(issues, NOW, 2 * HOUR).map((i) => i.iid)).toEqual([1, 3])
  })
})

describe("worktreePathsForIssue", () => {
  const porcelain = [
    "worktree /home/u/.afk-worktrees/repo/afk_issue-5-add-login",
    "HEAD aaaa",
    "branch refs/heads/afk/issue-5-add-login",
    "",
    "worktree /home/u/.afk-worktrees/repo/afk_issue-55-other",
    "HEAD bbbb",
    "branch refs/heads/afk/issue-55-other",
    "",
    "worktree /home/u/project",
    "HEAD cccc",
    "branch refs/heads/master",
    "",
  ].join("\n")

  it("finds the worktree for an issue", () => {
    expect(worktreePathsForIssue(porcelain, 5)).toEqual([
      "/home/u/.afk-worktrees/repo/afk_issue-5-add-login",
    ])
  })

  it("does not match a different issue with a prefix-overlapping iid", () => {
    expect(worktreePathsForIssue(porcelain, 5)).not.toContain(
      "/home/u/.afk-worktrees/repo/afk_issue-55-other",
    )
  })

  it("returns empty when no worktree belongs to the issue", () => {
    expect(worktreePathsForIssue(porcelain, 999)).toEqual([])
  })

  it("handles empty input", () => {
    expect(worktreePathsForIssue("", 5)).toEqual([])
  })

  it("skips detached / branchless and bare worktree blocks", () => {
    const odd = [
      "worktree /home/u/detached",
      "HEAD dddd",
      "detached",
      "",
      "worktree /home/u/bare-repo",
      "bare",
      "",
      "worktree /home/u/.afk-worktrees/repo/afk_issue-5-x",
      "HEAD eeee",
      "branch refs/heads/afk/issue-5-x",
      "",
    ].join("\n")
    expect(worktreePathsForIssue(odd, 5)).toEqual(["/home/u/.afk-worktrees/repo/afk_issue-5-x"])
  })
})
