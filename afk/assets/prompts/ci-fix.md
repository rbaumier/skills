The CI pipeline on branch `<BRANCH>` failed and `glab mr merge` was rejected. Fix it.

Workspace: `<WORKTREE>`

1. `cd "<WORKTREE>"`
2. `glab ci view --branch "<BRANCH>" --logs` (or `glab ci view <pipeline-id> --logs` for a specific job). Identify the failing job, read the actual error, name the root cause in one sentence to yourself before touching code.
3. Fix inside `<WORKTREE>` — no edits outside. Match the project's existing style. Run the relevant tests locally first if cheap.
4. Commit and push.
5. Return exactly one line: `READY_FOR_PIPELINE_POLL` on success (the orchestrator will then poll the post-fix pipeline before re-invoking `queue-merge`), or `CI_FIX_FAILED: <root cause and why it's unfixable from inside the worktree>` if the failure is structural (missing secret, infra outage, broken test that depends on production data). The success token names what the orchestrator does next rather than using a terminal word like `CI_FIXED` / `DONE` — past runs have stopped on those.

**Forbidden**: skipping the failing test, marking it `xfail`, commenting it out, or `--no-verify`-ing the push. If the test is genuinely wrong, fix the test; if the code is wrong, fix the code. Disabling the gate is not a fix.
