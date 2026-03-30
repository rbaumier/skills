---
name: enforcing-skill-rules
description: Use when improving an existing skill, creating a new one, or when a skill feels weak, rules are ignored, ineffective, or you want to prove a skill works with data. Use when you need to compress a skill without regression.
---

## Overview

Measure skill effectiveness per-rule, fix what fails, re-measure. Every rule gets an assertion. Every assertion gets a binary grade. Loop until 100%.

## When to Use

- Skill rules get ignored by the model
- Need to prove a skill works with data before deploying
- Compressing a skill and need to verify no regression
- Creating a new skill and want measured effectiveness from the start

**Not for:** skill triggering/description optimization (use skill-creator for that)

## The Loop

```
extract assertions → write trap prompts → run baseline → grade → root-cause failures → fix wording → re-measure failed sections → repeat
```

## Step 1: Extract Assertions

Read the skill. List every rule as a named assertion. Group by section.

```
## Naming (6 assertions)
- intent-over-implementation
- no-mental-mapping
- explicit-units
...
```

Every rule = 1 assertion. No rule left unmeasured.

## Step 2: Write Trap Prompts

Save to `{skill}-workspace/evals/evals.json`. Two modes:

**Section prompts** (full sweep): 1 prompt per section — realistic code/scenario that violates every rule in that section.
**Targeted prompts** (single assertion): 1 prompt testing exactly 1 rule. Use for re-testing flaky assertions — faster and more precise than re-running full sections.

- Code sections (naming, functions, data-types): "Refactor this code" + violating code
- Review sections (architecture): "Review this and list issues" + bad code
- Meta sections (project-hygiene): "Review this plan" + bad plan

## Step 3: Run Baseline

Spawn subagents in parallel (use `model: sonnet` for speed):
- **with-skill**: agent reads the skill first, then executes the prompt
- **without-skill**: same prompt, no skill

Save outputs to `{skill}-workspace/iteration-N/{section}-{with,without}_skill/outputs/`

Increment N for each iteration. Never overwrite previous iterations.

## Step 4: Grade + Root-Cause

Grade each assertion as **PASS/FAIL** (binary, no partial, no scales). Spawn a grader agent.

```json
{
  "eval_name": "naming",
  "expectations": [
    { "text": "intent-over-implementation", "passed": true, "evidence": "renamed to closeAccount" },
    { "text": "no-mental-mapping", "passed": false, "evidence": "d.ts, d.buf left as abbreviations" }
  ]
}
```

Build summary table, then **root-cause each failure** — don't just list them:

| Section | With Skill | Without Skill | Delta |
|---|---|---|---|
| Naming | 5/6 | 2/6 | +3 |

**Key metrics:**
- **Non-discriminating**: both pass → model already does this, can compress later
- **Discriminating**: with-skill passes, without fails → skill is teaching this
- **Failed with-skill**: rule wording too weak → needs fix

## Step 5: Fix Failed Assertions

Diagnose **why** and apply the right fix pattern:

| Failure pattern | Fix |
|---|---|
| Rule is abstract ("prefer X") | Add review checklist: "if you see Y, flag it" |
| Model does a workaround | Explicitly forbid it ("ternary is NOT a fix") |
| Silent fallback instead of reject | Add "never `?? default` — throw on invalid" |
| Rule buried in middle of section | Move to top, bold it |
| Model doesn't mention pattern by name | Add "always recommend X by name in reviews" |
| Rule lacks concrete example | Add specific before/after or valid/invalid values |
| Rule states what but not why | Add rationale — models internalize rules better when they understand the reasoning |
| Rule duplicated across sections, ignored in both | Consolidate into one authoritative location or reinforce with cross-reference |

**Only re-run the failed sections**, not the full suite.

## Step 6: Compress

After reaching 100%, compress the skill:
- **Non-discriminating rules**: single line, no "why" (model already does them)
- **Discriminating rules**: keep full detail, examples, explicit workaround bans
- Target: <800 words for frequently-loaded skills

**Re-run the hardest sections** after compression. If regression → restore detail on those specific rules. There's a floor below which rules lose effectiveness.

## Step 7: Save Benchmarks

Save `benchmarks/YYYY-MM-DD-{version}.md` in the skill directory:

```markdown
# Benchmark — YYYY-MM-DD
## Overall
| | With Skill | Without Skill | Delta |
|---|---|---|---|
| Pass rate | 49/49 (100%) | 27/49 (55%) | +45% |
## Per-section
...
## Progression
| Iteration | Score | Key fix |
...
```

Commit skill + benchmarks together.

## Red Flags

- Grading on a scale (7/10) instead of binary → grader drift, inconsistent results
- Testing with opus when skill will be used by sonnet → test on the target model
- Changing assertions between iterations → can't compare, start over
- "Looks good enough" without re-measuring → you don't know if the fix worked
- Compressing before reaching 100% → you'll lose rules that matter
- With-skill scores LOWER than without on some assertions → skill is misleading the model, investigate

## Key Learnings

From measured experiments (coding-standards skill, 49 assertions, 9 iterations):

- Abstract rules ("prefer X over Y") get ignored. Review checklists ("if you see X, flag it") work
- Position matters — rule #1 in a section gets followed more than rule #5
- Boolean flag elimination needs "ternary is NOT a fix" or the model stops at ternary
- Architecture rules in reviews need "recommend X pattern by name" or the model stays generic
- Compression has a floor — too aggressive and rules lose effectiveness. Restore detail on discriminating rules only
