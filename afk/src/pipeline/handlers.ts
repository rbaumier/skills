/**
 * One handler per state, plus the `step` dispatcher.
 *
 * Each handler takes its narrowed state variant and returns the next state.
 * Only `fetch_queue` can fail (a `GitLabError` reading the queue is fatal).
 * Every other handler routes its own failures into a `failed` state,
 * so it returns `Effect<State>` (never fails).
 */
import { $ } from "bun";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Console, Effect } from "effect";
import { z } from "zod";
import type { Phase } from "../config";
import { ISSUE_BUDGET_MS, LABELS, MAX_FIX_CYCLES, WORKTREES_DIR } from "../config";
import { runShell } from "../shell";
import type { GitLabError } from "../gitlab/errors";
import { describeGitLabError } from "../gitlab/errors";
import type { GitLabMergeRequest } from "../gitlab/schema";
import { IssueSchema, MergeRequestSchema } from "../gitlab/schema";
import { parseGlabJson, runGlabRead, runGlabWrite } from "../gitlab/glab";
import type { Environment } from "../preflight";
import { runDir, runLogPath } from "../run-artifacts";
import { describePhaseError } from "../session/errors";
import { phaseTimeoutMs, runPhaseSession } from "../session/phase";
import type { VerdictToken } from "../session/verdict";
import { branchName, worktreePath } from "./naming";
import type { IssueRef, PipelineContext, State } from "./state";

// ─── Constants ────────────────────────────────────────────────────────────

const STATE_FETCH_QUEUE = "fetch_queue" as const;
const STATE_RUN_DOGFOOD = "run_dogfood" as const;

// ─── Handler helpers ───────────────────────────────────────────────────────

/** The outcome of a phase, flattened for routing: a verdict, or a fail reason. */
type PhaseOutcome =
  | { readonly ok: true; readonly verdict: VerdictToken }
  | { readonly ok: false; readonly reason: string };

/** The fields `failedState` needs to build a `failed` node. */
type FailedStateKnown = {
  readonly issue: IssueRef;
  readonly branch: string | null;
  readonly worktree: string | null;
  readonly mergeRequestIid: number | null;
};

/**
 * Build a `failed` state.
 *
 * Every field is explicit so no optional markers leak into the State type.
 * A pipeline-stage handler can pass its own state variable, which
 * already carries non-null branch/worktree/mergeRequestIid.
 */
const failedState = (known: FailedStateKnown, reason: string): State => ({
  kind: "failed",
  issue: known.issue,
  branch: known.branch,
  worktree: known.worktree,
  mergeRequestIid: known.mergeRequestIid,
  reason,
});

/** The five shared pipeline fields, copied off any node that carries them. */
const pipelineContext = (state: PipelineContext): PipelineContext => ({
  issue: state.issue,
  branch: state.branch,
  worktree: state.worktree,
  deadline: state.deadline,
  mergeRequestIid: state.mergeRequestIid,
});

/** Options for running a single phase session. */
type RunPhaseOptions = {
  readonly issueIid: number;
  readonly worktree: string;
  readonly deadline: number;
  readonly iteration: number;
  readonly replacements: Record<string, string>;
};

/**
 * Run one phase and flatten its outcome.
 *
 * This is the single adapter from the typed phase-error channel to a
 * routable {@link PhaseOutcome}. Used by every phase handler.
 */
const runPhase = (phase: Phase, options: RunPhaseOptions): Effect.Effect<PhaseOutcome> =>
  runPhaseSession({
    phase,
    issueIid: options.issueIid,
    worktree: options.worktree,
    iteration: options.iteration,
    timeoutMs: phaseTimeoutMs(phase, options.deadline),
    replacements: options.replacements,
  }).pipe(
    Effect.map((verdict): PhaseOutcome => ({ ok: true, verdict })),
    Effect.catchAll(
      (error): Effect.Effect<PhaseOutcome> =>
        Effect.succeed({ ok: false, reason: describePhaseError(error) }),
    ),
  );

/** Run an MR-bound phase — the four phases that share the `{worktree} {mr_iid}` prompt. */
const runMrPhase = (
  phase: Phase,
  context: PipelineContext,
  iteration: number,
): Effect.Effect<PhaseOutcome> =>
  runPhase(phase, {
    issueIid: context.issue.iid,
    worktree: context.worktree,
    deadline: context.deadline,
    iteration,
    replacements: { worktree: context.worktree, mr_iid: String(context.mergeRequestIid) },
  });

/** Run `git -C <worktree> <args>` and capture the result. */
const runShellGit = (worktree: string, args: readonly string[]) =>
  runShell(() => $`git -C ${worktree} ${args}`);

