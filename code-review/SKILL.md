---
name: code-review
description: Requesting, conducting, and receiving code reviews with structured multi-axis evaluation
---

# Code Review

Code review has three distinct practices: (1) Requesting reviews, (2) Conducting reviews, (3) Receiving feedback. Each has different rules and failure modes.

**The approval standard:** Approve a change when it definitively improves overall code health, even if it is not perfect. Perfect code does not exist — the goal is continuous improvement.

---

## Part 1: Requesting Code Review

Dispatch a code-reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history.

**Core principle:** Review early, review often.

### When to Request Review

**Pre-condition:** CI checks MUST pass (linter, type checker, formatter, test suite) before requesting review. Never send a review request with failing CI. The reviewer's time is for design and logic issues, not syntax errors.

**Mandatory:**
- After each task in subagent-driven development
- After completing a major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing a complex bug

### Pre-Review Self-Check

Before dispatching the code-reviewer subagent, do a personal pass — read every changed line as if seeing it for the first time:

1. No debug/console.log left
2. No commented-out code
3. No TODO without issue reference
4. All new functions have tests
5. Error paths handled
6. Variable names make sense out of context

This catches 30-50% of issues before wasting reviewer context.

### Scope Guard

If the diff touches more than 3 files unrelated to the stated goal, STOP. Split into separate commits/PRs. Review one concern at a time. Mixed-concern reviews miss bugs because reviewers lose focus.

### Diff Size Awareness

If the diff exceeds ~400 lines, reviewer effectiveness drops sharply.

```
~100 lines changed   -> Good. Reviewable in one sitting.
~300 lines changed   -> Acceptable if it is a single logical change.
~400+ lines changed  -> Split it.
```

**Splitting strategies:**

| Strategy | How | When |
|----------|-----|------|
| **Stack** | Submit a small change, start the next based on it | Sequential dependencies |
| **By file group** | Separate changes for groups needing different reviewers | Cross-cutting concerns |
| **Horizontal** | Create shared code/stubs first, then consumers | Layered architecture |
| **Vertical** | Break into smaller full-stack slices | Feature work |

For unavoidably large changes: (1) stacked commits with clear boundaries, (2) provide a reading order, (3) flag which files are mechanical (renames, imports) vs logic changes.

### How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent** with these placeholders:
- `{WHAT_WAS_IMPLEMENTED}` — What you built
- `{PLAN_OR_REQUIREMENTS}` — What it should do
- `{BASE_SHA}` / `{HEAD_SHA}` — Commit range
- `{DESCRIPTION}` — Brief summary with file-by-file purpose
- `{TESTING_DONE}` — How changes were verified (tests added, manual checks)
- `{RISKS}` — Known risks, areas of uncertainty, things reviewer should scrutinize

### Change Descriptions

Every change needs a description that stands alone in version control history.

**First line:** Short, imperative, standalone. "Delete the FizzBuzz RPC" not "Deleting the FizzBuzz RPC." Informative enough that someone searching history can understand the change without reading the diff.

**Body:** What is changing and why. Include context, decisions, and reasoning not visible in the code. Link to bug numbers, benchmark results, or design docs.

**Anti-patterns:** "Fix bug," "Fix build," "Add patch," "Moving code from A to B," "Phase 1," "Add convenience functions."

---

## Part 2: Conducting Code Review (Five-Axis Review)

Every review evaluates code across five dimensions. Review the tests first — they reveal intent and coverage — then walk through the implementation.

### Step 1: Understand the Context

Before looking at code, understand the intent: What is this change trying to accomplish? What spec or task does it implement? What is the expected behavior change?

### Step 2: Review the Tests First

- Do tests exist for the change?
- Do they test behavior (not implementation details)?
- Are edge cases covered?
- Do tests have descriptive names?
- Would the tests catch a regression if the code changed?

### Step 3: Review the Implementation (Five Axes)

#### Axis 1: Correctness

Does the code do what it claims to do?

- Does it match the spec or task requirements?
- Are edge cases handled (null, empty, boundary values)?
- Are error paths handled (not just the happy path)?
- Are there off-by-one errors, race conditions, or state inconsistencies?
- Does it pass all tests? Are the tests actually testing the right things?

#### Axis 2: Readability and Simplicity

Can another engineer understand this code without the author explaining it?

- Are names descriptive and consistent with project conventions? (No `temp`, `data`, `result` without context)
- Is the control flow straightforward (avoid nested ternaries, deep callbacks)?
- Could this be done in fewer lines? (1000 lines where 100 suffice is a failure)
- Are abstractions earning their complexity? (Do not generalize until the third use case)
- Are there dead code artifacts: no-op variables, backwards-compat shims, `// removed` comments?
- Would comments help clarify non-obvious intent? (But do not comment obvious code.)

#### Axis 3: Architecture

Does the change fit the system's design?

