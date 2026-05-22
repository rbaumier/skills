#!/usr/bin/env bun
/**
 * Main.ts — the AFK orchestrator entry point.
 *
 * The orchestrator is a deterministic state machine. It drives
 * Claude Code through a project's GitLab issue queue, one
 * issue at a time. Each phase runs as a fresh `claude`
 * session in its own tmux window.
 *
 * `BunRuntime.runMain` is the signal-aware runtime. On Ctrl-C
 * it interrupts the fiber so every finalizer runs before exit.
 *
 * Usage: `bun ~/.claude/skills/afk/src/main.ts`.
 */
import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runMachine } from "./pipeline/machine";
import { preflight } from "./preflight";

const program = preflight.pipe(Effect.flatMap((env) => runMachine(env)));

BunRuntime.runMain(program);
