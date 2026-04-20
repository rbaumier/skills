---
name: to-issues
description: Use when user wants to break a plan, spec, or PRD into independently-grabbable implementation tickets, convert a plan into issues, or split work into tracer-bullet vertical slices. Writes a local markdown doc (not GitHub issues) with HITL/AFK taxonomy and dependency chaining.
---

# To Issues (local doc)

Break a plan into independently-grabbable implementation tickets using **vertical slices** (tracer bullets). Output goes to a local markdown doc — no GitHub integration.

## Vertical Slice Rules

- Each slice delivers a narrow but **complete path through every layer** (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
- Each slice is either **HITL** (Human In The Loop — requires human interaction, architectural decision, design review) or **AFK** (Away From Keyboard — implementable and mergeable without human interaction)
- **Prefer AFK over HITL wherever possible** — maximizes agent-executable work

## Process

### 1. Gather context

Work from whatever is already in the conversation. If the user references a plan/PRD/issue file, read it.

### 2. Explore the codebase (optional)

If you haven't already explored the codebase, do so to understand current state. Don't deep-dive — enough to size slices realistically.

### 3. Draft vertical slices

Break the plan into tracer-bullet slices following the rules above.

### 4. Quiz the user

Present the breakdown as a numbered list. For each slice:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: other slices that must complete first (reference by number)
- **User stories covered**: which user stories this addresses (if source had them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are HITL/AFK labels correct?

Iterate until the user approves.

### 5. Write the doc

**Default location**: `docs/plans/YYYY-MM-DD-{slug}.md` at repo root. Create `docs/plans/` if it doesn't exist.

If the user specifies a path, use that. If the repo has an existing plans/issues directory (`plans/`, `specs/`, `rfcs/`), propose using it.

Use the template below. Create slices in dependency order (blockers first) so `Blocked by #N` references resolve.

## Doc Template

```markdown
# {Plan title}

**Date**: YYYY-MM-DD
**Source**: {link/ref to source PRD/plan/conversation}
**Total slices**: N ({X AFK} / {Y HITL})

## Overview

{1-2 paragraph summary of what's being built and why.}

---

## Slice 1 — {Title}

**Type**: AFK | HITL
**Blocked by**: None — can start immediately
**User stories**: {if applicable}

### What to build

{Concise description of the end-to-end behavior, not layer-by-layer implementation. What capability does this slice deliver?}

### Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

---

## Slice 2 — {Title}

**Type**: AFK
**Blocked by**: Slice 1

### What to build

...

### Acceptance criteria

- [ ] ...

---

{... repeat for each slice ...}
```

## Anti-Patterns

- **Horizontal slices** — "build all the schemas, then all the APIs, then all the UI" = not tracer bullets. Every slice must cut through every layer.
- **Over-specification** — don't inline file paths or code snippets. They rot. Describe behavior.
- **Collapsing to one giant slice** — if "slice 1" covers 60% of the work, it's not a slice, it's the whole thing. Split.
- **All HITL** — if every slice needs human input, you haven't decomposed enough. Force at least half to AFK.
