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
classify skill → extract assertions → write trap prompts → run baseline → grade → root-cause failures → fix wording → re-measure → repeat
```

## Step 0: Classify the Skill

Before writing evals, answer one question: **"Would a senior dev with 5 years in this domain already follow >70% of these rules?"**

| Classification | Signal | Eval strategy |
|---|---|---|
| **Cat A — Unique philosophy** | Opinionated patterns the model wouldn't follow naturally (specific commenting style, custom error paradigm, proprietary architecture) | Standard "fix all issues" with Level 1 traps works. The skill's unique patterns ARE the discriminating factor. |
| **Cat B — Standard best practices** | Well-known patterns any senior dev knows (OWASP, React perf, Rust idioms) | "Fix all issues" won't discriminate — model already knows these. Use Level 2 traps or accept low delta. |

**Why this matters**: coding-standards (Cat A) achieved +50% delta. security-defensive, react, ui-ux, language-rust (Cat B) achieved 0% delta even with subtle traps — Sonnet already knows standard best practices. Classifying first avoids wasted benchmark cycles.

**Cat B skills are not useless.** Their value is in variance reduction (consistent 100% vs occasional 95%), review/audit mode, and cross-project consistency — not capturable in single-prompt refactoring evals. Document this in benchmarks rather than endlessly rewriting traps.

## Step 1: Extract Assertions

Read the skill. List every rule as a named assertion. Group by section. Tag each assertion with a category for coverage tracking:

- `behavior` — logic, patterns, decision-making rules
- `format` — naming, style, structure conventions
- `architecture` — file organization, module boundaries, dependency direction
- `security` — secrets, validation, auth, injection prevention

```
## Naming (6 assertions) [format]
- intent-over-implementation
- no-mental-mapping
- explicit-units
...
## Error Handling (4 assertions) [behavior]
- result-over-throw
- fail-fast
...
```

Every rule = 1 assertion. No rule left unmeasured. Track category distribution — if 80% of assertions are `format` and 5% are `behavior`, the skill is style-heavy and logic-light.

**Assertion categories for coverage tracking**: Tag each assertion with a category: `format` (naming, style), `behavior` (logic, patterns), `architecture` (structure, organization), `security` (secrets, injection), `gotcha` (common mistakes). Track pass rates per category to identify systemic weaknesses — e.g., 'model follows format rules at 95% but architecture rules at 60%'.

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

### Trap Difficulty Levels

**Level 1 — Obvious violations** (sufficient for Cat A skills):
Code written by a junior. Any model fixes these without the skill.

**Level 2 — Subtle violations** (required for Cat B skills):
Code written by a competent intermediate dev — correct patterns applied slightly wrong. The code WORKS and LOOKS reasonable. Only someone who read the skill catches the issue.

| Level 1 (too easy) | Level 2 (discriminating) |
|---|---|
| `exec(command)` | `bcrypt(10)` instead of `bcrypt(12+)` |
| `SELECT * ... '${id}'` | HS256 on public API (HS256 is fine internally) |
| `useMemo(() => "string")` | `React.memo()` on cheap component with stable props |
| `Arc<Mutex<Vec>>` | `HashMap<u64, _>` instead of `FxHashMap` |
| `user-scalable=no` | 3 font weights instead of max 2 |

**The litmus test**: run the trap WITHOUT the skill. If the model passes >90%, your traps are Level 1 — rewrite with Level 2.

**Level 2 design principle**: the code should look like it passed code review by a good developer. Violations are things a SENIOR specialist catches, not things any developer spots.

## Step 3: Run Baseline

**First: "Does the model already know this?" baseline** — run the trap prompt WITHOUT the skill loaded. This separates rules the model already follows (non-discriminating) from rules the skill actually teaches (discriminating). Rules where the model passes without the skill can be compressed aggressively later — the skill isn't adding value there.

**Then: With-skill runs** — Spawn 3 Sonnet agents in parallel (3 runs for variance):
- Each agent reads the skill SKILL.md first, then executes the prompt
- Save outputs to `{skill}/enforcing-skill-rules/iteration-N/run{1,2,3}-with-skill.md`
- Save without-skill baseline to `iteration-N/run{1,2,3}-without-skill.md`
- Increment N for each iteration. Never overwrite previous iterations.


**Separate 'does the model already know this?' baseline**: Before writing skill rules, run the trap prompt WITHOUT the skill to establish what the model already knows. Rules where the model passes without the skill are non-discriminating — compress aggressively. This baseline is different from the with-skill run and should be saved separately: `iteration-0/run{1,2,3}-without-skill.md`.

## Step 4: Grade with Cross-Model Grading

**The grader MUST be a different model than the executor.** Sonnet executes, Opus grades. Never let the executor grade its own output -- it will be indulgent.

**Opus grader instructions -- strict grading, no leniency:**
- PASS: the violation is CLEARLY fixed in the actual code output
- FAIL: violation still present, fix is superficial, fix is "aspirational" (described but not coded), or fix is delegated to an unshown component
- "The comment says it's fixed but the code doesn't show it" -- FAIL
- "Delegated to another component not shown" -- FAIL
- "Would need aria-label" without actually adding one -- FAIL
- If unsure -- FAIL

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
- **Non-discriminating**: both pass → model already does this, compress later
- **Discriminating**: with-skill passes, without fails → skill teaches this
- **Failed with-skill**: rule wording too weak → needs fix
- **Regression**: without passes, with-skill FAILS → skill misleads the model, investigate immediately
- **Opus-FAIL but Sonnet-self-reported-PASS**: the most important signal — superficial fix or aspirational description

**After grading, tag each assertion** in evals.json:

```json
{ "id": "rule-name", "trap": "...", "description": "...", "category": "behavior", "discriminating": true }
```

`"discriminating": false` → compress to single line in SKILL.md. `"discriminating": true` → keep full detail, examples, workaround bans. This tag persists across iterations.

### When Delta is 0% or Negative

If without-skill scores ≥90% on Level 2 traps, stop rewriting evals. The skill's value is not capturable in single-prompt refactoring. Instead:

1. **Run 3 without-skill runs** (not 1) to check variance. 100%/95%/100% without vs 100%/100%/100% with = variance reduction value.
2. **Document in benchmark**: `"Delta: 0% — non-discriminating for refactoring. Value: consistency and review mode."`
3. **If delta is negative**: the skill actively misleads the model. Find which rules cause regression, soften or remove them.

Do NOT keep rewriting evals hoping for a delta. If Level 2 traps show 0% after one rewrite, accept it and move on.

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

## Pre-Deployment Checklist

Before deploying any skill modification, verify all of these. Benchmark must show 100% pass rate on target model.

- [ ] Skill classified as Cat A or Cat B — eval difficulty matches classification
- [ ] Every SKILL.md rule has a corresponding assertion in evals.json — audit coverage by diffing rule count vs assertion count
- [ ] Description triggers correctly — test with 5 prompts that SHOULD activate the skill and 5 that SHOULD NOT
- [ ] Benchmark shows 100% pass rate on target model (Sonnet for Sonnet skills, etc.)
- [ ] Delta is positive or documented as non-discriminating — if 0%, benchmark explains the skill's consistency/review value
- [ ] No regression — with-skill never scores LOWER than without on any assertion
- [ ] `discriminating` field set on all assertions after first benchmark
- [ ] Compression didn't break discriminating rules — re-run hardest sections after any word reduction

## Red Flags

- Grading on a scale (7/10) instead of binary → grader drift, inconsistent results
- **Same model grades its own output** → indulgent grading. Sonnet self-reported 100% but Opus found 4 real failures across 253 assertions
- Testing with opus when skill will be used by sonnet → test on the target model
- Changing assertions between iterations → can't compare, start over
- "Looks good enough" without re-measuring → you don't know if the fix worked
- Compressing before reaching 100% → you'll lose rules that matter
- **Skill description testing**: The `description` field controls when the skill activates. Test it: write 5 prompts that SHOULD trigger the skill and 5 that SHOULD NOT. Common failure: description too broad (triggers on unrelated prompts, wastes context) or too narrow (never triggers). Use intent patterns (implicit) + content patterns (explicit file/keyword matches).
- With-skill scores LOWER than without on some assertions → skill is misleading the model, investigate
- **Hint comments in trap code** ("// this is wrong because...") → model follows hints, not skill rules. Remove ALL hints.
- **Aspirational fixes** ("would need aria-label") → Opus catches these, Sonnet self-grading doesn't

## Key Learnings

From measured experiments (21 skills, ~650 assertions, Opus cross-grading, 5 full benchmarks):

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
- **Classify before writing evals**: "Unique philosophy" skills (Cat A) show +20-50% delta with standard traps. "Standard best practices" skills (Cat B) show ~0% delta even with Level 2 traps — Sonnet already knows OWASP, React perf, Rust idioms. Classifying first saves wasted benchmark cycles
- **Level 2 traps are necessary but not sufficient**: "Code that looks correct" traps showed 0% delta for security-defensive and language-rust. The model's baseline knowledge is extremely strong for well-documented domains
- **Regression is real**: with-skill scored LOWER than without on 2/5 benchmarked skills (security-defensive -4%, language-rust -4%). Skills can mislead the model by over-emphasizing one pattern at the expense of another
- **Delta does not equal value**: a skill with 0% refactoring delta may still reduce variance (consistent 100% vs occasional 95%) and enforce consistency across a project. Document this distinction in benchmarks
- **Style and philosophy rules discriminate most**: coding-standards achieved +50% because it teaches HOW to comment, not WHAT code to write. Rules that override the model's defaults discriminate more than correctness rules the model already follows
- **3 runs minimum for statistical confidence**: single runs mislead — the without-skill run might get lucky. Always run 3+ to measure the delta reliably
