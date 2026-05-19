The CI pipeline on branch `<BRANCH>` failed and `glab mr merge` was rejected. Fix it.

Workspace: `<WORKTREE>`

1. `cd "<WORKTREE>"`
2. `glab ci view --branch "<BRANCH>" --logs` (or `glab ci view <pipeline-id> --logs` for a specific job). Identify the failing job, read the actual error, name the root cause in one sentence to yourself before touching code.
3. Fix inside `<WORKTREE>` — no edits outside. Match the project's existing style. Run the relevant tests locally first if cheap.
4. Commit and push.
5. Return exactly one line: `CI_FIXED` on success, or `CI_FIX_FAILED: <root cause and why it's unfixable from inside the worktree>` if the failure is structural (missing secret, infra outage, broken test that depends on production data).

**Forbidden**: skipping the failing test, marking it `xfail`, commenting it out, or `--no-verify`-ing the push. If the test is genuinely wrong, fix the test; if the code is wrong, fix the code. Disabling the gate is not a fix.
