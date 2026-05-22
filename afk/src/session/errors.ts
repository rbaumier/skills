/**
 * session/errors.ts — the failure modes of running one phase session.
 *
 * See `gitlab/errors.ts` for the project-wide error policy. The short of it:
 * one tagged error per distinct failure mode, grouped by boundary, with a
 * union alias and a `describe` function so a handler can turn any of them
 * into a `failed` state's reason string.
 *
 * The six modes below are genuinely distinct — an operator reading a failed
 * issue treats a timeout, a missing verdict, and a broken tmux very
 * differently — so they are six types, not one `{ reason: string }`.
 */
import { Data } from "effect";
import type { Phase } from "../config";

/** A tmux command failed — the session could not be created or driven. */
export class TmuxError extends Data.TaggedError("TmuxError")<{
  readonly step: string;
  readonly stderr: string;
}> {}

/** A phase prompt template was missing, unreadable, or left a placeholder unresolved. */
export class PromptError extends Data.TaggedError("PromptError")<{
  readonly phase: Phase;
  readonly reason: string;
}> {}

/** A filesystem operation in the worktree or run directory failed. */
export class WorkspaceError extends Data.TaggedError("WorkspaceError")<{
  readonly phase: Phase;
  readonly operation: string;
  readonly reason: string;
}> {}

/** No budget was left to even start the phase. */
export class BudgetExhausted extends Data.TaggedError("BudgetExhausted")<{
  readonly phase: Phase;
}> {}

/** The session ran past its timeout without ever producing a verdict. */
export class SessionTimedOut extends Data.TaggedError("SessionTimedOut")<{
  readonly phase: Phase;
  readonly elapsedMs: number;
}> {}

/** The session stopped, but its final message carried no clean verdict. */
export class NoVerdict extends Data.TaggedError("NoVerdict")<{
  readonly phase: Phase;
  readonly captured: string;
}> {}

/** Every failure running a phase session can produce. */
export type PhaseError =
  | TmuxError
  | PromptError
  | WorkspaceError
  | BudgetExhausted
  | SessionTimedOut
  | NoVerdict;

/** A one-line, human-readable description of a phase error. */
export function describePhaseError(error: PhaseError): string {
  switch (error._tag) {
    case "TmuxError":
      return `tmux ${error.step} failed: ${error.stderr.slice(0, 160)}`;
    case "PromptError":
      return `prompt: ${error.reason}`;
    case "WorkspaceError":
      return `${error.operation} failed: ${error.reason}`;
    case "BudgetExhausted":
      return `per-issue budget exhausted before the ${error.phase} phase could start`;
    case "SessionTimedOut":
      return `timed out after ${Math.round(error.elapsedMs / 1000)}s without a verdict`;
    case "NoVerdict":
      return `stopped without a clean verdict (got: ${error.captured.slice(0, 120)})`;
  }
}
