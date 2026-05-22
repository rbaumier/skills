/**
 * pipeline/handlers.ts — one handler per state, plus the `step` dispatcher.
 *
 * Each handler takes its narrowed state variant and returns the next state.
 * Only `fetch_queue` can fail (a `GitLabError` reading the queue is fatal —
 * we cannot run blind); every other handler routes its own failures into a
 * `failed` state, so it returns `Effect<State>` (never fails).
 */
import { $ } from "bun"
import { existsSync } from "node:fs"
import { appendFile, mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { Console, Effect } from "effect"
import { z } from "zod"
import { ISSUE_BUDGET_MS, LABELS, MAX_FIX_CYCLES, type Phase, WORKTREES_DIR } from "../config"
import { runShell } from "../shell"
import { describeGitLabError, type GitLabError } from "../gitlab/errors"
import { parseGlabJson, runGlabRead, runGlabWrite } from "../gitlab/glab"
import { type GitLabMergeRequest, IssueSchema, MergeRequestSchema } from "../gitlab/schema"
import type { Environment } from "../preflight"
import { runDir, runLogPath } from "../run-artifacts"
import { describePhaseError } from "../session/errors"
import { phaseTimeoutMs, runPhaseSession } from "../session/phase"
import type { VerdictToken } from "../session/verdict"
import { branchName, worktreePath } from "./naming"
import type { IssueRef, PipelineContext, State } from "./state"

// ─── Handler helpers ───────────────────────────────────────────────────────

/** The outcome of a phase, flattened for routing: a verdict, or a fail reason. */
type PhaseOutcome =
  | { readonly ok: true; readonly verdict: VerdictToken }
  | { readonly ok: false; readonly reason: string }

/** Build a `failed` state from whatever the failing handler knew. */
const failedState = (
  known: {
    readonly issue: IssueRef
    readonly branch?: string
    readonly worktree?: string
    readonly mergeRequestIid?: number
  },
  reason: string,
): State => ({
  kind: "failed",
  issue: known.issue,
  branch: known.branch ?? null,
  worktree: known.worktree ?? null,
  mergeRequestIid: known.mergeRequestIid ?? null,
  reason,
})

/** The five shared pipeline fields, copied off any node that carries them. */
const pipelineContext = (state: PipelineContext): PipelineContext => ({
  issue: state.issue,
  branch: state.branch,
  worktree: state.worktree,
  deadline: state.deadline,
  mergeRequestIid: state.mergeRequestIid,
})

/**
 * Run one phase and flatten its outcome — the single adapter from the typed
 * phase-error channel to a routable {@link PhaseOutcome}. Used by every phase.
 */
const runPhase = (
  phase: Phase,
  options: {
    readonly issueIid: number
    readonly worktree: string
    readonly deadline: number
    readonly iteration: number
    readonly replacements: Record<string, string>
  },
): Effect.Effect<PhaseOutcome> =>
  runPhaseSession({
    phase,
    issueIid: options.issueIid,
    worktree: options.worktree,
    iteration: options.iteration,
    timeoutMs: phaseTimeoutMs(phase, options.deadline),
    replacements: options.replacements,
  }).pipe(
    Effect.map((verdict): PhaseOutcome => ({ ok: true, verdict })),
    Effect.catchAll((error): Effect.Effect<PhaseOutcome> =>
      Effect.succeed({ ok: false, reason: describePhaseError(error) }),
    ),
  )

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
  })

/** Find the open merge request for a branch, if any. Never fails. */
const findOpenMergeRequest = (branch: string): Effect.Effect<GitLabMergeRequest | undefined> => {
  const command = ["mr", "list", "--source-branch", branch, "--output", "json"]
  return runGlabRead(command).pipe(
    Effect.flatMap((output) =>
      parseGlabJson(output.trim() === "" ? "[]" : output, z.array(MergeRequestSchema), command),
    ),
    Effect.map((mergeRequests) => mergeRequests.find((mr) => mr.state === "opened")),
    Effect.catchAll(() => Effect.succeed(undefined)),
  )
}

