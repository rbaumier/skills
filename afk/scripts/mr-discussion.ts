#!/usr/bin/env bun
/**
 * mr-discussion.ts — a thin CLI over the GitLab MR-discussion operations.
 *
 * The phase prompts call this (`review` posts, `evaluate`/`fix` reply and
 * resolve). The logic lives in `src/gitlab/discussion-api.ts`; this file only
 * parses argv and prints the result.
 *
 *   post    --mr <iid> --body <text>
 *   list    --mr <iid>
 *   reply   --mr <iid> --discussion <id> --body <text>
 *   resolve --mr <iid> --discussion <id>
 */
import { BunRuntime } from "@effect/platform-bun"
import { Console, Data, Effect } from "effect"
import {
  listDiscussions,
  postDiscussion,
  replyToDiscussion,
  resolveDiscussion,
} from "../src/gitlab/discussion-api"

/** The CLI was invoked with a missing or malformed argument. */
class UsageError extends Data.TaggedError("UsageError")<{ readonly message: string }> {}

interface Args {
  readonly command: string
  readonly mr: string | null
  readonly body: string | null
  readonly discussion: string | null
}

/** Parse `process.argv` into {@link Args}. Plain — the effectful work is below. */
function parseArgs(argv: ReadonlyArray<string>): Args {
  const [command = "", ...rest] = argv
  let mr: string | null = null
  let body: string | null = null
  let discussion: string | null = null
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index]
    if (flag === "--mr") mr = rest[++index] ?? null
    else if (flag === "--body") body = rest[++index] ?? null
    else if (flag === "--discussion") discussion = rest[++index] ?? null
  }
  return { command, mr, body, discussion }
}

/** Require `--mr` to be a numeric MR iid. */
const requireMr = (value: string | null): Effect.Effect<number, UsageError> =>
  value !== null && /^\d+$/.test(value)
    ? Effect.succeed(Number(value))
    : Effect.fail(new UsageError({ message: `--mr must be a numeric MR iid (got ${JSON.stringify(value)})` }))

/** Require a flag to be present and non-empty. */
const requireFlag = (value: string | null, name: string): Effect.Effect<string, UsageError> =>
  value !== null && value !== ""
    ? Effect.succeed(value)
    : Effect.fail(new UsageError({ message: `missing required flag --${name}` }))

const program = Effect.gen(function* () {
  const args = parseArgs(process.argv.slice(2))
  switch (args.command) {
    case "list": {
      const mr = yield* requireMr(args.mr)
      const discussions = yield* listDiscussions(mr)
      return JSON.stringify(discussions, null, 2)
    }
    case "post": {
      const mr = yield* requireMr(args.mr)
      const body = yield* requireFlag(args.body, "body")
      yield* postDiscussion(mr, body)
      return `posted a discussion on !${mr}`
    }
    case "reply": {
      const mr = yield* requireMr(args.mr)
      const discussion = yield* requireFlag(args.discussion, "discussion")
      const body = yield* requireFlag(args.body, "body")
      yield* replyToDiscussion(mr, discussion, body)
      return `replied on discussion ${discussion}`
    }
    case "resolve": {
      const mr = yield* requireMr(args.mr)
      const discussion = yield* requireFlag(args.discussion, "discussion")
      yield* resolveDiscussion(mr, discussion)
      return `resolved discussion ${discussion}`
    }
    default:
      return yield* Effect.fail(
        new UsageError({
          message: `unknown subcommand ${JSON.stringify(args.command)} — expected post | list | resolve | reply`,
        }),
      )
  }
}).pipe(Effect.flatMap((output) => Console.log(output)))

BunRuntime.runMain(program)
