#!/usr/bin/env bun
/**
 * AFK orchestrator — the deterministic state machine that drives Claude Code
 * through GitLab issues, one at a time, until the ready-for-agent queue is
 * empty.
 *
 * ## Architecture
 *
 * This script owns the loop. It never implements or reviews anything itself —
 * each *phase* of work is a fresh, single-job `claude` session spawned in its
 * own tmux window. The cross-session review state lives on the GitLab MR
 * (its discussions), never in `/tmp/` files.
 *
 * The decomposed pipeline (replaces the old monolithic `run_claude_code`):
 *
 *   fetch_queue → claim_issue → branch_worktree
 *     → run_impl ──────────────────────────────────────── BLOCKER/timeout → failed
 *     → open_draft_mr        (script: glab mr create --draft)
 *     → review ◄──────────────────────────────────┐
 *     → evaluate                                  │ FIX_DONE (fixCycles < 3)
 *          ├─ CONVERGED → run_dogfood             │
 *          └─ NEEDS_FIX → fix ────────────────────┘
 *                            fixCycles == 3 → failed (fix_cycle_cap)
 *     run_dogfood            (always spawned; the prompt self-skips)
 *          ├─ DOGFOOD_PASS → merge
 *          └─ DOGFOOD_FAIL / timeout → failed
 *     merge                  (script: glab mr update --ready; glab mr merge)
 *     → done → fetch_queue
 *
 *   plus `failed` (post a note, label, → fetch_queue) and `end`.
 *
 * ## Completion mechanism
 *
 * Each phase session ends its final assistant message with a strict last line
 * `VERDICT: <TOKEN>`. A non-blocking Stop hook (configured per worktree by
 * `writeStopHookConfig`) captures that whole message into a per-phase sentinel
 * file. The orchestrator polls the sentinel and runs the message through the
 * pure `parseVerdict`. The per-phase timeout — not the hook — is the real
 * safety net: if a hook ever fails to fire, the cap still ends the phase.
 *
 * ## Budget
 *
 * One per-issue wall-clock budget of 90 min covers `run_impl` → `run_dogfood`;
 * the deadline is set when `run_impl` starts. Each session is spawned with
 * `timeout = min(phase cap, deadline − now)`.
 *
 * ## Effect
 *
 * The state machine is written in Effect — typed errors, retried `glab` calls
 * (`runGlab`), an Effect-native polling loop. The top-level machine runs under
 * `Effect.runPromiseExit`. No retries on a `failed` verdict: any failure posts
 * a note on the issue and the user inspects the worktree + run log.
 *
 * Usage: bun ~/.claude/skills/afk/orchestrator.ts
 * Requires: jq, tmux, claude, glab, git in PATH; origin/HEAD set.
 */
import { $ } from "bun"
import { Cause, Console, Data, Effect, Exit } from "effect"
import { existsSync } from "node:fs"
import { mkdir, writeFile, appendFile, readFile, chmod } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { GlabError, parseJson, runGlab } from "./src/glab"
import { parseVerdict, type VerdictToken } from "./src/verdict"

// ─── Types ─────────────────────────────────────────────────────────────

/** The GitLab issue a run is currently working on. */
type IssueRef = { iid: number; title: string; body: string }

/**
 * The per-issue wall-clock deadline (epoch ms) for the whole `run_impl` →
 * `run_dogfood` pipeline. Set once when `run_impl` starts, then carried in
 * every state through to `run_dogfood` so each phase can compute its
 * `min(phase cap, deadline − now)` session timeout.
 */
type Deadline = number

/**
 * Every state of the machine. The payload of each grows as the pipeline
 * progresses: a branch + worktree appear at `branch_worktree`, the per-issue
 * `deadline` at `run_impl`, the `mrIid` at `open_draft_mr`, and `fixCycles`
 * (the count of fix sessions already run) inside the review⇄fix loop.
 */
type State =
  | { kind: "fetch_queue" }
  | { kind: "claim_issue"; issue: IssueRef }
  | { kind: "branch_worktree"; issue: IssueRef }
  | { kind: "run_impl"; issue: IssueRef; branch: string; worktree: string }
  | { kind: "open_draft_mr"; issue: IssueRef; branch: string; worktree: string; deadline: Deadline }
  | {
      kind: "review"
      issue: IssueRef
      branch: string
      worktree: string
      deadline: Deadline
      mrIid: number
      fixCycles: number
    }
  | {
      kind: "evaluate"
      issue: IssueRef
      branch: string
      worktree: string
      deadline: Deadline
      mrIid: number
      fixCycles: number
    }
  | {
      kind: "fix"
      issue: IssueRef
      branch: string
      worktree: string
      deadline: Deadline
      mrIid: number
      fixCycles: number
    }
  | {
      kind: "run_dogfood"
      issue: IssueRef
      branch: string
      worktree: string
      deadline: Deadline
      mrIid: number
    }
  | { kind: "merge"; issue: IssueRef; branch: string; worktree: string; mrIid: number }
  | { kind: "done"; issue: IssueRef; branch: string; worktree: string; mrIid: number }
  | {
      kind: "failed"
      issue: IssueRef
      reason: string
      branch: string | null
      worktree: string | null
      mrIid: number | null
    }
  | { kind: "end" }

/** The five phases that are driven by a `claude` tmux session. */
type Phase = "run_impl" | "review" | "evaluate" | "fix" | "run_dogfood"

// ─── Constants ─────────────────────────────────────────────────────────

