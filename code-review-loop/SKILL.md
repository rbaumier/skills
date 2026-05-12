---
name: code-review-loop
description: Use when the user wants a thorough, autonomous code review of the current branch. Also use when the user asks to stress-test code quality, run a deep review, or review before merge. Spawns specialized review agents in parallel, fixes all findings, and loops until every agent has zero feedback.
---

# Code Review Loop

Specialized review agents in parallel. Zero tolerance for remaining feedback. Loop until convergence.

You orchestrate the loop: read feedback, fix code, commit, re-launch. The user does not intervene between iterations.

## The Funnel

Three levels, in order. Each gates the next.

**Level 1 — Question the need.** Does this code need to exist? Does the framework or a dependency already solve this? Are we reproducing a pattern by inertia when a fundamentally different approach would be simpler? Start from the problem, not from the existing code.

**Level 2 — Reduce scope.** Find the smallest perimeter that solves the validated need. A separate file might become an inlined function. Three queries might become one. A wrapper type might disappear if the underlying type suffices. Every abstraction, file, function, or intermediate type must justify its existence through concrete usage, not hypothetical flexibility.

**Level 3 — Minimize code + review tests.** Write the shortest correct, typed code. If data already exists in usable form, don't create a second copy. If you control the input data, don't re-validate it. Then review tests: which ones are missing? Which ones are useless or redundant? Which ones can be improved? How?

**Discipline: iterate internally before proposing.** Challenge your own proposal at each funnel level until you can't remove anything. Then present the simplest result.

## Workflow

### Step 0 — Detect and spawn agents

Analyze the list of files changed (`git diff --name-only main...HEAD`) and their content to determine which agents to spawn.

**Agent roster — spawn every applicable agent in parallel. One skill per agent: keep each agent focused on the rules of its skill, no cross-contamination of attention.**

| Agent | Model | Trigger | Role |
|-------|-------|---------|------|
| Funnel L1 | sonnet | always | Question the need. Prompt-only, no skill. |
| Funnel L2 | sonnet | always | Reduce scope. Prompt-only, no skill. |
| `coding-standards` | sonnet | always | Enforce umbrella philosophy (Rule of Three, state machines as enums, immutable config, mechanism/policy, symmetric siblings, minimal main, etc.) + "rules vary by boundary" meta-rule. |
| `coding-standards:style` | sonnet | always | Enforce comments, naming, control flow, readability, file structure rules. |
| `coding-standards:design` | sonnet | always | Enforce function/type/data/architecture rules (DI, extraction, modularity, negative-space modules, behavior-not-ontology, etc.). |
| `coding-standards:errors` | sonnet | always | Enforce error-handling rules (Result/Option, timeouts, assertions, user-facing messages, diagnostic-complete errors). |
| `coding-standards:hygiene` | sonnet | always | Enforce tooling/lint/CI rules — dead code added, TODOs without context, cyclomatic complexity, lint suppression bypasses. |
| `simplify` | sonnet | always | Look for reuse, quality, efficiency wins in the changed code — concrete simplifications the diff could absorb, not structural reframes (those belong to Funnel L2). |
| `matt-improve-codebase-architecture` | sonnet | always | Find deepening opportunities, tightly-coupled modules ripe for consolidation, hotspots reducing testability. |
| `security-defensive` | sonnet | always | Enforce security skill. |
| Language | sonnet | by extension | Enforce language skill (`language-typescript`, `language-rust`, `language-swift`, `vue`). |
| Framework/lib (one per skill) | sonnet | by imports | Enforce framework skill (see eligible list below). |
| Tests | sonnet | always | Enforce `testing` + `matt-tdd` skills. Check for missing tests even when none are in the diff. Flag useless tests (trivial type guards, testing language semantics, no real behavior). |
| Correctness | sonnet | always | Bugs, edge cases, race conditions, missing logic, error paths. |
| Codex | CLI | explicit only | Generalist review via `codex review`. Only spawn if the user explicitly requests it. |

**On overlap between agents:** the four `coding-standards:*` sub-skills cover distinct rule sets — the umbrella `coding-standards` holds the universals that don't fit in any sub-skill (Rule of Three, state machines, etc.). `simplify` overlaps with Funnel L2 but operates at a different granularity: L2 questions whether structure should exist, `simplify` cleans up code that's already decided to exist. `matt-improve-codebase-architecture` overlaps with `coding-standards:design` but looks at the *codebase-level* deepening opportunities (consolidation across modules) rather than per-diff design rules. Keep all of them — when they converge on the same finding, that's signal, not noise.

