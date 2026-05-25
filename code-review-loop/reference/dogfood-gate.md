# Runtime dogfood gate — 3 personas in parallel

Runs only after **static convergence**, and only when the review object's `dogfood_required: true`. Personas test signed-off code, never intermediate fixes that get rewritten next iteration. The surfaces to exercise are in `dogfood_surfaces`.

## Spawn 3 personas in parallel (one turn, 3 Agent calls)

- **Happy-path** — `general-purpose`, **`sonnet`**. Walks the documented golden path end-to-end. Recipe execution, no creativity. Sonnet = the right cost/quality.
- **Adversarial** — `general-purpose`, **`opus`**. Hunts non-obvious failures: race conditions, refresh mid-flow, broken state machines, permission-boundary crossings, weird input combos. Creativity is the deliverable; Opus earns its cost.
- **Regression** — `general-purpose`, **`sonnet`**. Scripted checklist of behaviors that must keep working across releases. Deterministic, low ambiguity.

All 3 load the `dogfood` skill, share the verify-not-prod / dev-server / authenticate / cleanup scaffolding, and differ only in **Exercise focus** (see the persona blocks in `templates/dogfood-personas.md`). Independent dev-server instances on different ports. Only one port free → sequential Happy-path → Regression → Adversarial (Adversarial last — hardest findings, absorb the cheaper personas' findings first).

## Merging and triage (orchestrator, no fourth subagent)

All 3 return:

1. **Dedupe.** The same observable bug from 2 personas = one finding. Match by `suspected_file` + a one-line summary slug.

2. **Classify in-scope vs out-of-scope.**
   - **In-scope** — bug in a code path the diff touches, OR a bug that wouldn't reproduce on `origin/$DEFAULT_BRANCH`. Verify via `git diff --name-only origin/$DEFAULT_BRANCH...HEAD` or call-graph reasoning. **Uncertain → in-scope** (false in-scope = a cheap no-op fix attempt; false out-of-scope = ship a bug).
   - **Out-of-scope** — bug in code untouched by the diff AND reproduces on `origin/$DEFAULT_BRANCH`. File a new issue:
     ```bash
     glab issue create --label ready-for-agent \
       --title "<one-line summary>" \
       --description "Found during dogfood gate on branch <BRANCH> while validating <parent issue or feature>. Suspected file(s): <files>. Reproduces on $DEFAULT_BRANCH — not introduced by this diff. Repro: <steps>. Observed: <…>. Expected: <…>."
     ```
     Out-of-scope doesn't block convergence.
   - **Cleanup-incomplete** — a persona's final line starting `cleanup-incomplete:` is itself blocking (no process/data leak allowed). In-scope regardless of bug location.

3. **Fix in-scope, loop back.**
   - Forge a `fix_prompt` from the textual findings:
     `In {suspected_file}, {one-line summary}. Reproduce by {steps}. Expected {expected}, observed {observed}. Fix the code path so the expected behavior holds.`
   - Group by file, spawn fix agents.
   - Re-run the Step 3 gate (tests + linter, commit).
   - **Re-enter the Step 2–4 static review on the new commits.** A dogfood-driven fix introducing a Correctness/Subsystem/Skill violation is a regression. The 8-iter static cap applies — don't reset it for dogfood-triggered re-review.
   - Once static re-converges, **re-run the full dogfood gate** (3 personas from scratch — no previous findings injected, per the Step 4 rule).

4. **File out-of-scope and move on.** They land in the queue for AFK or human triage. Not your problem for this branch.

## Convergence

All 3 personas return exactly `No findings.` (or only out-of-scope, filed) AND every persona's final line is `cleanup-complete:`.

## When to bail (orchestrator judgment, no fixed cap)

Loops that look like convergence but aren't = how overnight runs burn hours producing nothing. Bail into the non-convergence failure family on any signal:

| Signal | Why "not converging" |
|---|---|
| Same finding (matched on `suspected_file` + summary slug) reappears unchanged after a fix attempt — survives a full loop through static + dogfood | Fix didn't fix. 2nd occurrence = stop. |
| Round N+1 produces a NEW finding whose cited line is inside round N's fix commit | Fixes introducing regressions faster than they resolve. |
| Round N has ≥ in-scope count vs N-1, twice consecutively | Regressing on count. |
| Static hits the 8-iter cap while fixing dogfood findings | Already `failed-by-agent` from static — propagate. |

Bail → finalize as `failed-by-agent` (family: non-convergence) with the last 3 rounds of merged findings + the bail signal + diff stats.

In-scope bugs are fixed; out-of-scope bugs become new issues. The only `failed-by-agent` from this phase = non-convergence or static-cap propagation.
