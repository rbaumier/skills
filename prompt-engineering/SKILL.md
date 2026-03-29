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

## When not to use
- Fine-tuning or model training (use training pipelines)
- RAG retrieval design (use `rag-search` skill)
- API integration patterns (use `api-design` skill)

## Rules
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
- CoT gives +30-50% accuracy on analytical/math tasks
- System prompts: persistent role, constraints, output format
- Templates: reusable structures with variables and conditionals
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
