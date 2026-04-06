---
name: finishing-branch
description: Verify all claims with evidence, then complete a development branch via merge, PR, or cleanup
---

# Finishing a Branch

## Overview

Verify everything works with evidence, then integrate the work.

**Core principle:** Evidence before claims. Verify → Clean → Integrate → Cleanup.

**Announce at start:** "I'm using the finishing-branch skill to complete this work."

## Phase 1: Verification Gate (MANDATORY)

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the command in this message, you cannot claim it passes.

### 1.1 — Run Full Verification

```
1. IDENTIFY: What commands prove this work is correct?
2. RUN: Execute FULL commands (tests, build, linter) — fresh, complete
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence. STOP.
   - If YES: Proceed to Phase 2
```

Skip any step = lying, not verifying.

### 1.2 — Verification Requirements

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

### 1.3 — Red Flags: STOP and Verify

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!")
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- **ANY wording implying success without having run verification**

### 1.4 — Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

**If tests fail:** Stop. Fix failures. Re-run verification. Do not proceed.

## Phase 2: Cleanup Scan (MANDATORY before any commit)

AI-generated work leaves debris — catch it now, not in code review.

### 2.1 — Debug artifacts

```bash
# console.log / console.debug in changed files
git diff --name-only <base-branch>...HEAD | xargs grep -n 'console\.\(log\|debug\|warn\)' 2>/dev/null

# debugger statements
git diff --name-only <base-branch>...HEAD | xargs grep -n 'debugger' 2>/dev/null
```

### 2.2 — Orphan TODOs

```bash
# TODOs YOU added (not pre-existing)
git diff <base-branch>...HEAD | grep '^\+.*TODO'
```

If any TODO lacks a ticket reference (e.g., `TODO(PROJ-123)`), resolve it or add a reference. Orphan TODOs rot.

### 2.3 — Temp/scratch files

```bash
ls -1 | grep -iE '(temp|scratch|test_|debug_|untitled|copy|backup|\.\(bak\|tmp\|swp\))'
```

Delete anything that shouldn't be committed.

### 2.4 — Documentation gate

Before commit, verify these docs are up to date (if the project uses them):

- [ ] **CHANGELOG.md** — entry under `[Unreleased]`
- [ ] **README.md** — updated if new user-facing capability or setup step
- [ ] **.env.example** — entry for every new env var introduced

### 2.5 — Prune stale worktrees

```bash
git worktree prune
```

**If any issues found:** fix before proceeding. Do NOT commit with debris.

## Phase 3: Integration

### 3.1 — Determine Base Branch

```bash
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main — is that correct?"

### 3.2 — Present Options

Present exactly these 4 options:

```
Verification passed. Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Don't add explanation** — keep options concise.

### 3.3 — Execute Choice

#### Option 1: Merge Locally

```bash
git checkout <base-branch>
git pull
git merge <feature-branch>
<test command>              # Verify tests on merged result
git branch -d <feature-branch>
```

Then: Cleanup worktree (Phase 4).

#### Option 2: Push and Create PR

```bash
git push -u origin <feature-branch>

gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

Then: Cleanup worktree (Phase 4).

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation. If confirmed:
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then: Cleanup worktree (Phase 4).

## Phase 4: Worktree Cleanup

**For Options 1, 2, 4:**

```bash
git worktree list | grep $(git branch --show-current)
# If in worktree:
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.

## Phase 5: Post-Merge Verification (if PR merged)

Merge != success. CI can pass locally and fail in the pipeline.

```bash
# Check deployment status
gh run list --branch main --limit 5
gh run view <run-id>

# All jobs green -> task complete
# Any job red   -> task NOT complete, investigate
```

**Apply when:** a PR was merged, task includes deployment/release, or human says "it's merged."

## Quick Reference

| Phase | Gate | Proceed if |
|-------|------|------------|
| 1. Verification | Tests, build, linter | All green with evidence |
| 2. Cleanup | Debug artifacts, TODOs, docs | No debris found |
| 3. Integration | User choice (4 options) | Choice executed |
| 4. Worktree | Remove if not keeping | Clean |
| 5. Post-merge | CI/CD green | All jobs pass |

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | yes | - | - | yes |
| 2. Create PR | - | yes | yes | - |
| 3. Keep as-is | - | - | yes | - |
| 4. Discard | - | - | - | yes (force) |

## Red Flags

**Never:**
- Claim completion without fresh evidence
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request
- Trust "should work" or agent success reports

**Always:**
- Run verification commands before any claim
- Clean debris before committing
- Present exactly 4 options
- Get typed confirmation for Option 4

## Integration

**Called by:**
- **subagent-driven-development** (Step 7) — after all tasks complete
- **executing-plans** (Step 5) — after all batches complete

**Pairs with:**
- **using-git-worktrees** — cleans up worktree created by that skill
