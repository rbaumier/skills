#!/usr/bin/env bun
/**
 * V1b sandbox setup — creates ONE trivial test issue labeled `ready-for-agent`
 * in the current GitLab project, so the orchestrator has something to process
 * end-to-end.
 *
 * Run WITHOUT --confirm to see which project will be targeted (dry-run).
 * Run WITH --confirm to actually create the issue.
 *
 * Usage:
 *   bun ~/.claude/skills/afk/v1b-sandbox-setup.ts            # dry-run
 *   bun ~/.claude/skills/afk/v1b-sandbox-setup.ts --confirm  # creates issue
 */
import { $ } from "bun"

const repoJson = (await $`glab repo view --output json`.nothrow().text()).trim()
if (!repoJson) {
  console.error("ERROR: glab repo view failed. Run this from within a GitLab repo.")
  process.exit(2)
}

const project = JSON.parse(repoJson) as {
  path_with_namespace: string
  web_url: string
}

console.log("Sandbox setup target:")
console.log(`  Project: ${project.path_with_namespace}`)
console.log(`  URL:     ${project.web_url}`)
console.log("")

if (!process.argv.includes("--confirm")) {
  console.log("DRY-RUN. To actually create the test issue:")
  console.log(`  bun ~/.claude/skills/afk/v1b-sandbox-setup.ts --confirm`)
  console.log("")
  console.log("Make sure this is a SANDBOX project (something you can break safely).")
  console.log("The orchestrator will: create a branch, commit, open a MR, auto-merge.")
  process.exit(0)
}

// ─── Confirmed: create the issue ───────────────────────────────────────

const title = "[V1b TEST] Add hello.txt at repo root"
const body = `Add a single file \`hello.txt\` at the repository root with the exact content:

Hello from AFK V1b

(no trailing newline matters, plain text). Use a sensible commit message. That is the entire task — no tests, no docs.`

const create = await $`glab issue create --title ${title} --description ${body} --label ready-for-agent`.nothrow()
if (create.exitCode !== 0) {
  console.error("Issue creation failed:")
  console.error(create.stderr.toString())
  process.exit(1)
}

const out = create.stdout.toString().trim()
console.log(out)
console.log("")
console.log("Now run the orchestrator from this same repo:")
console.log("  bun ~/.claude/skills/afk/src/main.ts")
console.log("")
console.log("It will pick up this issue (and any other ready-for-agent issues).")
console.log("Watch live with:")
console.log("  tmux ls   # list sessions")
console.log("  tmux attach -r -t afk-<iid>   # attach read-only")
