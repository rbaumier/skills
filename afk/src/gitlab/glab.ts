/**
 * gitlab/glab.ts — the typed, retrying boundary to the GitLab CLI (`glab`).
 *
 * Two runners, deliberately kept separate:
 *
 *   - `runGlabRead`  retries transient failures. Safe only for reads — a
 *     retry after a lost response is harmless.
 *   - `runGlabWrite` never retries. For mutations (`mr create`, `issue note`,
 *     discussion `post`/`reply`): if the request succeeded but its response
 *     was lost, a retry would duplicate the merge request, note, or thread.
 */
import { $ } from "bun"
import { Effect, Schedule } from "effect"
import type { z } from "zod"
import { runShell } from "../shell"
import { GlabCommandError, GlabResponseError } from "./errors"

/** Run `glab <command>` once; fail with {@link GlabCommandError} on non-zero exit. */
const runGlabOnce = (
  command: ReadonlyArray<string>,
): Effect.Effect<string, GlabCommandError> =>
  runShell(() => $`glab ${command}`).pipe(
    Effect.flatMap((result) =>
      result.exitCode === 0
        ? Effect.succeed(result.stdout)
        : Effect.fail(
            new GlabCommandError({ command, exitCode: result.exitCode, stderr: result.stderr.trim() }),
          ),
    ),
  )

/**
 * Retry policy for reads: jittered exponential backoff, 3 attempts total.
 * Every failure is retried — telling a transient glab error from a permanent
 * one is unreliable, and retrying a genuine 4xx merely wastes ~1 second.
 */
const readRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(2)),
)

/**
 * Run a glab READ command, retrying transient failures.
 * Never pass a mutation here — use {@link runGlabWrite}.
 */
export const runGlabRead = (
  command: ReadonlyArray<string>,
): Effect.Effect<string, GlabCommandError> => runGlabOnce(command).pipe(Effect.retry(readRetryPolicy))

/**
 * Run a glab WRITE command exactly once — no retry.
 * A retry after a lost response would duplicate the mutation; the caller
 * handles a genuine failure instead.
 */
export const runGlabWrite = (
  command: ReadonlyArray<string>,
): Effect.Effect<string, GlabCommandError> => runGlabOnce(command)

/** Parse a glab command's stdout as JSON and validate it against `schema`. */
export const parseGlabJson = <A>(
  raw: string,
  schema: z.ZodType<A>,
  command: ReadonlyArray<string>,
): Effect.Effect<A, GlabResponseError> =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: () =>
      new GlabResponseError({ command, detail: `output was not JSON: ${raw.slice(0, 200)}` }),
  }).pipe(
    Effect.flatMap((parsed) => {
      const validation = schema.safeParse(parsed)
      return validation.success
        ? Effect.succeed(validation.data)
        : Effect.fail(
            new GlabResponseError({
              command,
              detail: `output failed validation: ${validation.error.message.slice(0, 200)}`,
            }),
          )
    }),
  )
