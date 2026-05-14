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

**Spawn by interface touched.** If the diff changes a user-facing surface, also spawn a **Dogfood** agent. Detect broadly — *err on the side of triggering*. Categories and signals:

- **Web UI**: `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `*.html`, CSS / design-token files (`*.css`, `*.scss`, `tokens.*`, theme files), `app/**/page.*`, `pages/**`, `src/routes/**`, server actions, i18n copy files, public/static assets that change observable behaviour.
- **HTTP / API**: `app/**/route.*`, `middleware.*`, `server/api/**`, `api/**`, `routes/**`, tRPC routers, GraphQL resolvers/schema, WebSocket handlers, route definitions imported from `next`/`express`/`fastify`/`hono`/`koa`.
- **CLI**: `bin/**`, `cli/**`, `src/cli/**`, files importing `commander`, `yargs`, `oclif`, `clipanion`, `cac`, `meow`.
- **Native / desktop / mobile**: Electron/Tauri main or renderer entrypoints, React Native / Expo screens, native iOS/Android files.

If you are unsure, spawn Dogfood. A spurious dogfood run is cheap; a missed runtime bug is expensive. Dogfood runs **after Step 4 static convergence**, not in parallel with the static agents — it needs the code to actually work.

**Don't rely on `git diff main...HEAD` alone for the dogfood trigger.** That misses uncommitted work. When deciding to spawn Dogfood, also union in `git diff --name-only` (unstaged), `git diff --name-only --staged` (staged), and `git ls-files --others --exclude-standard` (untracked). Any of these touching a category above flags Dogfood.

**Codex:** only if the user explicitly requests it.

**General Opus 4.7:** always spawn. Same role as Codex (generalist reviewer, no skill loaded). Spawn via `general-purpose` subagent with `model: opus`.

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

If every agent returned "No findings.": done. Proceed to Step 4.5 (if Dogfood was flagged) or Step 5.

Otherwise, re-spawn only agents that had findings OR whose scoped files were touched by a fix. Continue fixing, committing, and re-launching until convergence.

### Step 4.5 — Runtime dogfood (only if flagged in Step 0)

Spawn the Dogfood agent once static review has converged. When it returns:

1. Process its findings the same way as static findings: spawn fix agents per file group.
2. **Re-run the full Step 3 gate** (tests + linter, then commit) on the fixes.
3. **Re-run static review** on the touched files until it re-converges (Step 4's discipline applies — no shortcuts because "it's just a small fix").
4. Re-spawn Dogfood.

Loop until Dogfood's **first line** is exactly `No findings.` **AND** the final line starts with `cleanup-complete:`. A `cleanup-incomplete` line is itself a finding — re-run Dogfood (or have the user intervene) so the run leaves no orphan processes or test data behind. A working happy path is **not** sufficient — edge-case and runtime bugs count and block convergence the same way static findings do.

### Step 5 — Brief conversation summary

Print a short summary directly in the conversation. No file artifact.

Format:
- Iterations: N (converged on iteration K)
- Agents per iteration: N₁ → N₂ → … (e.g. 12 → 4 → 0)
- Findings fixed: total count, grouped by agent
- Non-regression tests added: one bullet per bug (description → test name)

Keep it under ~15 lines. The diff is the source of truth; the summary just locates it.

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

### Dogfood Agent (runtime, post-static-convergence)

```
You exercise a user-facing surface to find runtime bugs that static review can't catch.

Load the `dogfood` skill via the Skill tool. Read the project's CLAUDE.md for run instructions, dev credentials, and conventions.

The changed surface(s) to exercise: {file_list}

Your task — in this exact order:

1. **Verify you are NOT in production.** Before doing anything, confirm the environment: read `.env`/`.env.local`, check the database connection string, look for `NODE_ENV`/`APP_ENV`. If the active database, API host, or any service URL looks like a real production system, **abort immediately** and report it as a finding ("refused to run: target appears to be production"). Never mutate data on a non-dev environment.

2. **Start the dev server / CLI with PID capture.** Find the command in package.json scripts, Makefile, justfile, or CLAUDE.md. Start it as a tracked background process so we can stop *every* child it spawns:

   ```bash
   # setsid puts the server in its own process group whose leader's PID we can capture.
   setsid <run-command> &
   SERVER_PID=$!
   # The PGID equals the leader's PID for a setsid leader, but read it explicitly to be safe.
   SERVER_PGID=$(ps -o pgid= "$SERVER_PID" 2>/dev/null | tr -d ' ')
   ```

   **If `setsid` is not available** (some shells/platforms): the fallback `<run-command> &` puts the child in the SAME process group as the agent shell. Negative-PGID kill in that case would terminate the agent itself. Therefore, **without `setsid`, never `kill -TERM -"$SERVER_PGID"`** — set `SERVER_PGID=""`, kill `SERVER_PID` directly with `kill -TERM "$SERVER_PID"` followed by `kill -KILL "$SERVER_PID"`, and rely on the port/pgrep checks in cleanup to catch escaped watchers and children. Note this limitation in the output's "How I authenticated" section.

   Register a cleanup trap **before** running the test interactions:
   ```bash
   cleanup() {
     # Prefer process-group kill (covers children/watchers/queue workers). Falls back to PID-only
     # if SERVER_PGID is empty (e.g., setsid unavailable) — never negative-PGID kill on the parent group.
     if [ -n "$SERVER_PGID" ]; then
       kill -TERM -"$SERVER_PGID" 2>/dev/null
       sleep 1
       kill -KILL -"$SERVER_PGID" 2>/dev/null
     elif [ -n "$SERVER_PID" ]; then
       kill -TERM "$SERVER_PID" 2>/dev/null
       sleep 1
       kill -KILL "$SERVER_PID" 2>/dev/null
     fi
     # Verify nothing is still listening on the project's ports.
     # Portable: pipe lsof output to a while-read loop (avoids `xargs -r`, which is GNU-only).
     for port in <project-ports>; do
       lsof -ti :"$port" 2>/dev/null | while IFS= read -r pid; do
         [ -n "$pid" ] && kill -KILL "$pid" 2>/dev/null
       done
     done
   }
   trap cleanup EXIT INT TERM
   ```

   Wait for readiness (poll the port, watch for the "ready" line, etc.).

3. **Authenticate if needed.** Check CLAUDE.md for test credentials first. If absent, in this order:
   - run a seed script if one exists,
   - drive the signup flow yourself,
   - request a magic-link / dev-only auth bypass,
   - direct DB insert as a last resort, against the **confirmed-dev** database only.

   **Use a unique identifier you can clean up later** — e.g., `email = afk-dogfood-<YYYYMMDD-HHMMSS>-<rand>@example.invalid`. Record exactly what you created in a list (`/tmp/dogfood-created.txt`): the table(s), the row ids, and the unique identifier. The next run reads this list; you must too.

4. **Exercise the changed surface.** Drive the new code path end-to-end via the actual interface (browser for UI, terminal invocation for CLI, HTTP for API). Hit the happy path, then push it: empty inputs, oversized inputs, malformed inputs, rapid clicks, race conditions, refresh mid-flow, browser back, permission boundaries.

5. **Capture evidence.** For every bug: a one-line summary, the steps to reproduce, the observed vs expected behaviour, and any console / network / server-log artifact you saw.

6. **Cleanup is mandatory.** Even on bugs, even on errors, even on your own crash — the trap from step 2 fires and stops the server's process group. Then:
   - Delete every row listed in `/tmp/dogfood-created.txt`. Report exact counts (`deleted: 3 users, 7 sessions`).
   - Verify ports are free: `lsof -i :<port>` returns nothing.
   - Verify no orphan processes: `pgrep -f <server-command>` returns nothing.
   - If anything you created cannot be cleanly deleted, list it in the output under "cleanup-incomplete" — do **not** hide it.

Output (the **first line** is the convergence signal — keep header lines after it):
- If zero bugs: line 1 is exactly `No findings.`
- Otherwise: line 1 is a one-line count (e.g. `3 findings.`), then a flat list of bugs. Every bug entry MUST include a `suspected files:` field listing the paths/components most likely owning the defect — Step 4.5 groups fix agents by file, so this attribution is required, not optional.
- A short "How I authenticated" note so the next run can reuse it.
- A final line: `cleanup-complete: server stopped (PID/PGID killed and verified), N rows deleted` OR `cleanup-incomplete: <what's left>`.
```