/**
 * One per-issue wall-clock budget covering `run_impl` → `run_dogfood`.
 * Replaces the old 60-min `ISSUE_TIMEOUT_MS`.
 */
const ISSUE_BUDGET_MS = 90 * 60 * 1000

/** Sentinel polling interval — how often we check whether a phase finished. */
const SENTINEL_POLL_MS = 5 * 1000

/**
 * Per-phase ceilings (minutes). A per-phase cap stops one hung session from
 * silently eating the whole budget. The caps sum to 155 min > the 90-min
 * budget on purpose — each cap guards one stuck phase; the 90-min deadline is
 * the real bound and trips first on a normal run.
 */
const PHASE_CAP_MIN: Record<Phase, number> = {
  run_impl: 45,
  review: 25,
  evaluate: 30,
  fix: 30,
  run_dogfood: 25,
}

/** Hardest guard on the review⇄fix loop — at most 3 fix sessions per issue. */
const MAX_FIX_CYCLES = 3

const RUNS_DIR = join(homedir(), ".afk-runs")
const WORKTREES_DIR = join(homedir(), ".afk-worktrees")

// ─── Errors ────────────────────────────────────────────────────────────

/**
 * A phase session did not produce a usable result — it timed out (the budget
 * was exhausted, or the per-phase cap tripped), or it stopped without a clean
 * verdict. Carried out of the session helper so the handler can route to
 * `failed` with a precise reason.
 */
class PhaseError extends Data.TaggedError("PhaseError")<{
  readonly phase: Phase
  readonly reason: string
}> {}

// ─── Run setup ─────────────────────────────────────────────────────────

const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_")
const runDir = join(RUNS_DIR, runTimestamp)
await mkdir(runDir, { recursive: true })

const jsonlPath = join(runDir, "run.jsonl")
const repoName = (await $`basename $(git rev-parse --show-toplevel)`.text()).trim()

// Pre-check required external tools — fail loud with a clear hint, not after a
// 90-min timeout. `jq` is needed by the Stop hook command.
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

/** Append one structured event to `run.jsonl` — the run's machine log. */
async function logEvent(event: Record<string, unknown>): Promise<void> {
  await appendFile(jsonlPath, JSON.stringify({ t: new Date().toISOString(), ...event }) + "\n")
}

/** Print a one-line, human-readable state transition. */
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

// ─── Stop hook setup ───────────────────────────────────────────────────

/**
 * Write the Claude Code Stop-hook config into a worktree's `.claude/`
 * directory, pointed at this phase's `sentinel` path.
 *
 * The hook is **non-blocking** and trivial: on every Stop it dumps the
 * payload's `last_assistant_message` into the sentinel. It is registered for
 * both `Stop` (normal yield) and `StopFailure` (API-error stop) so that even
 * an abnormal end is captured — belt-and-suspenders; the per-phase timeout is
 * the real safety net if a hook ever fails to fire.
 *
 * The write is atomic — `jq … > <sentinel>.tmp && mv <sentinel>.tmp
 * <sentinel>` — so the polling loop never observes a half-written file.
 * `// empty` makes a payload lacking the field yield an empty sentinel, which
 * then fails verdict parsing visibly rather than hanging.
 *
 * Requires `jq` in PATH (pre-checked at startup).
 *
 * Note: each phase rewrites this file with its own sentinel path. A phase
 * never spawns until the previous one's session is dead, so there is never a
 * live session reading a stale config.
 */
async function writeStopHookConfig(worktree: string, sentinel: string): Promise<void> {
  const claudeDir = join(worktree, ".claude")
  await mkdir(claudeDir, { recursive: true })

  // The agent cannot forget this — the harness fires the hook on every Stop.
  const command = `jq -r '.last_assistant_message // empty' > ${sentinel}.tmp && mv ${sentinel}.tmp ${sentinel}`
  const hookEntry = [{ matcher: "", hooks: [{ type: "command", command }] }]

  await writeFile(
    join(claudeDir, "settings.local.json"),
    JSON.stringify({ hooks: { Stop: hookEntry, StopFailure: hookEntry } }, null, 2),
  )
}

// ─── Tmux session helper (fail-loud) ───────────────────────────────────

/**
 * Spawn Claude Code in a fresh tmux session and paste the prompt.
 *
 * Throws on any tmux failure — these indicate system-level issues (tmux
 * missing, paste-buffer broken) where we want to know immediately rather than
 * wait for a phase timeout.
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
  // Wait for the claude TUI to settle before pasting — poll capture-pane
  // until its content stops changing for two consecutive ticks (claude has
  // finished booting). Best-effort, capped at ~20s; far less fragile than a
  // blind fixed sleep into a not-yet-ready pane.
  let prevPane = ""
  let stableTicks = 0
  for (let i = 0; i < 20 && stableTicks < 2; i++) {
    await Bun.sleep(1000)
    const pane = (await $`tmux capture-pane -p -t ${sessionName}`.nothrow().quiet()).stdout.toString()
    stableTicks = pane === prevPane ? stableTicks + 1 : 0
    prevPane = pane
  }
  await run("load-buffer", $`tmux load-buffer ${promptFile}`)
  await run("paste-buffer", $`tmux paste-buffer -t ${sessionName}`)
  await Bun.sleep(500)
  await run("send-enter", $`tmux send-keys -t ${sessionName} Enter`)
}

// ─── Naming / path helpers ─────────────────────────────────────────────

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

/**
 * The sentinel + tmux-log paths for one phase run.
 *
 * `iter` disambiguates the review⇄fix loop: `review`, `evaluate`, `fix` all
 * run multiple times, and a fresh path per iteration stops a late hook from a
 * dead session clobbering the next phase's sentinel.
 */
