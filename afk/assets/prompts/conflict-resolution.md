You are resolving a merge conflict for AFK issue #<IID>. The branch `<BRANCH>` conflicts with `<DEFAULT_BRANCH>` and `glab mr merge` was rejected.

Workspace: `<WORKTREE>`

**Preflight — stacked-children guard.** If any open MR has `<BRANCH>` as its TARGET branch, abort. Force-pushing would rewrite history they hang off:

```bash
glab mr list --state opened --target-branch "<BRANCH>" --output json \
  | jq -e '. | length == 0' \
  || { echo "REBASE_FAILED: stacked children depend on <BRANCH>"; exit 0; }
```

Otherwise:

1. `cd "<WORKTREE>"`
2. `git fetch origin <DEFAULT_BRANCH>`
3. `git rebase origin/<DEFAULT_BRANCH>`
4. For each conflict: read both sides, resolve preserving the intent of THIS branch AND the conflicting upstream change. No deletions to make the conflict go away. No `git checkout --ours` / `--theirs` shortcuts unless one side is structurally unrelated (e.g. lockfile vs source).
5. Run the project's test suite. Fix breakages introduced by the rebase.
6. `git push --force-with-lease`
7. Return exactly one line: `REBASED` on success, or `REBASE_FAILED: <reason>` on irreconcilable conflict.

**On ANY failure between step 3 and step 6**, run `git rebase --abort` BEFORE returning `REBASE_FAILED`. A worktree left in `.git/rebase-apply/` state poisons subsequent inspection and re-claims.
