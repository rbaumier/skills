import { describe, expect, it } from "vitest";
import { branchName, worktreePath } from "./naming";

describe("branchName", () => {
  it("builds afk/issue-<iid>-<slug> from a plain title", () => {
    expect(branchName({ iid: 42, title: "Add login", body: "" })).toBe("afk/issue-42-add-login");
  });

  it("lowercases and collapses non-alphanumeric runs into single hyphens", () => {
    expect(branchName({ iid: 7, title: "Fix  the   CACHE!!", body: "" })).toBe(
      "afk/issue-7-fix-the-cache",
    );
  });

  it("strips leading and trailing hyphens from the slug", () => {
    expect(branchName({ iid: 9, title: "  ...trim me...  ", body: "" })).toBe(
      "afk/issue-9-trim-me",
    );
  });

  it("caps the slug at 40 characters", () => {
    const slug = branchName({ iid: 1, title: "a".repeat(80), body: "" }).replace(
      "afk/issue-1-",
      "",
    );
    expect(slug.length).toBe(40);
  });

  it("yields a trailing hyphen when the title has no alphanumerics", () => {
    expect(branchName({ iid: 5, title: "!!!", body: "" })).toBe("afk/issue-5-");
  });
});

describe("worktreePath", () => {
  it("replaces slashes in the branch name with underscores", () => {
    const path = worktreePath("my-repo", "afk/issue-42-add-login");
    expect(path.endsWith("/my-repo/afk_issue-42-add-login")).toBe(true);
  });
});
