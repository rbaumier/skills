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

Save to `{skill}/enforcing-skill-rules/evals/evals.json`. ONE full-sweep eval per skill.

**Single full-sweep prompt**: 1 prompt with ONE code block that violates ALL rules. "Fix all issues:" + violating code. This is the standard format — consolidate, don't scatter across sections.

- Instruction: `"Fix all issues:"` (minimal, no hints)
- Trap code: realistic component/module violating every rule. NO comments hinting at violations — the model must FIND them
- Output instruction: `"Output fixed code only."` or `"Output fixed code + list every issue."`
- Remove section headers (##), hint comments, verbose instructions

**Every assertion must have a `trap` field** explaining what specific code/scenario tests it:

```json
{
  "skill_name": "my-skill",
  "evals": [{
    "id": 1,
    "name": "full-sweep",
    "prompt": "Fix all issues:\n\n```typescript\n...\n```\n\nOutput fixed code only.",
    "assertions": [
      { "id": "channels-over-mutex", "trap": "process_batch uses Arc<Mutex<Vec>> to collect results", "description": "Use mpsc channels, not Arc<Mutex<Vec>>" }
    ]
  }]
}
```

If a trap doesn't naturally exercise a rule, the trap is bad — enrich the code until it does. Every rule in the SKILL.md MUST have a corresponding assertion. Audit coverage before validating.

## Step 3: Run Baseline

**Executor**: Spawn 3 Sonnet agents in parallel (3 runs for variance):
- Each agent reads the skill SKILL.md first, then executes the prompt
- Save outputs to `{skill}/enforcing-skill-rules/iteration-N/run{1,2,3}-with-skill.md`
- Increment N for each iteration. Never overwrite previous iterations.

## Step 4: Grade with Cross-Model Grading

<EXTREMELY-IMPORTANT>
**The grader MUST be a different model than the executor.** Sonnet executes → Opus grades. NEVER let the executor grade its own output — it will be indulgent.

**Opus grader instructions — be EXTREMELY strict:**
- PASS: the violation is CLEARLY fixed in the actual code output
- FAIL: violation still present, fix is superficial, fix is "aspirational" (described but not coded), or fix is delegated to an unshown component
- "The comment says it's fixed but the code doesn't show it" → FAIL
- "Delegated to another component not shown" → FAIL
- "Would need aria-label" without actually adding one → FAIL
- If unsure → FAIL
</EXTREMELY-IMPORTANT>

Spawn Opus grader agent with:
1. The assertions (evals/evals.json)
2. The code output to grade (iteration-N/runX-with-skill.md)
3. NO access to the original prompt — grader only sees output + assertions

Grade each assertion as **PASS/FAIL** (binary, no partial, no scales). Require evidence (quote from code).

```
| ID | PASS/FAIL | Evidence (quote from code) |
|---|---|---|
| channels-over-mutex | PASS | "let (tx, rx) = mpsc::channel(items.len())" |
| cancellation-safety | FAIL | No Drop impl shown, no cancellation docs |
```

Build summary table, then **root-cause each failure**:

**Key metrics:**
- **Non-discriminating**: both pass → model already does this, can compress later
- **Discriminating**: with-skill passes, without fails → skill is teaching this
- **Failed with-skill**: rule wording too weak → needs fix
- **Opus-FAIL but Sonnet-self-reported-PASS**: the most important signal — superficial fix or aspirational description

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
- **Same model grades its own output** → indulgent grading. Sonnet self-reported 100% but Opus found 4 real failures across 253 assertions
- Testing with opus when skill will be used by sonnet → test on the target model
- Changing assertions between iterations → can't compare, start over
- "Looks good enough" without re-measuring → you don't know if the fix worked
- Compressing before reaching 100% → you'll lose rules that matter
- With-skill scores LOWER than without on some assertions → skill is misleading the model, investigate
- **Hint comments in trap code** ("// this is wrong because...") → model follows hints, not skill rules. Remove ALL hints.
- **Aspirational fixes** ("would need aria-label") → Opus catches these, Sonnet self-grading doesn't

## Key Learnings

From measured experiments (16 skills, 402 assertions, Opus cross-grading):

- Abstract rules ("prefer X over Y") get ignored. Review checklists ("if you see X, flag it") work
- Position matters — rule #1 in a section gets followed more than rule #5
- Boolean flag elimination needs "ternary is NOT a fix" or the model stops at ternary
- Architecture rules in reviews need "recommend X pattern by name" or the model stays generic
- Compression has a floor — too aggressive and rules lose effectiveness. Restore detail on discriminating rules only
- **Single full-sweep prompt > many per-section prompts**: 1 prompt testing ALL rules is 5-10x faster to run than 5-10 separate prompts, with equal or better coverage
- **Remove hint comments from trap code**: `// stored in plain text`, `// no junction table` — these guide the model to the answer. The model must FIND violations from the skill, not from breadcrumbs
- **"Refactor this code" > "Implement this function"**: refactoring tests whether the model RECOGNIZES violations, not just writes clean code from scratch
- **Opus cross-grading catches ~2% false positives**: Sonnet says "fixed" but just deleted the code, delegated to unshown component, or described the fix without coding it
- **Aspirational FAIL pattern**: "icon buttons *would* get aria-label" — no code = no pass. Most common Opus-caught failure mode
- **Coverage audit before validating**: compare every SKILL.md rule against assertions. Missing rules = missing trap code. ~30% of rules were untested before systematic audit
- **Non-testable rules exist**: process rules ("design in grayscale first"), multi-file rules ("feature folders"), runtime rules ("cargo miri test") cannot be tested in a single-component refactoring prompt. Accept the gap or create dedicated eval shapes
