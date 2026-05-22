/**
 * pipeline/machine.ts — the top-level loop that drives `step` to `end`.
 *
 * One transition at a time: run the handler, time it, print and log the
 * transition, repeat until the machine reaches `end`.
 */
import { Console, Effect } from "effect"
import type { GitLabError } from "../gitlab/errors"
import type { Environment } from "../preflight"
import { logEvent, runDir } from "../run-artifacts"
import { step } from "./handlers"
import type { IssueRef, State } from "./state"

/** Shorten `text` to at most `maxLength` characters, with an ellipsis. */
const truncate = (text: string, maxLength: number): string =>
  text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`

/** Render a millisecond duration as a compact human string (`1m05s`, `4.2s`). */
const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) return `${milliseconds}ms`
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)}s`
  const minutes = Math.floor(milliseconds / 60_000)
  const seconds = Math.floor((milliseconds % 60_000) / 1000)
  return `${minutes}m${seconds.toString().padStart(2, "0")}s`
}

/** One console line describing a state transition. */
const formatTransition = (transition: {
  readonly issue: IssueRef | null
  readonly from: string
  readonly to: string
  readonly elapsedMs: number
  readonly note: string | undefined
}): string => {
  const prefix = transition.issue
    ? `[#${transition.issue.iid} "${truncate(transition.issue.title, 50)}"]`
    : "[—]"
  const tail = transition.note ? ` — ${transition.note}` : ""
  return (
    `${prefix} ${transition.from.toUpperCase()} → ${transition.to.toUpperCase()} ` +
    `(${formatDuration(transition.elapsedMs)})${tail}`
  )
}

/** The issue a state is about, or `null` for the queue-level states. */
const issueOf = (state: State): IssueRef | null => ("issue" in state ? state.issue : null)

/** Run one handler, then print and log the transition it produced. */
const advance = (state: State, env: Environment): Effect.Effect<State, GitLabError> =>
  Effect.gen(function* () {
    const startedAt = Date.now()
    const next = yield* step(state, env)
    const elapsedMs = Date.now() - startedAt

    const issue = issueOf(state) ?? issueOf(next)
    const note = next.kind === "failed" ? next.reason : undefined

    yield* Console.log(formatTransition({ issue, from: state.kind, to: next.kind, elapsedMs, note }))
    yield* logEvent({
      event: "transition",
      from: state.kind,
      to: next.kind,
      elapsedMs,
      issue: issue ? { iid: issue.iid, title: issue.title } : null,
      note,
    })
    return next
  })

/**
 * Drive the machine from `fetch_queue` to `end`. A `GitLabError` (the fatal
 * queue-read failure) is the only way this fails; every other failure is a
 * `failed` state the loop walks through.
 */
export const runMachine = (env: Environment): Effect.Effect<void, GitLabError> =>
  Effect.gen(function* () {
    yield* Console.log(
      `AFK orchestrator starting. Repo: ${env.repoName}, default branch: ${env.defaultBranch}`,
    )
    yield* Console.log(`Run dir: ${runDir}\n`)
    yield* logEvent({ event: "run_start", repo: env.repoName, defaultBranch: env.defaultBranch })

    yield* Effect.iterate({ kind: "fetch_queue" } as State, {
      while: (state) => state.kind !== "end",
      body: (state) => advance(state, env),
    })

    yield* logEvent({ event: "run_end" })
    yield* Console.log("\nAFK done. Worktrees and run logs left under ~/.afk-runs/ and ~/.afk-worktrees/.")
  })