function sentinelPath(iid: number, phase: Phase, iter: number): string {
  return join(runDir, `sentinel-${iid}-${phase}-${iter}.flag`)
}

function tmuxLogPath(iid: number, phase: Phase, iter: number): string {
  return join(runDir, `tmux-${iid}-${phase}-${iter}.log`)
}

/** A stable, unique tmux session name for one phase run. */
function sessionName(iid: number, phase: Phase, iter: number): string {
  return `afk-${iid}-${phase}-${iter}`
}

// ─── Prompt templates ──────────────────────────────────────────────────

const PROMPTS_DIR = join(homedir(), ".claude/skills/afk/assets/prompts")

/** The prompt file backing each phase. */
const PROMPT_FILE: Record<Phase, string> = {
  run_impl: "run-impl.md",
  review: "review.md",
  evaluate: "evaluate.md",
  fix: "fix.md",
  run_dogfood: "run-dogfood.md",
}

// ─── The phase session — the load-bearing helper ───────────────────────

/**
 * Run one phase as a fresh `claude` tmux session and return the verdict it
 * declared.
 *
 * The full lifecycle:
 *  1. Pick this run's sentinel + tmux-log + session name (unique per phase +
 *     iteration so they never collide).
 *  2. `rm -f` the sentinel and kill any stale session of the same name.
 *  3. `writeStopHookConfig` — drop the non-blocking Stop/StopFailure hook into
 *     the worktree so the session's final message is captured atomically.
 *  4. Read the phase's prompt template, substitute placeholders, write it to a
 *     prompt file under the run dir.
 *  5. Spawn `claude` in tmux and paste the prompt.
 *  6. Poll the sentinel every 5s. The timeout is `min(phase cap, remaining
 *     budget)` — whichever bound trips first.
 *  7. On sentinel: read it, `parseVerdict`. On timeout: kill the session.
 *
 * Fails with {@link PhaseError} on a timeout, a missing verdict, or a garbage
 * verdict — the handler routes that to `failed`. Succeeds with the
 * {@link VerdictToken}; routing on that token is the handler's job.
 *
 * @param iter   the iteration index of this phase (0 for once-only phases;
 *               the fix-cycle count for the review⇄fix loop).
 * @param timeoutMs `min(phase cap, deadline − now)`, pre-computed by the caller.
 * @param replacements the `{placeholder}` → value map for the prompt template.
 */
const runPhaseSession = (
  phase: Phase,
  issue: IssueRef,
  worktree: string,
  iter: number,
  timeoutMs: number,
  replacements: Record<string, string>,
): Effect.Effect<VerdictToken, PhaseError> =>
  Effect.gen(function* () {
    // Budget already spent — refuse to spawn a session that cannot run.
    if (timeoutMs <= 0) {
      return yield* Effect.fail(
        new PhaseError({ phase, reason: "per-issue budget exhausted before this phase could start" }),
      )
    }

    const sentinel = sentinelPath(issue.iid, phase, iter)
    const tmuxLog = tmuxLogPath(issue.iid, phase, iter)
    const session = sessionName(issue.iid, phase, iter)

    // Clear any residue from a crashed prior run before spawning.
    yield* Effect.promise(() => $`rm -f ${sentinel}`.nothrow().quiet())
    yield* Effect.promise(() => $`tmux kill-session -t ${session}`.nothrow().quiet())

    // Drop the Stop hook into the worktree, pointed at this phase's sentinel.
    yield* Effect.promise(() => writeStopHookConfig(worktree, sentinel))

    // Build the prompt: read the template, substitute every {placeholder}.
    const template = yield* Effect.tryPromise({
      try: () => readFile(join(PROMPTS_DIR, PROMPT_FILE[phase]), "utf8"),
      catch: (cause) =>
        new PhaseError({ phase, reason: `could not read prompt template: ${String(cause)}` }),
    })
    let promptText = template
    for (const [key, value] of Object.entries(replacements)) {
      promptText = promptText.replaceAll(`{${key}}`, value)
    }
    const promptFile = join(runDir, `prompt-${issue.iid}-${phase}-${iter}.md`)
    yield* Effect.promise(() => writeFile(promptFile, promptText))

    // Spawn the session. A tmux-level failure is a system fault — surface it
    // as a PhaseError rather than letting it crash the whole orchestrator.
    yield* Effect.tryPromise({
      try: () => spawnClaudeInTmux(session, worktree, tmuxLog, promptFile),
      catch: (cause) => new PhaseError({ phase, reason: `tmux spawn failed: ${String(cause)}` }),
    })

    yield* Console.log(`  ↳ watch live: tmux attach -r -t ${session}   (detach: Ctrl-B then d)`)
    yield* Console.log(`  ↳ raw log:    tail -f ${tmuxLog}`)
    yield* Console.log(`  ↳ phase ${phase} — timeout ${fmtDuration(timeoutMs)}`)

    // Poll the sentinel. The verdict is the clean early-exit; the timeout is
    // the real safety net (a runaway loop never writes the sentinel).
    const verdict = yield* pollSentinel(phase, session, sentinel, timeoutMs)
    return verdict
  })

