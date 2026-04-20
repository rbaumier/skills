---
name: request-refactor-plan
description: Use when user wants to plan a refactor, create a refactoring RFC, break a refactor into safe incremental steps, or mentions "refactor plan", "refactoring", "Fowler tiny steps". Interviews the user, verifies assumptions against code, produces a tiny-commit plan, saves as local markdown RFC (not a GitHub issue).
---

# Request Refactor Plan (local doc)

Create a detailed refactor plan with **tiny commits** via user interview. Output goes to a local markdown RFC — no GitHub integration.

Inspired by Martin Fowler's advice: *"Make each refactoring step as small as possible, so that you can always see the program working."*

## Process

Skip steps if they're clearly unnecessary. But default to asking rather than assuming.

### 1. Get the problem statement

Ask the user for a **long, detailed description** of the problem they want to solve and any ideas they've had for solutions.

### 2. Verify against the code

Explore the repo to verify their assertions and understand current state. If their mental model is wrong, surface that before planning.

### 3. Consider alternatives

Ask whether they've considered other options. Present alternatives if relevant — don't let them converge on the first idea without stress-testing.

### 4. Interview the user about implementation

Be extremely detailed and thorough. For each question, provide your recommended answer. Ask one question at a time.

### 5. Hammer out scope

Work out what you plan to change and what you plan NOT to change. Scope discipline prevents refactor creep.

### 6. Check test coverage

Look at test coverage for the area being refactored. **Refactoring without tests is rewriting.** If coverage is insufficient, ask the user what their testing plan is — do we add characterization tests first?

### 7. Break into tiny commits

Break the implementation into a plan of **tiny commits**. Each commit should leave the codebase in a working state. If a commit can't be independently green, it's too big — split it.

### 8. Write the doc

**Default location**: `docs/rfcs/YYYY-MM-DD-refactor-{slug}.md` at repo root. Create `docs/rfcs/` if missing.

If the user specifies a path, use that. If the repo has an existing RFC convention, propose using it.

Use the template below. Don't ask the user to review the doc content — just create it and share the path.

## RFC Template

```markdown
# Refactor: {Title}

**Date**: YYYY-MM-DD
**Status**: Draft

## Problem Statement

The problem the developer is facing, from the developer's perspective.

## Solution

The solution to the problem, from the developer's perspective.

## Commits

A LONG, detailed implementation plan. Write the plan in plain English, breaking the implementation into the **tiniest commits possible**. Each commit should leave the codebase in a working state.

Format: one commit per bullet, numbered.

1. **{Commit title}** — what changes, what stays green, expected file touches
2. **{Commit title}** — ...
3. ...

## Decision Document

Implementation decisions made during the interview:

- Modules that will be built/modified
- Interfaces being modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

**Do NOT include specific file paths or code snippets** — they rot.

## Testing Decisions

- What makes a good test here (test external behavior, not implementation)
- Which modules will be tested
- Prior art: similar tests already in the codebase
- Characterization test strategy (if the area was under-tested)

## Out of Scope

What's explicitly excluded from this refactor.

## Further Notes (optional)

Anything else worth capturing.
```

## Anti-Patterns

- **One-commit refactor** — if the plan is "rewrite the module and ship", it's not a refactor, it's a rewrite. Split into tiny commits.
- **Refactoring without tests** — add characterization tests first. Don't plan a refactor assuming tests will be written alongside.
- **Scope creep** — "while I'm in there..." is the enemy. Stay in scope.
- **File paths in the doc** — they rot. Describe behavior.

## Cross-References

- `coding-standards` — the refactor targets (Stepdown Rule, Module depth, single-call-site inline)
- `tdd` — characterization-test-first approach for untested areas
