---
name: prompt-engineering
description: "Write, optimize, and debug prompts. Trigger on 'prompt', 'system prompt', 'few-shot', 'chain of thought', 'prompt template', 'reduce tokens', 'prompt caching'."
---

## When to use
- Designing or optimizing prompts for any LLM task
- Building reusable prompt templates or libraries
- Reducing token cost or latency of existing prompts
- Adding few-shot examples or chain-of-thought reasoning
- Configuring caching strategies for repeated prompts

## Triage (Phase 0) — Before Optimizing

> Before touching a prompt, assess whether optimization is even the right move.
> Many "prompt problems" are actually data problems or architecture problems.

1. **Is the prompt the bottleneck?** — If output quality is poor, check: is the input data clean? Is the model appropriate? Is the task even possible for an LLM?
2. **Is the model right?** — For simple text tasks (merge, reformat, classify), cheaper/faster models often match expensive ones. Flash/Mini models excel at structured output but struggle with nuance. Always include the current model as baseline before switching
3. **Try removing complexity first** — shorter prompts often match verbose ones on simple tasks. Good/bad examples are expensive in tokens but rarely improve output on capable models. Test removing them before adding more
4. **Simple prompt?** (under 20 lines, single purpose, no conditionals) → lightweight process: just apply 2-3 techniques directly
5. **Complex prompt?** (multiple sections, conditional behaviors, tool orchestration) → full optimization workflow: understand → plan → propose changes → receive approval → integrate. Every prompt change must trace to a specific pattern with documented impact
6. **Measure first** — before changing anything, establish a baseline: run 5-10 test cases, note accuracy/consistency. No baseline = no way to prove improvement

## Single-Turn vs Multi-Turn Reference

> Pick the right optimization strategy based on how the prompt will be used.

| Aspect | Single-Turn | Multi-Turn |
|--------|-------------|------------|
| **When** | One prompt → one response (API calls, templates, classification) | Conversation chains, iterative refinement, agent loops |
| **Key techniques** | Role framing, structured output, few-shot examples, CoT | Context management, memory summarization, state tracking |
| **Common pitfall** | Over-engineering with multi-turn patterns (adds latency, no benefit) | Under-specifying conversation boundaries (model "forgets" role) |
| **Caching** | Prefix caching (stable system prompt first), response caching at temp=0 | Cache system prompt only; conversation turns invalidate response cache |
| **Testing** | Fixed input/output pairs, easy to A/B test | Scenario-based testing, harder to reproduce — test conversation *flows* |

**Rule of thumb:** If the prompt executes in a single LLM call, use single-turn techniques only.
Multi-turn patterns (memory, summarization, state) add complexity for zero benefit on one-shot prompts.

## When not to use
- Fine-tuning or model training (use training pipelines)
- RAG retrieval design (use `rag-search` skill)
- API integration patterns (use `api-design` skill)

## Rules
- **Iron Law for system prompts**: every system prompt MUST define role + task + output format + constraints. Missing any one produces inconsistent outputs
- Structure: system context → task instruction → examples → input → output format
- Use RTF for role-based tasks, RISEN for multi-step projects
- Use RODES for complex analysis, RACE for communication tasks
- Use STAR for problem-solving, SOAP for documentation
- Use CLEAR for goal-setting, GROW for coaching
- Use Chain of Density for iterative summarization/compression
- Blend 2-3 frameworks for multi-dimensional tasks
- Few-shot: 2-5 examples, balance token cost vs accuracy
- Select examples by similarity, diversity, edge-cases
- Zero-shot CoT: add "think step by step" for reasoning tasks
- Few-shot CoT: include reasoning traces in examples
- Self-consistency CoT: sample N paths, pick majority answer
- Tree-of-Thoughts (ToT): generate multiple reasoning paths, evaluate each, prune bad branches, expand promising ones. More expensive than CoT but higher accuracy on planning/strategy tasks where a single chain might follow a wrong path early
- CoT gives +30-50% accuracy on analytical/math tasks
- System prompts: persistent role, constraints, output format
- XML tags for structure: `<rules>`, `<input>`, `<output>` tags create clear section boundaries the model parses reliably — especially effective for weaker/smaller models
- Templates: reusable structures with variables and conditionals. Use Jinja2/template parameterization (`{{variable}}`, `{% if %}`) for reusable prompt templates. Store templates in files, not inline. Security: templates MUST be author-written, never user-supplied
- Start simple → measure → A/B test → iterate
- Progressive disclosure: direct → +constraints → +reasoning → +examples
- Persona pattern: define role, traits, style, priorities
- Structured output: specify JSON/format schema explicitly
- Self-verification: "verify against [criteria], revise if fail"
- Include error recovery: fallbacks, confidence scores, alternatives
- Prefix caching: stable content first in prompt
- Response caching: cache identical queries at temperature=0
- CAG: pre-cache small doc sets in prompt instead of RAG
- Never cache with high temperature or without invalidation strategy
- TOON format for token reduction: when prompts contain large JSON payloads, consider YAML-style indentation for nested objects + CSV-style layout for uniform arrays. ~40% token reduction while maintaining LLM comprehension
- Remove redundant words, abbreviate after first definition
- Consolidate similar instructions, move stable content to system
- Stream long-form outputs, batch similar requests
- Prompt must have clear objective and specified output format
- Include sufficient context, constraints, and success criteria
- Prompt must be self-contained, no ambiguous language
- Test on unusual/boundary inputs for edge cases
- Version control prompts like code
- Examples must match target task exactly, avoid example pollution
- Balance examples vs token limits to avoid context overflow
- Measure: accuracy, consistency, latency, token usage, success rate

## Anti-Patterns Catalogue

> Banned patterns. If you see these in a prompt, flag and fix immediately.

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| **"Be creative"** / **"Be helpful"** | Vague, model already tries to be helpful — adds zero signal | Remove, or replace with specific behavioral instruction |
| **"Do NOT hallucinate"** | Model cannot reliably self-detect hallucination; creates false confidence | Add grounding: "Only use information from the provided context. If unsure, say 'I don't know'" |
| **Wall of rules (>15 bullets)** | Attention degrades on long flat lists — later rules get ignored | Group into prioritized sections (CRITICAL / IMPORTANT / NICE-TO-HAVE), max 5-7 per group |
| **Contradictory instructions** | "Be concise" + "Explain thoroughly" — model oscillates unpredictably | Pick one stance per section; use conditional triggers ("If user asks for detail, then expand") |
| **Repeating the same instruction 3+ times** | Wastes tokens, signals uncertainty to model, no accuracy gain after 2nd mention | State once clearly, optionally reinforce once in a different section |
| **"Think step by step" on trivial tasks** | CoT adds latency and tokens for zero accuracy gain on simple classification/extraction | Reserve CoT for reasoning-heavy tasks (math, multi-hop, analysis). Direct prompting for simple tasks |
| **Excessive emphasis (ALL CAPS, !!!, bold everywhere)** | ALL CAPS has zero measurable effect on compliance — "NEVER do X" performs the same as "Never do X". When everything is emphasized, nothing is | Reserve emphasis for structural markers (section headers). Max 3 emphasis markers per prompt |
| **Few-shot examples that don't match target** | Examples from a different domain/format confuse more than help | Examples must match the exact task format, domain, and edge cases |
| **Prompt says "you are an expert" without constraints** | Model generates confident-sounding but ungrounded output | Add domain boundaries: "You are an expert in X. You do NOT answer questions about Y" |
| **No output format specification** | Model picks random format each time — inconsistent parsing downstream | Always specify: JSON schema, bullet format, table structure, or "respond in exactly N sentences" |
