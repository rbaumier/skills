---
name: brainstorming
description: "Use when starting any creative work — designing features, planning components, adding functionality, or changing behavior. MUST run before implementation to explore intent, requirements, and design."
---

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design and get user approval.

**No implementation before approval.** Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.

## Step 0: Triage — Lightweight vs Heavyweight

Before diving in, classify the request. This prevents wasting 20 minutes on a full design session for a focused question, or under-thinking a strategic decision.

**Lightweight** — single-domain, one conversation, no cross-cutting impact:
- Focused design question ("how should I structure this component?")
- Single domain (just architecture, or just UX, or just process)
- Answer reachable in one conversation
- No lasting structural consequences

**Heavyweight** — crosses domains, needs research, lasting consequences:
- Strategic question affecting multiple systems ("how should goal tracking work?")
- Crosses architecture + UX + operations
- Needs external research (how do others solve this?)
- Decision shapes data models, project structure, or user flows

State the classification before proceeding:
```
Classification: {lightweight | heavyweight}
Reasoning: {one sentence why}
```

### Lightweight Path: Socratic Refinement

For focused questions. Think 5-minute whiteboard chat, not a design committee.

1. **Pick the right lens** — architecture? product? process? Match to the question domain.
2. **Clarify** — ask 2-3 sharpening questions. What are the constraints? What matters most? What's already been considered?
3. **Explore** — propose 2 options with clear trade-offs. Be opinionated: "I'd go with A because..." not "both have merit."
4. **Detail** — after the user picks a direction, flesh it out: what changes, what the structure looks like, what to watch out for.
5. **Capture Decision** — write a brief design note to `docs/specs/YYYY-MM-DD-<topic>-brainstorm.md`. Even lightweight decisions deserve a paper trail — reasoning dies in context windows.

**Upgrade trigger:** If clarifying questions reveal cross-cutting complexity, upgrade to heavyweight. Tell the user: "This is bigger than it looked — upgrading to full brainstorm."

### Heavyweight Path

**Frame-Diverge-Converge-Output workflow:** (1) Frame the problem with 5 Whys and "How Might We" questions, (2) Diverge with uncritical idea generation (quantity over quality), (3) Converge by evaluating against constraints and selecting top candidates, (4) Output the selected approach as a structured spec. This prevents premature convergence on the first decent idea.

For strategic questions, follow the full checklist below (Explore → Questions → Approaches → Design → Spec → Review → Plan).

