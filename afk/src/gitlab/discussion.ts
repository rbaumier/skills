/**
 * Gitlab/discussion.ts — the pure model of a merge-request discussion.
 *
 * `toDiscussionSummary` maps raw GitLab discussion JSON to the trimmed shape
 * the evaluate/fix phases reason about. Pure and bun-free, so it unit-tests
 * under Node — the `glab api` operations live in `discussion-api.ts`.
 */

/** A discussion reduced to what the pipeline reasons about. */
export type DiscussionSummary = {
  readonly id: string;
  readonly resolved: boolean;
  readonly notes: readonly { readonly author: string; readonly body: string }[];
};

/** The fields of a raw GitLab note we look at — every value is untrusted. */
type RawNote = {
  readonly body: unknown;
  readonly resolvable: unknown;
  readonly resolved: unknown;
  readonly author: { readonly username: unknown } | null;
};

/** Type guard: returns true if `val` is a non-null object usable as a record. */
const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === "object" && val !== null;

/**
 * Map one raw GitLab discussion object to a {@link DiscussionSummary}.
 *
 * A discussion is "resolved" iff every *resolvable* note is resolved.
 * No resolvable notes (a bare system note) maps to `resolved: true`.
 * It is not a blocking review thread, so it must not block convergence.
 * Pure and garbage-safe — non-object entries are dropped.
 */
export function toDiscussionSummary(raw: unknown): DiscussionSummary {
  // Normalize `raw` to a record so we can safely read `.id` and `.notes`.
  const object: Record<string, unknown> = isRecord(raw) ? raw : {};
  const rawNotes: readonly RawNote[] = (Array.isArray(object.notes) ? object.notes : []).filter(
    (note): note is RawNote => typeof note === "object" && note !== null,
  );

  const resolvableNotes = rawNotes.filter((note) => note.resolvable);
  const resolved = resolvableNotes.every((note) => note.resolved);

  // `object.id` may be any type — coerce primitives safely.
  const idValue = object.id;
  const id = typeof idValue === "string" || typeof idValue === "number" ? String(idValue) : "";

  return {
    id,
    resolved,
    notes: rawNotes.map((note) => ({
      author: typeof note.author?.username === "string" ? note.author.username : "unknown",
      body: typeof note.body === "string" ? note.body : "",
    })),
  };
}
