#!/usr/bin/env bun
/**
 * sweep-stale-claims.ts — standalone AFK crash-recovery.
 *
 * The decomposed orchestrator runs ~18 sessions per issue, so a crash mid-run
 * is more likely than before. A crashed run leaves the issue labelled
 * `picked-by-agent`, which `onFetchQueue` filters out → the issue is silently
 * stranded.
 *
 * This sweep — run on its OWN schedule (cron / launchd, ~every 3h), never by
 * the orchestrator — finds `picked-by-agent` issues idle longer than the
 * per-issue budget + margin, unlabels them (so the next run re-picks them from
 * scratch), and force-removes the orphan worktree.
 *
 * A crash is not a `failed` verdict, so re-picking does not violate the
 * orchestrator's "no retry on failure" rule.
 *
 * Usage: bun ~/.claude/skills/afk/scripts/sweep-stale-claims.ts [--dry-run]
 * Run from inside the target repo. Requires: glab (authenticated), git.
 */
import { $ } from "bun"
import { Cause, Console, Effect, Exit } from "effect"
import { type GlabError, parseJson, runGlab } from "../src/glab"
import { type ClaimedIssue, selectStale, worktreePathsForIssue } from "../src/stale"

/** Staleness threshold — 2h, safely above the 90-min per-issue budget. */
const THRESHOLD_MS = 2 * 60 * 60 * 1000

const dryRun = process.argv.slice(2).includes("--dry-run")

/** Fetch every issue currently labelled `picked-by-agent`. */
const listClaimed: Effect.Effect<ReadonlyArray<ClaimedIssue>, GlabError> = Effect.gen(function* () {
  const args = ["issue", "list", "--label", "picked-by-agent", "--output", "json", "--per-page", "100"]
  const out = yield* runGlab(args)

  let raw: unknown = []
  if (out.trim() !== "") raw = yield* parseJson(out, args)

  const arr: ReadonlyArray<unknown> = Array.isArray(raw) ? raw : []
  return arr
    .map((item) => {
      const o = item as { iid?: unknown; updated_at?: unknown }
      return { iid: Number(o.iid ?? 0), updatedAt: String(o.updated_at ?? "") }
    })
    // Drop malformed rows at the boundary — a bad iid must never reach
    // `glab issue update <iid>`.
    .filter((issue) => Number.isInteger(issue.iid) && issue.iid > 0)
})

/**
 * Force-remove the orphan worktree(s) of an issue. Best-effort — a worktree
 * that cannot be removed must not abort the recovery; the unlabel is what
 * actually re-queues the issue.
 */
const removeOrphanWorktree = (iid: number): Effect.Effect<void> =>
  Effect.promise(async () => {
    const listed = await $`git worktree list --porcelain`.nothrow().quiet()
    if (listed.exitCode !== 0) {
      console.error("    worktree cleanup skipped — `git worktree list` failed")
      return
    }
    for (const path of worktreePathsForIssue(listed.stdout.toString(), iid)) {
      const rm = await $`git worktree remove --force ${path}`.nothrow().quiet()
      if (rm.exitCode === 0) console.log(`    removed worktree ${path}`)
      else console.error(`    could not remove worktree ${path}: ${rm.stderr.toString().trim()}`)
    }
    await $`git worktree prune`.nothrow().quiet()
  })

/** Recover one crash-orphaned issue: unlabel it, then clean its worktree. */
const recoverOne = (issue: ClaimedIssue): Effect.Effect<void, GlabError> =>
  Effect.gen(function* () {
    yield* Console.log(`  recovering #${issue.iid} (idle since ${issue.updatedAt})`)
    yield* runGlab(["issue", "update", String(issue.iid), "--unlabel", "picked-by-agent"])
    yield* removeOrphanWorktree(issue.iid)
  })

const program: Effect.Effect<void, GlabError> = Effect.gen(function* () {
  const claimed = yield* listClaimed
  const stale = selectStale(claimed, Date.now(), THRESHOLD_MS)

  if (stale.length === 0) {
    yield* Console.log("No stale claims.")
    return
  }

  yield* Console.log(`${stale.length} stale claim(s)${dryRun ? " — dry-run, no changes:" : ":"}`)
  if (dryRun) {
    yield* Effect.forEach(stale, (i) => Console.log(`  #${i.iid} — idle since ${i.updatedAt}`), {
      discard: true,
    })
    return
  }

  // Recover each — one issue's failure must not abort the others.
  yield* Effect.forEach(
    stale,
    (issue) =>
      recoverOne(issue).pipe(
        Effect.catchAll((e) => Console.error(`  #${issue.iid} recovery failed: ${e.detail}`)),
      ),
    { discard: true },
  )
})

const exit = await Effect.runPromiseExit(program)
Exit.match(exit, {
  onSuccess: () => {},
  onFailure: (cause) => {
    console.error(Cause.pretty(cause))
    process.exit(1)
  },
})
