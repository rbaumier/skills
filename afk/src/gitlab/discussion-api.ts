/**
 * Gitlab/discussion-api.ts — the `glab api` operations over MR discussions.
 *
 * The pipeline uses a merge request's discussions as its review medium:
 * `review` posts findings, `evaluate` replies and resolves, `fix` resolves
 * what it fixed. The CLI in `scripts/mr-discussion.ts` exposes these to the
 * phase prompts.
 */
import { Effect } from "effect";
import { z } from "zod";
import type { DiscussionSummary } from "./discussion";
import { toDiscussionSummary } from "./discussion";
import type { GitLabError } from "./errors";
import { GlabResponseError } from "./errors";
import { parseGlabJson, runGlabRead, runGlabWrite } from "./glab";

const discussionsEndpoint = (mergeRequestIid: number): string =>
  `projects/:id/merge_requests/${mergeRequestIid}/discussions`;

/** Confirms a mutation took: the glab-api response carries an `id`. */
const IdStringSchema = z.string().trim().min(1);
const HasIdSchema = z.object({ id: z.union([IdStringSchema, z.number()]) });

/** List every discussion on a merge request. */
export const listDiscussions = (
  mergeRequestIid: number,
): Effect.Effect<readonly DiscussionSummary[], GitLabError> => {
  // `?per_page=100` over `--paginate`: `glab api --paginate` concatenates each
  // page's JSON array (`[…][…]`), which is not valid JSON. One page of 100
  // covers any realistic discussion count on an AFK merge request.
  const command = ["api", `${discussionsEndpoint(mergeRequestIid)}?per_page=100`];
  return runGlabRead(command).pipe(
    Effect.flatMap((output) =>
      // An MR with no discussions is a normal state, not an error — and some
      // glab versions print nothing rather than `[]`.
      output.trim() === ""
        ? Effect.succeed<readonly unknown[]>([])
        : parseGlabJson(output, z.array(z.looseObject({})), command),
    ),
    Effect.map((rawDiscussions) => rawDiscussions.map((disc) => toDiscussionSummary(disc))),
  );
};

/** Create a new general, resolvable discussion carrying `body`. */
export const postDiscussion = (
  mergeRequestIid: number,
  body: string,
): Effect.Effect<void, GitLabError> => {
  const command = ["api", discussionsEndpoint(mergeRequestIid), "-X", "POST", "-f", `body=${body}`];
  return runGlabWrite(command).pipe(
    Effect.flatMap((output) => parseGlabJson(output, HasIdSchema, command)),
    Effect.asVoid,
  );
};

/**
 * Add a note (a reply) to an existing discussion thread. The response is
 * verified — a note with an `id` must come back — so a silent half-success
 * cannot pass for a delivered reply.
 */
export const replyToDiscussion = (
  mergeRequestIid: number,
  discussionId: string,
  body: string,
): Effect.Effect<void, GitLabError> => {
  const command = [
    "api",
    `${discussionsEndpoint(mergeRequestIid)}/${discussionId}/notes`,
    "-X",
    "POST",
    "-f",
    `body=${body}`,
  ];
  return runGlabWrite(command).pipe(
    Effect.flatMap((output) => parseGlabJson(output, HasIdSchema, command)),
    Effect.asVoid,
  );
};

/**
 * Resolve a discussion thread, then verify it came back resolved.
 * A `glab` exit 0 that no-ops must not pass for a resolved thread.
 */
export const resolveDiscussion = (
  mergeRequestIid: number,
  discussionId: string,
): Effect.Effect<void, GitLabError> => {
  const command = [
    "api",
    `${discussionsEndpoint(mergeRequestIid)}/${discussionId}`,
    "-X",
    "PUT",
    "-F",
    "resolved=true",
  ];
  // Parse the response, then verify the discussion came back resolved.
  const DiscussionResponseSchema = z.looseObject({});
  return runGlabWrite(command).pipe(
    Effect.flatMap((output) => parseGlabJson(output, DiscussionResponseSchema, command)),
    Effect.flatMap((raw) => {
      const summary = toDiscussionSummary(raw);
      return summary.resolved
        ? Effect.void
        : Effect.fail(
            new GlabResponseError({
              command,
              detail: `discussion ${discussionId} still unresolved after PUT`,
            }),
          );
    }),
  );
};
