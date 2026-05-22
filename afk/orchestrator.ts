#!/usr/bin/env bun
/**
 * AFK orchestrator. Deterministic state machine that drives Claude Code
 * sessions through GitLab issues, one at a time, until the ready-for-agent
 * queue is empty.
 *
 * Architecture: this script owns the state machine. Claude Code (spawned in
 * tmux) only implements + runs /code-review-loop. The script verifies via
 * sentinel file (written by a Stop hook gated on a READY_FOR_MR token in
 * Claude's transcript) and glab calls.
 *
 * No retries. Any failure → FAILED with a note on the issue. User inspects
 * the worktree + run log and intervenes manually if recoverable.
 *
 * Usage: bun ~/.claude/skills/afk/orchestrator.ts
 */
import { $ } from "bun"
import { mkdir, writeFile, appendFile, readFile, chmod } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

// ─── Types ─────────────────────────────────────────────────────────────

type IssueRef = { iid: number; title: string; body: string }

type State =
  | { kind: "fetch_queue" }
  | { kind: "claim_issue"; issue: IssueRef }
  | { kind: "branch_worktree"; issue: IssueRef }
  | { kind: "run_claude_code"; issue: IssueRef; branch: string; worktree: string }
  | { kind: "open_mr"; issue: IssueRef; branch: string; worktree: string }
  | { kind: "merge"; issue: IssueRef; branch: string; worktree: string; mrUrl: string }
  | { kind: "done"; issue: IssueRef; branch: string; worktree: string; mrUrl: string }
  | { kind: "failed"; issue: IssueRef; reason: string; branch: string | null; worktree: string | null; mrUrl: string | null }
  | { kind: "end" }

// ─── Constants ─────────────────────────────────────────────────────────

const ISSUE_TIMEOUT_MS = 60 * 60 * 1000           // 1h hard timeout per issue
const SENTINEL_POLL_MS = 5 * 1000                  // 5s polling for sentinel

const RUNS_DIR = join(homedir(), ".afk-runs")
const WORKTREES_DIR = join(homedir(), ".afk-worktrees")
const PROMPT_TEMPLATE_PATH = join(homedir(), ".claude/skills/afk/assets/prompts/session.md")

// ─── Run setup ─────────────────────────────────────────────────────────

const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_")
const runDir = join(RUNS_DIR, runTimestamp)
await mkdir(runDir, { recursive: true })

const jsonlPath = join(runDir, "run.jsonl")
const repoName = (await $`basename $(git rev-parse --show-toplevel)`.text()).trim()

// Pre-check required external tools — fail loud with a clear hint, not 1h timeouts later.
for (const tool of ["jq", "tmux", "claude", "glab", "git"]) {
  const r = await $`which ${tool}`.nothrow().quiet()
  if (r.exitCode !== 0) {
    console.error(`ERROR: ${tool} not in PATH — required by the orchestrator.`)
    process.exit(1)
  }
}

