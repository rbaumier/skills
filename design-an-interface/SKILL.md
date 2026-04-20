---
name: design-an-interface
description: Use when designing an API, exploring interface options, comparing module shapes, choosing between competing designs, or when user mentions "design it twice", "design an interface", or wants multiple design alternatives. Generates 3+ radically different designs via parallel sub-agents with forced divergent constraints.
---

# Design an Interface

Based on "Design It Twice" from Ousterhout's *A Philosophy of Software Design*: your first idea is unlikely to be the best. Generate multiple radically different designs in parallel, then compare.

## When to Use

- Before committing to a public API shape (library, service, module boundary)
- When a design feels obvious but you haven't considered alternatives
- When two devs disagree on an interface
- When the module will have many callers or will be hard to change later

## When NOT to Use

- Internal helper with one call site — skip, inline it instead
- Trivial CRUD with one reasonable shape
- Pure implementation change with no interface shift

## Workflow

### 1. Gather Requirements

Before designing:

- [ ] What problem does this module solve?
- [ ] Who are the callers? (other modules, external users, tests)
- [ ] What are the key operations?
- [ ] Any constraints? (performance, compatibility, existing patterns)
- [ ] What should be hidden inside vs exposed?

Ask: *"What does this module need to do? Who will use it?"*

### 2. Generate Designs (Parallel Sub-Agents)

Spawn **3+ sub-agents simultaneously** via the Agent tool. Each must produce a **radically different** approach.

**Prompt template for each sub-agent:**

```
Design an interface for: [module description]

Requirements: [gathered requirements]

Your design constraint: [assign a different one per agent — see below]

Output format:
1. Interface signature (types/methods)
2. Usage example (how caller uses it)
3. What this design hides internally
4. Trade-offs of this approach
```

**Divergent constraints — assign one per agent:**

- **Agent 1**: "Minimize method count — aim for 1-3 methods max"
- **Agent 2**: "Maximize flexibility — support many use cases and extension"
- **Agent 3**: "Optimize for the most common case — make the default trivial"
- **Agent 4** (optional): "Take inspiration from [specific paradigm/library: iterators / streams / ports-and-adapters / builder / fluent]"
- **Agent 5** (optional): "Design around the failure modes — what does the interface look like when things go wrong?"

The constraints MUST diverge. If two agents produce similar designs, the prompts weren't divergent enough.

### 3. Present Designs

Show each design **sequentially** (not in a table) so the user absorbs each approach before comparison:

1. **Interface signature** — types, methods, params
2. **Usage example** — how callers actually use it in practice
3. **What it hides** — complexity kept internal

### 4. Compare Designs

After showing all designs, compare them in **prose** (not tables) on:

- **Interface simplicity** — fewer methods, simpler params
- **General-purpose vs specialized** — flexibility vs focus
- **Implementation efficiency** — does the shape allow efficient internals?
- **Depth** — small interface hiding significant complexity (good) vs large interface with thin implementation (bad)
- **Ease of correct use** vs **ease of misuse**

Highlight where designs diverge most — that's where the real design question lives.

### 5. Recommend + Synthesize

Give your **opinionated recommendation**: which design you think is strongest and why. If elements from different designs combine well, propose a hybrid.

Don't just present a menu. The user wants a strong read.

Ask:
- *"Which design best fits your primary use case?"*
- *"Any elements from other designs worth incorporating?"*

## Evaluation Criteria

From *A Philosophy of Software Design*:

- **Interface simplicity** — fewer methods, simpler params = easier to learn and use correctly.
- **General-purpose** — can handle future use cases without changes. Beware over-generalization (YAGNI).
- **Implementation efficiency** — does the interface shape allow efficient implementation? Or force awkward internals?
- **Depth** — small interface hiding significant complexity = **deep module** (good). Large interface with thin implementation = **shallow module** (avoid).

## Anti-Patterns

- **Similar designs** — if two sub-agents produced similar shapes, the constraints weren't divergent enough. Respawn with stronger differentiation.
- **Skipping comparison** — the value IS in the contrast. Don't just pick the first one that looks good.
- **Implementing during design** — this is purely about interface shape. No implementation details.
- **Evaluating by effort** — "this one is easier to build" is not a design criterion.
- **Menu without opinion** — always give your recommendation, even if the user overrides it.

## Cross-References

- `coding-standards` — "Module depth over shallow wrappers" rule
- `brainstorming` — for upstream problem-space exploration before interface design