/** Find the open merge request for a branch, if any. Never fails. */
const findOpenMr = (mergeRequests: readonly GitLabMergeRequest[]) =>
  mergeRequests.find((mr) => mr.state === "opened");

const findOpenMergeRequest = (branch: string): Effect.Effect<GitLabMergeRequest | undefined> => {
  const command = ["mr", "list", "--source-branch", branch, "--output", "json"];
  return runGlabRead(command).pipe(
    Effect.flatMap((output) =>
      parseGlabJson(output.trim() === "" ? "[]" : output, z.array(MergeRequestSchema), command),
    ),
    Effect.map((mrs) => findOpenMr(mrs)),
    Effect.catchAll(() => Effect.succeed<GitLabMergeRequest | undefined>(void 0)),
  );
};

/**
 * Exclude `.claude/settings.local.json` from git in a fresh worktree.
 *
 * Uses the repo's git exclude file so a phase agent's `git add -A` cannot
 * commit the orchestrator's Stop-hook config into the MR. Best-effort:
 * a failure is logged, not fatal.
 */
const excludeStopHookConfig = (worktree: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    const probe = yield* runShellGit(worktree, [
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    if (probe.exitCode !== 0) {
      return;
    }
    const excludeFile = join(probe.stdout.trim(), "info", "exclude");
    yield* Effect.tryPromise(async () => {
      const current = existsSync(excludeFile) ? await readFile(excludeFile, "utf8") : "";
      if (!current.split("\n").includes(".claude/settings.local.json")) {
        const separator = current === "" || current.endsWith("\n") ? "" : "\n";
        await appendFile(excludeFile, `${separator}.claude/settings.local.json\n`);
      }
    }).pipe(
      Effect.catchAll(() => Console.error("  ⚠ could not update the git exclude for .claude/")),
    );
  });

// ─── State handlers ────────────────────────────────────────────────────────

/** Fetch_queue — read the ready queue, pick one issue at random, or end. */
const onFetchQueue: Effect.Effect<State, GitLabError> = Effect.gen(function* () {
  const command = [
    "issue",
    "list",
    "--label",
    LABELS.readyForAgent,
    "--not-label",
    LABELS.failedByAgent,
    "--not-label",
    LABELS.pickedByAgent,
    "--per-page",
    "100",
    "--output",
    "json",
  ];
  const output = yield* runGlabRead(command);
  const issues =
    output.trim() === "" ? [] : yield* parseGlabJson(output, z.array(IssueSchema), command);
  const count = issues.length;
  if (count === 0) {
    return { kind: "end" };
  }

  // Random pick keeps multi-instance collisions probabilistically rare.
  const picked = issues.at(Math.floor(Math.random() * count));
  if (picked === undefined) {
    return { kind: "end" };
  }
  return {
    kind: "claim_issue",
    issue: { iid: picked.iid, title: picked.title, body: picked.description ?? "" },
  };
});

/** Claim_issue — re-check the labels, then claim by adding `picked-by-agent`. */
const onClaimIssue = (issue: IssueRef): Effect.Effect<State> =>
  Effect.gen(function* () {
    // Re-read the labels right before claiming. This narrows the window
    // where another instance claims the same issue. A label add is not a
    // compare-and-swap. Worst case both work it; the random pick keeps that rare.
    const alreadyClaimed = yield* runGlabRead([
      "issue",
      "view",
      String(issue.iid),
      "--output",
      "json",
    ]).pipe(
      Effect.flatMap((output) => parseGlabJson(output, IssueSchema, ["issue", "view"])),
      Effect.map((view) => new Set(view.labels).has(LABELS.pickedByAgent)),
      Effect.catchAll(() => Effect.succeed(false)),
    );
    if (alreadyClaimed) {
      yield* Console.log(`  ↳ #${issue.iid} already claimed by another instance — skipping`);
      return { kind: STATE_FETCH_QUEUE };
    }

    const claim = yield* runGlabWrite([
      "issue",
      "update",
      String(issue.iid),
      "--label",
      LABELS.pickedByAgent,
    ]).pipe(Effect.either);
    if (claim._tag === "Left") {
      return failedState(
        { issue, branch: null, worktree: null, mergeRequestIid: null },
        `claim_issue: ${describeGitLabError(claim.left)}`,
      );
    }

    const banner = "─".repeat(80);
    yield* Console.log(
      `\n${banner}\n#${issue.iid} ${issue.title}\n${banner}\n${issue.body === "" ? "(no description)" : issue.body}\n${banner}\n`,
    );
    return { kind: "branch_worktree", issue };
  });

/** Branch_worktree — create the issue branch in a dedicated worktree, push it. */
const onBranchWorktree = (issue: IssueRef, env: Environment): Effect.Effect<State> =>
  Effect.gen(function* () {
    const branch = branchName(issue);
    const worktree = worktreePath(env.repoName, branch);

    const parentReady = yield* Effect.tryPromise(() =>
      mkdir(join(WORKTREES_DIR, env.repoName), { recursive: true }),
    ).pipe(Effect.either);
    if (parentReady._tag === "Left") {
      return failedState(
        { issue, branch: null, worktree: null, mergeRequestIid: null },
        "branch_worktree: could not create the worktree parent directory",
      );
    }

    // Re-entrancy: a crashed prior run may have left this branch and worktree
    // behind (the sweep removes only the worktree, not the branch). Clear both
    // so the `git worktree add -b` below starts from a clean slate.
    yield* runShell(() => $`git worktree remove --force ${worktree}`);
    yield* runShell(() => $`git worktree prune`);
    yield* runShell(() => $`git branch -D ${branch}`);

    const fetched = yield* runShell(() => $`git fetch origin ${env.defaultBranch}`);
    if (fetched.exitCode !== 0) {
      yield* Console.error(
        `  ⚠ git fetch failed — branching off a possibly-stale origin/${env.defaultBranch}`,
      );
    }
    const added = yield* runShell(
      () => $`git worktree add -b ${branch} ${worktree} origin/${env.defaultBranch}`,
    );
    if (added.exitCode !== 0) {
      return failedState(
        { issue, branch: null, worktree: null, mergeRequestIid: null },
        `branch_worktree: worktree add failed — ${added.stderr.trim()}`,
      );
    }

    yield* excludeStopHookConfig(worktree);

    const pushed = yield* runShellGit(worktree, ["push", "-u", "origin", branch]);
    if (pushed.exitCode !== 0) {
      return failedState(
        { issue, branch, worktree, mergeRequestIid: null },
        `branch_worktree: push failed — ${pushed.stderr.trim()}`,
      );
    }
    return { kind: "run_impl", issue, branch, worktree };
  });

/** Run_impl — start the budget, run the implementer phase. */
const onRunImpl = (state: Extract<State, { kind: "run_impl" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { issue, branch, worktree } = state;
    const deadline = Date.now() + ISSUE_BUDGET_MS;

    const outcome = yield* runPhase("run_impl", {
      issueIid: issue.iid,
      worktree,
      deadline,
      iteration: 0,
      replacements: {
        iid: String(issue.iid),
        title: issue.title,
        branch,
        worktree,
        body: issue.body === "" ? "(no description)" : issue.body,
      },
    });
    const known = { issue, branch, worktree, mergeRequestIid: null };
    if (!outcome.ok) {
      return failedState(known, `run_impl: ${outcome.reason}`);
    }
    if (outcome.verdict === "READY_FOR_REVIEW") {
      return { kind: "open_draft_mr", issue, branch, worktree, deadline };
    }
    if (outcome.verdict === "BLOCKER_SUSPECTED") {
      return failedState(known, "run_impl: the implementer reported a blocker");
    }
    return failedState(known, `run_impl: unexpected verdict ${outcome.verdict}`);
  });

/** Open_draft_mr — open the Draft MR (idempotent), recording its iid. */
const onOpenDraftMr = (
  state: Extract<State, { kind: "open_draft_mr" }>,
  env: Environment,
): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { issue, branch, worktree, deadline } = state;

    const existing = yield* findOpenMergeRequest(branch);
    if (existing !== undefined) {
      yield* Console.log(`  ↳ reusing open MR !${existing.iid} for ${branch}`);
      return {
        kind: "review",
        issue,
        branch,
        worktree,
        deadline,
        mergeRequestIid: existing.iid,
        fixCycles: 0,
      };
    }

    const description =
      `Closes #${issue.iid}\n\nImplemented and reviewed autonomously by the AFK orchestrator.\n\n` +
      `Run log: \`${runDir}\``;
    const created = yield* runGlabWrite([
      "mr",
      "create",
      "--draft",
      "--source-branch",
      branch,
      "--target-branch",
      env.defaultBranch,
      "--title",
      `[AFK] ${issue.title}`,
      "--description",
      description,
      "--remove-source-branch",
      "--squash-before-merge",
    ]).pipe(Effect.either);
    if (created._tag === "Left") {
      return failedState(
        { issue, branch, worktree, mergeRequestIid: null },
        `open_draft_mr: ${describeGitLabError(created.left)}`,
      );
    }

    // Read the iid back from `mr list` rather than scraping `mr create`'s
    // stdout — a structured query, not a brittle URL regex.
    const opened = yield* findOpenMergeRequest(branch);
    if (opened === undefined) {
      return failedState(
        { issue, branch, worktree, mergeRequestIid: null },
        "open_draft_mr: MR created but could not be found",
      );
    }
    yield* Console.log(`  ↳ Draft MR !${opened.iid} created for ${branch}`);
    return {
      kind: "review",
      issue,
      branch,
      worktree,
      deadline,
      mergeRequestIid: opened.iid,
      fixCycles: 0,
    };
  });

