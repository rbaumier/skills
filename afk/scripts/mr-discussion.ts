#!/usr/bin/env bun
/**
 * mr-discussion.ts — the AFK pipeline's GitLab MR-discussion helper.
 *
 * The decomposed pipeline uses the merge request's **discussions** as the
 * shared review medium (no /tmp/ files): `review` posts findings, `evaluate`
 * replies + resolves, `fix` resolves what it fixed, convergence = no
 * unresolved blocking discussion. This helper is the single deterministic
 * place that wraps `glab api` so the phase-session prompts never have to
 * hand-build API calls.
 *
 * Subcommands:
 *   post    --mr <iid> --body <text> [--dry-run]        create a general resolvable discussion
 *   list    --mr <iid>                                  all discussions as JSON
 *   resolve --mr <iid> --discussion <id>                resolve one thread
 *   reply   --mr <iid> --discussion <id> --body <text>  add a note to an existing thread
 *
 * Only **general** discussions are used — no diff-position objects (those
 * break on every rebase). The finding's `file:line` lives in the body text.
 *
 * Effect is used for the robustness this needs: typed errors and a jittered
 * exponential retry on transient `glab` failures.
 *
 * Usage: bun ~/.claude/skills/afk/scripts/mr-discussion.ts <subcommand> [flags]
 * Requires: glab (authenticated), run from inside the target repo.
 */
import { Cause, Data, Effect, Exit } from "effect"
import { toDiscussionSummary } from "../src/discussion"
import { GlabError, parseJson, runGlab } from "../src/glab"

// ─── Errors ────────────────────────────────────────────────────────────

/** The CLI was invoked with missing or invalid arguments. */
class UsageError extends Data.TaggedError("UsageError")<{
  readonly message: string
}> {}

// ─── Subcommands ───────────────────────────────────────────────────────

const discussionsEndpoint = (mr: string): string =>
  `projects/:id/merge_requests/${mr}/discussions`

/** Create a general resolvable discussion carrying `body`. */
const post = (mr: string, body: string, dryRun: boolean): Effect.Effect<string, GlabError> => {
  const args = ["api", discussionsEndpoint(mr), "-X", "POST", "-f", `body=${body}`]
  if (dryRun) return Effect.succeed(`[dry-run] glab ${args.join(" ")}`)
  return runGlab(args).pipe(
    Effect.flatMap((out) => parseJson(out, args)),
    Effect.map((raw) => `posted discussion ${toDiscussionSummary(raw).id}`),
  )
}

/** List every discussion on the MR as a JSON array of {@link DiscussionSummary}. */
const list = (mr: string): Effect.Effect<string, GlabError> => {
  const args = ["api", "--paginate", discussionsEndpoint(mr)]
  return runGlab(args).pipe(
    Effect.flatMap((out) =>
      // An MR with no discussions is a normal state, not an error — and some
      // glab versions print nothing rather than `[]`.
      out.trim() === ""
        ? Effect.succeed<unknown>([])
        : parseJson(out, args),
    ),
    Effect.map((raw) => {
      const arr: ReadonlyArray<unknown> = Array.isArray(raw) ? raw : []
      return JSON.stringify(arr.map(toDiscussionSummary), null, 2)
    }),
  )
}

/**
 * Resolve one discussion thread, then verify it actually came back resolved.
 *
 * `resolved` goes via `-F` (typed → boolean true), not `-f` (raw string).
 * The response is parsed and checked — a `glab` exit 0 that no-ops (e.g. a
 * non-resolvable discussion) must NOT report a false "resolved", or the loop
 * could declare convergence on a thread that is still open.
 */
const resolve = (mr: string, discussionId: string): Effect.Effect<string, GlabError> => {
  const args = [
    "api",
    `${discussionsEndpoint(mr)}/${discussionId}`,
    "-X",
    "PUT",
    "-F",
    "resolved=true",
  ]
  return runGlab(args).pipe(
    Effect.flatMap((out) => parseJson(out, args)),
    Effect.flatMap((raw) =>
      toDiscussionSummary(raw).resolved
        ? Effect.succeed(`resolved discussion ${discussionId}`)
        : Effect.fail(
            new GlabError({ args, detail: `discussion ${discussionId} still unresolved after PUT` }),
          ),
    ),
  )
}