/**
 * Exclude `.claude/settings.local.json` from git in a fresh worktree, via the
 * repo's git exclude file — so a phase agent's `git add -A` cannot commit the
 * orchestrator's Stop-hook config into the MR. Best-effort: a failure is
 * logged, not fatal.
 */
const excludeStopHookConfig = (worktree: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    const probe = yield* runShellGit(worktree, ["rev-parse", "--path-format=absolute", "--git-common-dir"])
    if (probe.exitCode !== 0) return
    const excludeFile = join(probe.stdout.trim(), "info", "exclude")
    yield* Effect.tryPromise(async () => {
      const current = existsSync(excludeFile) ? await readFile(excludeFile, "utf8") : ""
      if (!current.split("\n").includes(".claude/settings.local.json")) {
        const separator = current === "" || current.endsWith("\n") ? "" : "\n"
        await appendFile(excludeFile, `${separator}.claude/settings.local.json\n`)
      }
    }).pipe(
      Effect.catchAll(() => Console.error("  ⚠ could not update the git exclude for .claude/")),
    )
  })

/** Run `git -C <worktree> <args>` and capture the result. */
const runShellGit = (worktree: string, args: ReadonlyArray<string>) =>
  runShell(() => $`git -C ${worktree} ${args}`)

// ─── State handlers ────────────────────────────────────────────────────────

/** fetch_queue — read the ready queue, pick one issue at random, or end. */
const onFetchQueue: Effect.Effect<State, GitLabError> = Effect.gen(function* () {
  const command = [
    "issue", "list",
    "--label", LABELS.readyForAgent,
    "--not-label", LABELS.failedByAgent,
    "--not-label", LABELS.pickedByAgent,
    "--per-page", "100", "--output", "json",
  ]
  const output = yield* runGlabRead(command)
  const issues = output.trim() === "" ? [] : yield* parseGlabJson(output, z.array(IssueSchema), command)
  if (issues.length === 0) return { kind: "end" }

  // Random pick keeps multi-instance collisions probabilistically rare.
  const picked = issues[Math.floor(Math.random() * issues.length)]!
  return {
    kind: "claim_issue",
    issue: { iid: picked.iid, title: picked.title, body: picked.description ?? "" },
  }
})

/** claim_issue — re-check the labels, then claim by adding `picked-by-agent`. */
const onClaimIssue = (issue: IssueRef): Effect.Effect<State> =>
  Effect.gen(function* () {
    // Re-read the labels right before claiming. This narrows — but does not
    // close — the window where another instance claims the same issue: a
    // label add is not a compare-and-swap. Worst case both work it; the
    // random queue pick keeps that rare.
    const alreadyClaimed = yield* runGlabRead([
      "issue", "view", String(issue.iid), "--output", "json",
    ]).pipe(
      Effect.flatMap((output) => parseGlabJson(output, IssueSchema, ["issue", "view"])),
      Effect.map((view) => view.labels.includes(LABELS.pickedByAgent)),
      Effect.catchAll(() => Effect.succeed(false)),
    )
    if (alreadyClaimed) {
      yield* Console.log(`  ↳ #${issue.iid} already claimed by another instance — skipping`)
      return { kind: "fetch_queue" }
    }

    const claim = yield* runGlabWrite([
      "issue", "update", String(issue.iid), "--label", LABELS.pickedByAgent,
    ]).pipe(Effect.either)
    if (claim._tag === "Left") {
      return failedState({ issue }, `claim_issue: ${describeGitLabError(claim.left)}`)
    }

    const banner = "─".repeat(80)
    yield* Console.log(
      `\n${banner}\n#${issue.iid} ${issue.title}\n${banner}\n${issue.body || "(no description)"}\n${banner}\n`,
    )
    return { kind: "branch_worktree", issue }
  })

