---
name: to-prd
description: Use when user wants to turn the current conversation into a PRD, capture a feature spec, or produce a product requirements doc from accumulated context. Writes a local markdown PRD (not a GitHub issue) by synthesizing conversation + codebase — does NOT interview the user.
---

# To PRD (local doc)

Turn the current conversation context and codebase understanding into a PRD, saved as a local markdown file. **Do NOT interview the user** — synthesize what you already know.

## Process

### 1. Explore the repo

If you haven't already explored the codebase, do so now to understand the current state.

### 2. Sketch the module landscape

Sketch the major modules you'll need to build or modify to complete the implementation. Actively look for opportunities to extract **deep modules** — small interfaces hiding significant functionality, testable in isolation, rarely changing.

**Check with the user:**
- Do these modules match your expectations?
- Which modules should we write tests for?

### 3. Write the PRD

**Default location**: `docs/prds/YYYY-MM-DD-{slug}.md` at repo root. Create `docs/prds/` if missing.

If the user specifies a path, use that. If the repo already has a `specs/` or `docs/features/` convention, propose using it.

Use the template below. Create the file directly — don't ask the user to review the content first, just create it and share the path.

## PRD Template

```markdown
# {Feature title}

**Date**: YYYY-MM-DD
**Status**: Draft

## Problem Statement

The problem the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each in the format:

1. As a {actor}, I want {feature}, so that {benefit}
2. As a ..., I want ..., so that ...

The list should be extensive and cover all aspects of the feature.

**Example**:

1. As a mobile bank customer, I want to see the balance on my accounts, so that I can make better informed decisions about my spending.

## Implementation Decisions

Architectural and technical decisions:

- Modules that will be built/modified
- Interfaces being modified
- Technical clarifications from the developer
- Architectural choices
- Schema changes
- API contracts
- Specific interactions

**Do NOT include specific file paths or code snippets** — they may end up being outdated very quickly. Describe behavior and contracts, not structure.

## Testing Decisions

- What makes a good test here (test external behavior, not implementation details)
- Which modules will be tested
- Prior art: similar types of tests already in the codebase

## Out of Scope

Things explicitly out of scope for this PRD.

## Further Notes

Any further notes about the feature.
```

## Anti-Patterns

- **Interviewing the user** — this skill synthesizes existing context. If more interviewing is needed, use `grill-me` first, then return here.
- **File paths in implementation decisions** — they rot. Describe behavior instead.
- **Code snippets** — same reason. The PRD outlives the implementation.
- **Vague user stories** — "As a user, I want the app to work" is worthless. Be concrete about actor, feature, benefit.