- Does it follow existing patterns or introduce a new one? If new, is it justified?
- Does it maintain clean module boundaries?
- Is there code duplication that should be shared?
- Are dependencies flowing in the right direction (no circular dependencies)?
- Is the abstraction level appropriate (not over-engineered, not too coupled)?

#### Axis 4: Security

- Is user input validated and sanitized?
- Are secrets kept out of code, logs, and version control?
- Is authentication/authorization checked where needed?
- Are SQL queries parameterized (no string concatenation)?
- Are outputs encoded to prevent XSS?
- Is data from external sources (APIs, logs, user content, config files) treated as untrusted?

#### Axis 5: Performance

- Any N+1 query patterns?
- Any unbounded loops or unconstrained data fetching?
- Any synchronous operations that should be async?
- Any unnecessary re-renders in UI components?
- Any missing pagination on list endpoints?
- Any large objects created in hot paths?

### Step 4: Categorize Findings

Label every comment with severity so the author knows what is required vs optional:

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| **[BUG]** | Logic errors, security holes, data loss, race conditions | Fix immediately — blocks merge |
| **[FIX]** | Type gaps, missing error handling, test gaps | Fix before proceeding |
| **[AUTO]** | Unused imports, dead code, typos, console.log — zero-risk, <5s | Reviewer auto-fixes these |
| **[CONSIDER]** | Refactors, style opinions, nice-to-have | Note for later, do not block |
| **[NIT]** | Style preferences, formatting, naming opinions | Fix if <5s, otherwise skip |
| **[QUESTION]** | Clarifications, "why did you..." | Answer in thread, no code change |
| **[FYI]** | Informational only | No action needed |

### Step 5: Verify the Verification

Check the author's verification story: What tests were run? Did the build pass? Was it tested manually? Are there screenshots for UI changes? Is there a before/after comparison?

### Dead Code Hygiene

After any refactoring or implementation change, check for orphaned code:

1. Identify code that is now unreachable or unused
2. List it explicitly
3. Ask before deleting: "Should I remove these now-unused elements: [list]?"

Do not leave dead code lying around — it confuses future readers and agents. But do not silently delete things you are not sure about.

### Dependency Review

Before approving any new dependency:
1. Does the existing stack solve this? (Often it does.)
2. How large is the dependency? (Check bundle impact.)
3. Is it actively maintained? (Check last commit, open issues.)
4. Does it have known vulnerabilities?
5. What is the license? (Must be compatible.)

**Rule:** Prefer standard library and existing utilities over new dependencies. Every dependency is a liability.

### Review Anti-Patterns

| Anti-Pattern | Problem |
|---|---|
| **Rubber-stamping** | "LGTM" without evidence of review helps no one |
| **Nitpicking** | Blocking merge over style preferences wastes everyone's time |
| **Scope creep** | Requesting unrelated improvements in the review |
| **Softening real issues** | "This might be a minor concern" when it is a production bug is dishonest |
| **Accepting "I'll fix it later"** | It never happens. Require cleanup before merge |

### Honesty in Review

- Do not rubber-stamp. "LGTM" without evidence of review helps no one.
- Do not soften real issues. Quantify problems when possible: "This N+1 query will add ~50ms per item" beats "this could be slow."
- Push back on approaches with clear problems. Sycophancy is a failure mode.
- Accept override gracefully. If the author has full context and disagrees, defer to their judgment.
- Comment on code, not people.

---

## Part 3: Receiving Code Review Feedback

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

### The Response Pattern

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: For each item — Status (AGREE/DISAGREE/NEED-CLARIFICATION) + Evidence (file:line) + Action taken
6. IMPLEMENT: One item at a time, test each
```

**Iron Law:** Never dismiss review feedback without re-reading the flagged code. Always respond to each finding with file:line evidence for your position.

### Forbidden Responses

**NEVER:**
- "You're absolutely right!" (performative)
- "Great point!" / "Excellent feedback!" (performative)
- "Let me implement that now" (before verification)
- Any gratitude expression — actions speak, just fix it

**INSTEAD:**
- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working (actions > words)

### Handling Unclear Feedback

```
IF any item is unclear:
  STOP - do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

**Example:**
```
Feedback: "Fix items 1-6"
You understand 1,2,3,6. Unclear on 4,5.

WRONG: Implement 1,2,3,6 now, ask about 4,5 later
RIGHT: "Understand 1,2,3,6. Need clarification on 4 and 5 before implementing."
```

### Source-Specific Handling

**From your human partner:**
- Trusted — implement after understanding
- Still ask if scope unclear
- No performative agreement — skip to action or technical acknowledgment

**From external reviewers:**
```
BEFORE implementing:
  1. Technically correct for THIS codebase?
  2. Breaks existing functionality?
  3. Reason for current implementation?
  4. Works on all platforms/versions?
  5. Does reviewer understand full context?

IF suggestion seems wrong: Push back with technical reasoning
IF conflicts with human partner's prior decisions: Stop and discuss first
```