/** branch_worktree — create the issue branch in a dedicated worktree, push it. */
const onBranchWorktree = (issue: IssueRef, env: Environment): Effect.Effect<State> =>
  Effect.gen(function* () {
    const branch = branchName(issue)
    const worktree = worktreePath(env.repoName, branch)

    const parentReady = yield* Effect.tryPromise(() =>
      mkdir(join(WORKTREES_DIR, env.repoName), { recursive: true }),
    ).pipe(Effect.either)
    if (parentReady._tag === "Left") {
      return failedState({ issue }, "branch_worktree: could not create the worktree parent directory")
    }

    yield* runShell(() => $`git fetch origin ${env.defaultBranch}`)
    const added = yield* runShell(() =>
      $`git worktree add -b ${branch} ${worktree} origin/${env.defaultBranch}`,
    )
    if (added.exitCode !== 0) {
      return failedState({ issue }, `branch_worktree: worktree add failed — ${added.stderr.trim()}`)
    }

    yield* excludeStopHookConfig(worktree)

    const pushed = yield* runShellGit(worktree, ["push", "-u", "origin", branch])
    if (pushed.exitCode !== 0) {
      return failedState({ issue, branch, worktree }, `branch_worktree: push failed — ${pushed.stderr.trim()}`)
    }
    return { kind: "run_impl", issue, branch, worktree }
  })

/** run_impl — start the budget, run the implementer phase. */
const onRunImpl = (state: Extract<State, { kind: "run_impl" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { issue, branch, worktree } = state
    const deadline = Date.now() + ISSUE_BUDGET_MS

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
        body: issue.body || "(no description)",
      },
    })
    if (!outcome.ok) return failedState({ issue, branch, worktree }, `run_impl: ${outcome.reason}`)
    if (outcome.verdict === "READY_FOR_REVIEW") {
      return { kind: "open_draft_mr", issue, branch, worktree, deadline }
    }
    return failedState({ issue, branch, worktree }, `run_impl: unexpected verdict ${outcome.verdict}`)
  })

/** open_draft_mr — open the Draft MR (idempotent), recording its iid. */
const onOpenDraftMr = (
  state: Extract<State, { kind: "open_draft_mr" }>,
  env: Environment,
): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { issue, branch, worktree, deadline } = state

    const existing = yield* findOpenMergeRequest(branch)
    if (existing !== undefined) {
      yield* Console.log(`  ↳ reusing open MR !${existing.iid} for ${branch}`)
      return { kind: "review", issue, branch, worktree, deadline, mergeRequestIid: existing.iid, fixCycles: 0 }
    }

    const description =
      `Closes #${issue.iid}\n\nImplemented and reviewed autonomously by the AFK orchestrator.\n\n` +
      `Run log: \`${runDir}\``
    const created = yield* runGlabWrite([
      "mr", "create", "--draft",
      "--source-branch", branch,
      "--target-branch", env.defaultBranch,
      "--title", `[AFK] ${issue.title}`,
      "--description", description,
      "--remove-source-branch", "--squash-before-merge",
    ]).pipe(Effect.either)
    if (created._tag === "Left") {
      return failedState({ issue, branch, worktree }, `open_draft_mr: ${describeGitLabError(created.left)}`)
    }

    // Read the iid back from `mr list` rather than scraping `mr create`'s
    // stdout — a structured query, not a brittle URL regex.
    const opened = yield* findOpenMergeRequest(branch)
    if (opened === undefined) {
      return failedState({ issue, branch, worktree }, "open_draft_mr: MR created but could not be found")
    }
    yield* Console.log(`  ↳ Draft MR !${opened.iid} created for ${branch}`)
    return { kind: "review", issue, branch, worktree, deadline, mergeRequestIid: opened.iid, fixCycles: 0 }
  })

