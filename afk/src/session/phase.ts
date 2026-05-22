/**
 * session/phase.ts — running one pipeline phase as a fresh `claude` tmux session.
 *
 * `runPhaseSession` is the load-bearing helper: it writes the Stop-hook
 * config, renders the prompt, and drives a tmux session to a verdict — with
 * the session held in an `acquireUseRelease` bracket so it is always killed,
 * on every exit path (verdict returned, timeout, defect, or Ctrl-C).
 *
 * Every failure is one of the typed errors in `./errors` — no catch-all.
 */
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Console, Effect } from "effect"
import { type Phase, PHASE_CAP_MINUTES, SENTINEL_POLL_MS } from "../config"
import { promptFilePath, sentinelPath, sessionName, tmuxLogPath } from "../run-artifacts"
import { BudgetExhausted, NoVerdict, type PhaseError, SessionTimedOut, WorkspaceError } from "./errors"
import { renderPrompt } from "./prompt"
import { createSession, killSession, startClaudeAndPaste } from "./tmux"
import { parseVerdict, type VerdictToken } from "./verdict"

/**
 * Write the Claude Code Stop-hook config into a worktree's `.claude/`.
 *
 * The hook is non-blocking: on every Stop it dumps the payload's
 * `last_assistant_message` into `sentinel`, written atomically (`.tmp` then
 * `mv`) so the poller never sees a half-written file. Registered for both
 * `Stop` and `StopFailure`. Every path is double-quoted — `jq`/`mv` run
 * through a shell and the worktree path may contain spaces.
 */
const writeStopHookConfig = (
  phase: Phase,
  worktree: string,
  sentinel: string,
): Effect.Effect<void, WorkspaceError> =>
  Effect.tryPromise({
    try: async () => {
      const claudeDir = join(worktree, ".claude")
      await mkdir(claudeDir, { recursive: true })
      const command =
        `jq -r '.last_assistant_message // empty' > "${sentinel}.tmp" ` +
        `&& mv "${sentinel}.tmp" "${sentinel}"`
      const hookEntry = [{ matcher: "", hooks: [{ type: "command", command }] }]
      await writeFile(
        join(claudeDir, "settings.local.json"),
        JSON.stringify({ hooks: { Stop: hookEntry, StopFailure: hookEntry } }, null, 2),
      )
    },
    catch: (cause) =>
      new WorkspaceError({ phase, operation: "write the Stop-hook config", reason: String(cause) }),
  })

/**
 * A phase's session timeout: the smaller of its per-phase cap and the budget
 * still left for the issue. There is deliberately no floor — when the result
 * is below one poll interval, `runPhaseSession` refuses to spawn.
 */
export const phaseTimeoutMs = (phase: Phase, deadlineMs: number): number =>
  Math.min(PHASE_CAP_MINUTES[phase] * 60 * 1000, deadlineMs - Date.now())

/**
 * Poll `sentinel` every {@link SENTINEL_POLL_MS} until it appears or the
 * timeout elapses, then return the verdict — or fail with {@link SessionTimedOut}
 * / {@link NoVerdict} (never a false *proceed*).
 *
 * Killing the tmux session is not this function's job — the bracket in
 * `runPhaseSession` owns the session and kills it on every exit.
 */
const pollSentinel = (
  phase: Phase,
  sentinel: string,
  timeoutMs: number,
): Effect.Effect<VerdictToken, SessionTimedOut | NoVerdict | WorkspaceError> =>
  Effect.gen(function* () {
    const startedAt = Date.now()

    // Stack-safe poll loop: sleep one interval per tick until the sentinel
    // appears or the timeout elapses. The interruptible sleep also lets a
    // Ctrl-C unwind the wait promptly.
    yield* Effect.iterate(0, {
      while: () => !existsSync(sentinel) && Date.now() - startedAt <= timeoutMs,
      body: (tick) => Effect.as(Effect.sleep(`${SENTINEL_POLL_MS} millis`), tick + 1),
    })

    if (!existsSync(sentinel)) {
      return yield* Effect.fail(new SessionTimedOut({ phase, elapsedMs: Date.now() - startedAt }))
    }

    const message = yield* Effect.tryPromise({
      try: () => readFile(sentinel, "utf8"),
      catch: (cause) =>
        new WorkspaceError({ phase, operation: "read the sentinel", reason: String(cause) }),
    })
    const verdict = parseVerdict(message)
    if (verdict === null) {
      return yield* Effect.fail(
        new NoVerdict({ phase, captured: message.trim().replace(/\n/g, " ") }),
      )
    }
    return verdict
  })

/**
 * Run one phase as a fresh `claude` tmux session and return its verdict.
 *
 * The tmux session is an `acquireUseRelease` resource: `createSession` is the
 * acquire, `killSession` the release — guaranteed to run on every exit of
 * `use` (verdict returned, timeout, an unexpected defect, or interruption).
 */
export const runPhaseSession = (input: {
  readonly phase: Phase
  readonly issueIid: number
  readonly worktree: string
  readonly iteration: number
  readonly timeoutMs: number
  readonly replacements: Record<string, string>
}): Effect.Effect<VerdictToken, PhaseError> =>
  Effect.gen(function* () {
    const { phase, issueIid, worktree, iteration, timeoutMs, replacements } = input

    // A budget below one poll interval can never yield a verdict in time —
    // fail now rather than spawn a session that is killed mid-boot.
    if (timeoutMs < SENTINEL_POLL_MS) {
      return yield* Effect.fail(new BudgetExhausted({ phase }))
    }

    const session = sessionName(issueIid, phase, iteration)
    const sentinel = sentinelPath(issueIid, phase, iteration)
    const tmuxLog = tmuxLogPath(issueIid, phase, iteration)
    const promptFile = promptFilePath(issueIid, phase, iteration)

    yield* writeStopHookConfig(phase, worktree, sentinel)
    const rendered = yield* renderPrompt(phase, replacements)
    yield* Effect.tryPromise({
      try: () => writeFile(promptFile, rendered),
      catch: (cause) =>
        new WorkspaceError({ phase, operation: "write the prompt file", reason: String(cause) }),
    })
    // Clear any stale session of the same name from a crashed prior run.
    yield* killSession(session)

    return yield* Effect.acquireUseRelease(
      createSession(session, worktree),
      () =>
        Effect.gen(function* () {
          yield* startClaudeAndPaste({ session, tmuxLogPath: tmuxLog, promptFile })
          yield* Console.log(`  ↳ ${phase}: tmux attach -r -t ${session}   ·   tail -f ${tmuxLog}`)
          return yield* pollSentinel(phase, sentinel, timeoutMs)
        }),
      () => killSession(session),
    )
  })
