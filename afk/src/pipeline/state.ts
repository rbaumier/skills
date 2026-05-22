/**
 * Pipeline/state.ts — the orchestrator's state machine, as data.
 *
 * `State` is a discriminated union with one variant per pipeline node.
 * Each variant carries exactly the data that node needs, nothing more.
 * The type system proves a handler can never read a field that is not
 * there yet (no `mergeRequestIid` before the MR is opened, for instance).
 *
 * Pure type declarations — no logic, no imports.
 */

/** A GitLab issue, reduced to what the pipeline actually uses. */
export type IssueRef = {
  /** The project-scoped issue number (GitLab's `iid`, shown as `#42`). */
  readonly iid: number;
  readonly title: string;
  /** The issue description, or the empty string if it had none. */
  readonly body: string;
};

/** A wall-clock instant (epoch milliseconds) past which an issue is over budget. */
export type Deadline = number;

/**
 * The data every node from `open_draft_mr` onward shares.
 * Includes the issue, branch, worktree, budget deadline, and MR iid.
 */
export type PipelineContext = {
  readonly issue: IssueRef;
  readonly branch: string;
  readonly worktree: string;
  readonly deadline: Deadline;
  readonly mergeRequestIid: number;
};

/**
 * Every node of the pipeline.
 *
 * The machine starts at `fetch_queue` and terminates at `end`.
 * `failed` is reachable from any node.
 * Both `done` and `failed` loop back to `fetch_queue`.
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