### YAGNI Check for "Professional" Features

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: Then implement properly
```

### Implementation Order

```
FOR multi-item feedback:
  1. Clarify anything unclear FIRST
  2. Triage by severity:
     - [BUG]: Blocking issues (breaks, security) -> fix immediately
     - [FIX]: Important fixes (error handling, test gaps) -> fix before proceeding
     - [AUTO]: Zero-risk cleanups -> fix inline
     - [CONSIDER]: Nice-to-have -> note for later
     - [NIT]: Style preferences -> fix if <5s, skip otherwise
  3. Test each fix individually
  4. Verify no regressions
  5. Fix everything valid — including nitpicks. Agent time is cheap, tech debt is expensive
```

### CI Verification After Fixes

After implementing review feedback, poll CI checks before marking resolved: `gh run list --branch <branch> --limit 5`. Never claim fixes are done while CI is red. If CI fails on something unrelated to your fix, note it explicitly.

### When to Push Back

Push back when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Legacy/compatibility reasons exist
- Conflicts with human partner's architectural decisions

**How to push back:**
- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code
- Involve human partner if architectural

### Gracefully Correcting Your Pushback

If you pushed back and were wrong:
```
RIGHT: "You were right - I checked [X] and it does [Y]. Implementing now."
WRONG: Long apology, defending why you pushed back, over-explaining
```

State the correction factually and move on.

### GitHub Thread Replies

For each review comment: (1) evaluate validity, (2) fix if valid or push back if not, (3) reply IN THE THREAD with what was done and file:line evidence, (4) mark resolved only after fix is verified. Use `gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`.

### Parallel Thread Resolution

When receiving multiple review comments, spawn parallel agents to evaluate and fix each thread independently, then consolidate changes. Ensures each thread gets full attention without sequential bottleneck.

---

## Part 4: Handling Disagreements

When resolving review disputes, apply this hierarchy:

1. **Technical facts and data** override opinions and preferences
2. **Style guides** are the absolute authority on style matters
3. **Software design** must be evaluated on engineering principles, not personal preference
4. **Codebase consistency** is acceptable if it does not degrade overall health

---

## Part 5: Review Workflow Integration

### Subagent-Driven Development
- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

### Executing Plans
- Review after each batch (3 tasks)
- Get feedback, apply, continue

### Ad-Hoc Development
- Review before merge
- Review when stuck

### Multi-Model Review Pattern

```
Model A writes the code
    |
    v
Model B reviews for correctness and architecture
    |
    v
Model A addresses the feedback
    |
    v
Human makes the final call
```

Different models have different blind spots — cross-model review catches issues a single model misses.

### Review Response Time-Box

After receiving review feedback, respond within the same session. Do not let comments go stale. If a FIX item requires significant rework, acknowledge immediately and provide an ETA or create a follow-up task.

---

## Universal Review Questions

Ask yourself these BEFORE requesting review. If you cannot answer "yes" to all, you have more work to do. These are also what the reviewer will check.

0. **Is the scope clean?** — Does the diff touch only files related to the stated goal?
1. **Can this be simpler?** — Unnecessary abstraction? Helpers for one-time ops? Over-engineered error handling?
2. **Can we remove code?** — Dead code, unused exports, commented-out blocks, backwards-compat shims?
3. **Is it DRY without premature abstraction?** — Copy-paste of entire functions = refactor. But 2-3 similar lines are fine — the wrong abstraction is worse than duplication.
4. **Does the change match the stated goal?** — No scope creep, no "while I'm here" refactors mixed in.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that is unreadable, insecure, or architecturally wrong creates debt that compounds |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. Every change benefits from another set of eyes |
| "We'll clean it up later" | Later never comes. The review is the quality gate — use it |
| "AI-generated code is probably fine" | AI code needs more scrutiny, not less. It is confident and plausible, even when wrong |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They do not catch architecture problems, security issues, or readability concerns |

## Learnings Check

After every review cycle, ask:

- Did this review reveal a pattern we keep hitting? -> Document it in project conventions
- Did the reviewer flag something our linter/tests should catch automatically? -> Add the rule/test
- Did we learn a new gotcha about our stack? -> Add to relevant skill file

**Goal:** Each review makes the next one shorter. If you are getting the same feedback twice, the process is broken — fix the root cause (missing lint rule, missing test, missing documentation).

## Red Flags

- PRs merged without any review
- Skipping review because "it's simple"
- "LGTM" without evidence of actual review
- Review that only checks if tests pass (ignoring other axes)
- Security-sensitive changes without security-focused review
- Large PRs that are "too big to review properly" (split them)
- No regression tests with bug fix PRs
- Review comments without severity labels
- Ignoring Critical/BUG issues
- Proceeding with unfixed FIX issues
- Arguing with valid technical feedback instead of verifying