/**
 * Poll `sentinel` every 5s until it appears or `timeoutMs` elapses.
 *
 * On the sentinel: read it, run the message through the strict `parseVerdict`
 * — a missing or ambiguous verdict fails the phase (never a false *proceed*).
 * On timeout: kill the tmux session and fail the phase.
 *
 * Implemented as a tail-recursive Effect loop rather than `Effect.timeout` on
 * a blocking promise: this keeps the wait interruptible at every 5s tick and
 * lets the timeout reason name the phase + the elapsed time precisely.
 */
const pollSentinel = (
  phase: Phase,
  session: string,
  sentinel: string,
  timeoutMs: number,
): Effect.Effect<VerdictToken, PhaseError> =>
  Effect.gen(function* () {
    const start = Date.now()

    // Stack-safe poll loop: Effect.iterate sleeps one interval per tick until
    // the sentinel appears or the timeout elapses. (A hand-recursive loop
    // would build one generator frame per tick — hundreds over a long phase.)
    yield* Effect.iterate(0, {
      while: () => !existsSync(sentinel) && Date.now() - start <= timeoutMs,
      body: (n) => Effect.as(Effect.sleep(`${SENTINEL_POLL_MS} millis`), n + 1),
    })

    // The session is over either way — kill it (finished, or a runaway).
    const killSession = Effect.promise(() => $`tmux kill-session -t ${session}`.nothrow().quiet())

    if (!existsSync(sentinel)) {
      yield* killSession
      return yield* Effect.fail(
        new PhaseError({
          phase,
          reason: `timeout after ${fmtDuration(Date.now() - start)} — session killed (no verdict)`,
        }),
      )
    }

    // The session finished — capture its message, then tear the session down.
    const message = yield* Effect.promise(() => readFile(sentinel, "utf8"))
    yield* killSession

    const verdict = parseVerdict(message)
    if (verdict === null) {
      // Empty sentinel, no `VERDICT:` line, several of them, or an unknown
      // token — all ambiguous; refuse to guess, fail the phase.
      return yield* Effect.fail(
        new PhaseError({
          phase,
          reason: `session stopped without a clean verdict (got: ${truncate(
            message.trim().replace(/\n/g, " "),
            120,
          )})`,
        }),
      )
    }
    return verdict
  })

/**
 * Compute a phase's session timeout: the smaller of its per-phase cap and the
 * remaining per-issue budget. Floored at one poll interval so a near-exhausted
 * budget still gives the session a single tick to finish — the negative case
 * is then caught immediately by the next `failed` route anyway.
 */
function phaseTimeoutMs(phase: Phase, deadline: Deadline): number {
  const capMs = PHASE_CAP_MIN[phase] * 60 * 1000
  const remainingMs = deadline - Date.now()
  // No floor: a non-positive result means the per-issue budget is already
  // spent — runPhaseSession sees that and fails the phase without spawning.
  return Math.min(capMs, remainingMs)
}

// ─── State handlers ────────────────────────────────────────────────────

/**
 * fetch_queue — pull the ready-for-agent issue queue and pick one at random.
 * Empty queue → `end`. A `glab` failure here is fatal: we cannot run blind.
 */
const onFetchQueue: Effect.Effect<State, GlabError> = Effect.gen(function* () {
  const args = [
    "issue",
    "list",
    "--label",
    "ready-for-agent",
    "--not-label",
    "failed-by-agent",
    "--not-label",
    "picked-by-agent",
    "--per-page",
    "100",
    "--output",
    "json",
  ]
  const out = yield* runGlab(args)
  const raw = out.trim() === "" ? [] : yield* parseJson(out, args)
  const issues = (Array.isArray(raw) ? raw : []) as Array<{
    iid: number
    title: string
    description: string | null
  }>

  if (issues.length === 0) return { kind: "end" } satisfies State

  // Random pick — keeps multi-instance collisions probabilistically rare
  // without needing a lock.
  const i = issues[Math.floor(Math.random() * issues.length)]!
  return {
    kind: "claim_issue",
    issue: { iid: i.iid, title: i.title, body: i.description ?? "" },
  } satisfies State
})

/**
 * claim_issue — re-check the labels (another instance may have grabbed it),
 * then claim by adding `picked-by-agent`. The label IS the claim, so a failed
 * add means we cannot safely proceed.
 */
const onClaimIssue = (issue: IssueRef): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    // Re-fetch labels right before claiming, to detect a concurrent claim.
    const viewResult = yield* runGlab(["issue", "view", String(issue.iid), "--output", "json"]).pipe(
      Effect.map((out) => ({ ok: true as const, out })),
      Effect.catchAll(() => Effect.succeed({ ok: false as const })),
    )
    if (viewResult.ok) {
      const info = (yield* parseJson(viewResult.out, []).pipe(
        Effect.catchAll(() => Effect.succeed({} as unknown)),
      )) as { labels?: string[] }
      if (info.labels?.includes("picked-by-agent")) {
        yield* Console.log(`  ↳ #${issue.iid} already claimed by another instance, skipping`)
        return { kind: "fetch_queue" } satisfies State
      }
    }

    const claim = yield* runGlab(["issue", "update", String(issue.iid), "--label", "picked-by-agent"]).pipe(
      Effect.map(() => ({ ok: true as const })),
      Effect.catchAll((e: GlabError) => Effect.succeed({ ok: false as const, detail: e.detail })),
    )
    if (!claim.ok) {
      return {
        kind: "failed",
        issue,
        branch: null,
        worktree: null,
        mrIid: null,
        reason: `claim_issue: could not add picked-by-agent label — ${claim.detail.slice(0, 200)}`,
      } satisfies State
    }

    // Echo the issue body so the user can see what is about to be worked on.
    const sep = "─".repeat(80)
    yield* Console.log(`\n${sep}\n#${issue.iid} ${issue.title}\n${sep}\n${issue.body || "(no description)"}\n${sep}\n`)
    return { kind: "branch_worktree", issue } satisfies State
  })

