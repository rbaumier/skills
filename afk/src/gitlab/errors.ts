/**
 * Gitlab/errors.ts — the failure modes of the GitLab boundary.
 *
 * Error policy (consistent across every slice):
 *  - One tagged error per *distinct* failure mode — never a single catch-all.
 *    Distinct modes are caught and described differently, so they are typed
 *    differently.
 *  - Errors are grouped by the boundary they arise from; each slice owns its
 *    own `errors.ts`.
 *  - Anticipated, routable failures live in the Effect error channel. A
 *    genuine bug in our own code stays a defect — it is not modelled here.
 *  - A slice exports a union alias of its errors so callers can name the
 *    whole error surface in one place.
 */
import { Data } from "effect";

/** A `glab` process ran but exited non-zero. */
export class GlabCommandError extends Data.TaggedError("GlabCommandError")<{
  readonly command: readonly string[];
  readonly exitCode: number;
  readonly stderr: string;
}> {}

/** `glab` exited zero, but its output was not the JSON shape we expected. */
export class GlabResponseError extends Data.TaggedError("GlabResponseError")<{
  readonly command: readonly string[];
  readonly detail: string;
}> {}

/** Every failure the GitLab boundary can produce. */
export type GitLabError = GlabCommandError | GlabResponseError;

/** A one-line, human-readable description of a GitLab error. */
export function describeGitLabError(error: GitLabError): string {
  if (error._tag === "GlabCommandError") {
    return `glab ${error.command.join(" ")} exited ${error.exitCode}: ${error.stderr.slice(0, 200)}`;
  }
  return `glab ${error.command.join(" ")} returned unexpected output: ${error.detail.slice(0, 200)}`;
}
