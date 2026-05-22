/**
 * Run-artifacts.ts — the run's footprint on disk.
 *
 * Owns the per-run directory and every path beneath it (the JSONL
 * event log, per-phase sentinels, tmux logs, and rendered prompts),
 * plus the structured logger.
 *
 * Cross-cutting: both the session and pipeline slices write here,
 * so it sits at the top level rather than inside either.
 */
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import type { Phase } from "./config";
import { RUNS_DIR } from "./config";

/** Identifies one phase run — unique per issue, phase, iteration. */
export type PhaseRef = {
  readonly issueIid: number;
  readonly phase: Phase;
  readonly iteration: number;
};

/**
 * This run's unique directory under ~/.afk-runs/.
 * The timestamp plus random suffix prevents collisions when two
 * orchestrators start in the same second.
 */
const COLON_OR_DOT_RE = /[:.]/g;
const startedAt = new Date().toISOString().replaceAll(COLON_OR_DOT_RE, "-").replace("T", "_");
const randomSuffix = Math.random().toString(16).slice(2, 8);
export const runDir = join(RUNS_DIR, `${startedAt}-${randomSuffix}`);

/** The run's machine-readable event log. */
export const runLogPath = join(runDir, "run.jsonl");

/**
 * The sentinel file a phase's Stop hook writes its final message into.
 * `iteration` keeps the review/fix loop's repeated phases from colliding.
 */
export const sentinelPath = ({ issueIid, phase, iteration }: PhaseRef): string =>
  join(runDir, `sentinel-${issueIid}-${phase}-${iteration}.flag`);

/** The file a phase's tmux pane is mirrored into, for live tailing. */
export const tmuxLogPath = ({ issueIid, phase, iteration }: PhaseRef): string =>
  join(runDir, `tmux-${issueIid}-${phase}-${iteration}.log`);

/** The rendered prompt handed to a phase's claude session. */
export const promptFilePath = ({ issueIid, phase, iteration }: PhaseRef): string =>
  join(runDir, `prompt-${issueIid}-${phase}-${iteration}.md`);

/** The tmux session name for one phase run — unique per issue, phase, iteration. */
export const sessionName = ({ issueIid, phase, iteration }: PhaseRef): string =>
  `afk-${issueIid}-${phase}-${iteration}`;

/**
 * Append one structured event to the run's JSONL log. Best-effort: a logging
 * failure must never abort a run, so the returned Effect never fails.
 */
export const logEvent = (event: Record<string, unknown>): Effect.Effect<void> =>
  Effect.tryPromise(() =>
    appendFile(runLogPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`),
  ).pipe(Effect.ignore);
