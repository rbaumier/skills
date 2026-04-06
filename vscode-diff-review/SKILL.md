---
name: vscode-diff-review
description: Generate review markdown files for the vscode-diff-review Cursor/VSCode extension. Use when the user asks to create a review, diff review, review changes, or after completing work that needs review.
---

# Create a Diff Review

Generate a review `.md` file in `./reviews/` (relative to the **git repository root**, not a subdirectory) for the `vscode-diff-review` extension.

**IMPORTANT:** Always run the script from the git repository root so that the `reviews/` folder is created at the top level of the project. Do NOT run it from a subdirectory (e.g. `frontend/`), or the output will end up in the wrong place.

## Quick Start

Run the bundled script **from the git repo root**:

```bash
# Compare commits (default mode)
cd "$(git rev-parse --show-toplevel)" && bash {SKILL_DIR}/scripts/create-review.sh [FROM] [TO]

# Working tree mode — review unstaged/staged changes before committing
cd "$(git rev-parse --show-toplevel)" && bash {SKILL_DIR}/scripts/create-review.sh --working
```

- `FROM`: base ref — branch, tag, or commit (default: `origin/master`)
- `TO`: feature ref (default: `HEAD`)
- `--working`: uses `git diff` (unstaged) and `git diff --cached` (staged) instead of commit-to-commit diffs. Sets `mode: working` in frontmatter.

Example: `bash {SKILL_DIR}/scripts/create-review.sh origin/master HEAD`

Output: `reviews/2026-03-11-12h30-commits-abc1234-vs-def5678.md`

## Workflow

1. Run the script — it computes `git diff --name-status` and generates the frontmatter + skeleton
2. Return the file path to the user
3. User opens it in Cursor/VSCode — the extension renders the diff viewer with file tree

## Processing Review Feedback

After the user annotates the review in VSCode, process their feedback:

1. Read the review `.md` file — look for comments (`- [ ]` = unresolved, `- [x]` = resolved)
2. For each unresolved comment:
   a. Read the comment text and referenced file/line
   b. Fix the issue in the codebase
   c. Add a reply line: `  > description of fix — agent`
   d. Mark as resolved: change `- [ ]` to `- [x]`
3. Re-run the diff script to generate an updated review with the new changes
4. Tell the user: "I've addressed N comments. Please review the updated diff."

## Auto-Trigger Guidance

After completing work, if changes span 3+ files, proactively offer:

> "I've completed the changes. Would you like me to generate a diff review so you can inspect the changes in VSCode?"

## Manual Creation

If the script can't run (no git, custom mode), create the file manually:

```markdown
---
mode: working
pending: true
files:
  - path: "src/foo.ts"
    status: M
    reviewed: false
---

# Diff Review: Working Tree

**Mode:** working
**Date:** 2026-03-11
**Files:** 1 (0 reviewed)

## Agent Instructions

Review the comments below. For each unresolved comment:
1. Fix the issue in the codebase
2. Add a reply line under the comment: `  > description of fix — agent`
3. Mark as resolved by changing `- [ ]` to `- [x]`

## Comments

_No comments._
```

## Reference

See [REFERENCE.md](REFERENCE.md) for frontmatter schema, comment format, and constraints.
