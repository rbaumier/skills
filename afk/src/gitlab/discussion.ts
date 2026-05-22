/**
 * gitlab/discussion.ts — the pure model of a merge-request discussion.
 *
 * `toDiscussionSummary` maps raw GitLab discussion JSON to the trimmed shape
 * the evaluate/fix phases reason about. Pure and bun-free, so it unit-tests
 * under Node — the `glab api` operations live in `discussion-api.ts`.
 */

/** A discussion reduced to what the pipeline reasons about. */
export interface DiscussionSummary {
  readonly id: string;
  readonly resolved: boolean;
  readonly notes: readonly { readonly author: string; readonly body: string }[];
}

/** The fields of a raw GitLab note we look at — every value is untrusted. */
interface RawNote {
  readonly body: unknown;
  readonly resolvable: unknown;
  readonly resolved: unknown;
  readonly author: { readonly username: unknown } | null;
}

/**
 * Map one raw GitLab discussion object to a {@link DiscussionSummary}.
 *
 * A discussion is "resolved" iff every *resolvable* note in it is resolved.
 * A discussion with no resolvable notes (a bare system note) maps to
 * `resolved: true` — it is not a blocking review thread, so it must not block
 * convergence. Pure and garbage-safe — non-object entries are dropped.
 */
export function toDiscussionSummary(raw: unknown): DiscussionSummary {
  const object = (raw ?? {}) as { id: unknown; notes: unknown };
  const rawNotes: readonly RawNote[] = (Array.isArray(object.notes) ? object.notes : []).filter(
    (note): note is RawNote => typeof note === "object" && note !== null,
  );

  const resolvableNotes = rawNotes.filter((note) => note.resolvable === true);
  const resolved = resolvableNotes.every((note) => note.resolved === true);

  return {
    id: String(object.id ?? ""),
    resolved,
    notes: rawNotes.map((note) => ({
      author: typeof note.author?.username === "string" ? note.author.username : "unknown",
      body: typeof note.body === "string" ? note.body : "",
    })),
  };
}
