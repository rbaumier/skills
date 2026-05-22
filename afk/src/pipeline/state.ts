/**
 * pipeline/state.ts — the orchestrator's state machine, as data.
 *
 * `State` is a discriminated union: one variant per node in the pipeline.
 * Each variant carries exactly the data that node needs and nothing more, so
 * the type system proves a handler can never read a field that is not there
 * yet (no `mergeRequestIid` before the MR is opened, for instance).
 *
 * Pure type declarations — no logic, no imports.
 */

/** A GitLab issue, reduced to what the pipeline actually uses. */
export interface IssueRef {
  /** The project-scoped issue number (GitLab's `iid`, shown as `#42`). */
  readonly iid: number;
  readonly title: string;
  /** The issue description, or the empty string if it had none. */
  readonly body: string;
}

/** A wall-clock instant (epoch milliseconds) past which an issue is over budget. */
export type Deadline = number;

/**
 * The data every node from `open_draft_mr` onward shares: the issue, its
 * branch and worktree, the budget deadline, and the merge request.
 */
export interface PipelineContext {
  readonly issue: IssueRef;
  readonly branch: string;
  readonly worktree: string;
  readonly deadline: Deadline;
  readonly mergeRequestIid: number;
}

/**
 * Every node of the pipeline. The machine starts at `fetch_queue`, walks the
 * graph one transition at a time, and terminates at `end`.
 *
 *   fetch_queue → claim_issue → branch_worktree → run_impl → open_draft_mr
 *     → review ⇄ evaluate → fix → … → run_dogfood → merge → done → fetch_queue
 *
 * `failed` is reachable from any pipeline node; `done` and `failed` both loop
 * back to `fetch_queue` to pick up the next issue.
 */
export type State =
  | { readonly kind: "fetch_queue" }
  | { readonly kind: "claim_issue"; readonly issue: IssueRef }
  | { readonly kind: "branch_worktree"; readonly issue: IssueRef }
  | {
      readonly kind: "run_impl";
      readonly issue: IssueRef;
      readonly branch: string;
      readonly worktree: string;
    }
  | {
      readonly kind: "open_draft_mr";
      readonly issue: IssueRef;
      readonly branch: string;
      readonly worktree: string;
      readonly deadline: Deadline;
    }
  | ({ readonly kind: "review" } & PipelineContext & { readonly fixCycles: number })
  | ({ readonly kind: "evaluate" } & PipelineContext & { readonly fixCycles: number })
  | ({ readonly kind: "fix" } & PipelineContext & { readonly fixCycles: number })
  | ({ readonly kind: "run_dogfood" } & PipelineContext)
  | ({ readonly kind: "merge" } & PipelineContext)
  | {
      readonly kind: "done";
      readonly issue: IssueRef;
      readonly worktree: string;
      readonly mergeRequestIid: number;
    }
  | {
      readonly kind: "failed";
      readonly issue: IssueRef;
      readonly branch: string | null;
      readonly worktree: string | null;
      readonly mergeRequestIid: number | null;
      readonly reason: string;
    }
  | { readonly kind: "end" };
