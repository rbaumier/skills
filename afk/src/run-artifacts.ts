/**
 * run-artifacts.ts — the run's footprint on disk.
 *
 * Owns the per-run directory and every path beneath it (the JSONL event log,
 * the per-phase sentinels, tmux logs, and rendered prompts), plus the
 * structured logger. Cross-cutting: both the session and pipeline slices
 * write here, so it sits at the top level rather than inside either.
 */
import { appendFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import { type Phase, RUNS_DIR } from "./config"

/**
 * This run's unique directory under ~/.afk-runs/. The timestamp carries a
 * random suffix so two orchestrators started in the same second never share a
 * directory — and so never interleave their logs and sentinels.
 */
const startedAt = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_")
const randomSuffix = Math.random().toString(16).slice(2, 8)
export const runDir = join(RUNS_DIR, `${startedAt}-${randomSuffix}`)

/** The run's machine-readable event log. */
export const runLogPath = join(runDir, "run.jsonl")

/**
 * The sentinel file a phase's Stop hook writes its final message into.
 * `iteration` keeps the review⇄fix loop's repeated phases from colliding.
 */
export const sentinelPath = (issueIid: number, phase: Phase, iteration: number): string =>
  join(runDir, `sentinel-${issueIid}-${phase}-${iteration}.flag`)

/** The file a phase's tmux pane is mirrored into, for live tailing. */
export const tmuxLogPath = (issueIid: number, phase: Phase, iteration: number): string =>
  join(runDir, `tmux-${issueIid}-${phase}-${iteration}.log`)

/** The rendered prompt handed to a phase's claude session. */
export const promptFilePath = (issueIid: number, phase: Phase, iteration: number): string =>
  join(runDir, `prompt-${issueIid}-${phase}-${iteration}.md`)

/** The tmux session name for one phase run — unique per issue, phase, iteration. */
export const sessionName = (issueIid: number, phase: Phase, iteration: number): string =>
  `afk-${issueIid}-${phase}-${iteration}`

/**
 * Append one structured event to the run's JSONL log. Best-effort: a logging
 * failure must never abort a run, so the returned Effect never fails.
 */
export const logEvent = (event: Record<string, unknown>): Effect.Effect<void> =>
  Effect.tryPromise(() =>
    appendFile(runLogPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`),
  ).pipe(Effect.ignore)
