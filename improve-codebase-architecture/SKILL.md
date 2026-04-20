---
name: improve-codebase-architecture
description: Use when user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, make a codebase more testable or AI-navigable, or mentions "deep modules", "shallow modules", "architectural review". Explores a codebase, surfaces architectural friction, proposes module-deepening refactors as a local markdown RFC (not a GitHub issue).
---

# Improve Codebase Architecture

Explore a codebase like an AI would, surface architectural friction, discover opportunities for improving testability, and propose **module-deepening** refactors as a local RFC.

A **deep module** (John Ousterhout, *A Philosophy of Software Design*) has a small interface hiding a large implementation. Deep modules are more testable, more AI-navigable, and let you test at the boundary instead of inside.

A **shallow module** is one where the interface is nearly as complex as the implementation. It adds no value — it just forwards calls and forces every caller to know the internals.

## Process

### 1. Explore the codebase

Use the Agent tool with `subagent_type=Explore` to navigate the codebase **organically**. Do NOT follow rigid heuristics. Explore like an AI onboarding cold — note where you experience friction:

- Where does understanding one concept require bouncing between many small files?
- Where are modules so shallow that the interface is nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called?
- Where do tightly-coupled modules create integration risk in the seams between them?
- Which parts of the codebase are untested, or hard to test?

**The friction you encounter IS the signal.**

### 2. Present candidates

Present a numbered list of deepening opportunities. For each candidate:

- **Cluster**: which modules/concepts are involved
- **Why they're coupled**: shared types, call patterns, co-ownership of a concept
- **Dependency shape**: how the cluster depends on infrastructure (DB, network, cache, filesystem). Note which dependencies are pure logic (no I/O), which cross process boundaries, which span network boundaries.
- **Test impact**: what existing tests would be replaced by boundary tests

**Do NOT propose interfaces yet.** Ask the user: *"Which of these would you like to explore?"*

### 3. User picks a candidate

### 4. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would need to rely on
- A rough illustrative code sketch to ground the constraints — **not a proposal**, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 5. The user reads and thinks while the sub-agents work in parallel.

### 5. Design multiple interfaces (parallel sub-agents)

Spawn **3+ sub-agents in parallel** via the Agent tool. Each must produce a **radically different** interface for the deepened module.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency shape, what's being hidden). This brief is independent of the user-facing explanation in Step 4.

**Divergent constraints — assign one per agent:**

- **Agent 1**: "Minimize the interface — aim for 1-3 entry points max"
- **Agent 2**: "Maximize flexibility — support many use cases and extension"
- **Agent 3**: "Optimize for the most common caller — make the default case trivial"
- **Agent 4** (optional): "Design around ports & adapters for cross-boundary dependencies"

Each sub-agent outputs:

1. Interface signature (types, methods, params)
2. Usage example showing how callers use it
3. What complexity it hides internally
4. Dependency strategy (how deps are handled — constructor injection, factory, ambient context, ports)
5. Trade-offs

Present designs **sequentially** (not in a table), then compare in prose.

After comparing, **give your own opinionated recommendation** — which design is strongest and why. If elements from different designs combine well, propose a hybrid. The user wants a strong read, not a menu.

### 6. User picks an interface (or accepts your recommendation)

### 7. Write the RFC

**Default location**: `docs/rfcs/YYYY-MM-DD-arch-{slug}.md` at repo root. Create `docs/rfcs/` if missing.

If the user specifies a path, use that. Don't ask for review — create and share the path.

## RFC Template

```markdown
# Architectural refactor: {Title}

**Date**: YYYY-MM-DD
**Status**: Draft

## Motivation — Why deepen this module?

What friction does the current shallow/coupled module create?
- Testing difficulty: ...
- Change amplification: ...
- Navigation cost: ...

## Current shape

Which files/modules are in the cluster. What the interface looks like today. Why it's shallow/coupled.

Describe behavior and contracts. **Do NOT include specific file paths or code snippets** — they rot.

## Proposed deep module

### Interface

Types, methods, contracts.

### What it hides

Complexity kept internal.

### Dependency strategy

How deps are handled — DI, factory, ports & adapters.

## Alternatives considered

For each alternative interface generated in parallel:

- **Alt A (minimize)**: description, why not chosen
- **Alt B (maximize flexibility)**: description, why not chosen
- **Alt C (common case)**: description, why not chosen

## Migration plan

Tiny-commit plan (see `request-refactor-plan` style):

1. **Commit 1**: ...
2. **Commit 2**: ...

## Test impact

- Existing tests removed/replaced: ...
- New boundary tests added: ...
- Coverage delta: ...

## Out of scope

What this RFC deliberately doesn't touch.
```

## Anti-Patterns

- **Rigid heuristic exploration** — you're simulating an AI onboarding cold, not running a linter. Friction is the signal.
- **Proposing interfaces before framing the problem** — the user needs to think about the problem space in parallel with the sub-agents.
- **Menu without recommendation** — always give your opinion.
- **Similar designs from sub-agents** — if two produced similar shapes, the constraints weren't divergent enough. Respawn.
- **Implementation in the RFC** — this is about the interface shape and migration outline, not the implementation.

## Cross-References

- `design-an-interface` — the parallel-sub-agents pattern used in step 5
- `request-refactor-plan` — style of tiny-commit migration plan used in the RFC
- `coding-standards` — "Module depth over shallow wrappers", "Pull complexity downward"