/**
 * branch_worktree — create the issue branch in a dedicated git worktree off
 * `origin/<default>`, and push it so the MR phase has a remote branch.
 */
const onBranchWorktree = (issue: IssueRef): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    const branch = branchName(issue)
    const worktree = worktreePath(branch)

    yield* Effect.promise(() => mkdir(join(WORKTREES_DIR, repoName), { recursive: true }))
    yield* Effect.promise(() => $`git fetch origin ${defaultBranch}`.nothrow().quiet())

    const wt = yield* Effect.promise(() =>
      $`git worktree add -b ${branch} ${worktree} origin/${defaultBranch}`.nothrow().quiet(),
    )
    if (wt.exitCode !== 0) {
      return {
        kind: "failed",
        issue,
        branch: null,
        worktree: null,
        mrIid: null,
        reason: `worktree add failed: ${wt.stderr.toString().trim()}`,
      } satisfies State
    }

    // Keep the orchestrator's Stop-hook config out of the issue's diff:
    // exclude .claude/settings.local.json via the repo's git exclude (not a
    // tracked .gitignore), so a phase agent's `git add -A` cannot commit it
    // into the MR — which would also poison run_dogfood's diff check.
    yield* Effect.promise(async () => {
      const probe = await $`git -C ${worktree} rev-parse --path-format=absolute --git-common-dir`
        .nothrow()
        .quiet()
      if (probe.exitCode !== 0) return
      const excludePath = join(probe.stdout.toString().trim(), "info", "exclude")
      const current = existsSync(excludePath) ? await readFile(excludePath, "utf8") : ""
      if (!current.split("\n").includes(".claude/settings.local.json")) {
        const sep = current === "" || current.endsWith("\n") ? "" : "\n"
        await appendFile(excludePath, `${sep}.claude/settings.local.json\n`)
      }
    })

    const push = yield* Effect.promise(() =>
      $`git -C ${worktree} push -u origin ${branch}`.nothrow().quiet(),
    )
    if (push.exitCode !== 0) {
      return {
        kind: "failed",
        issue,
        branch,
        worktree,
        mrIid: null,
        reason: `push failed: ${push.stderr.toString().trim()}`,
      } satisfies State
    }

    return { kind: "run_impl", issue, branch, worktree } satisfies State
  })

/**
 * run_impl — the first phase session. Starts the 90-min per-issue budget,
 * then runs the implementer.
 *
 * Routing: `READY_FOR_REVIEW` → `open_draft_mr`. `BLOCKER_SUSPECTED`, any
 * other verdict, a missing verdict, or a timeout → `failed`.
 */
const onRunImpl = (issue: IssueRef, branch: string, worktree: string): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    // The budget clock starts here and is carried through `run_dogfood`.
    const deadline: Deadline = Date.now() + ISSUE_BUDGET_MS

    const result = yield* runPhaseSession(
      "run_impl",
      issue,
      worktree,
      0,
      phaseTimeoutMs("run_impl", deadline),
      {
        iid: String(issue.iid),
        title: issue.title,
        branch,
        worktree,
        body: issue.body || "(no description)",
      },
    ).pipe(
      Effect.map((verdict) => ({ ok: true as const, verdict })),
      Effect.catchTag("PhaseError", (e) => Effect.succeed({ ok: false as const, reason: e.reason })),
    )

    if (!result.ok) {
      return failedState(issue, branch, worktree, null, `run_impl: ${result.reason}`)
    }
    if (result.verdict === "READY_FOR_REVIEW") {
      return { kind: "open_draft_mr", issue, branch, worktree, deadline } satisfies State
    }
    // BLOCKER_SUSPECTED — or any verdict that does not belong to this phase.
    return failedState(issue, branch, worktree, null, `run_impl: ${result.verdict}`)
  })

/**
 * open_draft_mr — a script step, no session. Create the Draft MR for the
 * branch, or reuse an already-open MR for it (idempotent — a re-run after a
 * crash must not create a duplicate). Records the MR iid for every later phase.
 *
 * → `review` with `fixCycles = 0`.
 */
