/**
 * Shell.ts — the one Effect-wrapped way to run an external command.
 *
 * Every orchestrator shell-out (tmux, git, glab, jq, rm) goes
 * through here. The codebase has a single consistent boundary to the
 * OS instead of `$`-templates scattered across call sites.
 */
import type { $ } from "bun";
import { Effect } from "effect";
import { COMMAND_TIMEOUT_MS } from "./config";

/** The outcome of a finished command — exit code plus captured streams. */
export type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Exit codes for the two failure modes that are not a real process exit. */
const SPAWN_FAILURE_EXIT_CODE = 127;
const EXIT_CODE_TIMED_OUT = 124;

/**
 * Run a command and capture its result. The returned Effect
 * never fails. A non-zero exit, a spawn failure, or a timeout
 * are all reported as a {@link CommandResult}. The caller
 * decides what counts as an error.
 *
 * `build` is a thunk so the `$` command is constructed
 * *inside* the Effect — a proper deferred side effect.
 *
 * Two guards beyond `.nothrow()` (suppresses non-zero exits):
 *  - `Effect.tryPromise` turns a spawn-level throw (missing
 *    binary, OS error) into exit code 127.
 *  - A {@link COMMAND_TIMEOUT_MS} timeout turns a hung command
 *    into exit code 124, preventing a freeze.
 */
export const runShell = (build: () => ReturnType<typeof $>): Effect.Effect<CommandResult> =>
  Effect.tryPromise({
    try: async () => {
      const output = await build().nothrow().quiet();
      return {
        exitCode: output.exitCode,
        stdout: output.stdout.toString(),
        stderr: output.stderr.toString(),
      };
    },
    catch: (error: unknown): CommandResult => ({
      exitCode: SPAWN_FAILURE_EXIT_CODE,
      stdout: "",
      stderr: String(error),
    }),
  }).pipe(
    // Fold the spawn-failure error channel back into the success channel.
    Effect.catchAll((result) => Effect.succeed(result)),
    Effect.timeoutTo({
      duration: `${COMMAND_TIMEOUT_MS} millis`,
      onSuccess: (result: CommandResult) => result,
      onTimeout: (): CommandResult => ({
        exitCode: EXIT_CODE_TIMED_OUT,
        stdout: "",
        stderr: "command timed out",
      }),
    }),
  );