/** Review — run the review phase; `REVIEW_DONE` leads to evaluate. */
const onReview = (state: Extract<State, { kind: "review" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { fixCycles } = state;
    const outcome = yield* runMrPhase("review", state, fixCycles);
    if (!outcome.ok) {
      return failedState(state, `review[${fixCycles}]: ${outcome.reason}`);
    }
    if (outcome.verdict === "REVIEW_DONE") {
      return { kind: "evaluate", ...pipelineContext(state), fixCycles };
    }
    return failedState(state, `review[${fixCycles}]: unexpected verdict ${outcome.verdict}`);
  });

/** Evaluate — the convergence authority; `CONVERGED` leads to dogfood, `NEEDS_FIX` leads to fix. */
const onEvaluate = (state: Extract<State, { kind: "evaluate" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { fixCycles } = state;
    const outcome = yield* runMrPhase("evaluate", state, fixCycles);
    if (!outcome.ok) {
      return failedState(state, `evaluate[${fixCycles}]: ${outcome.reason}`);
    }
    if (outcome.verdict === "CONVERGED") {
      return { kind: STATE_RUN_DOGFOOD, ...pipelineContext(state) };
    }
    if (outcome.verdict === "NEEDS_FIX") {
      // The cap is on the number of fix sessions. A 4th NEEDS_FIX is a
      // structural disagreement, not a slow fix — end the issue for a human.
      if (MAX_FIX_CYCLES <= fixCycles) {
        return failedState(
          state,
          `fix_cycle_cap: ${MAX_FIX_CYCLES} fix cycles without convergence`,
        );
      }
      return { kind: "fix", ...pipelineContext(state), fixCycles };
    }
    return failedState(state, `evaluate[${fixCycles}]: unexpected verdict ${outcome.verdict}`);
  });