/** review — run the review phase; `REVIEW_DONE` → evaluate. */
const onReview = (state: Extract<State, { kind: "review" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const outcome = yield* runMrPhase("review", state, state.fixCycles)
    if (!outcome.ok) return failedState(state, `review[${state.fixCycles}]: ${outcome.reason}`)
    if (outcome.verdict === "REVIEW_DONE") {
      return { kind: "evaluate", ...pipelineContext(state), fixCycles: state.fixCycles }
    }
    return failedState(state, `review[${state.fixCycles}]: unexpected verdict ${outcome.verdict}`)
  })

/** evaluate — the convergence authority; `CONVERGED` → dogfood, `NEEDS_FIX` → fix. */
const onEvaluate = (state: Extract<State, { kind: "evaluate" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const outcome = yield* runMrPhase("evaluate", state, state.fixCycles)
    if (!outcome.ok) return failedState(state, `evaluate[${state.fixCycles}]: ${outcome.reason}`)
    if (outcome.verdict === "CONVERGED") {
      return { kind: "run_dogfood", ...pipelineContext(state) }
    }
    if (outcome.verdict === "NEEDS_FIX") {
      // The cap is on the number of fix sessions: a 4th NEEDS_FIX is a
      // structural disagreement, not a slow fix — end the issue for a human.
      if (state.fixCycles >= MAX_FIX_CYCLES) {
        return failedState(state, `fix_cycle_cap: ${MAX_FIX_CYCLES} fix cycles without convergence`)
      }
      return { kind: "fix", ...pipelineContext(state), fixCycles: state.fixCycles }
    }
    return failedState(state, `evaluate[${state.fixCycles}]: unexpected verdict ${outcome.verdict}`)
  })

/** fix — apply the verified fix instructions; `FIX_DONE` → back to review. */
const onFix = (state: Extract<State, { kind: "fix" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const outcome = yield* runMrPhase("fix", state, state.fixCycles)
    if (!outcome.ok) return failedState(state, `fix[${state.fixCycles}]: ${outcome.reason}`)
    if (outcome.verdict === "FIX_DONE") {
      // The cycle is spent — carry the incremented count back into the loop.
      return { kind: "review", ...pipelineContext(state), fixCycles: state.fixCycles + 1 }
    }
    return failedState(state, `fix[${state.fixCycles}]: unexpected verdict ${outcome.verdict}`)
  })

/** run_dogfood — the runtime gate; `DOGFOOD_PASS` → merge. */
const onRunDogfood = (state: Extract<State, { kind: "run_dogfood" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const outcome = yield* runMrPhase("run_dogfood", state, 0)
    if (!outcome.ok) return failedState(state, `run_dogfood: ${outcome.reason}`)
    if (outcome.verdict === "DOGFOOD_PASS") {
      return { kind: "merge", ...pipelineContext(state) }
    }
    return failedState(state, `run_dogfood: unexpected verdict ${outcome.verdict}`)
  })

/** merge — un-draft the MR and merge it, verifying on a non-zero exit. */
const onMerge = (state: Extract<State, { kind: "merge" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { issue, worktree, mergeRequestIid } = state
    const id = String(mergeRequestIid)

    const readied = yield* runGlabWrite(["mr", "update", id, "--ready"]).pipe(Effect.either)
    if (readied._tag === "Left") {
      return failedState(state, `merge: could not un-draft — ${describeGitLabError(readied.left)}`)
    }

    const merged = yield* runGlabWrite([
      "mr", "merge", id, "--yes", "--squash", "--auto-merge",
    ]).pipe(Effect.either)
    if (merged._tag === "Right") {
      return { kind: "done", issue, worktree, mergeRequestIid }
    }

    // `glab mr merge` can exit non-zero while the MR is in fact merged or
    // queued — verify the state before failing. `closed` ≠ `merged`.
    const isMerged = yield* runGlabRead(["mr", "view", id, "--output", "json"]).pipe(
      Effect.flatMap((output) => parseGlabJson(output, MergeRequestSchema, ["mr", "view"])),
      Effect.map((mr) => mr.state === "merged"),
      Effect.catchAll(() => Effect.succeed(false)),
    )
    if (isMerged) {
      return { kind: "done", issue, worktree, mergeRequestIid }
    }
    return failedState(state, `merge: ${describeGitLabError(merged.left)}`)
  })

