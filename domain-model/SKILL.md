---
name: domain-model
description: Use when the user wants to stress-test a plan against the project's existing domain model, sharpen terminology, challenge decisions against documented context, or mentions "domain model", "CONTEXT.md", or "ADR". Interviews the user relentlessly while cross-referencing code + docs, updates CONTEXT.md inline, offers ADRs only when the three-part gate is met.
---

# Domain Model

Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (`CONTEXT.md`, ADRs) inline as decisions crystallise.

## How It Works

Interview the user relentlessly about every aspect of the plan until reaching shared understanding. Walk down each branch of the decision tree, resolving dependencies one-by-one. **For each question, provide your recommended answer.** Ask questions one at a time, waiting for feedback before continuing.

**If a question can be answered by exploring the codebase, explore the codebase instead.** Don't make the user answer what you can find yourself.

## File Structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has **multiple bounded contexts**. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

**Create files lazily** — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the Session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately.

> *"Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"*

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term.

> *"You're saying 'account' — do you mean the Customer or the User? Those are different things."*

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it:

> *"Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"*

### Update `CONTEXT.md` inline

When a term is resolved, update `CONTEXT.md` right there. **Don't batch these up** — capture them as they happen.

## CONTEXT.md Format

```markdown
# {Context name}

## Purpose

One paragraph: what this context owns and why it exists as a separate bounded context.

## Glossary

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **Order** | A customer's request to purchase one or more items | Purchase, transaction |
| **Invoice** | A request for payment sent after delivery | Bill, payment request |

## Relationships

- An **Invoice** belongs to exactly one **Customer**
- An **Order** produces one or more **Invoices**

## Invariants

- Invariant 1: ...
- Invariant 2: ...

## Open questions / ambiguities

- "account" is still overloaded — does it mean Customer or User in the dashboard filter?
```

## ADR Gate — Offer Sparingly

Only offer to create an ADR when **all three** are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder *"why did they do it this way?"*
3. **Result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

**If any of the three is missing, skip the ADR.** Most decisions do not deserve an ADR.

## ADR Format

File: `docs/adr/NNNN-{slug}.md` (zero-padded 4-digit number)

```markdown
# NNNN. {Decision title}

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded by ADR-XXXX

## Context

What is the issue motivating this decision? What constraints and forces are at play?

## Decision

What we chose to do.

## Alternatives considered

- **Option A**: description, why rejected
- **Option B**: description, why rejected

## Consequences

What becomes easier, what becomes harder. What new problems does this create?
```

## Cross-References

- `ubiquitous-language` — extract a DDD glossary from the conversation (complements CONTEXT.md updates)
- `grill-me` — generic grilling without the DDD-doc integration