/** Fix — apply the verified fix instructions; `FIX_DONE` leads back to review. */
const onFix = (state: Extract<State, { kind: "fix" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { fixCycles } = state;
    const outcome = yield* runMrPhase("fix", state, fixCycles);
    if (!outcome.ok) {
      return failedState(state, `fix[${fixCycles}]: ${outcome.reason}`);
    }
    if (outcome.verdict === "FIX_DONE") {
      // The cycle is spent — carry the incremented count back into the loop.
      return { kind: "review", ...pipelineContext(state), fixCycles: fixCycles + 1 };
    }
    return failedState(state, `fix[${fixCycles}]: unexpected verdict ${outcome.verdict}`);
  });

/** Run_dogfood — the runtime gate; `DOGFOOD_PASS` leads to merge. */
const onRunDogfood = (state: Extract<State, { kind: "run_dogfood" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const outcome = yield* runMrPhase(STATE_RUN_DOGFOOD, state, 0);
    if (!outcome.ok) {
      return failedState(state, `${STATE_RUN_DOGFOOD}: ${outcome.reason}`);
    }
    if (outcome.verdict === "DOGFOOD_PASS") {
      return { kind: "merge", ...pipelineContext(state) };
    }
    if (outcome.verdict === "DOGFOOD_FAIL") {
      return failedState(
        state,
        `${STATE_RUN_DOGFOOD}: the runtime dogfood gate found an in-scope bug`,
      );
    }
    return failedState(state, `${STATE_RUN_DOGFOOD}: unexpected verdict ${outcome.verdict}`);
  });