const onOpenDraftMr = (
  issue: IssueRef,
  branch: string,
  worktree: string,
  deadline: Deadline,
): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    // Idempotent: reuse an existing open MR for this branch if there is one.
    const existing = yield* runGlab([
      "mr",
      "list",
      "--source-branch",
      branch,
      "--output",
      "json",
    ]).pipe(
      Effect.flatMap((out) => parseJson(out.trim() === "" ? "[]" : out, [])),
      Effect.map((raw) => (Array.isArray(raw) ? raw : []) as Array<{ iid: number; state: string }>),
      Effect.map((arr) => arr.find((m) => m.state === "opened")),
      Effect.catchAll(() => Effect.succeed(undefined)),
    )
    if (existing) {
      yield* Console.log(`  ↳ reusing existing open MR !${existing.iid} for ${branch}`)
      return { kind: "review", issue, branch, worktree, deadline, mrIid: existing.iid, fixCycles: 0 } satisfies State
    }

    const title = `[AFK] ${issue.title}`
    const body = `Closes #${issue.iid}\n\nImplemented and reviewed autonomously by the AFK orchestrator.\n\nRun log: \`${runDir}\``
    const create = yield* runGlab([
      "mr",
      "create",
      "--draft",
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
    ]).pipe(
      Effect.map((out) => ({ ok: true as const, out })),
      Effect.catchAll((e: GlabError) => Effect.succeed({ ok: false as const, detail: e.detail })),
    )
    if (!create.ok) {
      return failedState(issue, branch, worktree, null, `open_draft_mr: ${create.detail.slice(0, 300)}`)
    }

    // `glab mr create` prints the MR URL; the trailing path segment is the iid.
    const url = create.out.split(/\s+/).find((tok) => /^https?:\/\//.test(tok))
    const iidMatch = url?.match(/\/(\d+)(?:[/?#].*)?$/)
    const mrIid = iidMatch ? Number(iidMatch[1]) : NaN
    if (!Number.isInteger(mrIid)) {
      return failedState(
        issue,
        branch,
        worktree,
        null,
        `open_draft_mr: could not parse MR iid from glab output: ${create.out.slice(0, 200)}`,
      )
    }

    yield* Console.log(`  ↳ Draft MR !${mrIid} created for ${branch}`)
    return { kind: "review", issue, branch, worktree, deadline, mrIid, fixCycles: 0 } satisfies State
  })

/**
 * review — a phase session. Runs `code-review` and posts its findings as MR
 * discussions. `REVIEW_DONE` → `evaluate`; anything else → `failed`.
 *
 * `fixCycles` is carried unchanged: it is incremented only on entry to `fix`.
 */
const onReview = (
  issue: IssueRef,
  branch: string,
  worktree: string,
  deadline: Deadline,
  mrIid: number,
  fixCycles: number,
): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    const result = yield* runMrPhase("review", issue, worktree, deadline, mrIid, fixCycles)
    if (!result.ok) {
      return failedState(issue, branch, worktree, mrIid, `review[${fixCycles}]: ${result.reason}`)
    }
    if (result.verdict === "REVIEW_DONE") {
      return { kind: "evaluate", issue, branch, worktree, deadline, mrIid, fixCycles } satisfies State
    }
    return failedState(issue, branch, worktree, mrIid, `review[${fixCycles}]: ${result.verdict}`)
  })

/**
 * evaluate — a phase session, the convergence authority.
 *
 * `CONVERGED` → `run_dogfood`. `NEEDS_FIX` → `fix`, UNLESS this would be the
 * 4th fix cycle (`fixCycles` already at the cap of 3): then the issue ends
 * `failed` with reason `fix_cycle_cap` — no 4th fix session ever runs.
 * Any other verdict → `failed`.
 */
const onEvaluate = (
  issue: IssueRef,
  branch: string,
  worktree: string,
  deadline: Deadline,
  mrIid: number,
  fixCycles: number,
): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    const result = yield* runMrPhase("evaluate", issue, worktree, deadline, mrIid, fixCycles)
    if (!result.ok) {
      return failedState(issue, branch, worktree, mrIid, `evaluate[${fixCycles}]: ${result.reason}`)
    }
    if (result.verdict === "CONVERGED") {
      return { kind: "run_dogfood", issue, branch, worktree, deadline, mrIid } satisfies State
    }
    if (result.verdict === "NEEDS_FIX") {
      // Cycle-cap guard: the cap is on the *number of fix sessions*. If 3 have
      // already run, a 4th NEEDS_FIX is a structural disagreement, not a slow
      // fix — end the issue `failed` rather than pile up threads.
      if (fixCycles >= MAX_FIX_CYCLES) {
        return failedState(
          issue,
          branch,
          worktree,
          mrIid,
          `fix_cycle_cap: ${MAX_FIX_CYCLES} fix cycles without convergence`,
        )
      }
      return { kind: "fix", issue, branch, worktree, deadline, mrIid, fixCycles } satisfies State
    }
    return failedState(issue, branch, worktree, mrIid, `evaluate[${fixCycles}]: ${result.verdict}`)
  })

/**
 * fix — a phase session. On entry the cycle is consumed: `fixCycles` becomes
 * `fixCycles + 1`. (The cap check already happened in `evaluate`, so reaching
 * `fix` is always within budget.)
 *
 * `FIX_DONE` → back to `review`, carrying the incremented count. Anything
 * else → `failed`.
 */
const onFix = (
  issue: IssueRef,
  branch: string,
  worktree: string,
  deadline: Deadline,
  mrIid: number,
  fixCycles: number,
): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    // This is the Nth fix session — iteration index = the count before entry.
    const result = yield* runMrPhase("fix", issue, worktree, deadline, mrIid, fixCycles)
    if (!result.ok) {
      return failedState(issue, branch, worktree, mrIid, `fix[${fixCycles}]: ${result.reason}`)
    }
    if (result.verdict === "FIX_DONE") {
      // The cycle is now spent — carry fixCycles + 1 back into the loop.
      return {
        kind: "review",
        issue,
        branch,
        worktree,
        deadline,
        mrIid,
        fixCycles: fixCycles + 1,
      } satisfies State
    }
    return failedState(issue, branch, worktree, mrIid, `fix[${fixCycles}]: ${result.verdict}`)
  })

/**
 * run_dogfood — a phase session. Always spawned; the prompt self-skips when
 * no user-facing surface was touched. `DOGFOOD_PASS` → `merge`; everything
 * else (`DOGFOOD_FAIL`, missing verdict, timeout) → `failed`.
 */
