---
name: continue
description: "/continue [plan] — implement an incomplete plan to 100% completion. No mocks, no TODOs, exhaustive tests."
---

# Continue Skill

Finish implementing an incomplete plan by closing every gap between spec and code.

## Invocation

```
/continue <plan-file>
```

**Examples:**
- `/continue docs/plan.md`
- `/continue specs/feature-auth.md`
- `/continue implementation-plan.txt`

## Process

```
READ PLAN → AUDIT CODEBASE → LOOP { IDENTIFY GAP → TEST → IMPLEMENT → FIX → COMMIT } → DONE
```

## Phase 1: Read and Understand

1. Read the plan file passed as argument
2. Build a mental model of every requirement, feature, API, component, and behavior specified
3. List ALL discrete items the plan requires (functions, routes, components, configs, integrations)

## Phase 2: Audit Current State

1. **Dead code scan**: Find all functions/methods that exist but are never called or imported - implement the missing calls/links so they are used as the spec intends
2. **Gap analysis**: Compare plan requirements vs implemented code line-by-line
3. **Produce a gap list**: For each unimplemented or partially implemented item, note:
   - What the spec says
   - What exists (if anything)
   - What's missing

Use TaskCreate to track every gap as a task.

## Phase 3: Iterative Implementation Loop

For EACH gap (ordered by dependency - implement foundations first):

### 3a. Write Tests First (spec-driven)

- Read the plan/spec for the behavior being implemented
- Write exhaustive tests covering:
  - **Unit tests** (Rust: `#[cfg(test)]` / JS: vitest/jest)
  - **Integration tests** verifying cross-component behavior
  - **E2E tests** (use the playwright-e2e-test skill) validating user-facing behavior
- Tests MUST validate behavior described in the spec that is NOT YET implemented or NOT YET tested
- After initial tests pass, add edge-case tests for the same behavior
- NEVER skip a test - if it fails, fix the implementation (not the test)

### 3b. Implement

- Implement the feature/fix to make tests pass
- Full depth: backend to frontend, no shortcuts
- **ZERO tolerance for**:
  - `TODO` / `FIXME` comments
  - Mock data, fixtures, fake conditions
  - Placeholder implementations
  - Hardcoded lists (discover dynamically per CLAUDE.md)
- Every function must be called somewhere - no dead code
- If architecture is unclear, invoke `/interview-me <plan-file>` before proceeding

### 3c. Run All Tests

- Run unit, integration, AND e2e tests
- If any test fails:
  1. Diagnose root cause
  2. Fix the implementation (NOT the test, unless the test is wrong per spec)
  3. Re-run until ALL green
- Tests detecting bugs = expected behavior - fix the bug, not the test

### 3d. Commit

- Upsert `.gitignore` if new file types were added
- `git add` the relevant files
- `git commit` with a descriptive message of what was implemented
- One commit per logical unit of work (not per file)

## Phase 4: Verification

After all gaps are closed:

1. Run the FULL test suite one final time (unit + integration + e2e)
2. Verify no dead code remains (all functions are called/used)
3. Verify no TODO/FIXME in codebase
4. Verify plan coverage is 100%

## Stop Condition

**Only stop when ALL of these are true:**
- Every item in the plan is implemented at full depth
- All unit tests pass
- All integration tests pass
- All e2e tests pass
- No dead code (every function is called)
- No TODO/FIXME/mock/fake data anywhere
- Every step has been committed

## Rules

- NEVER mock anything - write real implementations
- NEVER skip tests - implement until they pass
- NEVER leave TODO/FIXME - implement it now
- NEVER use fake/fixture data - implement real data flow
- ALWAYS commit at each step (upsert .gitignore first)
- ALWAYS use /interview-me when architecture is unclear
- ALWAYS use the playwright-e2e-test skill for e2e tests
- ALWAYS follow CLAUDE.md rules (no hardcoded lists, no async/await try/catch, etc.)

## Related Skills

- `/interview-me` - Architecture questions and doubts
- `/implement` - Initial parallel implementation of a plan
- `/build` - Run full build and tests
- `/review-before-push` - Pre-push verification
