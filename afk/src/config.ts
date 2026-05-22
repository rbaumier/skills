/**
 * config.ts — every tunable constant for the AFK orchestrator, in one place.
 *
 * No logic and no dependencies beyond the standard library — just the dials.
 * Anything a future operator might want to change lives here and nowhere else.
 */
import { homedir } from "node:os"
import { join } from "node:path"

/** The GitLab issue labels the orchestrator reads and writes. */
export const LABELS = {
  /** An issue queued for the orchestrator to pick up. */
  readyForAgent: "ready-for-agent",
  /** An issue the orchestrator has claimed and is actively working. */
  pickedByAgent: "picked-by-agent",
  /** An issue the orchestrator gave up on — it needs a human. */
  failedByAgent: "failed-by-agent",
} as const

/** The five pipeline phases — each runs as a fresh `claude` tmux session. */
export const PHASES = ["run_impl", "review", "evaluate", "fix", "run_dogfood"] as const

/** One of the five session-driven pipeline phases. */
export type Phase = (typeof PHASES)[number]

/**
 * Per-phase wall-clock cap, in minutes.
 *
 * The 90-minute per-issue budget (below) is the *primary* bound and normally
 * trips first. These caps are the *secondary* guard: they stop a single hung
 * phase from silently eating the whole budget. Their sum (155) deliberately
 * exceeds the budget — a healthy run never reaches them.
 */
export const PHASE_CAP_MINUTES: Record<Phase, number> = {
  run_impl: 45,
  review: 25,
  evaluate: 30,
  fix: 30,
  run_dogfood: 25,
}

/** Total wall-clock an issue may take, from `run_impl` through `run_dogfood`. */
export const ISSUE_BUDGET_MS = 90 * 60 * 1000

/** How often the orchestrator polls a phase's sentinel file. */
export const SENTINEL_POLL_MS = 5000

/** The most review→fix cycles allowed before the issue is failed for a human. */
export const MAX_FIX_CYCLES = 3

/** Where per-issue git worktrees live — one subdirectory per repository. */
export const WORKTREES_DIR = join(homedir(), ".afk-worktrees")

/** Where per-run logs live — one timestamped subdirectory per run. */
export const RUNS_DIR = join(homedir(), ".afk-runs")

/** The directory holding the five phase prompt templates. */
export const PROMPTS_DIR = join(homedir(), ".claude/skills/afk/assets/prompts")