/** Merge — un-draft the MR and merge it, verifying on a non-zero exit. */
const onMerge = (state: Extract<State, { kind: "merge" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { issue, worktree, mergeRequestIid } = state;
    const id = String(mergeRequestIid);

    const readied = yield* runGlabWrite(["mr", "update", id, "--ready"]).pipe(Effect.either);
    if (readied._tag === "Left") {
      return failedState(state, `merge: could not un-draft — ${describeGitLabError(readied.left)}`);
    }

    const merged = yield* runGlabWrite([
      "mr",
      "merge",
      id,
      "--yes",
      "--squash",
      "--auto-merge",
    ]).pipe(Effect.either);
    if (merged._tag === "Right") {
      return { kind: "done", issue, worktree, mergeRequestIid };
    }

    // `glab mr merge` can exit non-zero while the MR is in fact merged or
    // queued — verify the state before failing. `closed` ≠ `merged`.
    const isMerged = yield* runGlabRead(["mr", "view", id, "--output", "json"]).pipe(
      Effect.flatMap((output) => parseGlabJson(output, MergeRequestSchema, ["mr", "view"])),
      Effect.map((mr) => mr.state === "merged"),
      Effect.catchAll(() => Effect.succeed(false)),
    );
    if (isMerged) {
      return { kind: "done", issue, worktree, mergeRequestIid };
    }
    return failedState(state, `merge: ${describeGitLabError(merged.left)}`);
  });

/** Done — unlabel the issue, remove the worktree, loop back to the queue. */
const onDone = (state: Extract<State, { kind: "done" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { issue, worktree, mergeRequestIid } = state;
    const unlabelOne = (label: string) =>
      runGlabWrite(["issue", "update", String(issue.iid), "--unlabel", label]).pipe(
        Effect.catchAll((error) =>
          Console.error(
            `  ⚠ #${issue.iid}: unlabel ${label} failed — ${describeGitLabError(error)}`,
          ),
        ),
      );
    for (const label of [LABELS.pickedByAgent, LABELS.readyForAgent]) {
      yield* unlabelOne(label);
    }
    const removed = yield* runShell(() => $`git worktree remove ${worktree} --force`);
    if (removed.exitCode !== 0) {
      yield* Console.error(`  ⚠ worktree removal failed: ${removed.stderr.trim().slice(0, 160)}`);
    }
    yield* runShell(() => $`git worktree prune`);
    yield* Console.log(`  ✓ #${issue.iid} merged (!${mergeRequestIid})`);
    return { kind: STATE_FETCH_QUEUE };
  });

/** Failed — note the failure on the issue, label it, loop back to the queue. */
const onFailed = (state: Extract<State, { kind: "failed" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { reason, mergeRequestIid, worktree, issue } = state;
    const note = [
      `**AFK failed** — ${reason}`,
      "",
      `- Run log: \`${runLogPath}\``,
      mergeRequestIid === null ? null : `- Draft MR (left for inspection): !${mergeRequestIid}`,
      worktree === null ? null : `- Worktree (left for inspection): \`${worktree}\``,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    yield* runGlabWrite(["issue", "note", String(issue.iid), "--message", note]).pipe(
      Effect.catchAll((error) =>
        Console.error(
          `  ⚠ #${issue.iid}: could not post the failure note — ${describeGitLabError(error)}`,
        ),
      ),
    );
    yield* runGlabWrite([
      "issue",
      "update",
      String(issue.iid),
      "--label",
      LABELS.failedByAgent,
      "--unlabel",
      LABELS.pickedByAgent,
    ]).pipe(
      Effect.catchAll((error) =>
        Console.error(
          `  ⚠ #${issue.iid}: could not set ${LABELS.failedByAgent} — ${describeGitLabError(error)}`,
        ),
      ),
    );
    return { kind: STATE_FETCH_QUEUE };
  });

// ─── The step dispatcher ───────────────────────────────────────────────────

/**
 * Advance the machine by one state.
 *
 * Only `fetch_queue` can fail — a `GitLabError` reading the queue is fatal.
 * Every other handler routes its own failures into a `failed` state.
 */
export const step = (current: State, env: Environment): Effect.Effect<State, GitLabError> => {
  switch (current.kind) {
    case "fetch_queue": {
      return onFetchQueue;
    }
    case "claim_issue": {
      return onClaimIssue(current.issue);
    }
    case "branch_worktree": {
      return onBranchWorktree(current.issue, env);
    }
    case "run_impl": {
      return onRunImpl(current);
    }
    case "open_draft_mr": {
      return onOpenDraftMr(current, env);
    }
    case "review": {
      return onReview(current);
    }
    case "evaluate": {
      return onEvaluate(current);
    }
    case "fix": {
      return onFix(current);
    }
    case "run_dogfood": {
      return onRunDogfood(current);
    }
    case "merge": {
      return onMerge(current);
    }
    case "done": {
      return onDone(current);
    }
    case "failed": {
      return onFailed(current);
    }
    case "end": {
      return Effect.die("step was called on the end state");
    }
    default: {
      // Exhaustiveness: a new State variant without a case here is a compile error.
      const unreachable: never = current;
      return Effect.die(`unhandled state: ${JSON.stringify(unreachable)}`);
    }
  }
};
