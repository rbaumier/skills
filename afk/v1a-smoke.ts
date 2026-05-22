#!/usr/bin/env bun
/**
 * V1a smoke test — verifies that every glab subcommand + flag the orchestrator
 * relies on actually exists on the user's installed glab version.
 *
 * Read-only: never creates MRs, never modifies issues. Just probes --help.
 *
 * Usage: bun ~/.claude/skills/afk/v1a-smoke.ts
 */
import { $ } from "bun"

type Check = { name: string; cmd: string[]; mustContain: string[] }

const checks: Check[] = [
  {
    name: "glab --version",
    cmd: ["--version"],
    mustContain: ["glab"],
  },
  {
    name: "issue list (fetch_queue / sweep)",
    cmd: ["issue", "list", "--help"],
    mustContain: ["--label", "--not-label", "--per-page", "--output"],
  },
  {
    name: "issue update (claim / unclaim / fail-label)",
    cmd: ["issue", "update", "--help"],
    mustContain: ["--label", "--unlabel"],
  },
  {
    name: "issue create (out-of-scope discoveries)",
    cmd: ["issue", "create", "--help"],
    mustContain: ["--label", "--title", "--description"],
  },
  {
    name: "issue note (failed-issue comment)",
    cmd: ["issue", "note", "--help"],
    mustContain: ["--message"],
  },
  {
    name: "mr list (idempotent open_draft_mr check)",
    cmd: ["mr", "list", "--help"],
    mustContain: ["--source-branch", "--output"],
  },
  {
    name: "mr create — draft + cleanup flags (open_draft_mr)",
    cmd: ["mr", "create", "--help"],
    mustContain: [
      "--draft",
      "--source-branch",
      "--target-branch",
      "--title",
      "--description",
      "--remove-source-branch",
      "--squash-before-merge",
    ],
  },
  {
    name: "mr update — --ready (un-draft in merge)",
    cmd: ["mr", "update", "--help"],
    mustContain: ["--ready"],
  },
  {
    name: "mr merge (merge)",
    cmd: ["mr", "merge", "--help"],
    mustContain: ["--squash", "--auto-merge", "--yes"],
  },
  {
    name: "mr view --output json (merge status verify)",
    cmd: ["mr", "view", "--help"],
    mustContain: ["--output"],
  },
  {
    name: "api — discussions endpoint (mr-discussion.ts)",
    cmd: ["api", "--help"],
    mustContain: ["--paginate", "--field", "--raw-field"],
  },
]

// Live calls (safe: read-only, no project mutations)
type LiveCheck = { name: string; cmd: string[] }
const liveChecks: LiveCheck[] = [
  {
    name: "glab auth status",
    cmd: ["auth", "status"],
  },
  {
    name: "glab repo view (current repo recognized)",
    cmd: ["repo", "view"],
  },
]

console.log("V1a smoke test — checking glab subcommands + flags\n")

let pass = 0
let fail = 0
const failures: string[] = []

for (const c of checks) {
  const r = await $`glab ${c.cmd}`.nothrow().quiet()
  if (r.exitCode !== 0) {
    console.log(`✗ ${c.name}`)
    console.log(`    glab ${c.cmd.join(" ")} exited ${r.exitCode}`)
    console.log(`    stderr: ${r.stderr.toString().trim().slice(0, 200)}`)
    fail++
    failures.push(c.name)
    continue
  }
  const out = r.stdout.toString() + r.stderr.toString()
  const missing = c.mustContain.filter((flag) => !out.includes(flag))
  if (missing.length > 0) {
    console.log(`✗ ${c.name}`)
    console.log(`    missing flags: ${missing.join(", ")}`)
    fail++
    failures.push(`${c.name} (missing: ${missing.join(", ")})`)
  } else {
    console.log(`✓ ${c.name}`)
    pass++
  }
}

console.log("\nLive calls (read-only):")

for (const c of liveChecks) {
  const r = await $`glab ${c.cmd}`.nothrow().quiet()
  if (r.exitCode === 0) {
    console.log(`✓ ${c.name}`)
    pass++
  } else {
    console.log(`✗ ${c.name}`)
    console.log(`    stderr: ${r.stderr.toString().trim().slice(0, 200)}`)
    fail++
    failures.push(c.name)
  }
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) {
  console.log("\nFailures:")
  failures.forEach((f) => console.log(`  • ${f}`))
  console.log("\nFix the orchestrator's glab calls (or upgrade glab) before V1b.")
  process.exit(1)
}
console.log("\nAll glab calls validated. Ready for V1b.")
