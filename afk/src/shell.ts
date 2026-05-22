/**
 * shell.ts — the one Effect-wrapped way to run an external command.
 *
 * Every orchestrator shell-out (tmux, git, glab, jq, rm) goes through here, so
 * the codebase has a single consistent boundary to the operating system
 * instead of a `$`-template scattered across a dozen call sites.
 */
import type { $ } from "bun";
import { Effect } from "effect";
import { COMMAND_TIMEOUT_MS } from "./config";

/** The outcome of a finished command — exit code plus captured streams. */
export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Exit codes for the two failure modes that are not a real process exit. */
const SPAWN_FAILURE_EXIT = 127;
const TIMEOUT_EXIT = 124;

/**
 * Run a command and capture its result. The returned Effect never fails — a
 * non-zero exit, a spawn failure, and a timeout are all reported as a
 * {@link CommandResult} with a non-zero `exitCode`, and the caller decides
 * what counts as an error.
 *
 * `build` is a thunk so the `$` command is constructed *inside* the Effect —
 * the shell-out is a proper deferred side effect, not something that already
 * started when the Effect was merely described.
 *
 * Two guards beyond `.nothrow()` (which only suppresses non-zero exits):
 *  - an inner try/catch turns a spawn-level throw (missing binary, OS error)
 *    into exit code 127 rather than an untyped defect;
 *  - a {@link COMMAND_TIMEOUT_MS} timeout turns a hung command into exit code
 *    124, so an unreachable `glab`/`git` cannot freeze the orchestrator.
 */
export const runShell = (build: () => ReturnType<typeof $>): Effect.Effect<CommandResult> =>
  Effect.promise(async (): Promise<CommandResult> => {
    try {
      const output = await build().nothrow().quiet();
      return {
        exitCode: output.exitCode,
        stdout: output.stdout.toString(),
        stderr: output.stderr.toString(),
      };
    } catch (cause) {
      return { exitCode: SPAWN_FAILURE_EXIT, stdout: "", stderr: String(cause) };
    }
  }).pipe(
    Effect.timeoutTo({
      duration: `${COMMAND_TIMEOUT_MS} millis`,
      onSuccess: (result: CommandResult) => result,
      onTimeout: (): CommandResult => ({
        exitCode: TIMEOUT_EXIT,
        stdout: "",
        stderr: "command timed out",
      }),
    }),
  );