**Eligible framework/lib skills** (scan imports in the diff to detect):
`better-auth-best-practices`, `better-result-adopt`, `database`, `docker`, `drizzle-orm`, `frontend`, `i18n`, `kubernetes`, `react`, `react-native`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui`, `ui-animations`, `ui-ux`, `vue`, `web-performance`, `zod`

### Step 1 — Spawn all agents in a single message block

Every agent is a Claude subagent (model: `sonnet`) except Codex (Bash command). Launch all of them in one message block so they run in parallel.

**All agents** start by reading the project's CLAUDE.md (if it exists) for project conventions. Then run `rtk proxy git diff main...HEAD` via Bash to get the diff. Read full files when the diff lacks context.

**Skill agents** (the `coding-standards` umbrella, each `coding-standards:*` sub-skill, `simplify`, `matt-improve-codebase-architecture`, `security-defensive`, language, framework, tests): each agent invokes **exactly one skill** via the Skill tool, then reviews the diff against the rules of that skill only. Loading multiple skills in one agent dilutes attention; one-skill-per-agent keeps each agent ruthless about its narrow rule set. For every rule in the loaded skill, actively look for violations in the diff. Don't skim — check each changed line against the skill's rules.

**Funnel L1**: read CONTEXT.md (if it exists) for domain terms, roles, and invariants. For every role, type, or constant referenced in the diff, verify it actually exists in the codebase (grep for its definition). Question whether each piece of code needs to exist, and what's missing.

**Funnel L2**: reduce scope. Look for inlining opportunities, mergeable abstractions, removable wrappers.

**Correctness agent**: check the implementation against the apparent intent. Look for bugs, missing edge cases, race conditions, incomplete error handling, logic gaps. For every permission check, verify the role used is correct for the operation.

**Codex**: `codex review "Review the diff on the current branch vs main. List every issue you find. No categories, no severity. If zero issues, say exactly: No findings."`

Every agent outputs a flat list of findings. No categories, no severity labels. Every finding matters equally. If zero findings, say exactly: "No findings."

### Step 2 — Process findings and fix

Read all agent reports. Process in funnel order:

1. **L1 findings first.** If L1 says "this module shouldn't exist," discard all other findings about that module.
2. **L2 findings next.** If L2 says "merge these 3 files into 1," discard file-level findings on the original files.
3. **All other findings.** When agents contradict each other, the simpler option wins.

**Fix every finding, regardless of how many agents reported it.** A finding from a single agent is just as valid as one reported by seven agents. The number of agents that converge on a finding is not a filter. The only valid reason to reject a finding is if a higher funnel level (L1/L2) makes it irrelevant.

**Parallelize fixes.** Group findings by file. Spawn one fix agent (model: `sonnet`) per file group, in parallel. Each fix agent receives only the findings for its files and applies all of them. If a finding spans multiple files, assign it to a single fix agent that handles all involved files. Fix agents do not load skills — the findings already contain all the context needed. Do NOT use `isolation: "worktree"` for fix agents — uncommitted changes in worktrees get cleaned up automatically. Fix agents work directly on the current working tree.

**Bug findings get TDD treatment.** When a finding identifies a bug, write a non-regression test that fails first, then fix the code so the test passes. Never fix a bug without a failing test.

### Step 3 — Verify and commit

1. Run the test suite
2. Run the linter
3. If anything fails, fix it
4. Commit with a message describing what was fixed and why

### Step 4 — Loop or stop

If any agent had findings: go back to Step 1.

If every agent returned "No findings.": the loop is done.

Do not give control back to the user between iterations. Fix, commit, re-launch, repeat. Only stop when converged.

### Step 5 — HTML Report

Generate a self-contained HTML report. The report contains:

- **Summary:** number of iterations, total agents per iteration, convergence confirmation
- **Per iteration:**
  - Findings from each agent, grouped by agent name
  - Corrections applied, with reasoning for each
  - Diff of changes made (the commit diff for that iteration)
- **Non-regression tests added:** bug description paired with the test that covers it

Write the report to `code-review-report-YYYY-MM-DD.html` in the project root. Open it with `open`.
