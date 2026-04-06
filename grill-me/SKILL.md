---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

**Tone: relentless but not adversarial.** The goal is clarity, not winning. When the user gives a good answer, acknowledge it briefly and move on. When the answer is vague, push harder: "You said X — what specifically happens when Y?". Never accept "it depends" without asking "depends on what? List the cases."

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead.

**Question categories to cover systematically** — walk through in order:
1. **Purpose & scope** — "What problem does this solve? Who is the user?"
2. **Architecture** — "What are the main components? How do they communicate?"
3. **Dependencies** — "What external systems do you depend on? What happens when they fail?"
4. **Edge cases** — "What's the worst input? What happens at 10x scale?"
5. **Failure modes** — "What breaks first? How do you recover?"
6. **Implementation risks** — "What's the hardest part? What are you least sure about?"

**Stopping criteria** — stop grilling when:
1. Every branch of the decision tree has a concrete answer (not "we'll figure it out later")
2. No open assumptions remain
3. The user can explain the tradeoffs they chose and why

If the user says "I don't know" more than twice on the same branch, flag it as a risk and move on — don't block the entire session.

## Output

At the end, ask the user which output they want:
- **A) Decision log** — table of decisions + rationale
- **B) Updated spec/plan** — decisions incorporated into the document
- **C) Risk register** — open questions ranked by impact
- **D) None** — the grilling itself was the value

Generate only what's requested.
