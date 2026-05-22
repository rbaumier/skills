/**
 * Gitlab/glab.ts — the typed, retrying boundary to the GitLab CLI (`glab`).
 *
 * Two runners, deliberately kept separate:
 *
 *   - `runGlabRead`  retries transient failures.
 *     Safe only for reads — a retry after a lost response is harmless.
 *   - `runGlabWrite` never retries.
 *     Used for mutations (`mr create`, `issue note`, discussion `post`/`reply`).
 *     If the request succeeded but its response was lost,
 *     a retry would duplicate the mutation.
 */
import { $ } from "bun";
import { Effect, Schedule } from "effect";
import type { z } from "zod";
import { runShell } from "../shell";
import { GlabCommandError, GlabResponseError } from "./errors";

/** Run `glab <command>` once; fail with {@link GlabCommandError} on non-zero exit. */
const runGlabOnce = (command: readonly string[]): Effect.Effect<string, GlabCommandError> =>
  runShell(() => $`glab ${command}`).pipe(
    Effect.flatMap((result) =>
      result.exitCode === 0
        ? Effect.succeed(result.stdout)
        : Effect.fail(
            new GlabCommandError({
              command,
              exitCode: result.exitCode,
              stderr: result.stderr.trim(),
            }),
          ),
    ),
  );

/**
 * Retry policy for reads: jittered exponential backoff, 3 attempts total.
 * Every failure is retried — telling a transient glab error from a permanent
 * one is unreliable, and retrying a genuine 4xx merely wastes ~1 second.
 */
const readRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(2)),
);

/**
 * Run a glab READ command, retrying transient failures.
 * Never pass a mutation here — use {@link runGlabWrite}.
 */
export const runGlabRead = (command: readonly string[]): Effect.Effect<string, GlabCommandError> =>
  runGlabOnce(command).pipe(Effect.retry(readRetryPolicy));

/**
 * Run a glab WRITE command exactly once — no retry.
 * A retry after a lost response would duplicate the mutation; the caller
 * handles a genuine failure instead.
 */
export const runGlabWrite = (command: readonly string[]): Effect.Effect<string, GlabCommandError> =>
  runGlabOnce(command);

/** Try to parse JSON, returning a discriminated result instead of throwing. */
const safeJsonParse = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/** Parse a glab command's stdout as JSON and validate it against `schema`. */
export const parseGlabJson = <A>(
  raw: string,
  schema: z.ZodType<A>,
  command: readonly string[],
): Effect.Effect<A, GlabResponseError> =>
  Effect.suspend(() => {
    // Parse the raw string as JSON — failure produces a descriptive error.
    const parseResult = safeJsonParse(raw);
    if (!parseResult.ok) {
      return Effect.fail(
        new GlabResponseError({ command, detail: `output was not JSON: ${raw.slice(0, 200)}` }),
      );
    }

    // Validate the parsed value against the caller's schema.
    const validation = schema.safeParse(parseResult.value);
    return validation.success
      ? Effect.succeed(validation.data)
      : Effect.fail(
          new GlabResponseError({
            command,
            detail: `output failed validation: ${validation.error.message.slice(0, 200)}`,
          }),
        );
  });
