/**
 * shell.ts — the one Effect-wrapped way to run an external command.
 *
 * Every orchestrator shell-out (tmux, git, glab, jq, rm) goes through here, so
 * the codebase has a single consistent boundary to the operating system
 * instead of a `$`-template scattered across fifteen call sites.
 */
import { $ } from "bun"
import { Effect } from "effect"

/** The outcome of a finished command — exit code plus captured streams. */
export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

/**
 * Run a command and capture its result. The returned Effect never fails.
 *
 * `build` is a thunk so the `$` command is constructed *inside* the Effect —
 * the shell-out is a proper deferred side effect, not something that already
 * started when the Effect was merely described.
 *
 * The command runs with `.nothrow()`, so a non-zero exit is reported in
 * `exitCode` rather than thrown. The caller decides whether that exit code is
 * an error: a best-effort `tmux kill-session` ignores it; `glab.ts` turns it
 * into a typed `GlabError`.
 */
export const runShell = (
  build: () => ReturnType<typeof $>,
): Effect.Effect<CommandResult> =>
  Effect.promise(async () => {
    const output = await build().nothrow().quiet()
    return {
      exitCode: output.exitCode,
      stdout: output.stdout.toString(),
      stderr: output.stderr.toString(),
    }
  })
