/**
 * glab.ts — the Effect-wrapped `glab` runner shared by every AFK script.
 *
 * One deterministic place for: typed failure (`GlabError`), a jittered
 * exponential retry on transient failures, and JSON parsing of glab output.
 *
 * Imports Bun (`$`) — so it is never imported by a `*.test.ts` (vitest runs
 * under Node). Pure logic that needs unit tests lives in its own module.
 */
import { $ } from "bun"
import { Data, Effect, Schedule } from "effect"

/** A `glab` invocation failed, or returned output we couldn't make sense of. */
export class GlabError extends Data.TaggedError("GlabError")<{
  readonly args: ReadonlyArray<string>
  readonly detail: string
}> {}

/**
 * Retry transient failures (network blips, 5xx, rate limits) with jittered
 * exponential backoff — 3 attempts total (1 + 2 retries). Every failure is
 * retried: classifying glab errors as transient-or-not is fiddly, and
 * retrying a genuine 4xx just wastes ~1s of backoff before failing anyway.
 */
const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(2)),
)

/** Run `glab <args>` once; fail with {@link GlabError} on a non-zero exit. */
const runGlabOnce = (args: ReadonlyArray<string>): Effect.Effect<string, GlabError> =>
  Effect.tryPromise({
    // `.nothrow()` — we inspect exitCode ourselves; the promise won't reject.
    try: () => $`glab ${args}`.nothrow().quiet(),
    catch: (cause) => new GlabError({ args, detail: String(cause) }),
  }).pipe(
    Effect.flatMap((result) =>
      result.exitCode === 0
        ? Effect.succeed(result.stdout.toString())
        : Effect.fail(new GlabError({ args, detail: result.stderr.toString().trim() })),
    ),
  )

/** Run `glab <args>`, retrying transient failures. */
export const runGlab = (args: ReadonlyArray<string>): Effect.Effect<string, GlabError> =>
  runGlabOnce(args).pipe(Effect.retry(retryPolicy))

/** Parse `glab`'s stdout as JSON, or fail with {@link GlabError}. */
export const parseJson = (
  raw: string,
  args: ReadonlyArray<string>,
): Effect.Effect<unknown, GlabError> =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new GlabError({ args, detail: `expected JSON from glab (${String(cause)}); got: ${raw.slice(0, 200)}` }),
  })