const onRunDogfood = (
  issue: IssueRef,
  branch: string,
  worktree: string,
  deadline: Deadline,
  mrIid: number,
): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    const result = yield* runMrPhase("run_dogfood", issue, worktree, deadline, mrIid, 0)
    if (!result.ok) {
      return failedState(issue, branch, worktree, mrIid, `run_dogfood: ${result.reason}`)
    }
    if (result.verdict === "DOGFOOD_PASS") {
      return { kind: "merge", issue, branch, worktree, mrIid } satisfies State
    }
    return failedState(issue, branch, worktree, mrIid, `run_dogfood: ${result.verdict}`)
  })

/**
 * merge — a script step, no session. Un-draft the MR (`glab mr update
 * --ready`), then merge it. → `done`; a failure → `failed`.
 *
 * The merge is verified on a non-zero exit: `glab mr merge` can exit non-zero
 * while the MR is in fact merged/queued, so a non-zero exit re-checks the MR
 * state before deciding. `closed` is NOT `merged` — a closed MR was rejected.
 */
const onMerge = (
  issue: IssueRef,
  branch: string,
  worktree: string,
  mrIid: number,
): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    // Un-draft: the MR was created Draft and the whole review loop ran on it.
    const ready = yield* runGlab(["mr", "update", String(mrIid), "--ready"]).pipe(
      Effect.map(() => ({ ok: true as const })),
      Effect.catchAll((e: GlabError) => Effect.succeed({ ok: false as const, detail: e.detail })),
    )
    if (!ready.ok) {
      return failedState(issue, branch, worktree, mrIid, `merge: could not un-draft — ${ready.detail.slice(0, 300)}`)
    }

    const merge = yield* runGlab(["mr", "merge", String(mrIid), "--yes", "--squash", "--auto-merge"]).pipe(
      Effect.map(() => ({ ok: true as const })),
      Effect.catchAll((e: GlabError) => Effect.succeed({ ok: false as const, detail: e.detail })),
    )
    if (merge.ok) {
      return { kind: "done", issue, branch, worktree, mrIid } satisfies State
    }

    // Non-zero exit — the MR may still be merged/queued. Verify before failing.
    const verified = yield* runGlab(["mr", "view", String(mrIid), "--output", "json"]).pipe(
      Effect.flatMap((out) => parseJson(out, [])),
      Effect.map((raw) => (raw as { state?: string }).state === "merged"),
      Effect.catchAll(() => Effect.succeed(false)),
    )
    if (verified) {
      return { kind: "done", issue, branch, worktree, mrIid } satisfies State
    }

    return failedState(issue, branch, worktree, mrIid, `merge: ${merge.detail.slice(0, 300)}`)
  })

/**
 * done — the issue shipped. Unlabel `picked-by-agent` + `ready-for-agent`,
 * remove the worktree, → `fetch_queue`. Cleanup failures are logged, not
 * fatal — the issue is already merged.
 */
const onDone = (
  issue: IssueRef,
  worktree: string,
  mrIid: number,
): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    // Two single-value unlabel calls — comma-separated multi-value parsing
    // differs across glab versions.
    for (const label of ["picked-by-agent", "ready-for-agent"]) {
      yield* runGlab(["issue", "update", String(issue.iid), "--unlabel", label]).pipe(
        Effect.catchAll((e: GlabError) =>
          Console.error(`  ⚠ #${issue.iid}: unlabel ${label} failed — ${e.detail.slice(0, 200)}`),
        ),
      )
    }
    const remove = yield* Effect.promise(() => $`git worktree remove ${worktree} --force`.nothrow().quiet())
    if (remove.exitCode !== 0) {
      yield* Console.error(`  ⚠ worktree removal failed: ${remove.stderr.toString().trim().slice(0, 200)}`)
    }
    yield* Effect.promise(() => $`git worktree prune`.nothrow().quiet())
    yield* Console.log(`  ✓ #${issue.iid} merged (!${mrIid})`)
    return { kind: "fetch_queue" } satisfies State
  })

/**
 * failed — post a note on the issue (the reason names the phase + iteration +
 * elapsed), set `failed-by-agent`, unlabel `picked-by-agent`. The Draft MR and
 * the worktree are left untouched for human inspection. → `fetch_queue`.
 */
