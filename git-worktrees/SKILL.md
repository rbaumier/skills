---
name: git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

**Announce at start:** "I'm using the git-worktrees skill to set up an isolated workspace."

## Directory Selection Process

Follow this priority order:

### 1. Check Existing Directories

```bash
# Check in priority order
ls -d .worktrees 2>/dev/null     # Preferred (hidden)
ls -d worktrees 2>/dev/null      # Alternative
```

**If found:** Use that directory. If both exist, `.worktrees` wins.

### 2. Check CLAUDE.md

```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```

**If preference specified:** Use it without asking.

### 3. Ask User

If no directory exists and no CLAUDE.md preference:

```
No worktree directory found. Where should I create worktrees?

1. .worktrees/ (project-local, hidden)
2. ~/.config/claude/worktrees/<project-name>/ (global location)

Which would you prefer?
```

## Safety Verification

### For Project-Local Directories (.worktrees or worktrees)

**MUST verify directory is ignored before creating worktree:**

```bash
# Check if directory is ignored (respects local, global, and system gitignore)
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:**

Per Jesse's rule "Fix broken things immediately":
1. Add appropriate line to .gitignore
2. Commit the change
3. Proceed with worktree creation

**Why critical:** Prevents accidentally committing worktree contents to repository.

### For Global Directory (~/.config/claude/worktrees)

No .gitignore verification needed - outside project entirely.

## Creation Steps

### 1. Detect Project Name

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. Create Worktree

```bash

Handle submodules in worktrees — worktrees don't automatically initialize submodules. After creating a worktree in a repo with submodules, run `git submodule update --init --recursive` in the new worktree.

Per-worktree .env files — worktrees share git config but NOT working directory files. Each worktree needs its own `.env` file (different ports, different DB names to avoid conflicts). Symlink shared config (tsconfig, eslintrc) but copy .env templates.
# Determine full path
case $LOCATION in
  .worktrees|worktrees)
    path="$LOCATION/$BRANCH_NAME"
    ;;
  ~/.config/claude/worktrees/*)
    path="~/.config/claude/worktrees/$project/$BRANCH_NAME"
    ;;
esac

# Create worktree with new branch
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

### 3. Run Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 4. Per-Worktree Environment

Worktrees share git config but NOT working directory files. Each worktree needs its own `.env` file (different ports, different DB names to avoid conflicts). Symlink shared configs that don't vary: `ln -s ../../.env.shared .env.shared`. Copy and modify configs that do vary (ports, DB names).

### 5. Verify Clean Baseline

Run tests to ensure worktree starts clean:

```bash
# Examples - use project-appropriate command
npm test
cargo test
pytest
go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### 5. Report Location

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists | Check CLAUDE.md → Ask user |
| Directory not ignored | Add to .gitignore + commit |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |
| Long-lived worktree | `git worktree lock <path>` prevents accidental pruning |
| Unlock when done | `git worktree unlock <path>` |

Worktree lock for long-lived worktrees — `git worktree lock <path>` prevents accidental pruning of worktrees on external drives, remote mounts, or in use by other agents. `git worktree unlock <path>` when done.

List and audit worktrees periodically — run `git worktree list` to see all active worktrees. Stale worktrees (deleted directories) show as 'prunable'. Run `git worktree prune` to clean them. Before creating a new worktree, check if one already exists for that branch.

Cleanup after finishing — run `git worktree remove <path>` (not just `rm -rf`), then `git worktree prune` to clean stale references. Delete the branch if merged: `git branch -d <branch>`. Add to finishing-a-development-branch integration.

## Advanced: Bare Repo Pattern

For worktree-centric workflows: `git clone --bare <url> .bare && echo 'gitdir: ./.bare' > .git`. All branches as worktrees, no "main" checkout. Used when the primary workflow IS worktree-based (e.g., reviewing multiple PRs simultaneously). Trade-off: more disk space, simpler mental model.

## Common Mistakes

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating project-local worktree

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Follow priority: existing > CLAUDE.md > ask

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Shared hooks break in worktrees

- **Problem:** Git hooks in `.git/hooks` are shared across all worktrees. Custom hooks using relative paths may break in worktrees
- **Fix:** Use `core.hooksPath` to point to a project-relative hooks directory, or use absolute paths in hooks

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools
- **Fix:** Auto-detect from project files (package.json, etc.)

Shared hooks across worktrees — git hooks in `.git/hooks` are shared across all worktrees (they're in the common git directory). Custom hooks that use relative paths may break in worktrees. Use `core.hooksPath` pointing to a versioned hooks directory if hooks need to be worktree-aware.

### Submodules not initialized

- **Problem:** Worktrees don't automatically initialize submodules. Build fails with missing dependencies
- **Fix:** After creating a worktree in a repo with submodules, run `git submodule update --init --recursive`

## Example Workflow

```
You: I'm using the git-worktrees skill to set up an isolated workspace.

[Check .worktrees/ - exists]
[Verify ignored - git check-ignore confirms .worktrees/ is ignored]
[Create worktree: git worktree add .worktrees/auth -b feature/auth]
[Run npm install]
[Run npm test - 47 passing]

Worktree ready at /Users/jesse/myproject/.worktrees/auth
Tests passing (47 tests, 0 failures)
Ready to implement auth feature
```

## Cleanup

After finishing work in a worktree:
```bash
git worktree remove <path>   # NOT just rm -rf (leaves stale refs)
git worktree prune            # Clean stale worktree references
git branch -d <branch>        # Delete branch if merged
```

Run `git worktree list` periodically to audit active worktrees. Stale entries (deleted directories) show as "prunable". Run `git worktree prune` to clean them. Add cleanup to your finishing-a-development-branch workflow. Stale worktrees accumulate and confuse `git worktree list`.

## Red Flags

**Never:**
- Create worktree without verifying it's ignored (project-local)
- Skip baseline test verification
- Proceed with failing tests without asking
- Assume directory location when ambiguous
- Skip CLAUDE.md check

**Always:**
- Follow directory priority: existing > CLAUDE.md > ask
- Verify directory is ignored for project-local
- Auto-detect and run project setup
- Verify clean test baseline

## Integration

**Called by:**
- **brainstorming** (Phase 4) - REQUIRED when design is approved and implementation follows
- **subagent-driven-development** - REQUIRED before executing any tasks
- **executing-plans** - REQUIRED before executing any tasks
- Any skill needing isolated workspace

**Pairs with:**
- **finishing-a-development-branch** - REQUIRED for cleanup after work complete


Bare repo pattern for worktree-centric workflows — `git clone --bare <url> .bare && echo 'gitdir: ./.bare' > .git`. All branches as worktrees, no 'main' checkout. Used when the primary workflow IS worktrees (e.g., multi-agent development).
