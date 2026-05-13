---
name: code-review-loop
description: Use when the user wants a thorough, autonomous code review of the current branch. Also use when the user asks to stress-test code quality, run a deep review, or review before merge. Spawns specialized review agents in parallel, fixes all findings, and loops until every agent has zero feedback.
---

# Code Review Loop

Specialized review agents in parallel. Fix every finding. Loop until convergence. The user does not intervene between iterations.

## When not to use

- Diff under 10 lines or single-file typo/rename
- No code changes (docs-only, config-only)
- The user wants a quick opinion, not an autonomous fix loop

## The Funnel

Three levels, in order. Each gates the next.

**Level 1 — Question the need.** Does this code need to exist? Does the framework or a dependency already solve this? Start from the problem, not from the existing code. What's missing?

**Level 2 — Reduce scope.** Smallest perimeter that solves the validated need. Inline, merge, remove wrappers. Every abstraction justifies itself through concrete usage.

**Level 3 — Minimize code + review tests.** Shortest correct typed code. No duplicate data. Then: missing tests? Useless tests? Improvable tests?

**Discipline:** challenge your own proposal at each level until you can't remove anything.

## Workflow

### Step 0 — Detect agents and scope files

Run `git diff --name-only main...HEAD` to get all changed files. Determine which agents to spawn based on file extensions and imports.

**Always spawn:** Funnel L1, Funnel L2, coding-standards (umbrella + 4 sub-skills), simplify, matt-improve-codebase-architecture, security-defensive, Tests, Correctness.

**Spawn by extension:** `.ts`/`.tsx` → language-typescript, `.rs` → language-rust, `.swift` → language-swift, `.vue` → vue.

**Spawn by imports** (one agent per detected skill):
`better-auth-best-practices`, `better-result-adopt`, `database`, `docker`, `drizzle-orm`, `frontend`, `i18n`, `kubernetes`, `react`, `react-native`, `shadcn`, `tailwind`, `tanstack-query`, `tanstack-start-best-practices`, `ui`, `ui-animations`, `ui-ux`, `vue`, `web-performance`, `zod`

**Codex:** only if the user explicitly requests it.

**Scope files per agent:**
- Language agents: only files matching the extension
- Framework/lib agents: only files that import the framework
- Tests agent: only test files + the source files they test
- All other agents: all changed files

### Step 1 — Spawn all agents in a single message block

Launch every agent in one message block so they run in parallel. Use the prompt templates below. Pass each agent its scoped file list.

### Step 2 — Process findings and fix

Read all reports. Process in funnel order:
1. L1 findings first. If L1 says "delete this module," discard findings about that module from other agents.
2. L2 findings next. If L2 says "merge these files," discard file-level findings on the originals.
3. All other findings. Contradictions: the simpler option wins.

Fix every finding, regardless of how many agents reported it. A single-agent finding is just as valid as one from seven agents.

**Parallelize fixes.** Group findings by file. Spawn one fix agent (model: `sonnet`) per file group, in parallel. Fix agents receive only their findings and apply all of them. Fix agents do not load skills. Do NOT use `isolation: "worktree"`. Fix agents work directly on the current working tree.

**Bugs get TDD treatment.** Write a non-regression test that fails first, then fix the code so the test passes.

### Step 3 — Verify and commit

1. Run the test suite
2. Run the linter
3. Fix failures
4. Commit describing what was fixed and why

### Step 4 — Loop or stop

If every agent returned "No findings.": done. Proceed to Step 5.

Otherwise, re-spawn only agents that had findings OR whose scoped files were touched by a fix. Continue fixing, committing, and re-launching until convergence.

### Step 5 — HTML Report

Generate a self-contained HTML report:
- **Summary:** iteration count, agents per iteration, convergence confirmation
- **Per iteration:** findings by agent, corrections with reasoning, commit diff
- **Non-regression tests:** bug description paired with the test that covers it

Write to `code-review-report-YYYY-MM-DD.html` in the project root. Open with `open`.

---

## Agent Prompt Templates

Every agent follows: role → context → task → constraints → output format.

### Funnel L1

```
You review code for necessity and completeness.

Read the project's CLAUDE.md for conventions. Read CONTEXT.md for domain terms, roles, and invariants.

Run `rtk proxy git diff main...HEAD -- {files}` to get the diff. For every role, type, or constant referenced in the diff, grep the codebase to verify it exists.

Your task: does each piece of code need to exist? Does the framework or a dependency already solve this? Is there a simpler approach? What's missing?

Stay within these files: {file_list}

Output: a flat list of findings. If zero findings, say exactly: "No findings."
```

### Funnel L2

```
You review code for scope reduction.

Read the project's CLAUDE.md for conventions.

Run `rtk proxy git diff main...HEAD -- {files}` to get the diff. Read full files when context is needed.

Your task: find the smallest perimeter. Can files be inlined? Can queries be merged? Can wrapper types be removed? Every abstraction must justify itself through concrete usage.

Stay within these files: {file_list}

Output: a flat list of findings. If zero findings, say exactly: "No findings."
```

### Skill Agent (coding-standards, coding-standards:*, security-defensive, language-*, framework/lib, simplify, matt-improve-codebase-architecture)

```
You enforce a single skill's rules on changed code.

Read the project's CLAUDE.md for conventions. Then load the skill `{skill_name}` via the Skill tool.

Run `rtk proxy git diff main...HEAD -- {files}` to get the diff. Read full files when context is needed.

Your task:
1. After loading the skill, list every rule and its review standard (the "flag when..." patterns)
2. Read the diff
3. Walk through each rule. For each rule, scan every changed line and check if it violates. When a rule has a review standard, apply it literally.
4. Report all violations found

Stay within these files: {file_list}

Output: a flat list of findings. If zero findings, say exactly: "No findings."
```

### Tests Agent

```
You review test quality and coverage.

Read the project's CLAUDE.md for conventions. Load the skills `testing` and `matt-tdd` via the Skill tool.

Run `rtk proxy git diff main...HEAD -- {files}` to get the diff. Read full files when context is needed.

Your task:
- Missing tests: what behavior is untested?
- Useless tests: trivial type guards, tests that verify language semantics, no real behavior tested
- Improvable tests: tests that test implementation instead of behavior, tests that would break on refactor

Stay within these files: {file_list}

Output: a flat list of findings. If zero findings, say exactly: "No findings."
```

### Correctness Agent

```
You hunt bugs.

Read the project's CLAUDE.md for conventions.

Run `rtk proxy git diff main...HEAD -- {files}` to get the diff. Read full files when context is needed.

Your task: check the implementation against the apparent intent. Look for bugs, missing edge cases, race conditions, incomplete error handling, logic gaps. For every permission check, verify the role is correct for the operation.

Stay within these files: {file_list}

Output: a flat list of findings. If zero findings, say exactly: "No findings."
```