Multi-role parallel analysis: spawn specialized agent perspectives (system-architect, product-owner, security-reviewer, devil's-advocate) to analyze the same design from different angles simultaneously. Synthesize insights across roles. Produces: Data Model, State Machine, Error Handling, Observability, Configuration Model, Boundary Scenarios.

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Ideation Toolkit

These frameworks are **tools you can deploy**, not mandatory steps. Pick the lens that fits the idea. Don't run every framework mechanically.

### 7 Lenses of Variation

When generating idea variations in the Diverge phase, apply these lenses to push beyond the obvious:

- **Inversion:** "What if we did the opposite?"
- **Constraint removal:** "What if budget/time/tech weren't factors?"
- **Audience shift:** "What if this were for [different user]?"
- **Combination:** "What if we merged this with [adjacent idea]?"
- **Simplification:** "What's the version that's 10x simpler?"
- **10x version:** "What would this look like at massive scale?"
- **Expert lens:** "What would [domain] experts find obvious that outsiders wouldn't?"

Generate 5-8 variations, not 20. Each variation must explain *why* it exists (which lens generated it), not just *what* it is.

### SCAMPER

For transforming an existing idea through seven operations — Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse. Best for improving or reimagining existing products/features.

### How Might We (HMW)

Reframe problems as opportunities: "How might we [desired outcome] for [specific user] without [key constraint]?" Generate multiple HMW framings of the same problem — different framings unlock different solutions. Good HMWs are narrow enough to be actionable but broad enough to allow creative solutions.

**Best for:** Reframing stuck thinking. When someone is anchored on a solution, pull them back to the problem.

### First Principles Thinking

Break down to fundamental truths, then rebuild: (1) What do we *know* is true? (2) What are we *assuming*? (3) Which assumptions can we challenge? (4) Rebuild from the truths alone.

**Best for:** Breaking out of incremental thinking. When every idea feels like a small improvement on the status quo.

### Jobs to Be Done (JTBD)

Focus on the user's actual goal — functional job (task), emotional job (feeling), social job (perception). Format: "When I [situation], I want to [motivation], so I can [expected outcome]." Key insight: the competing product is not always in the same category.

**Best for:** Understanding the real problem. When you're not sure if you're solving the right thing.

### Constraint-Based Ideation

Deliberately impose constraints to force creative solutions: "What if you only had 1 day?", "What if it could only have one feature?", "What if the user had never used a computer?"

**Best for:** Cutting through complexity. When the idea is growing too large or too vague.

### Pre-mortem

Imagine the idea has already failed. Work backwards: What went wrong? List every plausible failure mode. Which are preventable? Which would kill the project?

**Best for:** Stress-testing ideas in Phase 2 that feel good but haven't been pressure-tested.

### Residuality Stress-Testing — for architecture, not just ideas

Pre-mortem captures **known unknowns** (failures you can imagine). Residuality Theory (Barry O'Reilly) captures **unknown unknowns** — and, more importantly, reveals **hidden coupling** between components, which is the real architectural payoff. Use this *in addition to* pre-mortem when designing or reviewing a system architecture.

**The exercise has four artifacts:**

1. **Stressors list** — brainstorm 8-15 stressors that could hit the system. Include obviously-plausible ones (payment provider outage, DB failure) AND deliberately outlandish ones (regulatory ban, founding-team quits, a competitor open-sources our product, Godzilla, the data center loses power for a week). The outlandish ones are not for risk planning — they're for revealing coupling.

2. **Incidence Matrix** — a table with stressors as rows and components as columns. Each cell: does this component break under this stressor? (✓ / ✗). Concrete deliverable; the LLM can produce it as a markdown table.

   ```
                       | Orders | Payment | Kitchen | Notify | Pickup |
   Stripe outage       |        |    ✓    |         |        |        |
   Shop internet down  |   ✓    |    ✓    |    ✓    |   ✓    |   ✓    |  ← high coupling!
   TikTok virality     |   ✓    |    ✓    |    ✓    |   ✓    |        |
   Health inspector    |        |         |    ✓    |        |   ✓    |
   ```

3. **Attractors** — patterns in the matrix. Components that fail *together* across many stressors are coupled. The matrix above reveals a "Total Meltdown" attractor (any infrastructure stressor breaks everything). Naming the attractor — "the death spiral", "Friday night attractor", "the all-fire state" — makes it discussable.

4. **Residues** — for each attractor, what's the redesign that breaks the coupling? Critically, **the answer is not always technical**. Examples:
   - Technical: dual payment providers, offline mode, circuit breakers, async queues
   - Process/business: an "Internet Down Tuesday" promotion that turns the outage into a marketing event; an express menu during rush that prevents overload; a 15-minute auto-donation policy for unclaimed orders
   - The point: an LLM defaults to technical redundancy; force yourself to consider non-technical residues for half the attractors.

**Best for:** Architecture review, system design before commitment, post-incident "we got hit by X, what coupling did we miss" exercises. Distinct from pre-mortem because the deliverable (Incidence Matrix) makes coupling visible — pre-mortem leaves coupling implicit.

### Problem-vs-Solution heuristic

When a request arrives — from a user, a PM, a business stakeholder, an issue tracker — the wording is **almost always a proposed solution**, not the underlying problem. The default failure mode is to take the solution at face value and build it.

Test every incoming request:

| Surface request (likely solution) | Real problem to dig for |
|---|---|
| "Build me a web app for timesheets" | "HR needs to know how many hours each person worked" → could be Excel + email + parser |
| "Add a user admin panel" | "Support team needs to reset passwords without engineering" → could be a CLI script or runbook |
| "Make this 10x faster" | "Page feels slow" → could be a loading skeleton; "Customers are dropping off" → could be UX changes upstream |
| "Add caching" | "Database is overloaded at peak" → could be a query fix or batch job rescheduling |

**Two questions to surface the real problem:**
1. "If this exact feature existed tomorrow, what would change for the user?" — surfaces the outcome.
2. "What's the user doing today instead?" — surfaces the workaround they've already built; the real problem is usually whatever the workaround is paid in.

**When to take the request at face value:** explicit constraint ("we MUST integrate with system X"), regulatory requirement, deliberate user choice with full context. Otherwise: dig. The LLM has a stronger bias than humans toward "code what's asked" — counteract it explicitly.

Henry Ford (apocryphal but apt): *"If I had asked people what they wanted, they would have said faster horses."*

**Best for:** every non-trivial incoming request. Run it before generating options.

## Goal-Quality Gate — apply before any divergence

Before generating options, the stated goal must clear these three checks. If it doesn't, you're brainstorming wishes, not goals.

### 1. Falsifiable

**You must be able to name a concrete failure condition.** If you cannot describe a result that would mean "this didn't work", you don't have a goal — you have a wish, and any direction is equally fine because nothing is wrong.

- ❌ "Make the importer better" — what would count as worse? Equal?
- ✅ "Process 10,000-row CSVs in ≤30s end-to-end with zero data corruption" — failure: longer than 30s OR loses any row in a fuzz test
- ❌ "Improve developer experience" — no measurable failure mode
- ✅ "Reduce time from `git pull` to passing tests below 2 minutes on a clean repo" — failure: any flow above 2 min

Surface this gate explicitly: "What would tell us this didn't work?"

### 2. Operationalized

A goal headline ("CSV importer ≤30s") is the surface; the design problem isn't specified until the dimensions below are named (whichever apply):

- Exact **scope** of the problem being solved (and just as importantly, what's **not** in scope)
- **Who uses** the code; **where** it runs (browser? server? edge?); on **what hardware**
- **Who maintains** it and for how long
- **Constraints on correct output** (precision, idempotency, ordering, durability)
- **Consequences of bugs** (silent corruption? user-visible error? page out?)
- **Input data**: volume, distribution, rate of change, expected adversarial shapes
- **Requirements on throughput, latency, memory, storage, power**

If five+ of these are unknown for a non-trivial design, the design problem is unspecified, not solved. Ask the user before producing options.

### 3. Honest, not performative

**Watch for goals that are what a Good Engineer is supposed to want, not what you actually want.** Signal: you find yourself contorting to justify a chosen direction using the goal you wrote down — the strain is the tell. The real goal is somewhere else (cost, speed-of-ship, signal to a stakeholder, learning a new tool). Surface the real goal explicitly even when it's awkward; an unstated real goal will sabotage every option you generate against the performative one.

When in doubt, write down both: "stated goal" and "actual goal". If they differ, that's the conversation to have first.

## Decision-Paralysis Circuit-Breaker

When stuck on a decision (yours or the user's), walk this three-step protocol in order — most paralysis happens because someone is at step 3 when the real problem was at step 1 or 2.

1. **Does it matter?** Will this choice be visible in three months? In one quarter? If no, **coin-flip and move**. Most decisions don't matter; deliberation is the cost.
2. **Do you have enough information?** If the choice hinges on a fact you don't know (a benchmark, a user preference, a constraint from another team), **stop debating and go get the fact**. A 10-minute spike beats an hour of arguing.
3. **Which option moves toward the goal?** If steps 1 and 2 are settled and it still feels balanced, this question usually resolves it. If it doesn't, return to step 1 — the choice probably doesn't matter.

## Refinement Criteria Rubric

Use during the Converge phase to evaluate candidate directions.

### User Value — Painkiller vs Vitamin

- **Painkiller:** Acute, frequent problem. Users actively seek this out, will switch from current solution. Signs: emotional descriptions, existing workarounds, willingness to pay.
- **Vitamin:** Nice to have. Users won't go out of their way. Signs: polite nods, "that's cool," no behavior change.

Key questions: Can you name 3 specific people with this problem right now? What are they doing today instead? Would they switch? How often do they hit this problem?

### Feasibility

Technical: Does the core technology exist? What's the hardest problem? Dependencies on third parties?
Resource: Minimum team/effort for MVP? Specialized expertise needed? Regulatory requirements?
Time-to-value: How quickly can you get something in front of users?

### Differentiation

What makes this genuinely *different*, not just better? Types (strongest to weakest): new capability > 10x improvement > new audience > new context > better UX > cheaper.

### Decision Matrix

|                    | High Feasibility | Low Feasibility |
|--------------------|-------------------|-----------------|
| **High Value**     | Do this first     | Worth the risk   |
| **Low Value**      | Only if trivial   | Don't do this    |

Use differentiation as the tiebreaker between options in the same quadrant.

## The "Not Doing" List

**Every brainstorming output MUST include a "Not Doing" list.** This is arguably the most valuable artifact. Focus is about saying no to good ideas. Make the trade-offs explicit.

Format:
```markdown
## Not Doing (and Why)
- [Thing 1] — [reason it's tempting but wrong for now]
- [Thing 2] — [reason]
- [Thing 3] — [reason]
```

The "Not Doing" list prevents scope creep, forces honest prioritization, and gives future-you a record of what was deliberately excluded (and why).

## Red Flags Checklist

Watch for these anti-patterns during ideation. If you spot them, call them out:

- **Generating 20+ shallow variations** instead of 5-8 considered ones
- **Skipping "who is this for"** — every good idea starts with a person and their problem
- **No assumptions surfaced** before committing to a direction
- **Yes-machining weak ideas** — push back with specificity and kindness
- **No "Not Doing" list** — a plan without explicit exclusions is incomplete
- **Ignoring the codebase** — if you're in a project, existing architecture is a constraint and an opportunity
- **Jumping to output** without running diverge and converge phases
- **"Everyone could use this"** — if you can't name a specific user, the value isn't clear
- **"It's like X but better"** — marginal improvements rarely drive adoption
- **Solution-embedded problem statements** — "How might we build a chatbot?" is a solution, not a problem

## Checklist

You MUST create a task for each of these items and complete them in order:

1. **Explore project context** — check files, docs, recent commits
2. **Offer visual companion** (if topic will involve visual questions) — this is its own message, not combined with a clarifying question. See the Visual Companion section below.
3. **Ask clarifying questions** — one at a time, understand purpose/constraints/success criteria
4. **Propose 2-3 approaches** — with trade-offs and your recommendation
5. **Present design** — in sections scaled to their complexity, get user approval after each section
6. **Write design doc** — save to `docs/specs/YYYY-MM-DD-<topic>-design.md` and commit
7. **Capture Decision** — record the decision explicitly: what was chosen, what was rejected, and why. Reasoning evaporates from context windows — if it's not written down, it didn't happen.
8. **Spec review loop** — dispatch spec-document-reviewer subagent with precisely crafted review context (never your session history); fix issues and re-dispatch until approved (max 3 iterations, then surface to human)
9. **User reviews written spec** — ask user to review the spec file before proceeding
10. **Transition to implementation** — invoke writing-plans skill to create implementation plan

## Process Flow

```dot
digraph brainstorming {
    "Explore project context" [shape=box];
    "Visual questions ahead?" [shape=diamond];
    "Offer Visual Companion\n(own message, no other content)" [shape=box];
    "Ask clarifying questions" [shape=box];
    "Propose 2-3 approaches" [shape=box];
    "Present design sections" [shape=box];
    "User approves design?" [shape=diamond];
    "Write design doc" [shape=box];
    "Spec review loop" [shape=box];
    "Spec review passed?" [shape=diamond];
    "User reviews spec?" [shape=diamond];
    "Invoke writing-plans skill" [shape=doublecircle];

    "Explore project context" -> "Visual questions ahead?";
    "Visual questions ahead?" -> "Offer Visual Companion\n(own message, no other content)" [label="yes"];
    "Visual questions ahead?" -> "Ask clarifying questions" [label="no"];
    "Offer Visual Companion\n(own message, no other content)" -> "Ask clarifying questions";
    "Ask clarifying questions" -> "Propose 2-3 approaches";
    "Propose 2-3 approaches" -> "Present design sections";
    "Present design sections" -> "User approves design?";
    "User approves design?" -> "Present design sections" [label="no, revise"];
    "User approves design?" -> "Write design doc" [label="yes"];
    "Write design doc" -> "Spec review loop";
    "Spec review loop" -> "Spec review passed?";
    "Spec review passed?" -> "Spec review loop" [label="issues found,\nfix and re-dispatch"];
    "Spec review passed?" -> "User reviews spec?" [label="approved"];
    "User reviews spec?" -> "Write design doc" [label="changes requested"];
    "User reviews spec?" -> "Invoke writing-plans skill" [label="approved"];
}
```

**The terminal state is invoking writing-plans.** Do NOT invoke frontend-design, mcp-builder, or any other implementation skill. The ONLY skill you invoke after brainstorming is writing-plans.

## The Process

**Understanding the idea:**

- Check out the current project state first (files, docs, recent commits)
- Before asking detailed questions, assess scope: if the request describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately. Don't spend questions refining details of a project that needs to be decomposed first.
- If the project is too large for a single spec, help the user decompose into sub-projects: what are the independent pieces, how do they relate, what order should they be built? Then brainstorm the first sub-project through the normal design flow. Each sub-project gets its own spec → plan → implementation cycle.
- For appropriately-scoped projects, conduct a structured interview across dimensions: Technical Implementation (architecture tradeoffs, edge cases, failure modes), User Experience (workflows, error states, progressive disclosure), Operational (deployment, monitoring, rollback), and Scope (what's explicitly out of scope)
- Restate the idea as a crisp "How Might We" problem statement — this forces clarity on what's actually being solved
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Multi-perspective analysis:** For complex designs, mentally adopt specialized perspectives (system-architect, product-owner, security-reviewer, devil's-advocate) to analyze the same design from different angles. Surface conflicts early rather than discovering them during implementation.

**Exploring approaches:**

- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why
- Deploy ideation frameworks from the Toolkit section when they fit — use the 7 Lenses to generate variations, SCAMPER to transform existing ideas, JTBD to reframe the problem

**Presenting the design:**

- Once you believe you understand what you're building, present the design
- Scale each section to its complexity: a few sentences if straightforward, up to 200-300 words if nuanced
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

**Assumption Audit:** For every direction under consideration, explicitly surface:
- **Must Be True** — dealbreaker assumptions that kill the idea if wrong. Validate before building.
- **Should Be True** — important but adjustable. You can pivot if these are wrong.
- **Might Be True** — nice-to-have assumptions. Don't validate until core is proven.

**Design for isolation and clarity:**

- Break the system into smaller units that each have one clear purpose, communicate through well-defined interfaces, and can be understood and tested independently
- For each unit, you should be able to answer: what does it do, how do you use it, and what does it depend on?
- Can someone understand what a unit does without reading its internals? Can you change the internals without breaking consumers? If not, the boundaries need work.
- Smaller, well-bounded units are also easier for you to work with - you reason better about code you can hold in context at once, and your edits are more reliable when files are focused. When a file grows large, that's often a signal that it's doing too much.

**Working in existing codebases:**

- Explore the current structure before proposing changes. Follow existing patterns.
- Where existing code has problems that affect the work (e.g., a file that's grown too large, unclear boundaries, tangled responsibilities), include targeted improvements as part of the design - the way a good developer improves code they're working in.
- Don't propose unrelated refactoring. Stay focused on what serves the current goal.

## After the Design

**Documentation:**

- Write the validated design (spec) to `docs/specs/YYYY-MM-DD-<topic>-design.md`
  - (User preferences for spec location override this default)
- Use elements-of-style:writing-clearly-and-concisely skill if available
- Commit the design document to git

**Spec Review Loop:**
After writing the spec document:

1. Dispatch spec-document-reviewer subagent (see spec-document-reviewer-prompt.md)
2. If Issues Found: fix, re-dispatch, repeat until Approved
3. If loop exceeds 3 iterations, surface to human for guidance

**User Review Gate:**
After the spec review loop passes, ask the user to review the written spec before proceeding:

> "Spec written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan."

Wait for the user's response. If they request changes, make them and re-run the spec review loop. Only proceed once the user approves.

**PRD as design output:** For product features, generate a structured Product Requirements Document with user stories, acceptance criteria, non-functional requirements, and priority tiers (P0/P1/P2). The PRD becomes the single source of truth the implementation plan references.

**Implementation:**

- Invoke the writing-plans skill to create a detailed implementation plan
- Do NOT invoke any other skill. writing-plans is the next step.

## Key Principles

- **Creativity Faucet** -- accept that early ideas are low-quality. The bad ideas must flow first to clear the pipe. Don't self-censor during divergent thinking; filter during convergence
- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design, get approval before moving on
- **Be flexible** - Go back and clarify when something doesn't make sense
- **Be honest, not supportive** - If an idea is weak, say so with kindness. A good ideation partner is not a yes-machine. Push back on complexity, question real value, point out when the emperor has no clothes.
- **The restatement changes the frame** - "Help restaurants compete" becomes "retain existing customers." Reframing is where the real insight lives.

## Visual Companion

A browser-based companion for showing mockups, diagrams, and visual options during brainstorming. Available as a tool — not a mode. Accepting the companion means it's available for questions that benefit from visual treatment; it does NOT mean every question goes through the browser.

**Offering the companion:** When you anticipate that upcoming questions will involve visual content (mockups, layouts, diagrams), offer it once for consent:
> "Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams, comparisons, and other visuals as we go. This feature is still new and can be token-intensive. Want to try it? (Requires opening a local URL)"

**This offer MUST be its own message.** Do not combine it with clarifying questions, context summaries, or any other content. The message should contain ONLY the offer above and nothing else. Wait for the user's response before continuing. If they decline, proceed with text-only brainstorming.

**Per-question decision:** Even after the user accepts, decide FOR EACH QUESTION whether to use the browser or the terminal. The test: **would the user understand this better by seeing it than reading it?**

- **Use the browser** for content that IS visual — mockups, wireframes, layout comparisons, architecture diagrams, side-by-side visual designs
- **Use the terminal** for content that is text — requirements questions, conceptual choices, tradeoff lists, A/B/C/D text options, scope decisions

A question about a UI topic is not automatically a visual question. "What does personality mean in this context?" is a conceptual question — use the terminal. "Which wizard layout works better?" is a visual question — use the browser.

If they agree to the companion, read the detailed guide before proceeding:
`skills/brainstorming/visual-companion.md`
