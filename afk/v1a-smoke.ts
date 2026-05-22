#!/usr/bin/env bun
/**
 * V1a smoke test — verifies that every glab subcommand and flag the orchestrator
 * relies on actually exists on the user's installed glab version.
 *
 * Read-only: never creates MRs, never modifies issues. Probes --help only.
 *
 * Usage: bun ~/.claude/skills/afk/v1a-smoke.ts.
 */
import { $ } from "bun";

type Check = { name: string; cmd: string[]; mustContain: string[] };

const checks: Check[] = [
  {
    name: "glab --version",
    cmd: ["--version"],
    mustContain: ["glab"],
  },
  {
    name: "issue list (fetch_queue / sweep)",
    cmd: ["issue", "list", "--help"],
    mustContain: ["--label", "--not-label", "--per-page", "--output"],
  },
  {
    name: "issue update (claim / unclaim / fail-label)",
    cmd: ["issue", "update", "--help"],
    mustContain: ["--label", "--unlabel"],
  },
  {
    name: "issue create (out-of-scope discoveries)",
    cmd: ["issue", "create", "--help"],
    mustContain: ["--label", "--title", "--description"],
  },
  {
    name: "issue note (failed-issue comment)",
    cmd: ["issue", "note", "--help"],
    mustContain: ["--message"],
  },
  {
    name: "mr list (idempotent open_draft_mr check)",
    cmd: ["mr", "list", "--help"],
    mustContain: ["--source-branch", "--output"],
  },
  {
    name: "mr create — draft + cleanup flags (open_draft_mr)",
    cmd: ["mr", "create", "--help"],
    mustContain: [
      "--draft",
      "--source-branch",
      "--target-branch",
      "--title",
      "--description",
      "--remove-source-branch",
      "--squash-before-merge",
    ],
  },
  {
    name: "mr update — --ready (un-draft in merge)",
    cmd: ["mr", "update", "--help"],
    mustContain: ["--ready"],
  },
  {
    name: "mr merge (merge)",
    cmd: ["mr", "merge", "--help"],
    mustContain: ["--squash", "--auto-merge", "--yes"],
  },
  {
    name: "mr view --output json (merge status verify)",
    cmd: ["mr", "view", "--help"],
    mustContain: ["--output"],
  },
  {
    name: "api — discussions endpoint (mr-discussion.ts)",
    cmd: ["api", "--help"],
    mustContain: ["--paginate", "--method", "--field", "--raw-field"],
  },
];

// Live calls (safe: read-only, no project mutations)
type LiveCheck = { name: string; cmd: string[] };
const liveChecks: LiveCheck[] = [
  {
    name: "glab auth status",
    cmd: ["auth", "status"],
  },
  {
    name: "glab repo view (current repo recognized)",
    cmd: ["repo", "view"],
  },
];

console.log("V1a smoke test — checking glab subcommands + flags\n");

type Result = { ok: true } | { ok: false; label: string };

/** Check whether `output` contains `flag`. Extracted to avoid closures inside loops. */
const outputContainsFlag = (output: string, flag: string): boolean => output.includes(flag);

/** Run a single help-based check and log the result. */
async function runCheck(check: Check): Promise<Result> {
  const result = await $`glab ${check.cmd}`.nothrow().quiet();
  if (result.exitCode !== 0) {
    console.log(`✗ ${check.name}`);
    console.log(`    glab ${check.cmd.join(" ")} exited ${result.exitCode}`);
    console.log(`    stderr: ${result.stderr.toString().trim().slice(0, 200)}`);
    return { ok: false, label: check.name };
  }
  const output = result.stdout.toString() + result.stderr.toString();
  const missing = check.mustContain.filter((flag) => !outputContainsFlag(output, flag));
  if (missing.length > 0) {
    console.log(`✗ ${check.name}`);
    console.log(`    missing flags: ${missing.join(", ")}`);
    return { ok: false, label: `${check.name} (missing: ${missing.join(", ")})` };
  }
  console.log(`✓ ${check.name}`);
  return { ok: true };
}

/** Run a single live check and log the result. */
async function runLiveCheck(check: LiveCheck): Promise<Result> {
  const result = await $`glab ${check.cmd}`.nothrow().quiet();
  if (result.exitCode === 0) {
    console.log(`✓ ${check.name}`);
    return { ok: true };
  }
  console.log(`✗ ${check.name}`);
  console.log(`    stderr: ${result.stderr.toString().trim().slice(0, 200)}`);
  return { ok: false, label: check.name };
}

const HELP_RESULTS: Result[] = [];
for (const check of checks) {
  HELP_RESULTS.push(await runCheck(check));
}

console.log("\nLive calls (read-only):");

const LIVE_RESULTS: Result[] = [];
for (const check of liveChecks) {
  LIVE_RESULTS.push(await runLiveCheck(check));
}

const ALL_RESULTS = [...HELP_RESULTS, ...LIVE_RESULTS];
const PASS_COUNT = ALL_RESULTS.filter((entry) => entry.ok).length;
const FAILURES = ALL_RESULTS.filter((entry): entry is { ok: false; label: string } => !entry.ok);

const FAIL_COUNT = FAILURES.length;
console.log(`\n${PASS_COUNT} passed, ${FAIL_COUNT} failed`);
if (FAIL_COUNT > 0) {
  console.log("\nFailures:");
  for (const failure of FAILURES) {
    console.log(`  • ${failure.label}`);
  }
  console.log("\nFix the orchestrator's glab calls (or upgrade glab) before V1b.");
  process.exit(1);
}
console.log("\nAll glab calls validated. Ready for V1b.");
