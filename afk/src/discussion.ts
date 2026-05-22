/**
 * DiscussionSummary — the trimmed GitLab MR-discussion shape the evaluate and
 * fix phases consume.
 *
 * Pure mapping, zero I/O and zero runtime imports — so it can be unit-tested
 * under Node/vitest without pulling in Bun. The `glab`-touching CLI lives in
 * `scripts/mr-discussion.ts` and imports this.
 */

/** The trimmed discussion shape the evaluate/fix phases consume. */
export interface DiscussionSummary {
  readonly id: string
  readonly resolved: boolean
  readonly notes: ReadonlyArray<{ readonly author: string; readonly body: string }>
}

/** Minimal shape of a note inside GitLab's raw discussion JSON. */
interface RawNote {
  readonly body?: unknown
  readonly resolvable?: unknown
  readonly resolved?: unknown
  readonly author?: { readonly username?: unknown } | null
}

/**
 * Map one raw GitLab discussion object to a {@link DiscussionSummary}.
 *
 * A discussion is "resolved" iff every *resolvable* note in it is resolved.
 * A discussion with no resolvable notes (e.g. a bare system note) maps to
 * `resolved: true` — it is not a blocking review thread, so it must not block
 * convergence.
 */
export function toDiscussionSummary(raw: unknown): DiscussionSummary {
  const obj = (raw ?? {}) as { id?: unknown; notes?: unknown }
  // Keep only object entries — `glab` won't realistically produce a notes
  // array with nulls/primitives, but this function is sold as garbage-safe.
  const rawNotes: ReadonlyArray<RawNote> = (Array.isArray(obj.notes) ? obj.notes : []).filter(
    (n): n is RawNote => typeof n === "object" && n !== null,
  )

  const resolvableNotes = rawNotes.filter((n) => n.resolvable === true)
  const resolved = resolvableNotes.every((n) => n.resolved === true)

  return {
    id: String(obj.id ?? ""),
    resolved,
    notes: rawNotes.map((n) => ({
      author: typeof n.author?.username === "string" ? n.author.username : "unknown",
      body: typeof n.body === "string" ? n.body : "",
    })),
  }
}
