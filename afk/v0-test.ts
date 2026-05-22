#!/usr/bin/env bun
/**
 * V0 test — validates the two keystones of the AFK script architecture:
 *
 *   1. We can spawn Claude Code inside a tmux session and paste a multi-line
 *      prompt that Claude actually receives and processes.
 *   2. The Stop hook (configured via `.claude/settings.local.json` dropped in
 *      the working directory) fires reliably when Claude finishes its turn,
 *      writing a sentinel file the script can poll.
 *
 * If both work, the AFK orchestrator architecture is viable. If either
 * fails, we have a blocker to resolve before writing more code.
 *
 * Usage: bun ~/.claude/skills/afk/v0-test.ts
 */
import { $ } from "bun"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

// ─── Configuration ─────────────────────────────────────────────────────

const TEST_DIR = `/tmp/afk-v0-${Date.now()}`
const SESSION_NAME = "afk-v0"
const SENTINEL = "/tmp/afk-v0-sentinel.flag"
const OUTPUT = "/tmp/afk-v0-output.txt"
const TIMEOUT_MS = 2 * 60 * 1000  // 2 min — plenty for "echo PASS"

// ─── Pre-checks ────────────────────────────────────────────────────────

async function which(cmd: string): Promise<boolean> {
  const r = await $`which ${cmd}`.nothrow().quiet()
  return r.exitCode === 0
}

if (!(await which("tmux"))) {
  console.error("FAIL: tmux not installed. brew install tmux")
  process.exit(2)
}
if (!(await which("claude"))) {
  console.error("FAIL: claude CLI not in PATH")
  process.exit(2)
}

// ─── Setup test dir ────────────────────────────────────────────────────

console.log(`Test dir:   ${TEST_DIR}`)
console.log(`Session:    ${SESSION_NAME}`)
console.log(`Sentinel:   ${SENTINEL}`)
console.log(`Output:     ${OUTPUT}`)
console.log("")

await mkdir(TEST_DIR, { recursive: true })
await $`cd ${TEST_DIR} && git init -q && git commit -q --allow-empty -m init`.nothrow()

// Clean any leftover state from previous runs
await $`rm -f ${SENTINEL} ${OUTPUT}`.nothrow().quiet()
await $`tmux kill-session -t ${SESSION_NAME}`.nothrow().quiet()

// Drop the Stop hook config
await mkdir(join(TEST_DIR, ".claude"), { recursive: true })
await writeFile(
  join(TEST_DIR, ".claude/settings.local.json"),
  JSON.stringify(
    {
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [{ type: "command", command: `touch ${SENTINEL}` }],
          },
        ],
      },
    },
    null,
    2,
  ),
)

// ─── Spawn tmux + claude + paste prompt ────────────────────────────────

console.log("→ spawning tmux session…")
await $`tmux new-session -d -s ${SESSION_NAME} -c ${TEST_DIR}`

console.log("→ starting claude inside tmux…")
await $`tmux send-keys -t ${SESSION_NAME} ${"claude --dangerously-skip-permissions"} Enter`

console.log("→ waiting 4s for TUI to be ready…")
await new Promise((r) => setTimeout(r, 4000))

const promptFile = "/tmp/afk-v0-prompt.txt"
await writeFile(
  promptFile,
  `Run \`pwd\`, then write exactly the literal string "PASS" (no quotes) into the file ${OUTPUT}. That is your entire task. Do not ask questions. Do not explain.`,
)

console.log("→ pasting prompt via tmux load-buffer + paste-buffer…")
await $`tmux load-buffer ${promptFile}`
await $`tmux paste-buffer -t ${SESSION_NAME}`
await new Promise((r) => setTimeout(r, 500))

console.log("→ submitting (Enter)…")
await $`tmux send-keys -t ${SESSION_NAME} Enter`

// ─── Poll sentinel + output ────────────────────────────────────────────

console.log("")
console.log("Polling for sentinel… (open another terminal and run `tmux attach -r -t afk-v0` to watch live)")
const start = Date.now()
let dots = 0
while (!existsSync(SENTINEL)) {
  if (Date.now() - start > TIMEOUT_MS) {
    console.log("")
    console.error(`FAIL: timeout after ${TIMEOUT_MS / 1000}s — sentinel never appeared`)
    console.error(`Session left alive for inspection: tmux attach -t ${SESSION_NAME}`)
    console.error(`Then kill: tmux kill-session -t ${SESSION_NAME}`)
    process.exit(1)
  }
  process.stdout.write(".")
  dots++
  if (dots % 30 === 0) process.stdout.write("\n")
  await new Promise((r) => setTimeout(r, 2000))
}
console.log("")
console.log(`✓ Sentinel detected after ${((Date.now() - start) / 1000).toFixed(1)}s`)

// ─── Verify Claude actually processed the prompt ──────────────────────

if (!existsSync(OUTPUT)) {
  console.error("PARTIAL: hook fired but output file is missing — Claude did not process the prompt")
  console.error("Likely cause: prompt was not pasted correctly, or Claude stopped before acting")
  await $`tmux kill-session -t ${SESSION_NAME}`.nothrow().quiet()
  process.exit(1)
}

const content = (await readFile(OUTPUT, "utf8")).trim()
if (content !== "PASS") {
  console.error(`PARTIAL: hook fired and output exists, but content is not exactly "PASS":`)
  console.error(`  got: ${JSON.stringify(content)}`)
  await $`tmux kill-session -t ${SESSION_NAME}`.nothrow().quiet()
  process.exit(1)
}

console.log(`✓ Output file contains "PASS"`)
console.log("")
console.log("V0 PASSED. Both keystones work:")
console.log("  • tmux + claude code paste-buffer is reliable")
console.log("  • Stop hook fires and writes the sentinel")

await $`tmux kill-session -t ${SESSION_NAME}`.nothrow().quiet()