/** done — unlabel the issue, remove the worktree, loop back to the queue. */
const onDone = (state: Extract<State, { kind: "done" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const { issue, worktree, mergeRequestIid } = state
    for (const label of [LABELS.pickedByAgent, LABELS.readyForAgent]) {
      yield* runGlabWrite(["issue", "update", String(issue.iid), "--unlabel", label]).pipe(
        Effect.catchAll((error) =>
          Console.error(`  ⚠ #${issue.iid}: unlabel ${label} failed — ${describeGitLabError(error)}`),
        ),
      )
    }
    const removed = yield* runShell(() => $`git worktree remove ${worktree} --force`)
    if (removed.exitCode !== 0) {
      yield* Console.error(`  ⚠ worktree removal failed: ${removed.stderr.trim().slice(0, 160)}`)
    }
    yield* runShell(() => $`git worktree prune`)
    yield* Console.log(`  ✓ #${issue.iid} merged (!${mergeRequestIid})`)
    return { kind: "fetch_queue" }
  })

/** failed — note the failure on the issue, label it, loop back to the queue. */
const onFailed = (state: Extract<State, { kind: "failed" }>): Effect.Effect<State> =>
  Effect.gen(function* () {
    const note = [
      `**AFK failed** — ${state.reason}`,
      "",
      `- Run log: \`${runLogPath}\``,
      state.mergeRequestIid !== null ? `- Draft MR (left for inspection): !${state.mergeRequestIid}` : null,
      state.worktree !== null ? `- Worktree (left for inspection): \`${state.worktree}\`` : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n")

    yield* runGlabWrite(["issue", "note", String(state.issue.iid), "--message", note]).pipe(
      Effect.catchAll((error) =>
        Console.error(`  ⚠ #${state.issue.iid}: could not post the failure note — ${describeGitLabError(error)}`),
      ),
    )
    yield* runGlabWrite([
      "issue", "update", String(state.issue.iid),
      "--label", LABELS.failedByAgent,
      "--unlabel", LABELS.pickedByAgent,
    ]).pipe(
      Effect.catchAll((error) =>
        Console.error(`  ⚠ #${state.issue.iid}: could not set ${LABELS.failedByAgent} — ${describeGitLabError(error)}`),
      ),
    )
    return { kind: "fetch_queue" }
  })

// ─── The step dispatcher ───────────────────────────────────────────────────

/**
 * Advance the machine by one state. Only `fetch_queue` can fail — a
 * `GitLabError` reading the queue is fatal; every other handler routes its
 * own failures into a `failed` state.
 */
export const step = (state: State, env: Environment): Effect.Effect<State, GitLabError> => {
  switch (state.kind) {
    case "fetch_queue":
      return onFetchQueue
    case "claim_issue":
      return onClaimIssue(state.issue)
    case "branch_worktree":
      return onBranchWorktree(state.issue, env)
    case "run_impl":
      return onRunImpl(state)
    case "open_draft_mr":
      return onOpenDraftMr(state, env)
    case "review":
      return onReview(state)
    case "evaluate":
      return onEvaluate(state)
    case "fix":
      return onFix(state)
    case "run_dogfood":
      return onRunDogfood(state)
    case "merge":
      return onMerge(state)
    case "done":
      return onDone(state)
    case "failed":
      return onFailed(state)
    case "end":
      return Effect.die("step was called on the end state")
    default: {
      // Exhaustiveness: a new State variant without a case here is a compile error.
      const unreachable: never = state
      return Effect.die(`unhandled state: ${JSON.stringify(unreachable)}`)
    }
  }
}
