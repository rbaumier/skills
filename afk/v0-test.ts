#!/usr/bin/env bun
/**
 * V0 — integration POC for the AFK completion mechanism.
 *
 * The whole decomposed pipeline rests on ONE mechanism: a phase session ends
 * its final message with `VERDICT: <TOKEN>`, a non-blocking Stop hook captures
 * that message into a sentinel file, and the orchestrator reads + parses it.
 *
 * This proves the load-bearing, environment-dependent half end-to-end:
 *
 *   1. tmux + `claude` can be spawned and a multi-line prompt pasted in;
 *   2. a `Stop` hook fires when the session yields and its stdin payload
 *      carries `last_assistant_message`;
 *   3. that message, written to the sentinel, parses back to the verdict via
 *      the real `parseVerdict` (the same function the orchestrator uses).
 *
 * If step 2 fails — the payload has no `last_assistant_message` — STOP and
 * rethink the plan (fallback: the hook would have to parse `transcript_path`).
 * This is the gate for the whole implementation.
 *
 * The pure half of the contract — strict verdict parsing, all its edge cases —
 * is covered exhaustively by `src/verdict.test.ts` (no spawning needed).
 *
 * NOTE: this POC uses fixed sleeps for tmux/TUI readiness. That is acceptable
 * for a one-shot POC; the real orchestrator (S5) must NOT — it should poll
 * `tmux capture-pane` for readiness instead.
 *
 * Usage: bun ~/.claude/skills/afk/v0-test.ts
 * Requires: tmux, claude, jq in PATH.
 */
import { $ } from "bun"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseVerdict } from "./src/session/verdict"

// ─── Configuration ─────────────────────────────────────────────────────

const TEST_DIR = `/tmp/afk-v0-${Date.now()}`
const SESSION_NAME = "afk-v0"
// Run-scoped under TEST_DIR so concurrent runs (or a leaked prior run's late
// hook) can never clobber this run's sentinel.
const SENTINEL = join(TEST_DIR, "sentinel.flag")
const PROMPT_FILE = join(TEST_DIR, "prompt.txt")
const TIMEOUT_MS = 3 * 60 * 1000 // 3 min — generous for a one-shot `pwd`
const POLL_MS = 2000
const EXPECTED = "READY_FOR_REVIEW"

// ─── Helpers ───────────────────────────────────────────────────────────

async function which(cmd: string): Promise<boolean> {
  return (await $`which ${cmd}`.nothrow().quiet()).exitCode === 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function cleanup(): Promise<void> {
  await $`tmux kill-session -t ${SESSION_NAME}`.nothrow().quiet()
}

/** Always tears the tmux session down — never leak a live `claude` process. */
async function fail(msg: string): Promise<never> {
  await cleanup()
  console.error(`\nFAIL: ${msg}`)
  console.error(`Test dir left for inspection: ${TEST_DIR}`)
  process.exit(1)
}

// ─── Pre-checks ────────────────────────────────────────────────────────

for (const tool of ["tmux", "claude", "jq"]) {
  if (!(await which(tool))) {
    console.error(`FAIL: ${tool} not in PATH — required by the orchestrator.`)
    process.exit(2)
  }
}

console.log(`Test dir:  ${TEST_DIR}`)
console.log(`Sentinel:  ${SENTINEL}`)
console.log("")

// ─── Setup: a throwaway git repo with the Stop-hook config ─────────────

await mkdir(TEST_DIR, { recursive: true })
const gitInit = await $`cd ${TEST_DIR} && git init -q && git commit -q --allow-empty -m init`.nothrow()
if (gitInit.exitCode !== 0) {
  await fail(`could not initialise the throwaway git repo: ${gitInit.stderr.toString().trim()}`)
}
await cleanup() // kill any stale session of the same name from a crashed prior run

// The non-blocking Stop hook: on every Stop, dump the payload's
// `last_assistant_message` into the sentinel. Written atomically (`.tmp` then
// `mv`) so the polling loop never observes a half-written file. `// empty` so
// a payload lacking the field yields an empty sentinel — which then fails
// parsing visibly, rather than hanging.
await mkdir(join(TEST_DIR, ".claude"), { recursive: true })
await writeFile(
  join(TEST_DIR, ".claude/settings.local.json"),
  JSON.stringify(
    {
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: `jq -r '.last_assistant_message // empty' > "${SENTINEL}.tmp" && mv "${SENTINEL}.tmp" "${SENTINEL}"`,
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  ),
)

// ─── Spawn tmux + claude + paste the prompt ────────────────────────────

console.log("→ spawning tmux + claude…")
await $`tmux new-session -d -s ${SESSION_NAME} -c ${TEST_DIR}`
await $`tmux send-keys -t ${SESSION_NAME} ${"claude --dangerously-skip-permissions"} Enter`
await sleep(4000) // let the TUI come up (POC-only fixed sleep — see file header)

await writeFile(
  PROMPT_FILE,
  `Run \`pwd\` once. That is your entire task — do not ask questions, do not explain.\n` +
    `Then end your final message with exactly this line and nothing after it:\n` +
    `VERDICT: ${EXPECTED}`,
)

console.log("→ pasting prompt…")
await $`tmux load-buffer ${PROMPT_FILE}`
await $`tmux paste-buffer -t ${SESSION_NAME}`
await sleep(500)
await $`tmux send-keys -t ${SESSION_NAME} Enter`

// ─── Poll the sentinel ─────────────────────────────────────────────────

console.log(`\nPolling for the sentinel… (watch: tmux attach -r -t ${SESSION_NAME})`)
const start = Date.now()
while (!existsSync(SENTINEL)) {
  if (Date.now() - start > TIMEOUT_MS) {
    await fail(`timeout after ${TIMEOUT_MS / 1000}s — the Stop hook never wrote the sentinel.`)
  }
  process.stdout.write(".")
  await sleep(POLL_MS)
}
console.log(`\n✓ Sentinel written after ${((Date.now() - start) / 1000).toFixed(1)}s`)

// ─── Verify: the hook delivered last_assistant_message, and it parses ──

const captured = await readFile(SENTINEL, "utf8")
if (captured.trim() === "") {
  await fail(
    "the sentinel is EMPTY — the Stop payload had no `last_assistant_message`.\n" +
      "This is the gate: the hook cannot rely on that field. Fallback: parse `transcript_path`.",
  )
}
console.log(`✓ Hook delivered last_assistant_message (${captured.length} chars)`)

const verdict = parseVerdict(captured)
if (verdict !== EXPECTED) {
  await fail(`parseVerdict returned ${JSON.stringify(verdict)}, expected ${JSON.stringify(EXPECTED)}.`)
}

console.log(`✓ parseVerdict extracted ${verdict}`)
console.log("\nV0 PASSED — the completion mechanism is sound:")
console.log("  • tmux + claude spawn + paste-buffer works")
console.log("  • the Stop hook fires and its payload carries last_assistant_message")
console.log("  • the sentinel parses back to the verdict via the real parseVerdict")

await cleanup()
