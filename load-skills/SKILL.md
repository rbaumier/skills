---
name: load-skills
description: Scan and auto-load all relevant skills for the current task. Use when the user types /load-skills at any point in a conversation — before starting work, after describing a task, or when the task shifts direction. TRIGGER on /load-skills only.
---

# Load Skills

Scan available skills and invoke every one that's relevant to the current context. Produce no other output — just load and report.

## Always-load

When the task involves code (any language), always load these skills regardless of matching:
- `coding-standards`

## Process

1. **Extract criteria** from the full conversation context:
   - Language/framework: TypeScript, React, Vue, Swift, Rust, Python...
   - Task type: build, debug, refactor, review, write, design, deploy, test, plan
   - Domain: API, database, frontend, security, CI/CD, performance, UI/UX, documentation...
   - If no task described yet, infer from the project (package.json, Cargo.toml, tech stack visible in the repo)

2. **Scan every skill** in the available skills list. A skill matches if its description overlaps with at least one extracted criterion. Be permissive — loading one extra skill is cheap, missing a useful one is expensive.

3. **Invoke all matching skills in parallel** in a single message block via the Skill tool. Do NOT re-invoke a skill already loaded in this conversation.

4. **Report in one line**: "Loaded: skill-a, skill-b, skill-c" — nothing else.

## Guard-rail

If more than 6 skills match, list them with a one-line justification each before invoking. Then invoke all of them.