const onFailed = (s: Extract<State, { kind: "failed" }>): Effect.Effect<State, never> =>
  Effect.gen(function* () {
    const note = [
      `**AFK failed** — reason: ${s.reason}`,
      "",
      `- Run log: \`${jsonlPath}\``,
      s.mrIid ? `- Draft MR (left open for inspection): !${s.mrIid}` : null,
      s.worktree ? `- Worktree (left for inspection): \`${s.worktree}\`` : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n")

    yield* runGlab(["issue", "note", String(s.issue.iid), "--message", note]).pipe(
      Effect.catchAll((e: GlabError) =>
        Console.error(`  ⚠ #${s.issue.iid}: could not post failure note — ${e.detail.slice(0, 200)}`),
      ),
    )
    yield* runGlab([
      "issue",
      "update",
      String(s.issue.iid),
      "--label",
      "failed-by-agent",
      "--unlabel",
      "picked-by-agent",
    ]).pipe(
      Effect.catchAll((e: GlabError) =>
        Console.error(`  ⚠ #${s.issue.iid}: could not set failed-by-agent — ${e.detail.slice(0, 200)}`),
      ),
    )
    return { kind: "fetch_queue" } satisfies State
  })

// ─── Handler helpers ───────────────────────────────────────────────────

/** Build a `failed` state — the one place that shape is constructed. */
function failedState(
  issue: IssueRef,
  branch: string | null,
  worktree: string | null,
  mrIid: number | null,
  reason: string,
): State {
  return { kind: "failed", issue, branch, worktree, mrIid, reason }
}

/**
 * The result of a phase session, flattened for the handlers: either a verdict
 * to route on, or a reason for `failed`. The {@link PhaseError} channel is
 * caught here so handlers stay plain `Effect<State, never>`.
 */
type PhaseResult = { ok: true; verdict: VerdictToken } | { ok: false; reason: string }

/**
 * Run one of the MR-bound phases (`review`, `evaluate`, `fix`, `run_dogfood`)
 * and flatten its outcome into a {@link PhaseResult}.
 *
 * These four share the same `{worktree} {mr_iid}` prompt placeholders and the
 * same per-iteration timeout computation — only their routing differs, which
 * stays in each handler.
 */
const runMrPhase = (
  phase: Phase,
  issue: IssueRef,
  worktree: string,
  deadline: Deadline,
  mrIid: number,
  iter: number,
): Effect.Effect<PhaseResult, never> =>
  runPhaseSession(phase, issue, worktree, iter, phaseTimeoutMs(phase, deadline), {
    worktree,
    mr_iid: String(mrIid),
  }).pipe(
    Effect.map((verdict): PhaseResult => ({ ok: true, verdict })),
    Effect.catchTag("PhaseError", (e): Effect.Effect<PhaseResult> => Effect.succeed({ ok: false, reason: e.reason })),
  )

// ─── Step dispatcher ───────────────────────────────────────────────────

/**
 * Advance the machine by one state. `fetch_queue` is the only step that can
 * fail (a `GlabError` reading the queue is fatal — we cannot run blind); every
 * other handler routes its own errors into a `failed` state.
 */
const step = (state: State): Effect.Effect<State, GlabError> => {
  switch (state.kind) {
    case "fetch_queue":
      return onFetchQueue
    case "claim_issue":
      return onClaimIssue(state.issue)
    case "branch_worktree":
      return onBranchWorktree(state.issue)
    case "run_impl":
      return onRunImpl(state.issue, state.branch, state.worktree)
    case "open_draft_mr":
      return onOpenDraftMr(state.issue, state.branch, state.worktree, state.deadline)
    case "review":
      return onReview(state.issue, state.branch, state.worktree, state.deadline, state.mrIid, state.fixCycles)
    case "evaluate":
      return onEvaluate(state.issue, state.branch, state.worktree, state.deadline, state.mrIid, state.fixCycles)
    case "fix":
      return onFix(state.issue, state.branch, state.worktree, state.deadline, state.mrIid, state.fixCycles)
    case "run_dogfood":
      return onRunDogfood(state.issue, state.branch, state.worktree, state.deadline, state.mrIid)
    case "merge":
      return onMerge(state.issue, state.branch, state.worktree, state.mrIid)
    case "done":
      return onDone(state.issue, state.worktree, state.mrIid)
    case "failed":
      return onFailed(state)
    case "end":
      return Effect.die(new Error("step called on the end state"))
    default: {
      // Exhaustiveness: adding a State variant without a case here is a
      // compile error.
      const _exhaustive: never = state
      return Effect.die(new Error(`Unhandled state: ${JSON.stringify(_exhaustive)}`))
    }
  }
}

/** The issue a state is about, or `null` for the queue-level states. */
function getIssue(s: State): IssueRef | null {
  return "issue" in s ? s.issue : null
}

// ─── Main loop ─────────────────────────────────────────────────────────

/**
 * The top-level machine: drive `step` from `fetch_queue` until `end`, logging
 * and pretty-printing every transition.
 */
const machine: Effect.Effect<void, GlabError> = Effect.gen(function* () {
  yield* Console.log(`AFK orchestrator starting. Repo: ${repoName}, default branch: ${defaultBranch}`)
  yield* Console.log(`Run dir: ${runDir}\n`)
  yield* Effect.promise(() => logEvent({ event: "run_start", repo: repoName, defaultBranch }))

  let state: State = { kind: "fetch_queue" }
  while (state.kind !== "end") {
    const before: State = state
    const start = Date.now()
    const next: State = yield* step(before)
    const elapsed = Date.now() - start

    const issue = getIssue(before) ?? getIssue(next)
    const note = next.kind === "failed" ? next.reason : undefined

    pretty(issue, before.kind.toUpperCase(), next.kind.toUpperCase(), elapsed, note)
    yield* Effect.promise(() =>
      logEvent({
        event: "transition",
        from: before.kind,
        to: next.kind,
        elapsed_ms: elapsed,
        issue: issue ? { iid: issue.iid, title: issue.title } : null,
        note,
      }),
    )

    state = next
  }

  yield* Effect.promise(() => logEvent({ event: "run_end" }))
  yield* Console.log("\nAFK done. Worktrees and run logs left under ~/.afk-runs/ and ~/.afk-worktrees/.")
})

// Run the machine. A `GlabError` reaching here is the fatal queue-read failure
// — print it and exit non-zero; everything else routes through `failed`.
const exit = await Effect.runPromiseExit(machine)
Exit.match(exit, {
  onSuccess: () => {},
  onFailure: (cause) => {
    console.error(Cause.pretty(cause))
    process.exit(1)
  },
})
