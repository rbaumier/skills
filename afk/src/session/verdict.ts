/**
 * session/verdict.ts — the strict contract by which a phase session tells the
 * orchestrator how it ended.
 *
 * A phase session ends its final assistant message with a strict last line
 * `VERDICT: <TOKEN>`. The Stop hook captures that whole message into the
 * sentinel; the orchestrator reads the sentinel and calls `parseVerdict`.
 *
 * Pure — no Effect, no I/O — so it can be unit-tested exhaustively.
 */

/** Every terminal verdict a phase session may declare. */
export const VERDICT_TOKENS = [
  "READY_FOR_REVIEW",
  "BLOCKER_SUSPECTED",
  "REVIEW_DONE",
  "CONVERGED",
  "NEEDS_FIX",
  "FIX_DONE",
  "DOGFOOD_PASS",
  "DOGFOOD_FAIL",
] as const;

export type VerdictToken = (typeof VERDICT_TOKENS)[number];

/** A line is a verdict line iff it is exactly `VERDICT: ` + an uppercase token. */
const VERDICT_LINE = /^VERDICT: ([A-Z_]+)$/;

/**
 * Extract the verdict a session declared, or `null` if it did not declare one
 * cleanly.
 *
 * Strict by design — a loose substring scan would false-match prose like
 * "not yet READY_FOR_REVIEW", and a false *proceed* (acting on a session that
 * never finished) is far worse than a false *fail*. A verdict counts only
 * when ALL of these hold:
 *
 *  - exactly one `VERDICT:` line exists in the message (zero, or two+, is
 *    ambiguous → `null`);
 *  - that line is the LAST non-empty line;
 *  - the token is one of the known {@link VERDICT_TOKENS}.
 *
 * `null` means the caller must treat the session as failed — never proceed.
 */
export function parseVerdict(message: string): VerdictToken | null {
  const lines = message.split("\n");

  // Exactly one verdict line, or it is ambiguous and we refuse to guess.
  const verdictLineCount = lines.filter((line) => VERDICT_LINE.test(line.trim())).length;
  if (verdictLineCount !== 1) {return null;}

  // The verdict must be the last thing the session said.
  const lastNonEmpty = [...lines].reverse().find((line) => line.trim() !== "");
  if (lastNonEmpty === undefined) {return null;}

  const match = VERDICT_LINE.exec(lastNonEmpty.trim());
  if (match === null) {return null;}

  // match[1] is always set when exec succeeds with a participating group;
  // the guard exists only to satisfy noUncheckedIndexedAccess.
  const token = match[1];
  if (token === undefined) {return null;}

  return (VERDICT_TOKENS as readonly string[]).includes(token) ? (token as VerdictToken) : null;
}