const defaultBranchProbe = await $`git symbolic-ref --short refs/remotes/origin/HEAD`.nothrow().quiet()
if (defaultBranchProbe.exitCode !== 0) {
  console.error("ERROR: origin/HEAD is not set locally — can't determine the default branch.")
  console.error("Fix: git remote set-head origin -a")
  process.exit(1)
}
const defaultBranch = defaultBranchProbe.stdout.toString().trim().replace(/^origin\//, "")

// ─── Logging ───────────────────────────────────────────────────────────

async function logEvent(event: Record<string, unknown>): Promise<void> {
  await appendFile(jsonlPath, JSON.stringify({ t: new Date().toISOString(), ...event }) + "\n")
}

function pretty(issue: IssueRef | null, from: string, to: string, elapsedMs: number, note?: string): void {
  const prefix = issue ? `[#${issue.iid} "${truncate(issue.title, 50)}"]` : "[—]"
  const dur = fmtDuration(elapsedMs)
  const tail = note ? ` — ${note}` : ""
  console.log(`${prefix} ${from} → ${to} (${dur})${tail}`)
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…"
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m${s.toString().padStart(2, "0")}s`
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── glab helper ───────────────────────────────────────────────────────

type GlabResult = { ok: true; stdout: string } | { ok: false; stderr: string }

async function glab(args: string[]): Promise<GlabResult> {
  const r = await $`glab ${args}`.nothrow().quiet()
  if (r.exitCode === 0) return { ok: true, stdout: r.stdout.toString().trim() }
  return { ok: false, stderr: r.stderr.toString() }
}

// ─── Stop hook setup ───────────────────────────────────────────────────

/**
 * Writes the Claude Code Stop-hook config + bash script into the worktree's
 * `.claude/` directory. The hook only touches the sentinel if Claude's last
 * transcript line contains `READY_FOR_MR` — guards against premature stops
 * (e.g. Claude deciding it's done before /code-review-loop converged).
 *
 * Requires `jq` in PATH.
 */
async function writeStopHookConfig(worktree: string, sentinel: string): Promise<void> {
  const claudeDir = join(worktree, ".claude")
  await mkdir(claudeDir, { recursive: true })

  const hookScriptPath = join(claudeDir, "afk-stop-hook.sh")
  const hookScript = `#!/bin/bash
# AFK Stop hook — only touches sentinel when Claude's LAST assistant text line
# exactly equals READY_FOR_MR. Extracts text content via jq so the user prompt
# (which contains the token in its instructions) cannot false-positive a substring grep.
input=$(cat)
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
[ -z "$transcript" ] && exit 0
[ ! -f "$transcript" ] && exit 0
last_line=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' "$transcript" 2>/dev/null | tail -n 1)
if [ "$last_line" = "READY_FOR_MR" ]; then
  touch "${sentinel}"
fi
exit 0
`
  await writeFile(hookScriptPath, hookScript)
  await chmod(hookScriptPath, 0o755)

  await writeFile(
    join(claudeDir, "settings.local.json"),
    JSON.stringify(
      {
        hooks: {
          Stop: [
            {
              matcher: "",
              hooks: [{ type: "command", command: `bash ${hookScriptPath}` }],
            },
          ],
        },
      },
      null,
      2,
    ),
  )
}

// ─── Tmux session helper (fail-loud) ───────────────────────────────────

/**
 * Spawns Claude Code in a fresh tmux session and pastes the prompt.
 * Throws on any tmux failure — these indicate system-level issues
 * (tmux missing, paste-buffer broken) where we want to know immediately
 * rather than wait for a 1h timeout.
 */
async function spawnClaudeInTmux(
  sessionName: string,
  worktree: string,
  tmuxLog: string,
  promptFile: string,
): Promise<void> {
  const run = async (label: string, cmd: ReturnType<typeof $>) => {
    const r = await cmd.nothrow().quiet()
    if (r.exitCode !== 0) {
      throw new Error(`tmux step "${label}" failed (exit ${r.exitCode}): ${r.stderr.toString().trim()}`)
    }
  }

  await run("new-session", $`tmux new-session -d -s ${sessionName} -c ${worktree}`)
  await run("pipe-pane", $`tmux pipe-pane -t ${sessionName} -O ${"cat >> " + tmuxLog}`)
  await run("start-claude", $`tmux send-keys -t ${sessionName} ${"claude --dangerously-skip-permissions"} Enter`)
  await sleep(3000)
  await run("load-buffer", $`tmux load-buffer ${promptFile}`)
  await run("paste-buffer", $`tmux paste-buffer -t ${sessionName}`)
  await sleep(500)
  await run("send-enter", $`tmux send-keys -t ${sessionName} Enter`)
}

// ─── State helpers ─────────────────────────────────────────────────────

function getIssue(s: State): IssueRef | null {
  if ("issue" in s) return s.issue
  return null
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function branchName(issue: IssueRef): string {
  return `afk/issue-${issue.iid}-${slugifyTitle(issue.title)}`
}

function worktreePath(branch: string): string {
  return join(WORKTREES_DIR, repoName, branch.replace(/\//g, "_"))
}

function sentinelPath(branch: string): string {
  return `/tmp/afk-done-${branch.replace(/\//g, "_")}.flag`
}

function tmuxLogPath(iid: number): string {
  return join(runDir, `tmux-${iid}.log`)
}

// ─── State handlers ────────────────────────────────────────────────────

async function onFetchQueue(): Promise<State> {
  const r = await glab(["issue", "list", "--label", "ready-for-agent", "--not-label", "failed-by-agent", "--not-label", "picked-by-agent", "--per-page", "100", "--output", "json"])
  if (!r.ok) {
    console.error(`FETCH_QUEUE: glab failed — ${r.stderr}`)
    process.exit(1)
  }
  const issues = JSON.parse(r.stdout) as Array<{ iid: number; title: string; description: string | null }>
  if (issues.length === 0) return { kind: "end" }
  // Random pick — keeps multi-instance collisions probabilistically rare without needing locks.
  const i = issues[Math.floor(Math.random() * issues.length)]
  return { kind: "claim_issue", issue: { iid: i.iid, title: i.title, body: i.description ?? "" } }
}

async function onClaimIssue(issue: IssueRef): Promise<State> {
  // Re-fetch labels right before claiming to detect concurrent claims from another instance.
  const view = await glab(["issue", "view", `${issue.iid}`, "--output", "json"])
  if (view.ok) {
    const info = JSON.parse(view.stdout) as { labels?: string[] }
    if (info.labels?.includes("picked-by-agent")) {
      console.log(`  ↳ #${issue.iid} already claimed by another instance, skipping`)
      return { kind: "fetch_queue" }
    }
  }

  const r = await glab(["issue", "update", `${issue.iid}`, "--label", "picked-by-agent"])
  if (!r.ok) {
    // The label IS our claim — if add fails we can't safely proceed (multi-instance race).
    return {
      kind: "failed",
      issue,
      branch: null,
      worktree: null,
      mrUrl: null,
      reason: `CLAIM_ISSUE: failed to add picked-by-agent label — ${r.stderr.trim().slice(0, 200)}`,
    }
  }
  // Show the issue body so the user can see what Claude is about to work on
  const sep = "─".repeat(80)
  console.log(`\n${sep}\n#${issue.iid} ${issue.title}\n${sep}\n${issue.body || "(no description)"}\n${sep}\n`)
  return { kind: "branch_worktree", issue }
}

async function onBranchWorktree(issue: IssueRef): Promise<State> {
  const branch = branchName(issue)
  const worktree = worktreePath(branch)

  await mkdir(join(WORKTREES_DIR, repoName), { recursive: true })
  await $`git fetch origin ${defaultBranch}`.nothrow().quiet()

  const wt = await $`git worktree add -b ${branch} ${worktree} origin/${defaultBranch}`.nothrow().quiet()
  if (wt.exitCode !== 0) {
    return {
      kind: "failed",
      issue,
      branch: null,
      worktree: null,
      mrUrl: null,
      reason: `worktree add failed: ${wt.stderr.toString().trim()}`,
    }
  }

  const push = await $`git -C ${worktree} push -u origin ${branch}`.nothrow().quiet()
  if (push.exitCode !== 0) {
    return {
      kind: "failed",
      issue,
      branch,
      worktree,
      mrUrl: null,
      reason: `push failed: ${push.stderr.toString().trim()}`,
    }
  }

  return { kind: "run_claude_code", issue, branch, worktree }
}

async function onRunClaudeCode(issue: IssueRef, branch: string, worktree: string): Promise<State> {
  const sessionName = `afk-${issue.iid}`
  const sentinel = sentinelPath(branch)
  const tmuxLog = tmuxLogPath(issue.iid)

  await $`rm -f ${sentinel}`.nothrow().quiet()
  // Kill any stale session of the same name (from a crashed prior run)
  await $`tmux kill-session -t ${sessionName}`.nothrow().quiet()
  await writeStopHookConfig(worktree, sentinel)

  const template = await readFile(PROMPT_TEMPLATE_PATH, "utf8")
  const promptText = template
    .replaceAll("{iid}", String(issue.iid))
    .replaceAll("{title}", issue.title)
    .replaceAll("{branch}", branch)
    .replaceAll("{body}", issue.body || "(no description)")

  const promptFile = join(runDir, `prompt-${issue.iid}.md`)
  await writeFile(promptFile, promptText)

  await spawnClaudeInTmux(sessionName, worktree, tmuxLog, promptFile)

  console.log(`  ↳ to watch live: tmux attach -r -t ${sessionName}   (detach: Ctrl-B then d)`)
  console.log(`  ↳ raw log:       tail -f ${tmuxLog}`)

  const start = Date.now()
  while (true) {
    if (existsSync(sentinel)) {
      await $`tmux kill-session -t ${sessionName}`.nothrow().quiet()
      return { kind: "open_mr", issue, branch, worktree }
    }
    if (Date.now() - start > ISSUE_TIMEOUT_MS) {
      await $`tmux kill-session -t ${sessionName}`.nothrow().quiet()
      return {
        kind: "failed",
        issue,
        branch,
        worktree,
        mrUrl: null,
        reason: `timeout after ${fmtDuration(ISSUE_TIMEOUT_MS)} — session killed (no READY_FOR_MR token detected)`,
      }
    }
    await sleep(SENTINEL_POLL_MS)
  }
}

async function onOpenMr(issue: IssueRef, branch: string, worktree: string): Promise<State> {
  // Idempotent: if an MR already exists for this branch, use it.
  const list = await glab(["mr", "list", "--source-branch", branch, "--output", "json"])
  if (list.ok) {
    const arr = JSON.parse(list.stdout) as Array<{ web_url: string; state: string }>
    const opened = arr.find((m) => m.state === "opened")
    if (opened) {
      return { kind: "merge", issue, branch, worktree, mrUrl: opened.web_url }
    }
  }

  const title = `[AFK] ${issue.title}`
  const body = `Closes #${issue.iid}\n\nImplemented and reviewed autonomously by AFK orchestrator.\n\nRun log: \`${runDir}\``
  const create = await glab([
    "mr",
    "create",
    "--source-branch",
    branch,
    "--target-branch",
    defaultBranch,
    "--title",
    title,
    "--description",
    body,
    "--remove-source-branch",
    "--squash-before-merge",
  ])

  if (create.ok) {
    const url = create.stdout.split(/\s+/).find((tok) => /^https?:\/\//.test(tok))
    if (!url) {
      return {
        kind: "failed",
        issue,
        branch,
        worktree,
        mrUrl: null,
        reason: `OPEN_MR: glab succeeded but no URL found in stdout: ${create.stdout.slice(0, 200)}`,
      }
    }
    return { kind: "merge", issue, branch, worktree, mrUrl: url }
  }

  return {
    kind: "failed",
    issue,
    branch,
    worktree,
    mrUrl: null,
    reason: `OPEN_MR failed: ${create.stderr.trim().slice(0, 300)}`,
  }
}

async function onMerge(issue: IssueRef, branch: string, worktree: string, mrUrl: string): Promise<State> {
  const merge = await glab(["mr", "merge", branch, "--yes", "--squash", "--auto-merge"])
  if (merge.ok) {
    return { kind: "done", issue, branch, worktree, mrUrl }
  }

  // Even on non-zero exit, the MR may already be merged/queued. Verify.
  // `closed` is NOT merged — it means the MR was rejected/abandoned, do not mark done.
  const view = await glab(["mr", "view", branch, "--output", "json"])
  if (view.ok) {
    const info = JSON.parse(view.stdout) as { state: string }
    if (info.state === "merged") {
      return { kind: "done", issue, branch, worktree, mrUrl }
    }
  }

  return {
    kind: "failed",
    issue,
    branch,
    worktree,
    mrUrl,
    reason: `merge failed: ${merge.stderr.trim().slice(0, 300)}`,
  }
}

async function onDone(issue: IssueRef, branch: string, worktree: string, mrUrl: string): Promise<State> {
  // Two single-value unlabel calls — comma-separated multi-value parsing differs across glab versions.
  for (const label of ["picked-by-agent", "ready-for-agent"]) {
    const r = await glab(["issue", "update", `${issue.iid}`, "--unlabel", label])
    if (!r.ok) {
      console.error(`  ⚠ #${issue.iid}: unlabel ${label} failed — manual cleanup may be needed: ${r.stderr.trim().slice(0, 200)}`)
    }
  }
  const remove = await $`git worktree remove ${worktree} --force`.nothrow().quiet()
  if (remove.exitCode !== 0) {
    console.error(`  ⚠ worktree removal failed: ${remove.stderr.toString().trim().slice(0, 200)}`)
  }
  await $`git worktree prune`.nothrow().quiet()
  console.log(`  ✓ #${issue.iid} merged: ${mrUrl}`)
  return { kind: "fetch_queue" }
}

async function onFailed(s: Extract<State, { kind: "failed" }>): Promise<State> {
  const note = [
    `**AFK failed** — reason: ${s.reason}`,
    "",
    `- Run log: \`${jsonlPath}\``,
    s.mrUrl ? `- MR (left open for inspection): ${s.mrUrl}` : null,
    s.worktree ? `- Worktree (left for inspection): \`${s.worktree}\`` : null,
    `- Tmux log: \`${tmuxLogPath(s.issue.iid)}\``,
  ]
    .filter(Boolean)
    .join("\n")

  const noteRes = await glab(["issue", "note", `${s.issue.iid}`, "--message", note])
  if (!noteRes.ok) {
    console.error(`  ⚠ #${s.issue.iid}: failed to post failure note on GitLab — ${noteRes.stderr.trim().slice(0, 200)}`)
    console.error(`     reason was: ${s.reason}`)
  }
  const labelRes = await glab(["issue", "update", `${s.issue.iid}`, "--label", "failed-by-agent", "--unlabel", "picked-by-agent"])
  if (!labelRes.ok) {
    console.error(`  ⚠ #${s.issue.iid}: failed to set failed-by-agent label — ${labelRes.stderr.trim().slice(0, 200)}`)
  }
  return { kind: "fetch_queue" }
}

// ─── Step dispatcher ───────────────────────────────────────────────────

async function step(state: State): Promise<State> {
  switch (state.kind) {
    case "fetch_queue": return onFetchQueue()
    case "claim_issue": return onClaimIssue(state.issue)
    case "branch_worktree": return onBranchWorktree(state.issue)
    case "run_claude_code": return onRunClaudeCode(state.issue, state.branch, state.worktree)
    case "open_mr": return onOpenMr(state.issue, state.branch, state.worktree)
    case "merge": return onMerge(state.issue, state.branch, state.worktree, state.mrUrl)
    case "done": return onDone(state.issue, state.branch, state.worktree, state.mrUrl)
    case "failed": return onFailed(state)
    case "end": throw new Error("step called on end state")
    default: {
      // Exhaustiveness check: adding a new State variant without a case here becomes a compile error.
      const _exhaustive: never = state
      throw new Error(`Unhandled state: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

// ─── Main loop ─────────────────────────────────────────────────────────

console.log(`AFK orchestrator starting. Repo: ${repoName}, default branch: ${defaultBranch}`)
console.log(`Run dir: ${runDir}`)
console.log("")

await logEvent({ event: "run_start", repo: repoName, defaultBranch })

let state: State = { kind: "fetch_queue" }
while (state.kind !== "end") {
  const before = state
  const start = Date.now()
  const next = await step(before)
  const elapsed = Date.now() - start
  const issue = getIssue(before) ?? getIssue(next)

  const note = next.kind === "failed" ? next.reason : undefined

  pretty(issue, before.kind.toUpperCase(), next.kind.toUpperCase(), elapsed, note)
  await logEvent({
    event: "transition",
    from: before.kind,
    to: next.kind,
    elapsed_ms: elapsed,
    issue: issue ? { iid: issue.iid, title: issue.title } : null,
    note,
  })

  state = next
}

await logEvent({ event: "run_end" })
console.log("")
console.log("AFK done. Worktrees and run logs left under ~/.afk-runs/ and ~/.afk-worktrees/.")
