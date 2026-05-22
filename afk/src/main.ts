#!/usr/bin/env bun
/**
 * main.ts — the AFK orchestrator entry point.
 *
 * The orchestrator is a deterministic state machine that drives Claude Code
 * through a project's GitLab issue queue, one issue at a time. Each phase of
 * work runs as a fresh, single-purpose `claude` session in its own tmux
 * window; cross-session review state lives on the GitLab merge request.
 *
 *   preflight → fetch_queue → claim_issue → branch_worktree → run_impl
 *     → open_draft_mr → review ⇄ evaluate → fix → … → run_dogfood → merge
 *     → done → (next issue) … → end
 *
 * `BunRuntime.runMain` is the signal-aware runtime: on Ctrl-C it interrupts
 * the fiber so every `acquireUseRelease` finalizer (the tmux kills) runs
 * before exit, and it reports a fatal cause and sets the exit code.
 *
 * Usage: bun ~/.claude/skills/afk/src/main.ts   (run from inside the repo)
 */
import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runMachine } from "./pipeline/machine";
import { preflight } from "./preflight";

const program = preflight.pipe(Effect.flatMap(runMachine));

BunRuntime.runMain(program);
