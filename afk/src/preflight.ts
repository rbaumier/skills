/**
 * preflight.ts — startup checks, run as a typed Effect before the machine.
 *
 * Replaces the old module-level top-level `await` + `process.exit` block: a
 * failure here is a typed {@link PreflightError} that `BunRuntime.runMain`
 * reports cleanly, and the module stays importable without side effects.
 */
import { mkdir } from "node:fs/promises"
import { basename } from "node:path"
import { $ } from "bun"
import { Data, Effect } from "effect"
import { runDir } from "./run-artifacts"
import { runShell } from "./shell"

/**
 * A startup precondition failed. Preflight has a single error type on
 * purpose: every mode (missing tool, not a repo, no origin/HEAD) is fatal and
 * handled identically — abort before any work. The `reason` carries the
 * specifics. (Distinct *handling* earns a distinct type; identical handling
 * does not.)
 */
export class PreflightError extends Data.TaggedError("PreflightError")<{
  readonly reason: string
}> {}

/** Repository facts the orchestrator needs throughout a run. */
export interface Environment {
  readonly repoName: string
  readonly defaultBranch: string
}

/** External tools the orchestrator shells out to. */
const REQUIRED_TOOLS = ["jq", "tmux", "claude", "glab", "git"] as const

/**
 * Create the run directory and verify the environment, returning the repo
 * facts. Fails fast with a clear, actionable message — never after a
 * 90-minute timeout.
 */
export const preflight: Effect.Effect<Environment, PreflightError> = Effect.gen(function* () {
  yield* Effect.tryPromise({
    try: () => mkdir(runDir, { recursive: true }),
    catch: (cause) =>
      new PreflightError({ reason: `could not create the run directory: ${String(cause)}` }),
  })

  for (const tool of REQUIRED_TOOLS) {
    const found = yield* runShell(() => $`which ${tool}`)
    if (found.exitCode !== 0) {
      return yield* Effect.fail(
        new PreflightError({ reason: `${tool} is not in PATH — required by the orchestrator` }),
      )
    }
  }

  const topLevel = yield* runShell(() => $`git rev-parse --show-toplevel`)
  if (topLevel.exitCode !== 0) {
    return yield* Effect.fail(new PreflightError({ reason: "not inside a git repository" }))
  }

  const originHead = yield* runShell(() => $`git symbolic-ref --short refs/remotes/origin/HEAD`)
  if (originHead.exitCode !== 0) {
    return yield* Effect.fail(
      new PreflightError({
        reason: "origin/HEAD is not set locally — run: git remote set-head origin -a",
      }),
    )
  }

  return {
    repoName: basename(topLevel.stdout.trim()),
    defaultBranch: originHead.stdout.trim().replace(/^origin\//, ""),
  }
})
