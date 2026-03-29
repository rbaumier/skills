# Diff Review File Reference

## Frontmatter Schema

```yaml
---
mode: commits              # commits | branches | worktrees | staged | working
left: abc1234              # base ref (omit for staged/working)
right: def5678             # feature ref (omit for staged/working)
label: "abc1234..def5678"  # display label (quoted)
pending: true              # only when review is in progress
files:
  - path: "src/foo.ts"
    status: M              # A | M | D | R
    reviewed: false
---
```

| Field | Required | Notes |
|-------|----------|-------|
| `mode` | yes | One of: `commits`, `branches`, `worktrees`, `staged`, `working` |
| `left` | for commits/branches | Base ref (short SHA or branch name) |
| `right` | for commits/branches | Feature ref |
| `label` | yes | Display string shown in sidebar |
| `pending` | no | `true` shows "(in progress)" badge |
| `files[].path` | yes | Relative path from workspace root |
| `files[].status` | yes | `A` (added), `M` (modified), `D` (deleted), `R` (renamed) |
| `files[].reviewed` | yes | `true` or `false` |

## Comment Format

```markdown
- [ ] `src/foo.ts:10` This needs a null check
  > Fixed with optional chaining — agent
- [x] `src/foo.ts:25-30` Rename this variable
```

- `[ ]` = unresolved, `[x]` = resolved
- Location: `` `path:line` `` or `` `path:line-endLine` ``
- Replies: indented `> text` lines immediately after the comment

## Constraints

- Files go in `reviews/` directory at workspace root
- Must end in `.md`
- Parsed by `ReviewSession.fromMarkdown()` in the extension