/**
 * Add a note to an existing discussion thread — a *reply*, not a new
 * discussion. `evaluate` and `fix` use this to answer a finding in place;
 * `post` would instead create an orphan top-level discussion.
 */
const reply = (mr: string, discussionId: string, body: string): Effect.Effect<string, GlabError> => {
  const args = [
    "api",
    `${discussionsEndpoint(mr)}/${discussionId}/notes`,
    "-X",
    "POST",
    "-f",
    `body=${body}`,
  ]
  return runGlab(args).pipe(Effect.as(`replied on discussion ${discussionId}`))
}

// ─── CLI argument parsing ──────────────────────────────────────────────

interface Args {
  readonly command: string
  readonly mr?: string | undefined
  readonly body?: string | undefined
  readonly discussion?: string | undefined
  readonly dryRun: boolean
}

/** Parse `process.argv` into {@link Args}. Plain — the effectful work is below. */
function parseArgs(argv: ReadonlyArray<string>): Args {
  const [command = "", ...rest] = argv
  let mr: string | undefined
  let body: string | undefined
  let discussion: string | undefined
  let dryRun = false

  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i]
    if (flag === "--dry-run") {
      dryRun = true
    } else if (flag === "--mr") {
      mr = rest[++i]
    } else if (flag === "--body") {
      body = rest[++i]
    } else if (flag === "--discussion") {
      discussion = rest[++i]
    }
  }
  return { command, mr, body, discussion, dryRun }
}

/** Require a flag to be present, or fail with a {@link UsageError}. */
const require_ = (value: string | undefined, name: string): Effect.Effect<string, UsageError> =>
  value === undefined || value === ""
    ? Effect.fail(new UsageError({ message: `missing required flag --${name}` }))
    : Effect.succeed(value)

/** Require `--mr` to be a numeric MR iid — reject up front with a clear error. */
const requireMr = (value: string | undefined): Effect.Effect<string, UsageError> =>
  value !== undefined && /^\d+$/.test(value)
    ? Effect.succeed(value)
    : Effect.fail(new UsageError({ message: `--mr must be a numeric MR iid (got ${JSON.stringify(value)})` }))

// ─── Main ──────────────────────────────────────────────────────────────

const program: Effect.Effect<string, GlabError | UsageError> = Effect.gen(function* () {
  const args = parseArgs(process.argv.slice(2))

  switch (args.command) {
    case "post": {
      const mr = yield* requireMr(args.mr)
      const body = yield* require_(args.body, "body")
      return yield* post(mr, body, args.dryRun)
    }
    case "list": {
      const mr = yield* requireMr(args.mr)
      return yield* list(mr)
    }
    case "resolve": {
      const mr = yield* requireMr(args.mr)
      const discussion = yield* require_(args.discussion, "discussion")
      return yield* resolve(mr, discussion)
    }
    case "reply": {
      const mr = yield* requireMr(args.mr)
      const discussion = yield* require_(args.discussion, "discussion")
      const body = yield* require_(args.body, "body")
      return yield* reply(mr, discussion, body)
    }
    default:
      return yield* Effect.fail(
        new UsageError({
          message: `unknown subcommand ${JSON.stringify(args.command)} — expected post | list | resolve | reply`,
        }),
      )
  }
})

// Run the CLI only when this file is the entry point — importing it (e.g. the
// unit test importing `toDiscussionSummary`) must not execute `glab`.
if (import.meta.main) {
  const exit = await Effect.runPromiseExit(program)
  Exit.match(exit, {
    onSuccess: (output) => {
      console.log(output)
    },
    onFailure: (cause) => {
      console.error(Cause.pretty(cause))
      process.exit(1)
    },
  })
}
